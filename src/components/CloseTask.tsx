import { useState } from 'react';
import { api } from '../lib/api';
import { X, Lock, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, ArrowRight } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { useTranslation } from "react-i18next";

interface CloseTaskProps {
  taskId: string;
  initialComment?: string;
  hasSystem?: boolean;
  initialInvestigationStatus?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const INVESTIGATION_STATUSES = [
  { value: 'clean', label: 'Sain', description: 'Le systeme est sain, aucune trace de compromission', icon: ShieldCheck, bgClass: 'bg-green-50 dark:bg-green-900/20', borderActive: 'border-green-500', textClass: 'text-green-700 dark:text-green-400' },
  { value: 'compromised', label: 'Compromis / Accede', description: "Le systeme a ete accede ou compromis par l'attaquant", icon: ShieldAlert, bgClass: 'bg-amber-50 dark:bg-amber-900/20', borderActive: 'border-amber-500', textClass: 'text-amber-700 dark:text-amber-400' },
  { value: 'infected', label: 'Infecte', description: 'Le systeme est infecte (malware, backdoor, etc.)', icon: ShieldX, bgClass: 'bg-red-50 dark:bg-red-900/20', borderActive: 'border-red-500', textClass: 'text-red-700 dark:text-red-400' },
] as const;

const INITIAL_STATUS_MAP: Record<string, { label: string; icon: typeof ShieldCheck; textClass: string; bgClass: string; borderClass: string }> = {
  unknown: { label: 'Inconnu', icon: ShieldQuestion, textClass: 'text-slate-500 dark:text-slate-400', bgClass: 'bg-slate-100 dark:bg-slate-800', borderClass: 'border-slate-300 dark:border-slate-600' },
  clean: { label: 'Sain', icon: ShieldCheck, textClass: 'text-green-700 dark:text-green-400', bgClass: 'bg-green-50 dark:bg-green-900/20', borderClass: 'border-green-200 dark:border-green-800' },
  compromised: { label: 'Compromis / Accede', icon: ShieldAlert, textClass: 'text-amber-700 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-900/20', borderClass: 'border-amber-200 dark:border-amber-800' },
  infected: { label: 'Infecte', icon: ShieldX, textClass: 'text-red-700 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-900/20', borderClass: 'border-red-200 dark:border-red-800' },
};

export function CloseTask({ taskId, initialComment = '', hasSystem = false, initialInvestigationStatus, onClose, onSuccess }: CloseTaskProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState(initialComment);
  const [investigationStatus, setInvestigationStatus] = useState<string>('');
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (hasSystem && !investigationStatus) {
      setError("Vous devez selectionner un statut d'investigation pour ce systeme");
      return;
    }

    setError('');
    setClosing(true);

    try {
      await api.post(`/tasks/${taskId}/close`, {
        closure_comment: comment.trim(),
        investigation_status: hasSystem && investigationStatus ? investigationStatus : null,
      });

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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <strong>{t('auto.attention')}</strong> {t('auto.la_tache_passera_en_lecture_se')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasSystem && initialInvestigationStatus && (() => {
            const cfg = INITIAL_STATUS_MAP[initialInvestigationStatus];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.bgClass} ${cfg.borderClass}`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.textClass}`} />
                <span className={`text-xs ${cfg.textClass}`}>
                  {t('auto.statut_initial_avant_investiga')}<strong>{cfg.label}</strong>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0" />
                <span className="text-xs text-slate-500 dark:text-slate-400">{t('auto.statut_final_ci_dessous')}</span>
              </div>
            );
          })()}

          {hasSystem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t('auto.statut_final_du_systeme_apres_')}</label>
              <div className="grid grid-cols-1 gap-2">
                {INVESTIGATION_STATUSES.map(status => {
                  const Icon = status.icon;
                  const isSelected = investigationStatus === status.value;
                  return (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => setInvestigationStatus(status.value)}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 transition text-left ${isSelected
                          ? `${status.borderActive} ${status.bgClass}`
                          : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? status.textClass : 'text-gray-400 dark:text-slate-400'}`} />
                      <div>
                        <span className={`text-sm font-medium ${isSelected ? status.textClass : 'text-gray-800 dark:text-white'}`}>
                          {status.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{status.description}</p>
                      </div>
                    </button>
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
              disabled={closing || !comment.trim() || (hasSystem && !investigationStatus)}
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
