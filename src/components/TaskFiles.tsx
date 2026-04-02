import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Trash2, FileText, Image, Archive, Film, Music, Code, File, Download, Loader2 } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface TaskFile {
  id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  uploader_name?: string;
}

interface TaskFilesProps {
  taskId: string;
  caseId: string;
  isClosed: boolean;
  onCountChange?: (count: number) => void;
}

const FILE_ICON_MAP: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'text/plain': FileText,
  'text/csv': FileText,
  'image/': Image,
  'video/': Film,
  'audio/': Music,
  'application/zip': Archive,
  'application/x-rar': Archive,
  'application/x-7z': Archive,
  'application/gzip': Archive,
  'text/html': Code,
  'application/json': Code,
  'text/javascript': Code,
  'application/xml': Code,
};

function getFileIcon(contentType: string) {
  for (const [key, icon] of Object.entries(FILE_ICON_MAP)) {
    if (contentType.startsWith(key)) return icon;
  }
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function TaskFiles({ taskId, caseId, isClosed, onCountChange }: TaskFilesProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [taskId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/files/task/${taskId}`);
      setFiles(data);
      onCountChange?.(data.length);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    if (!user) return;
    setUploadError(null);
    setUploading(true);

    const filesToUpload = Array.from(fileList);

    await Promise.all(
      filesToUpload.map(file => {
        const formData = new FormData();
        formData.append('caseId', caseId);
        formData.append('taskId', taskId);
        formData.append('file', file);

        return api.post('/files/upload', formData).catch(err => {
          console.error('Erreur upload:', err);
          setUploadError(`Erreur lors de l'envoi de ${file.name}`);
        });
      })
    );

    setUploading(false);
    fetchFiles();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isClosed) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDownload = async (file: TaskFile) => {
    setDownloadingId(file.id);
    try {
      const token = localStorage.getItem('token');
      const url = `${import.meta.env.VITE_API_URL}/api/files/download?storagePath=${encodeURIComponent(file.storage_path)}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const tempUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = tempUrl;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(tempUrl);
    } catch (err) {
      console.error('Erreur download:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (file: TaskFile) => {
    if (!confirm(`Supprimer le fichier "${file.file_name}" ?`)) return;
    setDeletingId(file.id);

    try {
      await api.delete(`/files/${file.id}`);
      setFiles(prev => {
        const updated = prev.filter(f => f.id !== file.id);
        onCountChange?.(updated.length);
        return updated;
      });
    } catch (err) {
      console.error('Erreur suppression:', err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div>
      {!isClosed && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer mb-4 ${dragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
            : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50'
            }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-slate-300">{t('auto.envoi_en_cours')}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-500 dark:text-slate-400" />
              <span className="text-sm text-gray-600 dark:text-slate-300">
                {t('auto.glissez_vos_fichiers_ici_ou_cl')}</span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {t('auto.tous_types_de_fichiers_accepte')}</span>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
          {t('auto.aucun_fichier_attache')}</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = getFileIcon(file.content_type);
            const isDeleting = deletingId === file.id;
            const isDownloading = downloadingId === file.id;
            const canDelete = !isClosed && file.uploaded_by === user?.id;

            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg group"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {file.file_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>-</span>
                    <span>{file.uploader_name || 'Inconnu'}</span>
                    <span>-</span>
                    <span>
                      {new Date(file.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={isDownloading}
                    className="p-2 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition disabled:opacity-50"
                    title={t('auto.telecharger')}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={isDeleting}
                      className="p-2 text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                      title={t('auto.supprimer')}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
