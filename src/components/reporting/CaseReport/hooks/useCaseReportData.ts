import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../lib/api';
import {
  CaseReportData,
  ReportTask,
  ReportTaskEvent,
  CaseEvent,
  TaskComment,
  ReportSystem,
  ReportCompromisedAccount,
  ReportNetworkIndicator,
  ReportMalware,
  ReportExfiltration,
  AuditLog,
  ReportType,
} from '../types';

interface DateRange {
  start: string;
  end: string;
  label: string;
}

export function useCaseReportData(
  caseId: string,
  reportType: ReportType,
  selectedDate: string,
  weekCount: 1 | 2,
  language: string,
  formatDate: (date: string, lng: string) => string
) {
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

  const dateRange = useMemo<DateRange | null>(() => {
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
        ? formatDate(start.toISOString(), language)
        : `du ${formatDate(start.toISOString(), language)} au ${formatDate(end.toISOString(), language)}`,
    };
  }, [reportType, selectedDate, weekCount, language, formatDate]);

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

      setAttackerInfraData([]);

      const logs = await api.get(`/audit/case/${caseId}`);
      if (logs) {
        setAuditLogs(logs as AuditLog[]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const computedTasks = useMemo(() => {
    if (reportType === 'full' || !dateRange) {
      return {
        displayTasks: tasks,
        filteredEventsMap: taskEventsMap,
        periodFirstEvent: firstEvent,
        periodLastEvent: lastEvent,
        taskActivityMap: null as Record<string, boolean> | null,
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
    const filteredEventsMap: Record<string, ReportTaskEvent[]> = {};
    for (const [taskId, events] of Object.entries(taskEventsMap)) {
      const inRange = events.filter(e => {
        const createdAtIso = e.created_at.replace(' ', 'T') + 'Z';
        return createdAtIso >= start && createdAtIso <= end;
      });
      if (inRange.length > 0) filteredEventsMap[taskId] = inRange;
    }
    const eventsInRange = allEvents.filter(e => {
      const createdAtIso = e.created_at.replace(' ', 'T') + 'Z';
      return createdAtIso >= start && createdAtIso <= end;
    });
    const periodFirstEvent = eventsInRange.length > 0 ? eventsInRange[0].event_datetime : null;
    const periodLastEvent = eventsInRange.length > 0 ? eventsInRange[eventsInRange.length - 1].event_datetime : null;
    
    const taskActivityMap: Record<string, boolean> = {};
    for (const task of tasks) {
      if (task.created_at > end) continue;
      if (historicalStatus[task.id] === 'closed' && task.closed_at && task.closed_at < start) continue;
      let hasAct = false;
      if (filteredEventsMap[task.id]?.length > 0) hasAct = true;
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
      taskActivityMap[task.id] = hasAct;
    }
    const displayTasks = tasks.filter(t => {
      if (t.created_at > end) return false;
      const hStatus = historicalStatus[t.id];
      if (hStatus === 'open') return true;
      return !!taskActivityMap[t.id];
    });
    return {
      displayTasks,
      filteredEventsMap,
      periodFirstEvent,
      periodLastEvent,
      taskActivityMap,
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
    return compromisedAccounts.filter(a => (a.first_malicious_activity || a.created_at) <= dateRange.end);
  }, [compromisedAccounts, dateRange]);

  const filteredIndicators = useMemo(() => {
    if (!dateRange) return networkIndicators;
    return networkIndicators.filter(i => (i.first_activity || i.created_at) <= dateRange.end);
  }, [networkIndicators, dateRange]);

  const filteredMalware = useMemo(() => {
    if (!dateRange) return malwareTools;
    return malwareTools.filter(m => m.created_at <= dateRange.end);
  }, [malwareTools, dateRange]);

  const filteredExfiltrations = useMemo(() => {
    if (!dateRange) return exfiltrations;
    return exfiltrations.filter(e => e.created_at <= dateRange.end);
  }, [exfiltrations, dateRange]);

  const filteredAttackerInfra = useMemo(() => {
    if (!dateRange) return attackerInfraData;
    return attackerInfraData.filter((a: any) => (a.created_at || '') <= dateRange.end);
  }, [attackerInfraData, dateRange]);

  const filteredAuditLogs = useMemo(() => {
    if (!dateRange) return auditLogs;
    return auditLogs.filter(l => l.created_at <= dateRange.end);
  }, [auditLogs, dateRange]);

  return {
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
    filteredAuditLogs,
  };
}
