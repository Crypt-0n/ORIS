import { sanitizeHtml } from '../../../../lib/sanitize';
import { useTranslation } from 'react-i18next';
import { Lock, CheckCircle, Activity, Minus, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { formatDateTimeShort, formatDate } from './SharedUI';
import { ReportTask, ReportTaskEvent } from '../types';

export function TaskReportCard({
  task,
  index,
  events,
  activityStatus,
  isPeriodReport,
  historicalStatus,
}: {
  task: ReportTask;
  index: number;
  events: ReportTaskEvent[];
  activityStatus?: boolean;
  isPeriodReport: boolean;
  historicalStatus?: string;
}) {
  const { t, i18n } = useTranslation();
  const isClosed = (historicalStatus || task.status) === 'closed';

  return (
    <div className={`rounded-lg border p-4 ${isClosed ? 'border-gray-200 bg-gray-50' : 'border-green-200 bg-green-50'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isClosed ? 'bg-gray-200 text-gray-600' : 'bg-green-200 text-green-700'}`}>
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-semibold text-gray-800 truncate">{task.title}</h4>
            {isClosed ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">
                <Lock className="w-2.5 h-2.5" />
                {t('auto.fermee_35')}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                <CheckCircle className="w-2.5 h-2.5" />
                {t('auto.ouverte_36')}
              </span>
            )}
            {isClosed && task.result && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${task.result.color}20`, color: task.result.color }}>
                {task.result.label}
              </span>
            )}
            {isPeriodReport && activityStatus !== undefined && !isClosed && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${activityStatus ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {activityStatus ? (
                  <><Activity className="w-2.5 h-2.5" /> {t('auto.en_cours')}</>
                ) : (
                  <><Minus className="w-2.5 h-2.5" /> {t('auto.pas_d_avancement')}</>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(task.created_at, i18n.language)}
            </span>
            {task.assigned_to_user && <span>{t('auto.assignee_a')}{task.assigned_to_user.full_name}</span>}
          </div>
          {task.description && (
            <div className="mt-2 text-xs text-gray-600 leading-relaxed rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.description) }} />
          )}
          {events.length > 0 && (
            <div className="mt-3 bg-white rounded border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {t('report.highlights', { count: events.length })}
              </p>
              <div className="space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 text-[11px] text-gray-600 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-100">
                    <span className="text-gray-500 flex-shrink-0 pt-px">{formatDateTimeShort(ev.event_datetime, i18n.language)}</span>
                    <span className="font-medium text-gray-700 flex-shrink-0">
                      {ev.kill_chain ? t(`killChain.${ev.kill_chain}`, { defaultValue: ev.kill_chain.replace(/-/g, ' ') }) : (ev.event_type ? t(`report.event_types.${ev.event_type}`, { defaultValue: ev.event_type }) : '')}
                    </span>
                    {(ev.source_system?.name || ev.target_system?.name) && (
                      <span className="flex items-center gap-1 text-gray-500 flex-shrink-0">
                        {ev.source_system?.name}
                        {ev.target_system && (
                          <>
                            {ev.direction === 'target_to_source' ? <ArrowLeft className="w-2.5 h-2.5 inline" /> : <ArrowRight className="w-2.5 h-2.5 inline" />}
                            {ev.target_system.name}
                          </>
                        )}
                      </span>
                    )}
                    {ev.description && <span className="text-gray-500 truncate">{ev.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {isClosed && task.closure_comment && (
            <div className="mt-2 bg-white rounded border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">{t('auto.commentaire_de_fermeture_37')}</p>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.closure_comment) }} className="text-xs text-gray-700 leading-relaxed rich-text-content" />
              {task.closed_at && (
                <p className="mt-2 text-[10px] text-gray-500">
                  {t('auto.fermee_le')}
                  {formatDate(task.closed_at, i18n.language)}
                  {task.closed_by_user && ` par ${task.closed_by_user.full_name}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
