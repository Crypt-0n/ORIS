import { useState } from 'react';
import { api } from '../lib/api';
import { X, Lock, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { useTranslation } from "react-i18next";

interface CloseTaskProps {
  taskId: string;
  initialComment?: string;
  stixObjects?: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function CloseTask({ taskId, initialComment = '', stixObjects = [], onClose, onSuccess }: CloseTaskProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(initialComment);
  const [objectStatuses, setObjectStatuses] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (stixObjects.some(obj => !objectStatuses[obj.id])) {
      setError("Vous devez sélectionner un statut pour tous les éléments techniques de cette tâche.");
      return;
    }

    setError('');
    setClosing(true);

    try {
      await api.post(`/tasks/${taskId}/close`, {
        closure_comment: comment.trim()
      });

      // Update STIX Objects categorisation
      if (stixObjects && stixObjects.length > 0) {
        const categoriesToRemove = ['sain', 'clean', 'benign', 'false-positive', 'compromis', 'compromised', 'malveillant', 'malicious-activity'];
        for (const obj of stixObjects) {
            const finalStatus = objectStatuses[obj.id];
            if (finalStatus) {
                const currentLabels = obj.labels || [];
                const newLabels = currentLabels.filter((l: string) => !categoriesToRemove.includes(l.toLowerCase()));
                newLabels.push(finalStatus);
                await api.put(`/investigation/stix/${obj.id}`, { labels: newLabels });
            }
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la fermeture');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-lg max-w-2xl w-full p-4 sm:p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto shadow dark:shadow-slate-800/50">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Lock className="w-6 h-6 text-red-600" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('auto.fermer_la_tache')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <strong>{t('auto.attention')}</strong> {t('auto.la_tache_passera_en_lecture_se')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {stixObjects && stixObjects.length > 0 && (
            <div className="mb-6 space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Catégorisation des éléments techniques *
              </label>
              <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-3 max-h-[40vh] overflow-y-auto">
                {stixObjects.map(obj => {
                    const currentStatus = objectStatuses[obj.id] || '';
                    const label = obj.name || obj.value || obj.user_id || 'Inconnu';
                    return (
                        <div key={obj.id} className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-600 rounded-lg shadow-sm">
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate" title={label}>{label}</p>
                                <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">{obj.type}</p>
                            </div>
                            <div className="flex flex-wrap bg-gray-100 dark:bg-slate-900 rounded-lg p-1 gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setObjectStatuses(prev => ({...prev, [obj.id]: 'benign'}))}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1 ${currentStatus === 'benign' ? 'bg-green-100/80 text-green-700 dark:bg-green-900/40 dark:text-green-400 shadow-sm border border-green-200 dark:border-green-800' : 'text-gray-600 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800 border border-transparent'}`}
                                >
                                    <ShieldCheck className="w-3.5 h-3.5" /> Sain
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setObjectStatuses(prev => ({...prev, [obj.id]: 'compromised'}))}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1 ${currentStatus === 'compromised' ? 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-800' : 'text-gray-600 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800 border border-transparent'}`}
                                >
                                    <ShieldAlert className="w-3.5 h-3.5" /> Compromis
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setObjectStatuses(prev => ({...prev, [obj.id]: 'malicious-activity'}))}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition flex items-center gap-1 ${currentStatus === 'malicious-activity' ? 'bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-400 shadow-sm border border-red-200 dark:border-red-800' : 'text-gray-600 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-800 border border-transparent'}`}
                                >
                                    <ShieldX className="w-3.5 h-3.5" /> Malveillant
                                </button>
                            </div>
                        </div>
                    );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              {t('auto.commentaire_de_fermeture')}</label>
            <RichTextEditor
              value={comment}
              onChange={setComment}
              placeholder={t('auto.redigez_un_bilan_de_la_tache_r')}
            />
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {t('auto.ce_commentaire_sera_visible_da')}</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
            >
              {t('auto.annuler')}</button>
            <button
              type="submit"
              disabled={closing || !comment.trim()}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {closing ? 'Fermeture en cours...' : 'Fermer definitivement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
