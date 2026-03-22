import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { getUserTrigram } from '../lib/userUtils';
import { ArrowLeft, Edit, Trash2, MessageCircle, User, Share2, Lock, RotateCcw, Pencil, X, Server, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, Clock, ArrowRight, Edit3, Radar, Database, Bug, ChevronDown, Columns, LayoutList, List } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { TaskComments } from './TaskComments';
import { CloseTask } from './CloseTask';
import { RichTextEditor } from './RichTextEditor';
import { AddTimelineEvent } from './investigation/AddTimelineEvent';
import type { TimelineEventData } from './investigation/AddTimelineEvent';
import { getKillChainPhase } from '../lib/killChainDefinitions';

import { TaskObjectsPanel } from './TaskObjectsPanel';
import { ActiveUsers } from './ActiveUsers';
import { useTranslation } from "react-i18next";
import { useSearchParams } from 'react-router-dom';

interface TaskDetailsData {
  id: string;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  status: string;
  closure_comment: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closed_by_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  closure_comment_modified_by: string | null;
  closure_comment_modified_at: string | null;
  closure_comment_modified_by_user: {
    id: string;
    full_name: string;
  } | null;
  created_by_user: {
    id: string;
    full_name: string;
    email: string;
  };
  assigned_to_user: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  result: {
    label: string;
    color: string;
  } | null;
  system_id: string | null;
  initial_investigation_status: string | null;
  investigation_status: string | null;
  system: {
    id: string;
    name: string;
    system_type: string;
  } | null;
  malware_id: string | null;
  malware: {
    id: string;
    file_name: string;
    is_malicious: boolean;
  } | null;
  is_osint: boolean;
  can_edit_task?: boolean;
}

const INVESTIGATION_STATUS_MAP: Record<string, { label: string; icon: typeof ShieldCheck; textClass: string; bgClass: string; borderClass: string }> = {
  unknown: { label: 'Inconnu', icon: ShieldQuestion, textClass: 'text-slate-500 dark:text-slate-400', bgClass: 'bg-slate-100 dark:bg-slate-800', borderClass: 'border-slate-300 dark:border-slate-600' },
  clean: { label: 'Sain', icon: ShieldCheck, textClass: 'text-green-700 dark:text-green-400', bgClass: 'bg-green-50 dark:bg-green-900/20', borderClass: 'border-green-200 dark:border-green-800' },
  compromised: { label: 'Compromis / Accede', icon: ShieldAlert, textClass: 'text-amber-700 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-900/20', borderClass: 'border-amber-200 dark:border-amber-800' },
  infected: { label: 'Infecte', icon: ShieldX, textClass: 'text-red-700 dark:text-red-400', bgClass: 'bg-red-50 dark:bg-red-900/20', borderClass: 'border-red-200 dark:border-red-800' },
};



interface TaskEvent {
  id: string;
  event_datetime: string;
  notes?: string;
  direction: string | null;
  kill_chain: string | null;
  malware_id: string | null;
  compromised_account_id: string | null;
  exfiltration_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  source_system: { id: string; name: string } | null;
  target_system: { id: string; name: string } | null;
  creator_name?: string;
}

