import React from 'react';

import { useTranslation } from 'react-i18next';
import { ArrowLeft, Edit, Lock, Share2, Trash2, Server, Pencil, ArrowRight, Bug, Radar } from 'lucide-react';
import { ActiveUsers } from '../ActiveUsers';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';

const INVESTIGATION_STATUS_MAP: Record<string, { label: string; icon: any; textClass: string; bgClass: string; borderClass: string }> = {
  unknown: { label: 'Inconnu', icon: ShieldQuestion, textClass: 'text-slate-500 dark:text-slate-400', bgClass: 'bg-slate-100 dark:bg-slate-800', borderClass: 'border-slate-300 dark:border-slate-600' },
  clean: { label: 'Sain', icon: ShieldCheck, textClass: 'text-green-700 dark:text-green-400', bgClass: 'bg-green-50 dark:bg-green-900/20', borderClass: 'border-green-200 dark:border-green-800' },
  compromised: { label: 'Compromis / Accede', icon: ShieldAlert, textClass: 'text-amber-700 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-900/20', borderClass: 'border-amber-200 dark:border-amber-800' },
  infected: { label: 'Infecte', icon: ShieldX, textClass: 'text-red-700 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-900/20', borderClass: 'border-red-200 dark:border-red-800' },
};

interface TaskHeaderProps {
  taskData: any;
  caseId: string;
  taskId: string;
  isEffectivelyClosed: boolean;
  isTaskClosed: boolean;
  canEditTask: boolean;
  onBack: () => void;
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
  onShare: () => void;
  showCopiedMessage: boolean;
  showStatusPicker: boolean;
  setShowStatusPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  savingStatus: boolean;
  onSaveInitialStatus: (status: string) => void;
}

