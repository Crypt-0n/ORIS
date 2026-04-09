import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../../lib/api';
import {
  CaseReportData,
  ReportTask,
  ReportTaskEvent,
  CaseEvent,
  TaskComment,
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
  const [allStixObjects, setAllStixObjects] = useState<any[]>([]);
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
      // Fetch all objects from bundle
      const bundle: any = await api.get(`/stix/bundle/${caseId}`);
      if (bundle && bundle.objects) {
        setAllStixObjects(bundle.objects);
      }

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

  const filteredStixObjects = useMemo(() => {
    if (!allStixObjects || allStixObjects.length === 0) return {};
    
    const DISPLAY_TYPES = ['infrastructure', 'malware', 'user-account', 'indicator', 'ipv4-addr', 'domain-name', 'url', 'file'];
    
    let objectsToKeep = allStixObjects.filter(obj => DISPLAY_TYPES.includes(obj.type));
    
    if (dateRange) {
      objectsToKeep = objectsToKeep.filter(obj => {
        const dateStr = obj.created || obj.created_at || (obj.data && (obj.data.first_observed || obj.data.created));
        if (!dateStr) return true;
        return dateStr <= dateRange.end;
      });
    }
    
    const grouped: Record<string, any[]> = {};
    for (const obj of objectsToKeep) {
      if (!grouped[obj.type]) grouped[obj.type] = [];
      grouped[obj.type].push(obj);
    }
    
    for (const t in grouped) {
      grouped[t].sort((a, b) => {
        const labelA = (a.name || a.value || a.display_name || a.user_id || a.id || '').toLowerCase();
        const labelB = (b.name || b.value || b.display_name || b.user_id || b.id || '').toLowerCase();
        return labelA.localeCompare(labelB);
      });
    }

    return grouped;
  }, [allStixObjects, dateRange]);

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
    filteredStixObjects,
    filteredAttackerInfra,
    filteredAuditLogs,
  };
}