interface Participant {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface TaskDetailsProps {
  taskId: string;
  caseId: string;
  isClosed: boolean;
  onBack: () => void;
  onDelete?: () => void;
}

export function TaskDetails({ taskId, caseId, isClosed, onBack, onDelete }: TaskDetailsProps) {
  const { t } = useTranslation();
  const { user, hasAnyRole } = useAuth();

  const [taskData, setTaskData] = useState<TaskDetailsData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showEditClosureComment, setShowEditClosureComment] = useState(false);
  const [editClosureComment, setEditClosureComment] = useState('');
  const [savingClosureEdit, setSavingClosureEdit] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [caseAuthorId, setCaseAuthorId] = useState<string | null>(null);
  const [caseKillChainType, setCaseKillChainType] = useState<string | null>(null);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showTimelineForm, setShowTimelineForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEventData | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([]);
  const [searchParams] = useSearchParams();
  const targetEventId = searchParams.get('target');
  const [commentCount, setCommentCount] = useState(0);
  const [objectCount, setObjectCount] = useState(0);
  const [systemsList, setSystemsList] = useState<any[]>([]);
  const [indicatorsList, setIndicatorsList] = useState<any[]>([]);
  const [sectionOpen, setSectionOpen] = useState({ discussion: true, events: true, objects: true });
  const toggleSection = (key: 'discussion' | 'events' | 'objects') => setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));

  type ViewMode = 'timeline' | 'split' | 'accordion';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('oris_task_view_mode');
    return (saved === 'timeline' || saved === 'split' || saved === 'accordion') ? saved : 'split';
  });
  const changeViewMode = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem('oris_task_view_mode', mode); };

  const isCreator = taskData?.created_by === user?.id;
  const isAssignee = taskData?.assigned_to === user?.id;
  const isCaseTeamLeader = caseAuthorId === user?.id;
  const canEditTask = taskData?.can_edit_task || isCreator || isAssignee || isCaseTeamLeader;
  // If a user has explicit contextual task editing rights, they are definitively not Read-Only, overriding any lack of global user roles.
  const isReadOnly = !canEditTask && !hasAnyRole(['admin', 'team_leader', 'user', 'case_manager', 'case_user']);

  const handleShareTask = () => {
    const url = `${window.location.origin}/cases/${caseId}?task=${taskId}`;
    navigator.clipboard.writeText(url).then(() => {
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
    });
  };

  useEffect(() => {
    fetchTaskData();
    fetchCaseAuthor();
  }, [taskId]);

  useEffect(() => {
    if (taskData) {
      const count = calculateObjectCount(taskEvents, taskData, systemsList, indicatorsList);
      setObjectCount(count);
    }
  }, [taskEvents, taskData, systemsList]);

  const fetchCaseAuthor = async () => {
    try {
      const data = await api.get(`/cases/${caseId}`);
      if (data) {
        setCaseAuthorId(data.author_id);
        setCaseKillChainType(data.kill_chain_type ?? null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTaskData = async () => {
    setLoading(true);
    try {
      const [taskRes, eventsRes, usersRes, systemsRes, _filesRes, indicatorsRes, commentsRes] = await Promise.all([
        api.get(`/tasks/${taskId}`),
        api.get(`/investigation/events/by-case/${caseId}`),
        api.get('/auth/users'),
        api.get(`/investigation/systems/by-case/${caseId}`),
        api.get(`/files/task/${taskId}`),
        api.get(`/investigation/indicators/by-case/${caseId}`),
        api.get(`/comments/by-task/${taskId}`),
        api.get(`/investigation/diamond-overrides/by-case/${caseId}`)
      ]);

      if (taskRes) {
        setTaskData(taskRes);

        // Participants
        const participantsList: Participant[] = [];
        const addedIds = new Set<string>();
        if (taskRes.created_by_user) {
          participantsList.push({
            id: taskRes.created_by_user.id,
            full_name: taskRes.created_by_user.full_name,
            email: taskRes.created_by_user.email,
            role: 'Créateur',
          });
          addedIds.add(taskRes.created_by_user.id);
        }
        if (taskRes.assigned_to_user) {
          if (!addedIds.has(taskRes.assigned_to_user.id)) {
            participantsList.push({
              id: taskRes.assigned_to_user.id,
              full_name: taskRes.assigned_to_user.full_name,
              email: taskRes.assigned_to_user.email,
              role: 'Assigné',
            });
          }
        }
        setParticipants(participantsList);
      }

      if (eventsRes) {
        const events = eventsRes.filter((e: any) => e.task_id === taskId);
        const creatorMap = new Map<string, string>();
        (usersRes || []).forEach((p: any) => creatorMap.set(p.id, p.full_name));
        const systemsMap = new Map<string, { id: string; name: string }>();
        (systemsRes || []).forEach((s: any) => systemsMap.set(s.id, { id: s.id, name: s.name }));

        // Diamond Overrides
        const ovRes = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
        const overridesMap = new Map<string, any>();
        (ovRes || []).forEach((o: any) => overridesMap.set(o.event_id, o));

        setSystemsList(systemsRes || []);
        setIndicatorsList(indicatorsRes || []);

        const enriched = events.map((e: any) => {
          const ov = overridesMap.get(e.id);
          let infra: any[] = [];
          let vic: any[] = [];
          if (ov) {
            try { infra = JSON.parse(ov.infrastructure || '[]'); } catch (err) { }
            try { vic = JSON.parse(ov.victim || '[]'); } catch (err) { }
          }
          const sourceSys = infra.length > 0 && infra[0].type === 'system' ? systemsMap.get(infra[0].id) : null;
          const targetSys = vic.length > 0 && vic[0].type === 'system' ? systemsMap.get(vic[0].id) : null;

          return {
            ...e,
            source_system: sourceSys,
            target_system: targetSys,
            notes: ov?.notes || null,
            creator_name: creatorMap.get(e.created_by) || undefined,
          };
        }).sort((a: any, b: any) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());

        setTaskEvents(enriched);

        if (targetEventId) {
          setTimeout(() => {
            const element = document.getElementById(`event-${targetEventId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        }
      }



      if (commentsRes) {
        setCommentCount(commentsRes.length);
      }

      if (eventsRes && systemsRes && taskRes) {
        const events = eventsRes.filter((e: any) => e.task_id === taskId);
        const count = calculateObjectCount(events, taskRes, systemsRes, indicatorsRes || []);
        setObjectCount(count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateObjectCount = (events: TaskEvent[], task: TaskDetailsData | null, systemsData: any[], indicatorsData: any[]) => {
    if (!task) return 0;

    const systemIds = new Set<string>();
    const malwareIds = new Set<string>();
    const accountIds = new Set<string>();
    const exfiltrationIds = new Set<string>();

    const sid = task.system_id || task.system?.id;
    if (sid) systemIds.add(sid);

    const mid = task.malware_id || task.malware?.id;
    if (mid) malwareIds.add(mid);

    events.forEach((ev: any) => {
      if (ev.source_system?.id) systemIds.add(ev.source_system.id);
      if (ev.target_system?.id) systemIds.add(ev.target_system.id);
      if (ev.malware_id) malwareIds.add(ev.malware_id);
      if (ev.compromised_account_id) accountIds.add(ev.compromised_account_id);
      if (ev.exfiltration_id) exfiltrationIds.add(ev.exfiltration_id);
    });

    const sysIdsWithIndicators = new Set((systemsData || []).filter(s => !!s.network_indicator_id).map(s => s.network_indicator_id));
    const taskNetIndicators = (indicatorsData || []).filter(n => {
      if (sysIdsWithIndicators.has(n.id)) {
        const linkedSys = systemsData.find(s => s.network_indicator_id === n.id);
        return linkedSys && systemIds.has(linkedSys.id);
      }
      return false;
    });

    return systemIds.size + malwareIds.size + accountIds.size + exfiltrationIds.size + taskNetIndicators.length;
  };

  const handleDeleteEvent = async (eventId: string) => {
    setDeletingEventId(eventId);
    try {
      await api.delete(`/investigation/events/${eventId}`);
      setTaskEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (err) {
      console.error(err);
    }
    setDeletingEventId(null);
  };

  const handleReopenTask = async () => {
    if (!user) return;
    setReopening(true);
    try {
      await api.put(`/tasks/${taskId}`, {
        status: 'open',
        closed_at: null,
        closed_by: null,
        closure_comment: null,
      });
      setShowReopenConfirm(false);
      fetchTaskData();
    } catch (err) {
      console.error(err);
    }
    setReopening(false);
  };

  const handleSaveClosureComment = async () => {
    if (!user || !editClosureComment.trim()) return;
    setSavingClosureEdit(true);
    try {
      await api.put(`/tasks/${taskId}`, {
        closure_comment: editClosureComment.trim(),
        closure_comment_modified_by: user.id,
        closure_comment_modified_at: new Date().toISOString()
      });
      setShowEditClosureComment(false);
      fetchTaskData();
    } catch (err) {
      console.error(err);
    }
    setSavingClosureEdit(false);
  };

  const handleSaveInitialStatus = async (newStatus: string) => {
    setSavingStatus(true);
    try {
      await api.put(`/tasks/${taskId}`, {
        initial_investigation_status: newStatus || null
      });
      setShowStatusPicker(false);
      fetchTaskData();
    } catch (err) {
      console.error(err);
    }
    setSavingStatus(false);
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
      onDelete?.();
      onBack();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !taskData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-slate-400">{t('auto.chargement')}</div>
      </div>
    );
  }

  const isTaskClosed = taskData.status === 'closed';
  const isEffectivelyClosed = isClosed || isTaskClosed;

  return (
    <div className="space-y-4 sm:space-y-6">
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
                  onClick={handleShareTask}
                  className="text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition relative flex-shrink-0"
                  title={t('auto.partager_le_lien_de_la_t_che')}
                >
                  <Share2 className="w-4 h-4" />
                  {showCopiedMessage && (
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {t('auto.lien_copie')}</span>
                  )}
                </button>
                {!isEffectivelyClosed && canEditTask && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    {canEditTask && (
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 text-sm"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        {t('auto.modifier')}</button>
                    )}
                    <button
                      onClick={() => setShowCloseModal(true)}
                      className="bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition flex items-center gap-1.5 text-sm"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {t('auto.fermer')}</button>
                    {canEditTask && (
                      <button
                        onClick={handleDelete}
                        className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition flex items-center gap-1.5 text-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('auto.supprimer')}</button>
                    )}
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
                  {t('auto.investigation')}{taskData.system.name}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isEffectivelyClosed && canEditTask && (
                    <div className="relative">
                      <button
                        onClick={() => setShowStatusPicker(v => !v)}
                        title={t('auto.modifier_le_statut_initial')}
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
                          : <><Pencil className="w-2.5 h-2.5" />{t('auto.statut_initial')}</>
                        }
                      </button>
                      {showStatusPicker && (
                        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg p-2 min-w-[200px]">
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1">{t('auto.statut_initial')}</p>
                          {Object.entries(INVESTIGATION_STATUS_MAP).map(([value, cfg]) => {
                            const StatusIcon = cfg.icon;
                            const isSelected = taskData.initial_investigation_status === value;
                            return (
                              <button
                                key={value}
                                disabled={savingStatus}
                                onClick={() => handleSaveInitialStatus(isSelected ? '' : value)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition text-xs ${isSelected ? `${cfg.bgClass} ${cfg.textClass}` : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
                                  }`}
                              >
                                <StatusIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? cfg.textClass : 'text-gray-500 dark:text-slate-400'}`} />
                                {cfg.label}
                                {isSelected && <span className="ml-auto text-[9px] opacity-60">{t('auto.cliquer_pour_effacer')}</span>}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setShowStatusPicker(false)}
                            className="mt-1 w-full text-[10px] text-center text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 py-1"
                          >
                            {t('auto.annuler')}</button>
                        </div>
                      )}
                    </div>
                  )}
                  {isEffectivelyClosed && taskData.initial_investigation_status && (() => {
                    const cfg = INVESTIGATION_STATUS_MAP[taskData.initial_investigation_status];
                    if (!cfg) return null;
                    const StatusIcon = cfg.icon;
                    return (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`} title={t('auto.statut_initial')}>
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`} title={t('auto.statut_final_fermeture')}>
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
                  {t('auto.analyse_malware')}{taskData.malware.file_name}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${taskData.malware.is_malicious === true
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                  : taskData.malware.is_malicious === false
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  }`}>
                  {taskData.malware.is_malicious === true ? t('auto.malveillant') : taskData.malware.is_malicious === false ? t('auto.non_malveillant') : t('auto.inconnu', 'Inconnu')}
                </span>
              </div>
            )}
            {taskData.is_osint && (
              <div className="flex items-center gap-2 mt-1">
                <Radar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
                  {t('auto.tache_osint')}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800">
                  {t('auto.open_source_intelligence')}</span>
              </div>
            )}
            <p className="text-gray-600 dark:text-slate-300 text-xs sm:text-sm">
              {t('auto.cree_le')} {new Date(taskData.created_at).toLocaleDateString('fr-FR')} {t('auto.par')} {taskData.created_by_user.full_name}
            </p>
            <ActiveUsers caseId={caseId} taskId={taskId} />
          </div>
        </div>
        {!isEffectivelyClosed && canEditTask && (
          <div className="flex sm:hidden flex-col gap-2">
            {canEditTask && (
              <button
                onClick={() => setShowEditModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 w-full"
              >
                <Edit className="w-4 h-4" />
                {t('auto.modifier')}</button>
            )}
            <button
              onClick={() => setShowCloseModal(true)}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2 w-full"
            >
              <Lock className="w-4 h-4" />
              {t('auto.fermer')}</button>
            {canEditTask && (
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2 w-full"
              >
                <Trash2 className="w-4 h-4" />
                {t('auto.supprimer')}</button>
            )}
          </div>
        )}

      </div>

      {isTaskClosed && taskData.closure_comment && (
        <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('auto.commentaire_de_fermeture_2')}</h3>
            </div>
            {canEditTask && !isClosed && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditClosureComment(taskData.closure_comment || '');
                    setShowEditClosureComment(true);
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t('auto.modifier')}</button>
                <button
                  onClick={() => setShowReopenConfirm(true)}
                  className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('auto.reouvrir')}</button>
              </div>
            )}
          </div>
          <div
            className="text-gray-700 dark:text-slate-300 text-sm rich-text-content"
            dangerouslySetInnerHTML={{ __html: taskData.closure_comment }}
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
      )}

      <div className="space-y-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t('auto.description')}</h3>
            <div
              className="text-gray-700 dark:text-slate-300 rich-text-content"
              dangerouslySetInnerHTML={{ __html: taskData.description }}
            />
          </div>

          {/* View mode switcher */}
          <div className="flex items-center justify-end gap-1 mb-2">
            {([
              { key: 'timeline' as ViewMode, icon: List, label: 'Timeline' },
              { key: 'split' as ViewMode, icon: Columns, label: 'Split' },
              { key: 'accordion' as ViewMode, icon: LayoutList, label: 'Accordéon' },
            ]).map(v => (
              <button
                key={v.key}
                onClick={() => changeViewMode(v.key)}
                title={v.label}
                className={`p-1.5 rounded-lg transition ${viewMode === v.key
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <v.icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* ======================== VIEW A: TIMELINE ======================== */}
          {viewMode === 'timeline' && (
            <div className="space-y-6">
              {/* Events in chronological order */}
              {taskEvents.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-amber-500">
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('taskDetails.tabEvents')}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{taskEvents.length}</span>
                    </div>
                    {!isReadOnly && !isEffectivelyClosed && (
                      <button
                        onClick={() => { setEditingEvent(null); setShowTimelineForm(true); }}
                        className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition"
                      >
                        + {t('auto.ajouter')}
                      </button>
                    )}
                  </div>
                  <div className="px-5 pb-5 space-y-3">
                    {taskEvents.map((event) => {
                      const kcPhase = event.kill_chain ? getKillChainPhase(caseKillChainType ?? null, event.kill_chain) : null;
                      const canEdit = !isEffectivelyClosed && event.created_by === user?.id;
                      return (
                        <div key={event.id} id={`event-${event.id}`}
                          className={`border rounded-lg p-3 transition-all duration-500 ${event.id === targetEventId
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500/50 ring-2 ring-amber-500/30'
                            : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: kcPhase ? `${kcPhase.hexColor}20` : undefined, color: kcPhase?.hexColor }}>
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-gray-800 dark:text-white">{event.kill_chain ? t(`killChain.${event.kill_chain}`) : t('auto.non_specifie')}</span>
                                <span className="text-xs text-gray-400 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(event.event_datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                                <span className="font-medium text-purple-700 dark:text-purple-400">{t('diamond.infrastructure')} : {event.source_system?.name || t('auto.systeme_inconnu')}</span>
                                {event.target_system && (<><ArrowRight className="w-3 h-3 text-gray-400" /><span className="font-medium text-blue-700 dark:text-blue-400">{t('diamond.victim')} : {event.target_system.name}</span></>)}
                              </div>
                              {(event as any).notes && (
                                <div className="mt-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-500 rounded-r-lg">
                                  <p className="text-[11px] text-gray-700 dark:text-slate-300 whitespace-pre-wrap italic">{(event as any).notes}</p>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-700/50">
                                {event.creator_name && <span className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />{event.creator_name}</span>}
                                <span className="text-[11px] text-gray-500 dark:text-slate-400">{new Date(event.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-2 mt-2">
                                  <button onClick={() => { setEditingEvent({ id: event.id, event_datetime: event.event_datetime, kill_chain: event.kill_chain, malware_id: event.malware_id, compromised_account_id: event.compromised_account_id, exfiltration_id: event.exfiltration_id ?? null, source_system_id: event.source_system?.id || null, target_system_id: event.target_system?.id || null }); setShowTimelineForm(true); }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"><Edit3 className="w-3 h-3" />{t('auto.modifier')}</button>
                                  <button onClick={() => handleDeleteEvent(event.id)} disabled={deletingEventId === event.id} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"><Trash2 className="w-3 h-3" />{deletingEventId === event.id ? t('auto.suppression_en_cours') : t('auto.supprimer')}</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Discussion */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500 p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
                </div>
                {participants.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs font-medium text-gray-500 dark:text-slate-400">{t('taskDetails.tabParticipants')} ({participants.length})</span></div>
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => {
                        const cm: Record<string, { bg: string; avatar: string }> = { 'Créateur': { bg: 'bg-blue-50 dark:bg-blue-900/20', avatar: 'bg-blue-600' }, 'Assigné': { bg: 'bg-green-50 dark:bg-green-900/20', avatar: 'bg-green-600' }, 'Commentateur': { bg: 'bg-amber-50 dark:bg-amber-900/20', avatar: 'bg-amber-600' } };
                        const c = cm[p.role] || cm['Commentateur'];
                        return (<div key={p.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${c.bg} rounded-full`}><div className={`w-6 h-6 ${c.avatar} rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0`}>{getUserTrigram(p.full_name)}</div><span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate max-w-[120px]">{p.full_name}</span><span className="text-[10px] text-gray-500 dark:text-slate-400">{p.role}</span></div>);
                      })}
                    </div>
                  </div>
                )}
                <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} onNewEvent={isReadOnly ? undefined : () => { setEditingEvent(null); setShowTimelineForm(true); }} isReadOnly={isReadOnly} />
              </div>

              {/* Objects */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <Database className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('taskDetails.tabObjects')}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{objectCount}</span>
                </div>
                <TaskObjectsPanel caseId={caseId} taskId={taskId} isClosed={isEffectivelyClosed} onCountChange={setObjectCount} isReadOnly={isReadOnly} />
              </div>
            </div>
          )}

          {/* ======================== VIEW B: SPLIT ======================== */}
          {viewMode === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
              {/* Left column: Discussion */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500 p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
                </div>
                {participants.length > 0 && (
                  <div className="mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs font-medium text-gray-500 dark:text-slate-400">{t('taskDetails.tabParticipants')} ({participants.length})</span></div>
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => {
                        const cm: Record<string, { bg: string; avatar: string }> = { 'Créateur': { bg: 'bg-blue-50 dark:bg-blue-900/20', avatar: 'bg-blue-600' }, 'Assigné': { bg: 'bg-green-50 dark:bg-green-900/20', avatar: 'bg-green-600' }, 'Commentateur': { bg: 'bg-amber-50 dark:bg-amber-900/20', avatar: 'bg-amber-600' } };
                        const c = cm[p.role] || cm['Commentateur'];
                        return (<div key={p.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${c.bg} rounded-full`}><div className={`w-6 h-6 ${c.avatar} rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0`}>{getUserTrigram(p.full_name)}</div><span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate max-w-[120px]">{p.full_name}</span><span className="text-[10px] text-gray-500 dark:text-slate-400">{p.role}</span></div>);
                      })}
                    </div>
                  </div>
                )}
                <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} onNewEvent={isReadOnly ? undefined : () => { setEditingEvent(null); setShowTimelineForm(true); }} isReadOnly={isReadOnly} />
              </div>

              {/* Right column: Events + Objects */}
              <div className="space-y-6">
                {/* Events */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-amber-500">
                  <div className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('taskDetails.tabEvents')}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{taskEvents.length}</span>
                    </div>
                    {!isReadOnly && !isEffectivelyClosed && (
                      <button onClick={() => { setEditingEvent(null); setShowTimelineForm(true); }} className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition">+ {t('auto.ajouter')}</button>
                    )}
                  </div>
                  <div className="px-5 pb-5">
                    {taskEvents.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('auto.aucun_fait_marquant')}</p>
                    ) : (
                      <div className="space-y-3">
                        {taskEvents.map((event) => {
                          const kcPhase = event.kill_chain ? getKillChainPhase(caseKillChainType ?? null, event.kill_chain) : null;
                          const canEdit = !isEffectivelyClosed && event.created_by === user?.id;
                          return (
                            <div key={event.id} id={`event-${event.id}`}
                              className={`border rounded-lg p-3 transition-all duration-500 ${event.id === targetEventId
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500/50 ring-2 ring-amber-500/30'
                                : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: kcPhase ? `${kcPhase.hexColor}20` : undefined, color: kcPhase?.hexColor }}>
                                  <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-gray-800 dark:text-white">{event.kill_chain ? t(`killChain.${event.kill_chain}`) : t('auto.non_specifie')}</span>
                                    <span className="text-xs text-gray-400 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(event.event_datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                                    <span className="font-medium text-purple-700 dark:text-purple-400">{t('diamond.infrastructure')} : {event.source_system?.name || t('auto.systeme_inconnu')}</span>
                                    {event.target_system && (<><ArrowRight className="w-3 h-3 text-gray-400" /><span className="font-medium text-blue-700 dark:text-blue-400">{t('diamond.victim')} : {event.target_system.name}</span></>)}
                                  </div>
                                  {(event as any).notes && (
                                    <div className="mt-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-500 rounded-r-lg">
                                      <p className="text-[11px] text-gray-700 dark:text-slate-300 whitespace-pre-wrap italic">{(event as any).notes}</p>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-700/50">
                                    {event.creator_name && <span className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />{event.creator_name}</span>}
                                    <span className="text-[11px] text-gray-500 dark:text-slate-400">{new Date(event.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    {event.updated_at && event.updated_at !== event.created_at && (
                                      <span className="text-[11px] text-gray-500 dark:text-slate-400 italic">{t('auto.modifie_le_3')}{new Date(event.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })})</span>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button onClick={() => { setEditingEvent({ id: event.id, event_datetime: event.event_datetime, kill_chain: event.kill_chain, malware_id: event.malware_id, compromised_account_id: event.compromised_account_id, exfiltration_id: event.exfiltration_id ?? null, source_system_id: event.source_system?.id || null, target_system_id: event.target_system?.id || null }); setShowTimelineForm(true); }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"><Edit3 className="w-3 h-3" />{t('auto.modifier')}</button>
                                      <button onClick={() => handleDeleteEvent(event.id)} disabled={deletingEventId === event.id} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"><Trash2 className="w-3 h-3" />{deletingEventId === event.id ? t('auto.suppression_en_cours') : t('auto.supprimer')}</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {/* Objects */}
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <Database className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('taskDetails.tabObjects')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{objectCount}</span>
                  </div>
                  <TaskObjectsPanel caseId={caseId} taskId={taskId} isClosed={isEffectivelyClosed} onCountChange={setObjectCount} isReadOnly={isReadOnly} />
                </div>
              </div>
            </div>
          )}

          {/* ======================== VIEW C: ACCORDION ======================== */}
          {viewMode === 'accordion' && (
            <div className="space-y-4">
              {/* Section 1: Discussion */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500">
                <button onClick={() => toggleSection('discussion')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${sectionOpen.discussion ? '' : '-rotate-90'}`} />
                </button>
                {sectionOpen.discussion && (
                  <div className="px-5 pb-5 pt-1">
                    {participants.length > 0 && (
                      <div className="mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2"><User className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs font-medium text-gray-500 dark:text-slate-400">{t('taskDetails.tabParticipants')} ({participants.length})</span></div>
                        <div className="flex flex-wrap gap-2">
                          {participants.map(p => {
                            const cm: Record<string, { bg: string; avatar: string }> = { 'Créateur': { bg: 'bg-blue-50 dark:bg-blue-900/20', avatar: 'bg-blue-600' }, 'Assigné': { bg: 'bg-green-50 dark:bg-green-900/20', avatar: 'bg-green-600' }, 'Commentateur': { bg: 'bg-amber-50 dark:bg-amber-900/20', avatar: 'bg-amber-600' } };
                            const c = cm[p.role] || cm['Commentateur'];
                            return (<div key={p.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${c.bg} rounded-full`}><div className={`w-6 h-6 ${c.avatar} rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0`}>{getUserTrigram(p.full_name)}</div><span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate max-w-[120px]">{p.full_name}</span><span className="text-[10px] text-gray-500 dark:text-slate-400">{p.role}</span></div>);
                          })}
                        </div>
                      </div>
                    )}
                    <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} onNewEvent={isReadOnly ? undefined : () => { setEditingEvent(null); setShowTimelineForm(true); }} isReadOnly={isReadOnly} />
                  </div>
                )}
              </div>

              {/* Section 2: Faits marquants */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-amber-500">
                <button onClick={() => toggleSection('events')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('taskDetails.tabEvents')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">{taskEvents.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && !isEffectivelyClosed && (
                      <span role="button" onClick={(e) => { e.stopPropagation(); setEditingEvent(null); setShowTimelineForm(true); }} className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition">+ {t('auto.ajouter')}</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${sectionOpen.events ? '' : '-rotate-90'}`} />
                  </div>
                </button>
                {sectionOpen.events && (
                  <div className="px-5 pb-5 pt-1">
                    {taskEvents.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">{t('auto.aucun_fait_marquant')}</p>
                    ) : (
                      <div className="space-y-3">
                        {taskEvents.map((event) => {
                          const kcPhase = event.kill_chain ? getKillChainPhase(caseKillChainType ?? null, event.kill_chain) : null;
                          const canEdit = !isEffectivelyClosed && event.created_by === user?.id;
                          return (
                            <div key={event.id} id={`event-${event.id}`}
                              className={`border rounded-lg p-3 transition-all duration-500 ${event.id === targetEventId
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500/50 ring-2 ring-amber-500/30'
                                : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: kcPhase ? `${kcPhase.hexColor}20` : undefined, color: kcPhase?.hexColor }}>
                                  <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-gray-800 dark:text-white">{event.kill_chain ? t(`killChain.${event.kill_chain}`) : t('auto.non_specifie')}</span>
                                    <span className="text-xs text-gray-400 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(event.event_datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                                    <span className="font-medium text-purple-700 dark:text-purple-400">{t('diamond.infrastructure')} : {event.source_system?.name || t('auto.systeme_inconnu')}</span>
                                    {event.target_system && (<><ArrowRight className="w-3 h-3 text-gray-400" /><span className="font-medium text-blue-700 dark:text-blue-400">{t('diamond.victim')} : {event.target_system.name}</span></>)}
                                  </div>
                                  {(event as any).notes && (
                                    <div className="mt-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-500 rounded-r-lg">
                                      <p className="text-[11px] text-gray-700 dark:text-slate-300 whitespace-pre-wrap italic">{(event as any).notes}</p>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-1.5 border-t border-gray-100 dark:border-slate-700/50">
                                    {event.creator_name && <span className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-1"><User className="w-3 h-3" />{event.creator_name}</span>}
                                    <span className="text-[11px] text-gray-500 dark:text-slate-400">{new Date(event.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    {event.updated_at && event.updated_at !== event.created_at && (
                                      <span className="text-[11px] text-gray-500 dark:text-slate-400 italic">{t('auto.modifie_le_3')}{new Date(event.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })})</span>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button onClick={() => { setEditingEvent({ id: event.id, event_datetime: event.event_datetime, kill_chain: event.kill_chain, malware_id: event.malware_id, compromised_account_id: event.compromised_account_id, exfiltration_id: event.exfiltration_id ?? null, source_system_id: event.source_system?.id || null, target_system_id: event.target_system?.id || null }); setShowTimelineForm(true); }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"><Edit3 className="w-3 h-3" />{t('auto.modifier')}</button>
                                      <button onClick={() => handleDeleteEvent(event.id)} disabled={deletingEventId === event.id} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"><Trash2 className="w-3 h-3" />{deletingEventId === event.id ? t('auto.suppression_en_cours') : t('auto.supprimer')}</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3: Objets */}
              <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500">
                <button onClick={() => toggleSection('objects')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('taskDetails.tabObjects')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{objectCount}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${sectionOpen.objects ? '' : '-rotate-90'}`} />
                </button>
                {sectionOpen.objects && (
                  <div className="px-5 pb-5 pt-1">
                    <TaskObjectsPanel caseId={caseId} taskId={taskId} isClosed={isEffectivelyClosed} onCountChange={setObjectCount} isReadOnly={isReadOnly} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <TaskModal
          caseId={caseId}
          task={{
            id: taskData.id,
            title: taskData.title,
            description: taskData.description,
            assigned_to: taskData.assigned_to,
          }}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchTaskData();
          }}
        />
      )}

      {showCloseModal && (
        <CloseTask
          taskId={taskId}
          initialComment={taskData.closure_comment || ''}
          hasSystem={!!taskData.system_id}
          initialInvestigationStatus={taskData.initial_investigation_status}
          onClose={() => setShowCloseModal(false)}
          onSuccess={() => {
            setShowCloseModal(false);
            fetchTaskData();
          }}
        />
      )}

      {showReopenConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-lg max-w-md w-full p-6 shadow dark:shadow-slate-800/50">
            <div className="flex items-center gap-2 mb-4">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('auto.reouvrir_la_tache')}</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-6">
              {t('auto.la_tache_sera_rouverte_et_le_c')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReopenConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
              >
                {t('auto.annuler')}</button>
              <button
                onClick={handleReopenTask}
                disabled={reopening}
                className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {reopening ? 'Reouverture...' : 'Reouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditClosureComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-lg max-w-2xl w-full p-4 sm:p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto shadow dark:shadow-slate-800/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('auto.modifier_le_commentaire_de_fer')}</h3>
              </div>
              <button onClick={() => setShowEditClosureComment(false)} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('auto.la_modification_sera_tracee_av')}</p>
            </div>
            <div className="mb-4">
              <RichTextEditor
                value={editClosureComment}
                onChange={setEditClosureComment}
                placeholder={t('auto.commentaire_de_fermeture_4')}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditClosureComment(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
              >
                {t('auto.annuler')}</button>
              <button
                onClick={handleSaveClosureComment}
                disabled={savingClosureEdit || !editClosureComment.trim()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingClosureEdit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimelineForm && (
        <AddTimelineEvent
          caseId={caseId}
          killChainType={caseKillChainType ?? undefined}
          preselectedSystemId={taskData.system?.id}
          taskId={taskId}
          editEvent={editingEvent || undefined}
          onClose={() => { setShowTimelineForm(false); setEditingEvent(null); }}
          onSuccess={() => {
            setShowTimelineForm(false);
            setEditingEvent(null);
            fetchTaskData();
          }}
        />
      )}
    </div>
  );
}
