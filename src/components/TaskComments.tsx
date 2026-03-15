import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Send, Edit, Trash2, X, Check, Paperclip, Download, FileText, Image as ImageIcon, Reply, Clock } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { useTranslation } from "react-i18next";
import { useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  storage_path: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  author: {
    full_name: string;
  };
  attachments?: Attachment[];
}

interface TaskCommentsProps {
  taskId: string;
  isClosed: boolean;
  caseAuthorId: string | null;
  onCountChange?: (count: number) => void;
  onNewEvent?: () => void;
  isReadOnly?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

export function TaskComments({ taskId, isClosed, caseAuthorId, onCountChange, onNewEvent, isReadOnly }: TaskCommentsProps) {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const isOnline = useOnlineStatus();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchParams] = useSearchParams();
  const targetCommentId = searchParams.get('target');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  useEffect(() => {
    fetchComments();
  }, [taskId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/comments/by-task/${taskId}`);
      const list = data as Comment[] || [];
      setComments(list);
      onCountChange?.(list.length);

      // Handle scrolling to target after comments are loaded
      if (targetCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`comment-${targetCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  const isCommentEmpty = (content: string): boolean => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim().length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((isCommentEmpty(newComment) && selectedFiles.length === 0) || !user) return;

    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('task_id', taskId);
      formData.append('content', newComment || '<p></p>');
      if (replyingTo) formData.append('parent_id', replyingTo.id);
      selectedFiles.forEach(f => formData.append('files', f));

      await api.post('/comments', formData);
      setNewComment('');
      setSelectedFiles([]);
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error('Erreur:', error);
    }
    setPosting(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (isCommentEmpty(editContent)) return;

    try {
      await api.put(`/comments/${commentId}`, { content: editContent });
      setEditingCommentId(null);
      setEditContent('');
      fetchComments();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) return;

    try {
      await api.delete(`/comments/${commentId}`);
      fetchComments();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const canEditComment = (comment: Comment): boolean => {
    return user?.id === comment.author_id && !isClosed;
  };

  const canDeleteComment = (comment: Comment): boolean => {
    if (isClosed) return false;
    return (
      user?.id === comment.author_id ||
      user?.id === caseAuthorId ||
      hasAnyRole(['team_leader', 'admin'])
    );
  };

  const getDownloadUrl = (storagePath: string) => {
    const token = localStorage.getItem('oris_token');
    return `${API_URL}/files/download?storagePath=${encodeURIComponent(storagePath)}&token=${token}`;
  };

  const isImage = (contentType: string) => contentType.startsWith('image/');

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-slate-400">{t('auto.chargement_des_commentaires')}</div>;
  }

  // Organize comments into threads
  const rootComments = comments.filter(c => !c.parent_id);
  const childComments = comments.filter(c => c.parent_id);
  const getReplies = (parentId: string) => childComments.filter(c => c.parent_id === parentId);

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      id={`comment-${comment.id}`}
      className={`rounded-lg p-3 transition-all duration-500 ${isReply ? 'ml-6 border-l-2 border-blue-200 dark:border-blue-800' : ''} ${comment.id === targetCommentId
        ? 'bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500/50'
        : 'bg-gray-50 dark:bg-slate-800'
        }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-800 dark:text-white">{comment.author.full_name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {new Date(comment.created_at).toLocaleString('fr-FR')}
          </span>
          {!isReadOnly && (canEditComment(comment) || canDeleteComment(comment) || !isClosed) && editingCommentId !== comment.id && (
            <div className="flex gap-1">
              {!isClosed && !isReply && (
                <button
                  onClick={() => setReplyingTo(comment)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                  title="Répondre"
                >
                  <Reply className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                </button>
              )}
              {canEditComment(comment) && (
                <button
                  onClick={() => handleEdit(comment)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                  title={t('auto.modifier')}
                >
                  <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </button>
              )}
              {canDeleteComment(comment) && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                  title={t('auto.supprimer')}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {editingCommentId === comment.id ? (
        <div className="space-y-2">
          <RichTextEditor
            value={editContent}
            onChange={setEditContent}
            placeholder={t('auto.modifier_le_commentaire')}
            disabled={false}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition flex items-center gap-1 dark:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
              {t('auto.annuler')}</button>
            <button
              onClick={() => handleSaveEdit(comment.id)}
              disabled={isCommentEmpty(editContent)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {t('auto.enregistrer')}</button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="text-sm text-gray-700 dark:text-slate-300 rich-text-content"
            dangerouslySetInnerHTML={{ __html: comment.content }}
          />
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {comment.attachments.map(att => (
                isImage(att.content_type) ? (
                  <button
                    key={att.id}
                    onClick={() => setLightboxSrc(getDownloadUrl(att.storage_path))}
                    className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 hover:ring-2 hover:ring-blue-400 transition"
                  >
                    <img
                      src={getDownloadUrl(att.storage_path)}
                      alt={att.file_name}
                      className="h-20 w-auto max-w-[160px] object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                  </button>
                ) : (
                  <a
                    key={att.id}
                    href={getDownloadUrl(att.storage_path)}
                    download={att.file_name}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition text-sm"
                  >
                    <FileText className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-gray-700 dark:text-slate-300 truncate max-w-[150px]">{att.file_name}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(att.file_size)}</div>
                    </div>
                    <Download className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  </a>
                )
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('auto.aucun_commentaire')}</p>
      ) : (
        <div ref={scrollContainerRef} className="space-y-3 pr-1">
          {rootComments.map((comment) => (
            <div key={comment.id}>
              {renderComment(comment)}
              {getReplies(comment.id).length > 0 && (
                <div className="space-y-2 mt-2">
                  {getReplies(comment.id).map(reply => renderComment(reply, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isClosed && !isReadOnly && (
        <div className="border-t dark:border-slate-700 pt-3">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              <Reply className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-blue-700 dark:text-blue-300">Réponse à <strong>{replyingTo.author.full_name}</strong></span>
              <button onClick={() => setReplyingTo(null)} className="ml-auto p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded">
                <X className="w-3.5 h-3.5 text-blue-500" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <RichTextEditor
              value={newComment}
              onChange={setNewComment}
              placeholder={isOnline ? t('auto.ajouter_un_commentaire') : 'Hors ligne — modifications désactivées'}
              disabled={posting || !isOnline}
            />

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="relative group flex items-center gap-2 bg-gray-100 dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                    )}
                    <span className="text-gray-700 dark:text-slate-300 max-w-[120px] truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition"
                    >
                      <X className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="*/*"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                  title="Joindre un fichier"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                {onNewEvent && (
                  <button
                    type="button"
                    onClick={onNewEvent}
                    className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Nouveau fait marquant"
                  >
                    <Clock className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!isOnline || posting || (isCommentEmpty(newComment) && selectedFiles.length === 0)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {posting ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={lightboxSrc}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
