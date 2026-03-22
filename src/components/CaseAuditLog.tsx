import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { History, ChevronDown, ChevronUp, FileText, MessageSquare, Star, Upload, Users, Clock, FolderOpen, AlertTriangle, ExternalLink } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { useSearchParams } from 'react-router-dom';

interface AuditEntry {
  id: string;
  action: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
}

interface CaseAuditLogProps {
  caseId: string;
}

function formatDateTime(dateStr: string, lng: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lng === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Returns icon + color for each audit action type */
function getActionStyle(action: string) {
  if (action.includes('highlight')) return { icon: Star, color: 'text-yellow-500 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
  if (action.includes('comment')) return { icon: MessageSquare, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
  if (action.includes('file')) return { icon: Upload, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' };
  if (action.includes('task')) return { icon: FileText, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
  if (action.includes('member') || action.includes('leader')) return { icon: Users, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' };
  if (action.includes('timezone')) return { icon: Clock, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' };
  if (action.includes('alert')) return { icon: AlertTriangle, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  if (action.includes('case')) return { icon: FolderOpen, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
  return { icon: History, color: 'text-gray-500 dark:text-slate-400', bg: 'bg-gray-50 dark:bg-slate-800' };
}

export function CaseAuditLog({ caseId }: CaseAuditLogProps) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchAuditLog();
  }, [caseId]);

  const fetchAuditLog = async () => {
    try {
      const data = await api.get(`/audit/case/${caseId}`);
      setEntries(data || []);
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const getClickTarget = (entry: AuditEntry) => {
    const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
    const taskId = entry.entity_type === 'task' ? entry.entity_id : details?.task_id;

    if (taskId) {
      let tab = '';
      let target = '';
      if (entry.action.includes('highlight')) {
        tab = 'events';
        if (details.event_id) target = details.event_id;
      } else if (entry.action.includes('comment')) {
        tab = 'comments';
        if (details.comment_id) target = details.comment_id;
      } else if (entry.action.includes('file')) {
        tab = 'files';
      }
      return { type: 'task' as const, taskId, tab, target };
    }

    // Member/leader actions → navigate to team section
    if (entry.action.includes('member') || entry.action.includes('leader')) {
      return { type: 'team' as const };
    }

    return null;
  };

  const handleEntryClick = (entry: AuditEntry) => {
    const clickTarget = getClickTarget(entry);
    if (!clickTarget) return;

    const params = new URLSearchParams(searchParams);

    if (clickTarget.type === 'task') {
      params.set('section', 'tasks');
      params.set('task', clickTarget.taskId);
      if (clickTarget.tab) params.set('tab', clickTarget.tab);
      if (clickTarget.target) params.set('target', clickTarget.target);
    } else if (clickTarget.type === 'team') {
      // Scroll to team section
      params.delete('section');
      params.delete('task');
      params.delete('tab');
      params.delete('target');
    }

    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // For team actions, try to scroll to the team section
    if (clickTarget.type === 'team') {
      setTimeout(() => {
        const el = document.querySelector('[data-section="team"]') || document.querySelector('.team-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const visibleEntries = expanded ? entries : entries.slice(0, 10);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6 border border-transparent dark:border-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-gray-600 dark:text-slate-400" />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t('auto.historique')}</h3>
        {entries.length > 0 && (
          <span className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
            {entries.length}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('auto.chargement')}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
          {t('auto.aucun_historique_disponible')}</p>
      ) : (
        <div className="space-y-1">
          {visibleEntries.map((entry) => {
            const details = typeof entry.details === 'string' ? JSON.parse(entry.details) : entry.details;
            const performedByName = details.performed_by_name || details.user_full_name || 'System';
            const clickTarget = getClickTarget(entry);
            const isClickable = !!clickTarget;
            const actionStyle = getActionStyle(entry.action);
            const ActionIcon = actionStyle.icon;

            return (
              <div
                key={entry.id}
                onClick={() => isClickable && handleEntryClick(entry)}
                className={`flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-slate-800 last:border-0 ${isClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg -mx-2 px-2 transition-colors group' : ''}`}
              >
                <div className={`p-1.5 rounded-md mt-0.5 flex-shrink-0 ${actionStyle.color} ${actionStyle.bg}`}>
                  <ActionIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-slate-200">
                    {String(t(details.changes ? `audit.actions.${entry.action}_with_changes` : `audit.actions.${entry.action}`, {
                      user: performedByName,
                      performed_by_name: performedByName,
                      ...details,
                      changes: details.changes ? details.changes.split(', ').map((c: string) => t(`audit.fields.${c.trim()}`)).join(', ') : ''
                    }))}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{formatDateTime(entry.created_at, i18n.language)}</p>
                </div>
                {isClickable && (
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 mt-1.5 transition-colors" />
                )}
              </div>
            );
          })}

          {entries.length > 10 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 pt-2 w-full justify-center"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t('auto.voir_moins')}</>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {t('auto.voir_tout')}{entries.length})
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
