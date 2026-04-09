import { useState, useEffect } from 'react';
import { sanitizeHtml } from '../lib/sanitize';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Send, Edit, Trash2, X, Paperclip, Download, FileText, Image as ImageIcon, Reply, Plus, Clock, Diamond, CheckCircle2, AlertTriangle } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { OffCanvas } from './common/OffCanvas';
import { useTranslation } from "react-i18next";
import { getKillChainPhases } from '../lib/killChainDefinitions';
import { getDiamondCompleteness } from './tasks/TaskDiamondEvents';
import { useSearchParams } from 'react-router-dom';
import { useRef } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { UserAvatar } from './UserAvatar';
interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  storage_path: string;
}

interface CommentHistoryEntry {
  content: string;
  edited_at: string;
  edited_by: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_id: string | null;
  author: {
    full_name: string;
    avatar_url?: string;
  };
  attachments?: Attachment[];
  is_deleted?: number;
  is_edited?: number;
  edit_history?: CommentHistoryEntry[];
}

interface TaskCommentsProps {
  taskId: string;
  isClosed: boolean;
  caseAuthorId: string | null;
  onCountChange?: (count: number) => void;
  isReadOnly?: boolean;
  taskDiamonds?: any[];
  caseKillChainType?: string | null;
  canEditDiamond?: boolean;
  onAddDiamond?: () => void;
  onEditDiamond?: (d: any) => void;
  onDeleteDiamond?: (id: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

export function TaskComments({ 
  taskId, isClosed, caseAuthorId, onCountChange, isReadOnly,
  taskDiamonds = [], caseKillChainType = null, canEditDiamond = false,
  onAddDiamond, onEditDiamond, onDeleteDiamond
}: TaskCommentsProps) {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();
  const isOnline = useOnlineStatus();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [searchParams] = useSearchParams();
  const targetCommentId = searchParams.get('target');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [allowCommentEditing, setAllowCommentEditing] = useState(true);
  const [allowCommentDeletion, setAllowCommentDeletion] = useState(true);
  const [revealedComments, setRevealedComments] = useState<Set<string>>(new Set());
  const [historyComment, setHistoryComment] = useState<Comment | null>(null);

  const toggleReveal = (id: string) => {
    setRevealedComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchComments();
    fetchConfig();
  }, [taskId]);

  const fetchConfig = async () => {
    try {
      const data = await api.get('/config');
      if (data) {
        if (data.allow_comment_editing !== undefined) setAllowCommentEditing(data.allow_comment_editing !== 'false');
        if (data.allow_comment_deletion !== undefined) setAllowCommentDeletion(data.allow_comment_deletion !== 'false');
      }
    } catch (err) {
      console.error('Erreur config:', err);
    }
  };

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
    if ((isCommentEmpty(newComment) && selectedFiles.length === 0 && !editingComment) || !user) return;

    setPosting(true);
    try {
      if (editingComment) {
        await api.put(`/comments/${editingComment.id}`, { content: newComment });
      } else {
        const formData = new FormData();
        formData.append('task_id', taskId);
        formData.append('content', newComment || '<p></p>');
        if (replyingTo) formData.append('parent_id', replyingTo.id);
        selectedFiles.forEach(f => formData.append('files', f));

        await api.post('/comments', formData);
      }
      setNewComment('');
      setSelectedFiles([]);
      setReplyingTo(null);
      setEditingComment(null);
      setIsFormOpen(false);
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
    setEditingComment(comment);
    setNewComment(comment.content);
    setReplyingTo(null);
    setIsFormOpen(true);
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

  const unifiedTimeline = [...rootComments, ...taskDiamonds].sort((a: any, b: any) => {
    const dateA = new Date(a.created_at || a.first_observed || a.created || 0).getTime();
    const dateB = new Date(b.created_at || b.first_observed || b.created || 0).getTime();
    return dateA - dateB;
  });

  const renderComment = (comment: Comment, isReply = false) => {
    if (comment.is_deleted && !revealedComments.has(comment.id)) {
      return (
        <div
          key={comment.id}
          id={`comment-${comment.id}`}
          className={`flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 py-1.5 px-3 rounded-lg transition-all duration-500 ${isReply ? 'ml-6 border-l-2 !border-gray-200 dark:!border-slate-700' : ''}`}
        >
          <Trash2 className="w-3.5 h-3.5 opacity-40 -mt-0.5 flex-shrink-0" />
          <span className="italic flex-grow">{t('auto.commentaire_supprime') || 'Ce commentaire a été supprimé.'}</span>
          <button onClick={() => toggleReveal(comment.id)} className="hover:underline opacity-80 hover:opacity-100 text-blue-500 transition-colors">
            {t('auto.voir_quand_meme') || '(voir quand même)'}
          </button>
        </div>
      );
    }

    return (
      <div
        key={comment.id}
        id={`comment-${comment.id}`}
        className={`rounded-lg p-3 transition-all duration-500 ${isReply ? 'ml-6 border-l-2 border-blue-200 dark:border-blue-800' : ''} ${comment.id === targetCommentId
          ? 'bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500/50'
          : 'bg-gray-50 dark:bg-slate-800'
          }`}
      >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <UserAvatar name={comment.author.full_name} avatarUrl={comment.author.avatar_url} size="sm" />
          <span className="text-sm font-medium text-gray-800 dark:text-white">{comment.author.full_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {new Date(comment.created_at).toLocaleString('fr-FR')}
            {comment.is_edited === 1 && !comment.is_deleted && (
              <span className="inline-flex items-center gap-1">
                <span className="italic ml-1 opacity-70">({t('auto.modifie') || 'modifié'})</span>
                {comment.edit_history && comment.edit_history.length > 0 && (
                  <button onClick={() => setHistoryComment(comment)} className="text-blue-500 hover:text-blue-600 text-xs hover:underline ml-1">
                    {t('auto.historique_lien') || '(historique)'}
                  </button>
                )}
              </span>
            )}
          </span>
          {!comment.is_deleted && !isReadOnly && (canEditComment(comment) || canDeleteComment(comment) || !isClosed) && (
            <div className="flex gap-1">
              {!isClosed && !isReply && (
                <button
                  onClick={() => {
                    setReplyingTo(comment);
                    setIsFormOpen(true);
                  }}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                  title="Répondre"
                >
                  <Reply className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                </button>
              )}
              {canEditComment(comment) && allowCommentEditing && (
                <button
                  onClick={() => handleEdit(comment)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition"
                  title={t('auto.modifier')}
                >
                  <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </button>
              )}
              {canDeleteComment(comment) && allowCommentDeletion && (
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
      <div className={comment.is_deleted ? "border-2 border-red-200 dark:border-red-900/50 rounded-lg p-2 bg-red-50/30 dark:bg-red-900/10 mt-2" : ""}>
          {comment.is_deleted && (
             <div className="flex justify-between items-center mb-3 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-xs font-semibold rounded-md border border-red-200 dark:border-red-800">
               <span>{t('auto.commentaire_marque_supprime') || '[Ce commentaire a été marqué comme supprimé]'}</span>
               <button onClick={() => toggleReveal(comment.id)} className="hover:underline flex items-center gap-1 opacity-80 hover:opacity-100">
                 <X className="w-3 h-3" /> {t('auto.masquer') || 'Masquer'}
               </button>
             </div>
          )}
          <div
            className={`text-sm text-gray-700 dark:text-slate-300 rich-text-content ${comment.is_deleted ? 'opacity-80' : ''}`}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.content) }}
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
                      <div className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(att.file_size)}</div>
                    </div>
                    <Download className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  </a>
                )
              ))}
            </div>
          )}
        </div>
    </div>
  );
};

  return (
    <div className="space-y-3">
      {unifiedTimeline.length === 0 && childComments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('auto.aucun_commentaire')}</p>
      ) : (
        <div ref={scrollContainerRef} className="space-y-3 pr-1">
          {unifiedTimeline.map((item: any) => {
            if (item.type === 'observed-data') {
               const d = item;
               const phases = getKillChainPhases(caseKillChainType || 'lockheed-martin');
               const phase = phases.find(p => p.value === d.x_oris_kill_chain);
               const { complete, missing } = getDiamondCompleteness(d);
               return (
                  <div key={d.id} className="flex items-center justify-between py-2 px-3 bg-transparent border border-dashed border-cyan-200 dark:border-cyan-800/50 rounded-lg transition-colors group">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Diamond className="w-4 h-4 text-cyan-500 dark:text-cyan-600 flex-shrink-0" />
                      <span className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        Diamant d'investigation : <span className="font-semibold text-gray-700 dark:text-slate-300">{d.x_oris_description || d.name}</span>
                      </span>
                      {phase && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 border" style={{ backgroundColor: `${phase.hexColor}10`, color: phase.hexColor, borderColor: `${phase.hexColor}30` }}>
                          {phase.label}
                        </span>
                      )}
                      {complete ? (
                        <span title="Complet" className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500/80 flex-shrink-0" /></span>
                      ) : (
                        <span title={`Incomplet (${missing.length})`} className="flex items-center"><AlertTriangle className="w-3.5 h-3.5 text-amber-500/80 flex-shrink-0" /></span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {d.first_observed || d.created ? new Date(d.first_observed || d.created).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                      {canEditDiamond && !isReadOnly && (
                        <div className="flex gap-1.5 text-gray-400">
                          <button onClick={() => onEditDiamond?.(d)} className="hover:text-blue-600 transition" title={t('auto.modifier', 'Modifier')}>
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDeleteDiamond?.(d.id)} className="hover:text-red-600 transition" title={t('auto.supprimer', 'Supprimer')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
               );
            }

            return (
              <div key={item.id}>
                {renderComment(item)}
                {getReplies(item.id).length > 0 && (
                  <div className="space-y-2 mt-2">
                    {getReplies(item.id).map((reply: any) => renderComment(reply, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isClosed && !isReadOnly && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40 items-end">
          {onAddDiamond && canEditDiamond && (
            <button
              onClick={onAddDiamond}
              className="group flex flex-row-reverse items-center justify-start h-14 bg-cyan-600 text-white rounded-full shadow-lg hover:shadow-cyan-500/50 hover:bg-cyan-700 focus:outline-none transition-all duration-300"
            >
              <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
                <Diamond className="w-6 h-6" />
              </div>
              <div className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[250px] transition-all duration-300 ease-in-out font-medium">
                <span className="pl-6 pr-2 block">Ajouter un diamant</span>
              </div>
            </button>
          )}
          <button
            onClick={() => {
              setReplyingTo(null);
              setIsFormOpen(true);
            }}
            className="group flex flex-row-reverse items-center justify-start h-14 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-blue-500/50 hover:bg-blue-700 focus:outline-none transition-all duration-300"
          >
            <div className="w-14 h-14 flex items-center justify-center flex-shrink-0">
              <Plus className="w-6 h-6" />
            </div>
            <div className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[250px] transition-all duration-300 ease-in-out font-medium">
              <span className="pl-6 pr-2 block">Ajouter un commentaire</span>
            </div>
          </button>
        </div>
      )}

      {/* Formulaire Modal OffCanvas */}
      <OffCanvas
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setReplyingTo(null);
          setEditingComment(null);
          setNewComment('');
          setSelectedFiles([]);
        }}
        title={editingComment ? "Modifier le commentaire" : replyingTo ? "Répondre au commentaire" : "Nouveau commentaire"}
        width="md"
      >
        <div className="p-6">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 shadow-inner rounded-lg text-sm border border-blue-100 dark:border-blue-800/50">
              <Reply className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-blue-700 dark:text-blue-300">En réponse à <strong>{replyingTo.author.full_name}</strong></span>
              <button 
                onClick={() => setReplyingTo(null)} 
                className="ml-auto p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition"
                title="Annuler la réponse"
              >
                <X className="w-3.5 h-3.5 text-blue-500" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Contenu du commentaire
              </label>
              <RichTextEditor
                value={newComment}
                onChange={setNewComment}
                placeholder={isOnline ? t('auto.ajouter_un_commentaire') : 'Hors ligne — modifications désactivées'}
                disabled={posting || !isOnline}
              />
            </div>

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
                    <span className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(file.size)}</span>
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

            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-1">
                {!editingComment && (
                  <>
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
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 flex items-center gap-2 border border-gray-200 dark:border-slate-700"
                      title="Joindre un fichier"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span className="text-sm font-medium">Joindre...</span>
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setReplyingTo(null);
                    setEditingComment(null);
                    setNewComment('');
                    setSelectedFiles([]);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300 text-sm font-medium"
                >
                  {t('auto.annuler')}
                </button>
                <button
                  type="submit"
                  disabled={!isOnline || posting || (isCommentEmpty(newComment) && selectedFiles.length === 0)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {posting ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </OffCanvas>

      {/* Historique Modal OffCanvas */}
      <OffCanvas
        isOpen={!!historyComment}
        onClose={() => setHistoryComment(null)}
        title="Historique des modifications"
        width="md"
      >
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg border border-blue-100 dark:border-blue-800/50 mb-6 flex gap-3 text-sm">
            <div className="text-blue-600 dark:text-blue-400 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-gray-700 dark:text-slate-300">
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Historique des modifications</p>
              Les versions précédentes de ce commentaire sont affichées de la plus récente à la plus ancienne.
            </div>
          </div>
          
          {historyComment?.edit_history?.map((entry, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm relative">
              <div className="absolute top-0 right-0 p-2 text-xs font-mono text-gray-400 dark:text-slate-500 border-l border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-bl-lg rounded-tr-xl">
                 V{(historyComment.edit_history?.length || 0) - idx}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-3 pb-3 border-b border-gray-100 dark:border-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-600"></span>
                Modifié le <span className="font-medium text-gray-700 dark:text-slate-300">{new Date(entry.edited_at).toLocaleString('fr-FR')}</span>
              </div>
              <div
                className="text-sm text-gray-600 dark:text-slate-400 rich-text-content opacity-90 line-through-variants overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.content) }}
              />
            </div>
          ))}
          {(!historyComment?.edit_history || historyComment.edit_history.length === 0) && (
            <div className="text-center p-8 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
               <p className="text-sm text-gray-500 dark:text-slate-400">Aucun historique disponible pour ce commentaire.</p>
            </div>
          )}
        </div>
      </OffCanvas>

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
