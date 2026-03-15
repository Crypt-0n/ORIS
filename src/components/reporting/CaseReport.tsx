import { useState, useEffect, useMemo } from 'react';
import logoUrl from '../../assets/Logo.png';
import { api } from '../../lib/api';
import {
  FileText,
  Download,
  Loader2,
  Calendar,
  Globe,
  Lock,
  CheckCircle,
  ListTodo,
  Clock,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  FileStack,
  Activity,
  Minus,
  Monitor,
  Server,
  Smartphone,
  Tablet,
  Tv,
  Router,
  Cpu,
  HelpCircle,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ShieldCheck,
  KeyRound,
  Network,
  Bug,
  PackageOpen,
  AlertTriangle,
  GitBranch,
  FileBarChart,
} from 'lucide-react';
import { generateCaseReportPdf } from '../../lib/pdfExport';
import { useTranslation } from "react-i18next";
import { useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { LateralMovementGraph } from './LateralMovementGraph';
import { ChronologicalTreeView, fetchTreeData, runDagreLayout } from './ChronologicalTreeView';
import { VisualTimeline } from './VisualTimeline';
import { ActivityPlot } from './ActivityPlot';

interface CaseReportData {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: string;
  closure_summary: string | null;
  closed_at: string | null;
  created_at: string;
  author: { full_name: string };
  severity: { label: string; color: string };
  tlp: { code: string; label: string; color: string };
  pap: { code: string; label: string; color: string };
  closed_by_user: { full_name: string } | null;
  attacker_utc_offset: number | null;
  kill_chain_type?: string | null;
}

interface ReportTask {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  closure_comment: string | null;
  closed_at: string | null;
  assigned_to_user: { full_name: string } | null;
  closed_by_user: { full_name: string } | null;
  result: { label: string; color: string } | null;
}

interface ReportTaskEvent {
  id: string;
  event_type?: string;
  event_datetime: string;
  created_at: string;
  task_id: string | null;
  description: string;
  direction: string | null;
  kill_chain: string | null;
  source_system: { name: string } | null;
  target_system: { name: string } | null;
}

interface TaskComment {
  task_id: string;
  created_at: string;
}

interface CaseEvent {
  event_datetime: string;
  created_at: string;
  event_type?: string;
  description: string;
}

interface ReportSystemTask {
  id: string;
  status: string;
  closed_at: string | null;
  investigation_status: string | null;
  initial_investigation_status: string | null;
}

interface ReportSystem {
  id: string;
  name: string;
  system_type: string;
  ip_addresses: { ip: string; mask: string; gateway: string }[];
  owner: string;
  investigation_tasks: ReportSystemTask[];
}

interface ReportCompromisedAccount {
  id: string;
  account_name: string;
  domain: string;
  sid: string | null;
  privileges: string;
  first_malicious_activity: string | null;
  last_malicious_activity: string | null;
  context: string | null;
  created_at: string;
}

interface ReportNetworkIndicator {
  id: string;
  ip: string | null;
  domain_name: string | null;
  port: number | null;
  url: string | null;
  first_activity: string | null;
  last_activity: string | null;
  malware_file_name: string | null;
  created_at: string;
}

interface ReportMalware {
  id: string;
  file_name: string;
  file_path: string | null;
  is_malicious: boolean | null;
  creation_date: string | null;
  system_name: string | null;
  created_at: string;
}

interface ReportExfiltration {
  id: string;
  exfiltration_date: string | null;
  file_name: string | null;
  file_size: number | null;
  file_size_unit: string | null;
  content_description: string | null;
  source_system_name: string | null;
  exfil_system_name: string | null;
  destination_system_name: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user_full_name: string;
}

type ReportType = 'full' | 'daily' | 'weekly';

const REPORT_TYPE_OPTIONS: (t: any) => { value: ReportType; label: string; icon: typeof FileStack }[] = (t) => [
  { value: 'full', label: t('report.full', { defaultValue: 'Complet' }), icon: FileStack },
  { value: 'daily', label: t('report.daily', { defaultValue: 'Quotidien' }), icon: CalendarDays },
  { value: 'weekly', label: t('report.weekly', { defaultValue: 'Hebdomadaire' }), icon: CalendarRange },
];

interface CaseReportProps {
  caseId: string;
}

export function CaseReport({ caseId }: CaseReportProps) {
  const { t, i18n } = useTranslation();
  const [caseData, setCaseData] = useState<CaseReportData | null>(null);
  const [tasks, setTasks] = useState<ReportTask[]>([]);
  const [taskEventsMap, setTaskEventsMap] = useState<Record<string, ReportTaskEvent[]>>({});
  const [allEvents, setAllEvents] = useState<CaseEvent[]>([]);
  const [allTaskComments] = useState<TaskComment[]>([]);
  const [firstEvent, setFirstEvent] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [systems, setSystems] = useState<ReportSystem[]>([]);
  const [compromisedAccounts, setCompromisedAccounts] = useState<ReportCompromisedAccount[]>([]);
  const [networkIndicators, setNetworkIndicators] = useState<ReportNetworkIndicator[]>([]);
  const [malwareTools, setMalwareTools] = useState<ReportMalware[]>([]);
  const [exfiltrations, setExfiltrations] = useState<ReportExfiltration[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [attackerInfraData, setAttackerInfraData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('full');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [weekCount, setWeekCount] = useState<1 | 2>(1);
  const [reportLanguage, setReportLanguage] = useState(i18n.language);

  const dateRange = useMemo(() => {
    if (reportType === 'full') return null;
    const start = new Date(selectedDate + 'T00:00:00');
    let end: Date;
    if (reportType === 'daily') {
      end = new Date(selectedDate + 'T23:59:59.999');
    } else {
      end = new Date(start);
      end.setDate(end.getDate() + weekCount * 7 - 1);
      end.setHours(23, 59, 59, 999);
    }
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: reportType === 'daily'
        ? formatDate(start.toISOString(), i18n.language)
        : `du ${formatDate(start.toISOString(), i18n.language)} au ${formatDate(end.toISOString(), i18n.language)}`,
    };
  }, [reportType, selectedDate, weekCount, i18n.language]);

  useEffect(() => {
    fetchReportData();
  }, [caseId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/reports/case/${caseId}`);
      if (!data) return;
      if (data.caseData) setCaseData(data.caseData as CaseReportData);
      if (data.tasks) setTasks(data.tasks as ReportTask[]);
      if (data.events) {
        setAllEvents(data.events as CaseEvent[]);
        if (data.events.length > 0) {
          setFirstEvent(data.events[0].event_datetime);
          setLastEvent(data.events[data.events.length - 1].event_datetime);
        }
        const grouped: Record<string, ReportTaskEvent[]> = {};
        for (const ev of data.events as any[]) {
          if (!ev.task_id) continue;
          const tid = ev.task_id;
          if (!grouped[tid]) grouped[tid] = [];
          grouped[tid].push(ev as ReportTaskEvent);
        }
        setTaskEventsMap(grouped);
      }
      if (data.systems) setSystems(data.systems as ReportSystem[]);
      if (data.accounts) setCompromisedAccounts(data.accounts as ReportCompromisedAccount[]);
      if (data.indicators) setNetworkIndicators(data.indicators as ReportNetworkIndicator[]);
      if (data.malware) setMalwareTools(data.malware as ReportMalware[]);
      if (data.exfiltrations) setExfiltrations(data.exfiltrations as ReportExfiltration[]);

      // Fetch attacker infrastructure from the dedicated table
      const aiData = await api.get(`/investigation/attacker-infra/by-case/${caseId}`);
      setAttackerInfraData(aiData || []);

      // Fetch audit logs
      const logs = await api.get(`/audit/case/${caseId}`);
      if (logs) {
        // We need to fetch user names if they are not in the audit log
        setAuditLogs(logs as AuditLog[]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const computed = useMemo(() => {
    if (reportType === 'full' || !dateRange) {
      return {
        displayTasks: tasks,
        filteredEventsMap: taskEventsMap,
        periodFirstEvent: firstEvent,
        periodLastEvent: lastEvent,
        taskActivity: null as Record<string, boolean> | null,
        historicalStatusMap: null as Record<string, string> | null,
      };
    }
    const { start, end } = dateRange;
    const historicalStatus: Record<string, string> = {};
    for (const task of tasks) {
      if (task.closed_at && task.closed_at <= end) {
        historicalStatus[task.id] = 'closed';
      } else {
        historicalStatus[task.id] = 'open';
      }
    }
    const filteredMap: Record<string, ReportTaskEvent[]> = {};
    for (const [taskId, events] of Object.entries(taskEventsMap)) {
      const inRange = events.filter(e => {
        const createdAtIso = e.created_at.replace(' ', 'T') + 'Z';
        return createdAtIso >= start && createdAtIso <= end;
      });
      if (inRange.length > 0) filteredMap[taskId] = inRange;
    }
    const eventsInRange = allEvents.filter(e => {
      const createdAtIso = e.created_at.replace(' ', 'T') + 'Z';
      return createdAtIso >= start && createdAtIso <= end;
    });
    const pFirst = eventsInRange.length > 0 ? eventsInRange[0].event_datetime : null;
    const pLast = eventsInRange.length > 0 ? eventsInRange[eventsInRange.length - 1].event_datetime : null;
    const activity: Record<string, boolean> = {};
    for (const task of tasks) {
      if (task.created_at > end) continue;
      if (historicalStatus[task.id] === 'closed' && task.closed_at && task.closed_at < start) continue;
      let hasAct = false;
      if (filteredMap[task.id]?.length > 0) hasAct = true;
      if (!hasAct) {
        for (const c of allTaskComments) {
          if (c.task_id === task.id && c.created_at >= start && c.created_at <= end) {
            hasAct = true;
            break;
          }
        }
      }
      if (!hasAct && task.created_at >= start && task.created_at <= end) hasAct = true;
      if (!hasAct && task.closed_at && task.closed_at >= start && task.closed_at <= end) hasAct = true;
      activity[task.id] = hasAct;
    }
    const display = tasks.filter(t => {
      if (t.created_at > end) return false;
      const hStatus = historicalStatus[t.id];
      if (hStatus === 'open') return true;
      return !!activity[t.id];
    });
    return {
      displayTasks: display,
      filteredEventsMap: filteredMap,
      periodFirstEvent: pFirst,
      periodLastEvent: pLast,
      taskActivity: activity,
      historicalStatusMap: historicalStatus,
    };
  }, [reportType, dateRange, tasks, taskEventsMap, allEvents, allTaskComments, firstEvent, lastEvent]);

  const computedSystems = useMemo(() => {
    const STATUS_PRIORITY = ['infected', 'compromised', 'clean'];
    const getStatus = (sys: ReportSystem, periodEnd?: string): string => {
      const closedTasks = periodEnd
        ? sys.investigation_tasks.filter(t => t.status === 'closed' && !!t.closed_at && t.closed_at <= periodEnd && t.investigation_status)
        : sys.investigation_tasks.filter(t => t.status === 'closed' && t.investigation_status);
      for (const s of STATUS_PRIORITY) {
        if (closedTasks.some(t => t.investigation_status === s)) return s;
      }
      const openTasks = periodEnd
        ? sys.investigation_tasks.filter(t => t.status !== 'closed' && t.initial_investigation_status)
        : sys.investigation_tasks.filter(t => t.initial_investigation_status);
      for (const s of STATUS_PRIORITY) {
        if (openTasks.some(t => t.initial_investigation_status === s)) return s;
      }
      return 'unknown';
    };
    const periodEnd = dateRange?.end;
    return systems.map(sys => ({ ...sys, computedStatus: getStatus(sys, periodEnd) }));
  }, [systems, dateRange]);

  const filteredAccounts = useMemo(() => {
    if (!dateRange) return compromisedAccounts;
    const { end } = dateRange;
    return compromisedAccounts.filter(a => {
      const ref = a.first_malicious_activity || a.created_at;
      return ref <= end;
    });
  }, [compromisedAccounts, dateRange]);

  const filteredIndicators = useMemo(() => {
    if (!dateRange) return networkIndicators;
    const { end } = dateRange;
    return networkIndicators.filter(i => {
      const ref = i.first_activity || i.created_at;
      return ref <= end;
    });
  }, [networkIndicators, dateRange]);

  const filteredMalware = useMemo(() => {
    if (!dateRange) return malwareTools;
    const { end } = dateRange;
    return malwareTools.filter(m => m.created_at <= end);
  }, [malwareTools, dateRange]);

  const filteredExfiltrations = useMemo(() => {
    if (!dateRange) return exfiltrations;
    const { start, end } = dateRange;
    return exfiltrations.filter(e => {
      const ref = e.exfiltration_date || e.created_at;
      return ref >= start && ref <= end;
    });
  }, [exfiltrations, dateRange]);

  const exportPdf = async () => {
    if (!caseData) return;
    setExporting(true);
    try {
      let graphImageStr = undefined;
      const svgElement = document.getElementById('lateral-movement-svg');
      if (svgElement) {
        try {
          const serializer = new XMLSerializer();
          let svgString = serializer.serializeToString(svgElement);

          if (!svgString.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
            svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
          }

          // Remove CSS classes to avoid display inheritance bugs and explicitly set size
          svgString = svgString.replace(/class="[^"]*"/g, '');
          svgString = svgString.replace(/^<svg/, '<svg width="1800" height="1100"');

          const canvas = document.createElement('canvas');
          canvas.width = 1200;
          canvas.height = 733;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const img = new Image();
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            await new Promise((resolve) => {
              img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(null);
              };
              img.onerror = (e) => {
                console.error("SVG Image load error", e);
                URL.revokeObjectURL(url);
                resolve(null);
              };
              img.src = url;
            });
            graphImageStr = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch (e) {
          console.error("SVG to Canvas failed", e);
        }
      }

      let visualTimelineImage = undefined;
      const timelineElement = document.getElementById('visual-timeline-container');
      if (timelineElement) {
        try {
          const canvas = await html2canvas(timelineElement, {
            scale: 1.6,
            useCORS: true,
            logging: false,
            windowWidth: 1200,
            onclone: (clonedDoc) => {
              clonedDoc.documentElement.classList.remove('dark');
              const el = clonedDoc.getElementById('visual-timeline-container');
              if (el) el.style.width = '1200px';
            },
            backgroundColor: '#ffffff'
          });
          visualTimelineImage = canvas.toDataURL('image/jpeg', 0.85);
        } catch (e) {
          console.error('Failed to capture Visual Timeline', e);
        }
      }

      let activityPlotImage = undefined;
      const activityElement = document.getElementById('activity-plot-container');
      if (activityElement) {
        try {
          const canvas = await html2canvas(activityElement, {
            scale: 1.6,
            useCORS: true,
            logging: false,
            windowWidth: 1200,
            onclone: (clonedDoc) => {
              clonedDoc.documentElement.classList.remove('dark');
              const el = clonedDoc.getElementById('activity-plot-container');
              if (el) el.style.width = '1200px';
            },
            backgroundColor: '#ffffff'
          });
          activityPlotImage = canvas.toDataURL('image/jpeg', 0.85);
        } catch (e) {
          console.error('Failed to capture Activity Plot', e);
        }
      }

      let chronologicalTreeData = undefined;
      try {
        const treeResult = await fetchTreeData(caseId);
        if (treeResult) {
          const layouted = runDagreLayout(treeResult.nodeData, treeResult.edges);
          const maxX = Math.max(...layouted.map(n => n.x)) + 220;
          const maxY = Math.max(...layouted.map(n => n.y)) + 80;
          chronologicalTreeData = {
            nodes: layouted.map(n => ({
              id: n.id,
              x: n.x,
              y: n.y,
              label: n.data.label,
              status: n.data.status,
              isPatientZero: n.data.isPatientZero,
            })),
            edges: treeResult.edges,
            graphWidth: maxX + 40,
            graphHeight: maxY + 40,
          };
        }
      } catch (e) {
        console.error('Failed to compute chronological tree data', e);
      }

      const compromisedSys = computedSystems.filter(s =>
        s.computedStatus === 'compromised' || s.computedStatus === 'infected'
      );
      generateCaseReportPdf({
        caseData,
        tasks: computed.displayTasks,
        taskEventsMap: computed.filteredEventsMap,
        firstEvent: computed.periodFirstEvent,
        lastEvent: computed.periodLastEvent,
        reportType,
        periodLabel: dateRange?.label || undefined,
        taskActivityMap: computed.taskActivity || undefined,
        historicalStatusMap: computed.historicalStatusMap || undefined,
        attackerUtcOffset: caseData.attacker_utc_offset,
        attackerSystems: attackerInfraData,
        compromisedSystems: compromisedSys,
        compromisedAccounts: filteredAccounts,
        malwareTools: filteredMalware,
        networkIndicators: filteredIndicators,
        exfiltrations: filteredExfiltrations,
        lng: i18n.language,
        graphImage: graphImageStr,
        visualTimelineImage,
        activityPlotImage,
        chronologicalTreeData
      });
    } catch (err) {
      console.error('Erreur export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

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
  const hsm = computed.historicalStatusMap;
  const openTasks = computed.displayTasks.filter(t => (hsm ? hsm[t.id] : t.status) === 'open').length;
  const closedTasks = computed.displayTasks.filter(t => (hsm ? hsm[t.id] : t.status) === 'closed').length;
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
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t('auto.rapport_du_dossier')}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <select
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
              <span className={`text-sm font-medium flex items-center gap-1.5 ${caseData.attacker_utc_offset !== null ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                <Globe className="w-3.5 h-3.5" />
                {caseData.attacker_utc_offset !== null
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
          <div className="mt-4 text-sm leading-relaxed text-gray-700 rich-text-content" dangerouslySetInnerHTML={{ __html: caseData.description }} />
        </div>

        {showClosure && (
          <div className="px-8 py-6 border-b border-gray-100">
            <SectionHeader icon={Lock} title={t('auto.synthese_de_cloture')} />
            <div className="mt-4 text-sm leading-relaxed text-gray-700 rich-text-content bg-gray-50 rounded-lg p-5 border border-gray-100" dangerouslySetInnerHTML={{ __html: caseData.closure_summary! }} />
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
          {computed.displayTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {reportType === 'full' ? 'Aucune tache' : 'Aucune tache active sur cette periode'}
            </p>
          ) : (
            <div className="space-y-3">
              {computed.displayTasks.map((task, index) => (
                <TaskReportCard
                  key={task.id}
                  task={task}
                  index={index + 1}
                  events={computed.filteredEventsMap[task.id] || []}
                  activityStatus={computed.taskActivity ? computed.taskActivity[task.id] : undefined}
                  isPeriodReport={reportType !== 'full'}
                  historicalStatus={computed.historicalStatusMap ? computed.historicalStatusMap[task.id] : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <AttackerInfraSection items={attackerInfraData} />
        <SystemsSection systems={computedSystems} title={t('auto.systemes_compromis')} />
        <CompromisedAccountsSection accounts={filteredAccounts} />
        <MalwareSection items={filteredMalware} />
        <NetworkIndicatorsSection indicators={filteredIndicators} />
        <ExfiltrationsSection exfiltrations={filteredExfiltrations} />
        <ActivityHistorySection logs={auditLogs} />

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
            <ChronologicalTreeView caseId={caseId} staticRender={true} />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100">
          <SectionHeader icon={GitBranch} title={t('auto.timeline_visuelle', { defaultValue: 'Timeline Visuelle' })} />
          <div id="visual-timeline-container" className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 w-full">
            <VisualTimeline caseId={caseId} killChainType={caseData.kill_chain_type ?? null} isReportView={true} forceTheme="light" />
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100">
          <SectionHeader icon={FileBarChart} title={t('auto.graphiques_activite', { defaultValue: "Graphiques d'activité" })} />
          <div id="activity-plot-container" className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 w-full">
            <ActivityPlot caseId={caseId} isReportView={true} forceTheme="light" />
          </div>
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-center text-xs text-gray-400">
            {t('auto.rapport_confidentiel')}{caseData.case_number} {t('auto.genere_le')}{formatDateTime(new Date().toISOString(), i18n.language)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportOptionsBar({
  reportType,
  onReportTypeChange,
  selectedDate,
  onDateChange,
  weekCount,
  onWeekCountChange,
}: {
  reportType: ReportType;
  onReportTypeChange: (t: ReportType) => void;
  selectedDate: string;
  onDateChange: (d: string) => void;
  weekCount: 1 | 2;
  onWeekCountChange: (c: 1 | 2) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-3">
      <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
        {REPORT_TYPE_OPTIONS(t).map(opt => {
          const Icon = opt.icon;
          const isActive = reportType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onReportTypeChange(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isActive
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
      {reportType !== 'full' && (
        <>
          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              {reportType === 'daily' ? 'Date :' : 'Du :'}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      )}
      {reportType === 'weekly' && (
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
          <button onClick={() => onWeekCountChange(1)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${weekCount === 1 ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>
            {t('auto.1_semaine')}</button>
          <button onClick={() => onWeekCountChange(2)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${weekCount === 2 ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>
            {t('auto.2_semaines')}</button>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs font-medium text-gray-500 min-w-[120px]">{label}</span>
      <span className="text-sm font-medium" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function TlpPapBadge({ code, label, color }: { code: string; label: string; color: string }) {
  const isWhite = code === 'WHITE';
  return (
    <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${isWhite ? 'border border-gray-400' : ''}`} style={{ backgroundColor: isWhite ? 'transparent' : '#000000', color: isWhite ? '#374151' : color }}>
      {label}
    </span>
  );
}

function TaskReportCard({
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
                <Lock className="w-2.5 h-2.5" /> {t('auto.fermee_35')}</span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                <CheckCircle className="w-2.5 h-2.5" /> {t('auto.ouverte_36')}</span>
            )}
            {isClosed && task.result && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${task.result.color}20`, color: task.result.color }}>
                {task.result.label}
              </span>
            )}
            {isPeriodReport && activityStatus !== undefined && !isClosed && (
              <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${activityStatus ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {activityStatus ? <><Activity className="w-2.5 h-2.5" /> {t('auto.en_cours')}</> : <><Minus className="w-2.5 h-2.5" /> {t('auto.pas_d_avancement')}</>}
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
          {task.description && <div className="mt-2 text-xs text-gray-600 leading-relaxed rich-text-content" dangerouslySetInnerHTML={{ __html: task.description }} />}
          {events.length > 0 && (
            <div className="mt-3 bg-white rounded border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {t('auto.faits_marquants')}{events.length})
              </p>
              <div className="space-y-1.5">
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2 text-[11px] text-gray-600 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-100">
                    <span className="text-gray-400 flex-shrink-0 pt-px">{formatDateTimeShort(ev.event_datetime, i18n.language)}</span>
                    <span className="font-medium text-gray-700 flex-shrink-0">{ev.kill_chain ? t(`killChain.${ev.kill_chain}`, { defaultValue: ev.kill_chain }) : (ev.event_type ? t(`report.event_types.${ev.event_type}`, { defaultValue: ev.event_type }) : '')}</span>
                    <span className="flex items-center gap-1 text-gray-500 flex-shrink-0">
                      {ev.source_system?.name || '?'}
                      {ev.target_system && (
                        <>
                          {ev.direction === 'target_to_source' ? <ArrowLeft className="w-2.5 h-2.5 inline" /> : <ArrowRight className="w-2.5 h-2.5 inline" />}
                          {ev.target_system.name}
                        </>
                      )}
                    </span>
                    {ev.description && <span className="text-gray-400 truncate">{ev.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {isClosed && task.closure_comment && (
            <div className="mt-2 bg-white rounded border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">{t('auto.commentaire_de_fermeture_37')}</p>
              <div dangerouslySetInnerHTML={{ __html: task.closure_comment }} className="text-xs text-gray-700 leading-relaxed rich-text-content" />
              {task.closed_at && (
                <p className="mt-2 text-[10px] text-gray-400">
                  {t('auto.fermee_le')}{formatDate(task.closed_at, i18n.language)}
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

const SYSTEM_TYPE_ICONS: Record<string, typeof Monitor> = {
  ordinateur: Monitor,
  serveur: Server,
  telephone: Smartphone,
  tablette: Tablet,
  tv: Tv,
  equipement_reseau: Router,
  equipement_iot: Cpu,
  autre: HelpCircle,
};

const INVESTIGATION_STATUS_REPORT: Record<string, { label: string; icon: typeof ShieldCheck; bg: string; text: string; border: string }> = {
  clean: { label: 'Sain', icon: ShieldCheck, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  compromised: { label: 'Compromis / Accede', icon: ShieldAlert, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  infected: { label: 'Infecte', icon: ShieldX, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  unknown: { label: 'Inconnu', icon: ShieldQuestion, bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

function SystemsSection({ systems, title }: { systems: (ReportSystem & { computedStatus: string })[]; title: string }) {
  const { t } = useTranslation();
  const filtered = systems.filter(s => s.computedStatus === 'compromised' || s.computedStatus === 'infected');
  if (filtered.length === 0) return null;
  const SectionIcon = ShieldAlert;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={SectionIcon} title={title} />
      <div className="mt-4 space-y-2">
        {filtered.map(sys => {
          const TypeIcon = SYSTEM_TYPE_ICONS[sys.system_type] || HelpCircle;
          const statusCfg = INVESTIGATION_STATUS_REPORT[sys.computedStatus] || INVESTIGATION_STATUS_REPORT.unknown;
          const StatusIcon = statusCfg?.icon;
          return (
            <div key={sys.id} className={`flex items-start gap-3 rounded-lg border p-3 ${statusCfg ? `${statusCfg.bg} ${statusCfg.border}` : 'bg-slate-50 border-slate-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${statusCfg?.bg || 'bg-gray-100'}`}>
                <TypeIcon className={`w-4 h-4 ${statusCfg?.text || 'text-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{sys.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">{t(`report.system_types.${sys.system_type}`, { defaultValue: sys.system_type })}</span>
                  {statusCfg && StatusIcon && (
                    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                      <StatusIcon className="w-2.5 h-2.5" /> {statusCfg.label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  {sys.owner && <span className="text-xs text-gray-500">{t('auto.proprietaire_38')}{sys.owner}</span>}
                  {Array.isArray(sys.ip_addresses) && sys.ip_addresses.length > 0 && <span className="text-xs text-gray-500 font-mono">{sys.ip_addresses.map((ip: { ip: string }) => ip.ip).filter(Boolean).join(', ')}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttackerInfraSection({ items }: { items: any[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  const INFRA_TYPE_LABELS: Record<string, string> = {
    c2_server: 'Serveur C2', vpn: 'VPN', relay: 'Relais / Proxy',
    phishing_server: 'Serveur de phishing', exfil_server: "Serveur d'exfiltration",
    hosting: 'Hébergement', domain_registrar: 'Registrar / DNS', autre: 'Autre',
  };

  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={AlertTriangle} title={t('auto.systemes_utilises_par_l_attaqu')} />
      <div className="mt-4 space-y-2">
        {items.map((item: any) => {
          const ips = typeof item.ip_addresses === 'string' ? JSON.parse(item.ip_addresses) : (item.ip_addresses || []);
          const validIps = ips.filter((ip: any) => ip.ip?.trim());
          return (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3 bg-slate-50 border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-slate-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                    {INFRA_TYPE_LABELS[item.infra_type] || item.infra_type}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                )}
                {validIps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {validIps.map((ip: any, i: number) => (
                      <span key={i} className="text-[11px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                        {ip.ip}{ip.mask ? ip.mask : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function CompromisedAccountsSection({ accounts }: { accounts: ReportCompromisedAccount[] }) {
  const { t, i18n } = useTranslation();
  if (accounts.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={KeyRound} title={t('auto.comptes_compromis')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.compte_39')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.privileges')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.premiere_activite')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.derniere_activite')}</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => (
              <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-mono font-medium text-gray-800">
                  {a.domain ? `${a.domain}\\${a.account_name}` : a.account_name}
                  {a.sid && <span className="block text-[10px] text-gray-400 font-normal">{a.sid}</span>}
                </td>
                <td className="px-3 py-2 text-gray-700">{t(`report.privileges.${a.privileges}`, { defaultValue: a.privileges })}</td>
                <td className="px-3 py-2 text-gray-600">{a.first_malicious_activity ? formatDateTime(a.first_malicious_activity, i18n.language) : <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{a.last_malicious_activity ? formatDateTime(a.last_malicious_activity, i18n.language) : <span className="text-gray-400 italic">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MalwareSection({ items }: { items: ReportMalware[] }) {
  const { t, i18n } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Bug} title={t('auto.malwares_et_outils')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.fichier')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.statut')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.systeme_40')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.date_creation')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m, i) => (
              <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2">
                  <span className="font-mono font-medium text-gray-800">{m.file_name}</span>
                  {m.file_path && <span className="block text-[10px] text-gray-400">{m.file_path}</span>}
                </td>
                <td className="px-3 py-2">
                  {m.is_malicious === true ? (
                    <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle className="w-3 h-3" /> {t('auto.malveillant')}</span>
                  ) : m.is_malicious === false ? (
                    <span className="text-gray-500">{t('auto.outil_legitime')}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-medium"><HelpCircle className="w-3 h-3" /> {t('auto.inconnu', 'Inconnu')}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{m.system_name || <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{m.creation_date ? formatDateTime(m.creation_date, i18n.language) : <span className="text-gray-400 italic">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NetworkIndicatorsSection({ indicators }: { indicators: ReportNetworkIndicator[] }) {
  const { t, i18n } = useTranslation();
  if (indicators.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Network} title={t('auto.indicateurs_reseau')} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.indicateur_41')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.port')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.malware_associe')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.premiere_activite')}</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">{t('auto.derniere_activite')}</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, i) => (
              <tr key={ind.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-mono text-gray-800">
                  {ind.ip && <span className="block">{ind.ip}</span>}
                  {ind.domain_name && <span className="block">{ind.domain_name}</span>}
                  {ind.url && <span className="block text-[10px] break-all">{ind.url}</span>}
                </td>
                <td className="px-3 py-2 text-gray-600">{ind.port ?? <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{ind.malware_file_name || <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{ind.first_activity ? formatDateTime(ind.first_activity, i18n.language) : <span className="text-gray-400 italic">N/A</span>}</td>
                <td className="px-3 py-2 text-gray-600">{ind.last_activity ? formatDateTime(ind.last_activity, i18n.language) : <span className="text-gray-400 italic">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExfiltrationsSection({ exfiltrations }: { exfiltrations: ReportExfiltration[] }) {
  const { t, i18n } = useTranslation();
  if (exfiltrations.length === 0) return null;
  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={PackageOpen} title={t('auto.exfiltrations')} />
      <div className="mt-4 space-y-2">
        {exfiltrations.map((e) => (
          <div key={e.id} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-orange-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-800">{e.exfiltration_date ? formatDateTime(e.exfiltration_date, i18n.language) : <span className="italic text-gray-400">{t('auto.date_inconnue')}</span>}</span>
              </div>
              {e.file_name && <span className="text-xs font-mono text-gray-700">{e.file_name} {e.file_size != null && <span className="text-gray-500 ml-1">({e.file_size} {e.file_size_unit || ''})</span>}</span>}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 mt-1.5 text-xs text-gray-600">
              {e.source_system_name && <span>{t('auto.source')}<span className="font-medium">{e.source_system_name}</span></span>}
              {e.exfil_system_name && <span>{t('auto.via')}<span className="font-medium">{e.exfil_system_name}</span></span>}
              {e.destination_system_name && <span>{t('auto.destination_42')}<span className="font-medium">{e.destination_system_name}</span></span>}
            </div>
            {e.content_description && <div className="mt-2 text-xs text-gray-600 rich-text-content" dangerouslySetInnerHTML={{ __html: e.content_description }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string, lng: string) {
  return new Date(dateStr).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string, lng: string) {
  return new Date(dateStr).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTimeShort(dateStr: string, lng: string) {
  return new Date(dateStr).toLocaleDateString(lng === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function computeDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days === 0 && hours === 0) return "Moins d'une heure";
  if (days === 0) return `${hours} heure${hours > 1 ? 's' : ''}`;
  if (hours === 0) return `${days} jour${days > 1 ? 's' : ''}`;
  return `${days} jour${days > 1 ? 's' : ''} et ${hours} heure${hours > 1 ? 's' : ''}`;
}

function ActivityHistorySection({ logs }: { logs: AuditLog[] }) {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  if (logs.length === 0) return null;

  const handleEntryClick = (log: AuditLog) => {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    const taskId = log.entity_type === 'task' ? log.entity_id : details?.task_id;

    if (taskId) {
      const params = new URLSearchParams(searchParams);
      params.set('section', 'tasks');
      params.set('task', taskId);

      // Deep link to specific tab and highlight target if applicable
      if (log.action.includes('highlight')) {
        params.set('tab', 'events');
        if (details.event_id) params.set('target', details.event_id);
      } else if (log.action.includes('comment')) {
        params.set('tab', 'comments');
        if (details.comment_id) params.set('target', details.comment_id);
      } else if (log.action.includes('file')) {
        params.set('tab', 'files');
      }

      setSearchParams(params);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="px-8 py-6 border-t border-gray-100">
      <SectionHeader icon={Clock} title={t('report.history')} />
      <div className="mt-4 space-y-2">
        {logs.map((log) => {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
          const taskId = log.entity_type === 'task' ? log.entity_id : details?.task_id;
          const isClickable = !!taskId;

          return (
            <div
              key={log.id}
              onClick={() => isClickable && handleEntryClick(log)}
              className={`flex items-start gap-3 text-xs py-2 border-b border-gray-50 last:border-0 ${isClickable ? 'cursor-pointer hover:bg-gray-50 p-1 -mx-1 rounded transition-colors' : ''}`}
            >
              <span className="text-gray-400 font-mono whitespace-nowrap">{formatDateTimeShort(log.created_at, i18n.language)}</span>
              <span className="text-gray-700">
                {String(t(details.changes ? `audit.actions.${log.action}_with_changes` : `audit.actions.${log.action}`, {
                  user: details.user_full_name || details.performed_by_name || 'System',
                  ...details,
                  changes: details.changes ? details.changes.split(', ').map((c: string) => t(`audit.fields.${c.trim()}`)).join(', ') : ''
                }))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
