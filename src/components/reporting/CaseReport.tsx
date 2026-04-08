import { useState } from 'react';
import { sanitizeHtml } from '../../lib/sanitize';
import { useTranslation } from 'react-i18next';
import { Download, Loader2, Calendar, FileText, Globe, Lock, ListTodo, GitBranch, FileBarChart, Network } from 'lucide-react';
import logoUrl from '../../assets/Logo.png';
import { LateralMovementGraph } from './LateralMovementGraph';
import { ChronologicalTreeView } from './ChronologicalTreeView';
import { VisualTimeline } from './VisualTimeline';
import { ActivityPlot } from './ActivityPlot';

// Hooks
import { useCaseReportData } from './CaseReport/hooks/useCaseReportData';
import { useReportExport } from './CaseReport/hooks/useReportExport';

// Components
import { ReportOptionsBar } from './CaseReport/components/ReportOptionsBar';
import { TaskReportCard } from './CaseReport/components/TaskReportCard';
import { SectionHeader, InfoRow, TlpPapBadge, formatDateTime, formatDate, computeDuration } from './CaseReport/components/SharedUI';
import {
  SystemsSection,
  AttackerInfraSection,
  CompromisedAccountsSection,
  MalwareSection,
  NetworkIndicatorsSection,
  ExfiltrationsSection
} from './CaseReport/components/Sections';

// Types
import { ReportType } from './CaseReport/types';

interface CaseReportProps {
  caseId: string;
}

