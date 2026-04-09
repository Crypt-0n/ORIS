import React from 'react';

import { sanitizeHtml } from '../../lib/sanitize';
import { useTranslation } from 'react-i18next';
import { Lock, Pencil, RotateCcw } from 'lucide-react';

interface TaskClosureDetailsProps {
  taskData: any;
  canEditTask: boolean;
  isClosed: boolean;
  onEditClosureComment: () => void;
  onReopenConfirm: () => void;
}

export function TaskClosureDetails({
  taskData, canEditTask, isClosed, onEditClosureComment, onReopenConfirm
}: TaskClosureDetailsProps) {
  const { t } = useTranslation();

  if (taskData.status !== 'closed' || !taskData.closure_comment) return null;

  return (
    <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('auto.commentaire_de_fermeture_2')}</h3>
        </div>
        {canEditTask && !isClosed && (
          <div className="flex gap-2">
            <button
              onClick={onEditClosureComment}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('auto.modifier')}
            </button>
            <button
              onClick={onReopenConfirm}
              className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('auto.reouvrir')}
            </button>
          </div>
        )}
      </div>
      <div
        className="text-gray-700 dark:text-slate-300 text-sm rich-text-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(taskData.closure_comment) }}
      />
      <div className="mt-3 text-xs text-gray-500 dark:text-slate-400">
        {t('auto.fermee_le')}{taskData.closed_at ? new Date(taskData.closed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
        {taskData.closed_by_user && ` par ${taskData.closed_by_user.full_name}`}
      </div>
      {taskData.closure_comment_modified_at && taskData.closure_comment_modified_by_user && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 italic">
          {t('auto.modifie_le')}{new Date(taskData.closure_comment_modified_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {` par ${taskData.closure_comment_modified_by_user.full_name}`}
        </div>
      )}
    </div>
  );
}
