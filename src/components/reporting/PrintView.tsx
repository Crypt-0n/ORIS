import { sanitizeHtml } from '../../lib/sanitize';
import { useSearchParams, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Calendar, FileText, Lock, ListTodo, GitBranch, FileBarChart, Network } from 'lucide-react';
import { LateralMovementGraph } from './LateralMovementGraph';
import { ChronologicalTreeView } from './ChronologicalTreeView';
import { VisualTimeline } from './VisualTimeline';
import { ActivityPlot } from './ActivityPlot';
import { useCaseReportData } from './CaseReport/hooks/useCaseReportData';
import { TaskReportCard } from './CaseReport/components/TaskReportCard';
import { SectionHeader, InfoRow, TlpPapBadge, formatDateTime, formatDate, computeDuration } from './CaseReport/components/SharedUI';
import {
  StixElementsGroupedSection
} from './CaseReport/components/Sections';
import { ReportType } from './CaseReport/types';
import logoUrl from '../../assets/Logo.png';

export function PrintView() {
  const { caseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();

  const reportType = (searchParams.get('type') as ReportType) || 'full';
  const selectedDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const weekCount = (parseInt(searchParams.get('weeks') || '1') as 1 | 2) || 1;
  const lng = searchParams.get('lng') || i18n.language;

  const {
    loading,
    caseData,
    dateRange,
    firstEvent,
    lastEvent,
    computedTasks,
    filteredStixObjects
  } = useCaseReportData(caseId!, reportType, selectedDate, weekCount, lng, formatDate);

  if (!caseId) return <div>Missing case ID</div>;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" id="oris-print-loading">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return <p className="text-center text-gray-500 py-8" id="oris-print-error">Impossible de charger le rapport</p>;
  }

  const isClosed = caseData.status === 'closed';
  const showClosure = reportType === 'full'
    ? (isClosed && !!caseData.closure_summary)
    : (isClosed && !!caseData.closure_summary && !!caseData.closed_at && !!dateRange && caseData.closed_at >= dateRange.start && caseData.closed_at <= dateRange.end);
  

  
  const reportSubtitle = reportType === 'full'
    ? t('report.generated_on', { date: formatDate(new Date().toISOString(), lng) })
    : reportType === 'daily'
      ? t('report.daily_period', { period: dateRange?.label || '' })
      : t('report.weekly_period', { period: dateRange?.label || '' });

  return (
    <div id="oris-print-ready" className="bg-white text-gray-900 w-full max-w-[1200px] mx-auto p-8 print:p-0 print:max-w-none">
      <div className="bg-white border border-gray-200 overflow-hidden break-inside-avoid">
        <div className="bg-slate-900 px-8 py-8" style={{ backgroundColor: '#0f172a' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-slate-400 text-sm font-mono tracking-wider">{caseData.case_number}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: isClosed ? '#374151' : '#065f46', color: isClosed ? '#9ca3af' : '#10b981' }}>
                  {isClosed ? 'Cloture' : 'Ouvert'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{caseData.title}</h1>
              <p className="text-slate-400 text-sm">{reportSubtitle}</p>
            </div>
            <div className="h-12 w-12 overflow-hidden rounded-lg">
              <img src={logoUrl} alt="ORIS" className="h-full w-full object-contain" />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50 break-inside-avoid">
          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
            <InfoRow label="Responsable" value={caseData.author.full_name} />
            <InfoRow label="Date de creation" value={formatDate(caseData.created_at, lng)} />
            <InfoRow label="Severite" value={caseData.severity.label} color={caseData.severity.color} />
            <InfoRow label="Statut" value={isClosed ? 'Cloture' : 'Ouvert'} />
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 min-w-[120px]">TLP</span>
              <TlpPapBadge code={caseData.tlp.code} label={caseData.tlp.label} color={caseData.tlp.color} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 min-w-[120px]">PAP</span>
              <TlpPapBadge code={caseData.pap.code} label={caseData.pap.label} color={caseData.pap.color} />
            </div>
            {isClosed && caseData.closed_at && (
              <InfoRow label="Date de cloture" value={formatDate(caseData.closed_at, lng)} />
            )}
            {isClosed && caseData.closed_by_user && (
              <InfoRow label="Cloture par" value={caseData.closed_by_user.full_name} />
            )}
          </div>
        </div>

        {(firstEvent || lastEvent) && (
          <div className="px-8 py-6 border-b border-gray-100 break-inside-avoid">
            <SectionHeader icon={Calendar} title={t('auto.chronologie_des_evenements_mal')} />
            <div className="mt-4 flex gap-8">
              <div className="flex-1 bg-red-50 rounded-lg p-4 border border-red-100">
                <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-1">{t('auto.premier_evenement')}</p>
                <p className="text-sm font-semibold text-gray-800">{firstEvent ? formatDateTime(firstEvent, lng) : 'N/A'}</p>
              </div>
              <div className="flex-1 bg-orange-50 rounded-lg p-4 border border-orange-100">
                <p className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-1">{t('auto.dernier_evenement')}</p>
                <p className="text-sm font-semibold text-gray-800">{lastEvent ? formatDateTime(lastEvent, lng) : 'N/A'}</p>
              </div>
              {firstEvent && lastEvent && (
                <div className="flex-1 bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-xs font-medium text-blue-500 uppercase tracking-wider mb-1">{t('auto.duree')}</p>
                  <p className="text-sm font-semibold text-gray-800">{computeDuration(firstEvent, lastEvent)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-8 py-6 border-b border-gray-100 break-inside-avoid">
          <SectionHeader icon={FileText} title={t('auto.resume_du_dossier')} />
          <div className="mt-4 text-sm leading-relaxed text-gray-700 rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(caseData.description) }} />
        </div>

        {showClosure && (
          <div className="px-8 py-6 border-b border-gray-100 break-inside-avoid">
            <SectionHeader icon={Lock} title={t('auto.synthese_de_cloture')} />
            <div className="mt-4 text-sm leading-relaxed text-gray-700 rich-text-content bg-gray-50 rounded-lg p-5 border border-gray-100" dangerouslySetInnerHTML={{ __html: sanitizeHtml(caseData.closure_summary!) }} />
          </div>
        )}

        <div className="px-8 py-6 break-after-page">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={ListTodo} title={t('auto.taches')} />
          </div>
          {computedTasks.displayTasks.length === 0 ? (
            <p className="text-sm text-gray-500 py-8">Aucune tache</p>
          ) : (
            <div className="space-y-4">
              {computedTasks.displayTasks.map((task: any, index: number) => (
                <div key={task.id} className="break-inside-avoid shadow-sm border border-gray-200">
                  <TaskReportCard
                    task={task}
                    index={index + 1}
                    events={computedTasks.filteredEventsMap[task.id] || []}
                    activityStatus={computedTasks.taskActivityMap ? computedTasks.taskActivityMap[task.id] : undefined}
                    isPeriodReport={reportType !== 'full'}
                    historicalStatus={computedTasks.historicalStatusMap ? computedTasks.historicalStatusMap[task.id] : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <StixElementsGroupedSection elementsMap={filteredStixObjects} title={t('auto.elements_techniques', 'Éléments techniques')} />
        


        <div className="px-8 py-6 border-t border-gray-100 break-inside-avoid">
          <SectionHeader icon={Network} title={t('auto.mouvements_lateraux')} />
          <div className="mt-4 bg-white border border-gray-200 p-4 w-full">
            <LateralMovementGraph caseId={caseId} startDate={dateRange?.start} endDate={dateRange?.end} isReportView={true} forceTheme="light" />
          </div>
          <div className="mt-4 border border-gray-200 overflow-hidden">
            <ChronologicalTreeView caseId={caseId} staticRender={true} endDate={dateRange?.end} />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100 break-inside-avoid">
          <SectionHeader icon={GitBranch} title={t('auto.timeline_visuelle', { defaultValue: 'Timeline Visuelle' })} />
          <div className="mt-4 bg-white border border-gray-200 p-4 w-full">
            <VisualTimeline caseId={caseId} killChainType={caseData.kill_chain_type ?? null} isReportView={true} forceTheme="light" endDate={dateRange?.end} />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100 break-inside-avoid">
          <SectionHeader icon={FileBarChart} title={t('auto.graphiques_activite', { defaultValue: "Graphiques d'activité" })} />
          <div className="mt-4 bg-white border border-gray-200 p-4 w-full">
            <ActivityPlot caseId={caseId} isReportView={true} forceTheme="light" endDate={dateRange?.end} />
          </div>
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-center text-xs text-gray-500">
            {t('auto.rapport_confidentiel')}{caseData.case_number} {t('auto.genere_le')}{formatDateTime(new Date().toISOString(), lng)}
          </p>
        </div>
      </div>
    </div>
  );
}