export function CaseReport({ caseId }: CaseReportProps) {
  const { t, i18n } = useTranslation();
  
  // Local UI State
  const [reportType, setReportType] = useState<ReportType>('full');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekCount, setWeekCount] = useState<1 | 2>(1);
  const [reportLanguage, setReportLanguage] = useState(i18n.language);

  // Custom Data Hook
  const {
    loading,
    caseData,
    dateRange,
    firstEvent,
    lastEvent,
    computedTasks,
    computedSystems,
    filteredAccounts,
    filteredIndicators,
    filteredMalware,
    filteredExfiltrations,
    filteredAttackerInfra,
  } = useCaseReportData(caseId, reportType, selectedDate, weekCount, reportLanguage, formatDate);

  // Custom Export Hook
  const { exportPdf, exporting } = useReportExport(
    caseId,
    reportType,
    selectedDate,
    weekCount,
    reportLanguage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return <p className="text-center text-gray-500 dark:text-slate-400 py-8">{t('auto.impossible_de_charger_le_rappo')}</p>;
  }

  const isClosed = caseData.status === 'closed';
  const showClosure = reportType === 'full'
    ? (isClosed && !!caseData.closure_summary)
    : (isClosed && !!caseData.closure_summary && !!caseData.closed_at && !!dateRange && caseData.closed_at >= dateRange.start && caseData.closed_at <= dateRange.end);
  
  const hsm = computedTasks.historicalStatusMap;
  const openTasks = computedTasks.displayTasks.filter((t: any) => (hsm ? hsm[t.id] : t.status) === 'open').length;
  const closedTasks = computedTasks.displayTasks.filter((t: any) => (hsm ? hsm[t.id] : t.status) === 'closed').length;
  
  const reportSubtitle = reportType === 'full'
    ? t('report.generated_on', { date: formatDate(new Date().toISOString(), i18n.language) })
    : reportType === 'daily'
      ? t('report.daily_period', { period: dateRange!.label })
      : t('report.weekly_period', { period: dateRange!.label });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{t('auto.rapport_du_dossier')}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <select
              aria-label="Report language"
              value={reportLanguage}
              onChange={(e) => setReportLanguage(e.target.value)}
              className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-slate-200"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? t('report.export_in_progress') : t('report.export_pdf')}
          </button>
        </div>
      </div>

      <ReportOptionsBar
        reportType={reportType}
        onReportTypeChange={setReportType}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        weekCount={weekCount}
        onWeekCountChange={setWeekCount}
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ color: '#1f2937' }}>
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-slate-400 text-sm font-mono tracking-wider">{caseData.case_number}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: isClosed ? '#374151' : '#065f4620', color: isClosed ? '#9ca3af' : '#10b981' }}>
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

        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
            <InfoRow label="Responsable" value={caseData.author.full_name} />
            <InfoRow label="Date de creation" value={formatDate(caseData.created_at, i18n.language)} />
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
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 min-w-[120px]">{t('auto.fuseau_attaquant')}</span>
              <span className={`text-sm font-medium flex items-center gap-1.5 ${caseData.attacker_utc_offset != null ? 'text-gray-800' : 'text-gray-500 italic'}`}>
                <Globe className="w-3.5 h-3.5" />
                {caseData.attacker_utc_offset != null
                  ? caseData.attacker_utc_offset >= 0 ? `UTC+${caseData.attacker_utc_offset}` : `UTC${caseData.attacker_utc_offset}`
                  : 'Inconnu'}
              </span>
            </div>
            {isClosed && caseData.closed_at && (
              <InfoRow label="Date de cloture" value={formatDate(caseData.closed_at, i18n.language)} />
            )}
            {isClosed && caseData.closed_by_user && (
              <InfoRow label="Cloture par" value={caseData.closed_by_user.full_name} />
            )}
          </div>
        </div>

        {(firstEvent || lastEvent) && (
          <div className="px-8 py-6 border-b border-gray-100">
            <SectionHeader icon={Calendar} title={t('auto.chronologie_des_evenements_mal')} />
            <div className="mt-4 flex gap-8">
              <div className="flex-1 bg-red-50 rounded-lg p-4 border border-red-100">
                <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-1">{t('auto.premier_evenement')}</p>
                <p className="text-sm font-semibold text-gray-800">{firstEvent ? formatDateTime(firstEvent, i18n.language) : 'N/A'}</p>
              </div>
              <div className="flex-1 bg-orange-50 rounded-lg p-4 border border-orange-100">
                <p className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-1">{t('auto.dernier_evenement')}</p>
                <p className="text-sm font-semibold text-gray-800">{lastEvent ? formatDateTime(lastEvent, i18n.language) : 'N/A'}</p>
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

        <div className="px-8 py-6 border-b border-gray-100">
          <SectionHeader icon={FileText} title={t('auto.resume_du_dossier')} />
          <div className="mt-4 text-sm leading-relaxed text-gray-700 rich-text-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(caseData.description) }} />
        </div>

        {showClosure && (
          <div className="px-8 py-6 border-b border-gray-100">
            <SectionHeader icon={Lock} title={t('auto.synthese_de_cloture')} />
            <div className="mt-4 text-sm leading-relaxed text-gray-700 rich-text-content bg-gray-50 rounded-lg p-5 border border-gray-100" dangerouslySetInnerHTML={{ __html: sanitizeHtml(caseData.closure_summary!) }} />
            {caseData.closed_at && (
              <p className="mt-3 text-xs text-gray-500">
                {t('auto.cloture_le')}{formatDate(caseData.closed_at, i18n.language)}
                {caseData.closed_by_user && ` par ${caseData.closed_by_user.full_name}`}
              </p>
            )}
          </div>
        )}

        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={ListTodo} title={t('auto.taches')} />
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {openTasks} {t('auto.ouverte')}{openTasks !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                {closedTasks} {t('auto.fermee')}{closedTasks !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {computedTasks.displayTasks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {reportType === 'full' ? 'Aucune tache' : 'Aucune tache active sur cette periode'}
            </p>
          ) : (
            <div className="space-y-3">
              {computedTasks.displayTasks.map((task: any, index: number) => (
                <TaskReportCard
                  key={task.id}
                  task={task}
                  index={index + 1}
                  events={computedTasks.filteredEventsMap[task.id] || []}
                  activityStatus={computedTasks.taskActivityMap ? computedTasks.taskActivityMap[task.id] : undefined}
                  isPeriodReport={reportType !== 'full'}
                  historicalStatus={computedTasks.historicalStatusMap ? computedTasks.historicalStatusMap[task.id] : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <AttackerInfraSection items={filteredAttackerInfra} />
        <SystemsSection systems={computedSystems} title={t('auto.systemes_compromis')} />
        <CompromisedAccountsSection accounts={filteredAccounts} />
        <MalwareSection items={filteredMalware} />
        <NetworkIndicatorsSection indicators={filteredIndicators} />
        <ExfiltrationsSection exfiltrations={filteredExfiltrations} />


        <div className="px-8 py-6 border-t border-gray-100">
          <SectionHeader icon={Network} title={t('auto.mouvements_lateraux')} />
          <div id="lateral-movement-container" className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 w-full">
            <LateralMovementGraph
              caseId={caseId}
              startDate={dateRange?.start}
              endDate={dateRange?.end}
              isReportView={true}
              forceTheme="light"
            />
          </div>
          <div id="chronological-tree-container" className="mt-4 rounded-xl overflow-hidden">
            <ChronologicalTreeView caseId={caseId} staticRender={true} endDate={dateRange?.end} />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100">
          <SectionHeader icon={GitBranch} title={t('auto.timeline_visuelle', { defaultValue: 'Timeline Visuelle' })} />
          <div id="visual-timeline-container" className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 w-full">
            <VisualTimeline caseId={caseId} killChainType={caseData.kill_chain_type ?? null} isReportView={true} forceTheme="light" endDate={dateRange?.end} />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100">
          <SectionHeader icon={FileBarChart} title={t('auto.graphiques_activite', { defaultValue: "Graphiques d'activité" })} />
          <div id="activity-plot-container" className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 w-full">
            <ActivityPlot caseId={caseId} isReportView={true} forceTheme="light" endDate={dateRange?.end} />
          </div>
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-center text-xs text-gray-500">
            {t('auto.rapport_confidentiel')}{caseData.case_number} {t('auto.genere_le')}{formatDateTime(new Date().toISOString(), i18n.language)}
          </p>
        </div>
      </div>
    </div>
  );
}