export function TaskHeader({
  taskData, caseId, taskId, isEffectivelyClosed, isTaskClosed, canEditTask,
  onBack, onEdit, onClose, onDelete, onShare,
  showCopiedMessage, showStatusPicker, setShowStatusPicker, savingStatus, onSaveInitialStatus
}: TaskHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition flex-shrink-0 mt-0.5"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex-1 min-w-0">{taskData.title}</h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isTaskClosed
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}>
                {isTaskClosed ? t('auto.status_closed') : t('auto.status_open')}
              </span>
              <button
                onClick={onShare}
                className="text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition relative flex-shrink-0"
                title={t('auto.partager_le_lien_de_la_t_che', 'Partager le lien de la tâche')}
              >
                <Share2 className="w-4 h-4" />
                {showCopiedMessage && (
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {t('auto.lien_copie', 'Lien copié')}</span>
                )}
              </button>
              {!isEffectivelyClosed && canEditTask && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <button
                    onClick={onEdit}
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 text-sm"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    {t('auto.modifier')}
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition flex items-center gap-1.5 text-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {t('auto.fermer')}
                  </button>
                  <button
                    onClick={onDelete}
                    className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition flex items-center gap-1.5 text-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('auto.supprimer')}
                  </button>
                </div>
              )}
            </div>
          </div>
          {taskData.result && (
            <span
              className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium inline-block mb-2"
              style={{
                backgroundColor: `${taskData.result.color}20`,
                color: taskData.result.color,
              }}
            >
              {taskData.result.label}
            </span>
          )}
          {taskData.system && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Server className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <span className="text-xs text-teal-700 dark:text-teal-400 font-medium">
                {t('auto.investigation', 'Investigation : ')}{taskData.system.name}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!isEffectivelyClosed && canEditTask && (
                  <div className="relative">
                    <button
                      onClick={() => setShowStatusPicker(v => !v)}
                      title={t('auto.modifier_le_statut_initial', 'Modifier le statut initial')}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border transition hover:opacity-80 ${taskData.initial_investigation_status
                        ? (() => {
                          const cfg = INVESTIGATION_STATUS_MAP[taskData.initial_investigation_status];
                          return cfg ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600';
                        })()
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-dashed border-slate-300 dark:border-slate-600'
                        }`}
                    >
                      {taskData.initial_investigation_status
                        ? (() => {
                          const cfg = INVESTIGATION_STATUS_MAP[taskData.initial_investigation_status];
                          if (!cfg) return null;
                          const StatusIcon = cfg.icon;
                          return <><StatusIcon className="w-3 h-3" />{cfg.label}</>;
                        })()
                        : <><Pencil className="w-2.5 h-2.5" />{t('auto.statut_initial', 'Statut initial')}</>
                      }
                    </button>
                    {showStatusPicker && (
                      <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg p-2 min-w-[200px]">
                        <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1">{t('auto.statut_initial', 'Statut initial')}</p>
                        {Object.entries(INVESTIGATION_STATUS_MAP).map(([value, cfg]) => {
                          const StatusIcon = cfg.icon;
                          const isSelected = taskData.initial_investigation_status === value;
                          return (
                            <button
                              key={value}
                              disabled={savingStatus}
                              onClick={() => {
                                onSaveInitialStatus(isSelected ? '' : value);
                                setShowStatusPicker(false);
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition text-xs ${isSelected ? `${cfg.bgClass} ${cfg.textClass}` : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
                                }`}
                            >
                              <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? cfg.textClass : 'text-gray-500 dark:text-slate-400'}`} />
                              {cfg.label}
                              {isSelected && <span className="ml-auto text-[9px] opacity-60">{t('auto.cliquer_pour_effacer', 'Cliquer pour effacer')}</span>}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setShowStatusPicker(false)}
                          className="mt-1 w-full text-[10px] text-center text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 py-1"
                        >
                          {t('auto.annuler')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {isEffectivelyClosed && taskData.initial_investigation_status && (() => {
                  const cfg = INVESTIGATION_STATUS_MAP[taskData.initial_investigation_status];
                  if (!cfg) return null;
                  const StatusIcon = cfg.icon;
                  return (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`} title={t('auto.statut_initial', 'Statut initial')}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  );
                })()}
                {taskData.initial_investigation_status && taskData.investigation_status && (
                  <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                )}
                {taskData.investigation_status && (() => {
                  const cfg = INVESTIGATION_STATUS_MAP[taskData.investigation_status];
                  if (!cfg) return null;
                  const StatusIcon = cfg.icon;
                  return (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`} title={t('auto.statut_final_fermeture', 'Statut final après fermeture')}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
          {taskData.malware && (
            <div className="flex items-center gap-2 mt-1">
              <Bug className={`w-3.5 h-3.5 ${taskData.malware.is_malicious === true ? 'text-red-600 dark:text-red-400' : taskData.malware.is_malicious === false ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`} />
              <span className={`text-xs font-medium ${taskData.malware.is_malicious === true ? 'text-red-700 dark:text-red-400' : taskData.malware.is_malicious === false ? 'text-green-700 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {t('auto.analyse_malware', 'Analyse malware : ')}{taskData.malware.file_name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${taskData.malware.is_malicious === true
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                : taskData.malware.is_malicious === false
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                }`}>
                {taskData.malware.is_malicious === true ? t('auto.malveillant', 'Malveillant') : taskData.malware.is_malicious === false ? t('auto.non_malveillant', 'Sain') : t('auto.inconnu', 'Inconnu')}
              </span>
            </div>
          )}
          {taskData.is_osint && (
            <div className="flex items-center gap-2 mt-1">
              <Radar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                {t('auto.tache_osint', 'Tâche OSINT / Investigation externe')}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800">
                {t('auto.open_source_intelligence')}</span>
            </div>
          )}
          <p className="text-gray-600 dark:text-slate-300 text-xs sm:text-sm mt-1">
            {t('auto.cree_le')} {new Date(taskData.created_at).toLocaleDateString('fr-FR')} {t('auto.par')} {taskData.created_by_user.full_name}
          </p>
          <ActiveUsers caseId={caseId} taskId={taskId} />
        </div>
      </div>
      {!isEffectivelyClosed && canEditTask && (
        <div className="flex sm:hidden flex-col gap-2">
          <button
            onClick={onEdit}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 w-full"
          >
            <Edit className="w-4 h-4" />
            {t('auto.modifier')}
          </button>
          <button
            onClick={onClose}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2 w-full"
          >
            <Lock className="w-4 h-4" />
            {t('auto.fermer')}
          </button>
          <button
            onClick={onDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 w-full"
          >
            <Trash2 className="w-4 h-4" />
            {t('auto.supprimer')}
          </button>
        </div>
      )}
    </div>
  );
}
