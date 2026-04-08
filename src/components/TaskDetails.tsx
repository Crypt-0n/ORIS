import { useState, useEffect, useMemo } from 'react';
import { sanitizeHtml } from '../lib/sanitize';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, X, ChevronDown, Columns, LayoutList, List, Diamond, Database, RotateCcw, Pencil } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { TaskComments } from './TaskComments';
import { CloseTask } from './CloseTask';
import { RichTextEditor } from './RichTextEditor';
import { Skeleton } from './common/Skeleton';


import { StixObjectsList } from './investigation/StixObjectsList';
import { TaskDiamondWizard } from './investigation/TaskDiamondWizard';
import { StixDynamicForm } from './investigation/StixDynamicForm';


import { useTranslation } from "react-i18next";

import { TaskHeader } from './tasks/TaskHeader';
import { TaskClosureDetails } from './tasks/TaskClosureDetails';
import { TaskLinkedStixObject } from './tasks/TaskLinkedStixObject';
import { TaskParticipants } from './tasks/TaskParticipants';
import { TaskDiamondEvents } from './tasks/TaskDiamondEvents';


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
  onTaskLoad?: (task: any) => void;
}

export function TaskDetails({ taskId, caseId, isClosed, onBack, onDelete, onTaskLoad }: TaskDetailsProps) {
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
  const [caseType, setCaseType] = useState<string | null>(null);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const [commentCount, setCommentCount] = useState(0);
  const [stixRefreshKey, setStixRefreshKey] = useState(0);
  const [sectionOpen, setSectionOpen] = useState({ discussion: true, diamond: true, objects: true });
  const toggleSection = (key: 'discussion' | 'diamond' | 'objects') => setSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));
  // Diamond creation state
  const [showDiamondForm, setShowDiamondForm] = useState(false);
  const [caseKillChainType, setCaseKillChainType] = useState<string | null>(null);
  const [taskDiamonds, setTaskDiamonds] = useState<any[]>([]);
  const [editingDiamond, setEditingDiamond] = useState<any | null>(null);
  const [caseStixObjects, setCaseStixObjects] = useState<any[]>([]);
  const [editingStixObject, setEditingStixObject] = useState(false);

  const linkedStixObject = useMemo(() => {
    const secondaryTypes = [
      'observed-data', 'relationship', 'report', 'note', 'grouping', 'opinion', 'identity', 
      'course-of-action', 'attack-pattern', 'threat-actor', 'campaign', 'intrusion-set',
      'indicator', 'ipv4-addr', 'ipv6-addr', 'domain-name', 'url', 'file', 'mac-addr', 
      'email-addr', 'mutex', 'network-traffic', 'process', 'software', 'windows-registry-key', 'autonomous-system'
    ];
    
    const linked = caseStixObjects.filter(o => o.x_oris_task_id === taskId);
    
    // 1. Chercher un objet SDO principal (Infrastructure, Malware, User-Account...)
    const primary = linked.find(o => !secondaryTypes.includes(o.type));
    if (primary) return primary;
    
    // 2. Si pas de SDO, fallback sur le permier objet valide (hors metadata pure)
    return linked.find(o => !['observed-data', 'relationship', 'report', 'note', 'grouping', 'opinion', 'identity'].includes(o.type));
  }, [caseStixObjects, taskId]);
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
  const isReadOnly = !canEditTask && !hasAnyRole(['admin', 'team_leader', 'user', 'case_manager', 'case_user']);
  const canEditDiamond = hasAnyRole(['admin', 'case_analyst', 'alert_analyst']) && !isClosed;

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



  const fetchCaseAuthor = async () => {
    try {
      const data = await api.get(`/cases/${caseId}`);
      if (data) {
        setCaseAuthorId(data.author_id);
        setCaseKillChainType(data.kill_chain_type ?? null);
        setCaseType(data.type ?? 'case');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTaskDiamonds = async () => {
    try {
      const objects = await api.get(`/stix/objects/by-case/${caseId}`);
      const diamonds = (objects || []).filter((o: any) => o && o.type === 'observed-data' && o.x_oris_task_id === taskId);
      const merged = diamonds.map((d: any) => {
        const axes = d.x_oris_diamond_axes || {};
        return { ...d, _axes: { adversary: axes.adversary || [], infrastructure: axes.infrastructure || [], capability: axes.capability || [], victim: axes.victim || [] } };
      });
      setTaskDiamonds(merged);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchTaskDiamonds(); }, [taskId, caseId]);

  // Load STIX objects for vertex selection
  const fetchCaseStixObjects = async () => {
    try {
      const bundle = await api.get(`/stix/bundle/${caseId}`);
      setCaseStixObjects(bundle?.objects || []);
    } catch (err) { console.error(err); }
  };
  useEffect(() => { fetchCaseStixObjects(); }, [caseId]);


  const handleDeleteDiamond = async (diamondId: string) => {
    if (!confirm('Supprimer ce diamant ?')) return;
    try {
      await api.delete(`/stix/objects/${diamondId}`);
      fetchTaskDiamonds();
    } catch (err) {
      console.error('Delete diamond error:', err);
    }
  };

  const startEditDiamond = (d: any) => {
    setEditingDiamond(d);
    setShowDiamondForm(true);
  };

  const fetchTaskData = async () => {
    setLoading(true);
    try {
      const [taskRes, _filesRes, commentsRes] = await Promise.all([
        api.get(`/tasks/${taskId}`),
        api.get(`/files/task/${taskId}`),
        api.get(`/comments/by-task/${taskId}`),
      ]);

      if (taskRes) {
        setTaskData(taskRes);
        if (onTaskLoad) onTaskLoad(taskRes);

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





      if (commentsRes) {
        setCommentCount(commentsRes.length);
      }


    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <Skeleton type="text" className="w-24 mb-4" />
          <Skeleton type="title" className="w-1/2 mb-2" />
          <div className="flex gap-4">
            <Skeleton type="text" className="w-32" />
            <Skeleton type="text" className="w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton type="card" className="h-64" />
            <Skeleton type="card" className="h-32" />
          </div>
          <div className="space-y-6">
            <Skeleton type="card" className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!taskData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-gray-500 dark:text-slate-400">Cette tâche est introuvable ou a été supprimée.</div>
        <button onClick={onBack} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
          Retour au dossier
        </button>
      </div>
    );
  }

  const isTaskClosed = taskData.status === 'closed';
  const isEffectivelyClosed = isClosed || isTaskClosed;
  const isAlert = caseType === 'alert';

  return (
    <div className="space-y-4 sm:space-y-6">
      <TaskHeader
        taskData={taskData}
        caseId={caseId}
        taskId={taskId}
        isEffectivelyClosed={isEffectivelyClosed}
        isTaskClosed={isTaskClosed}
        canEditTask={canEditTask}
        onBack={onBack}
        onEdit={() => setShowEditModal(true)}
        onClose={() => setShowCloseModal(true)}
        onDelete={handleDelete}
        onShare={handleShareTask}
        showCopiedMessage={showCopiedMessage}
        showStatusPicker={showStatusPicker}
        setShowStatusPicker={setShowStatusPicker}
        savingStatus={savingStatus}
        onSaveInitialStatus={handleSaveInitialStatus}
      />

      <TaskClosureDetails
        taskData={taskData}
        canEditTask={canEditTask}
        isClosed={isClosed}
        onEditClosureComment={() => {
          setEditClosureComment(taskData.closure_comment || '');
          setShowEditClosureComment(true);
        }}
        onReopenConfirm={() => setShowReopenConfirm(true)}
      />

      <div className="space-y-6">
        {!isAlert && (
          <TaskLinkedStixObject
            linkedStixObject={linkedStixObject}
            caseStixObjects={caseStixObjects}
            setEditingStixObject={setEditingStixObject}
          />
        )}

        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{t('auto.description')}</h3>
          <div
            className="text-gray-700 dark:text-slate-300 rich-text-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(taskData.description) }}
          />
        </div>

        {/* View mode switcher */}
        <div className="flex items-center justify-end gap-1 mb-2">
          {[
            { key: 'timeline', icon: List, label: 'Timeline' },
            { key: 'split', icon: Columns, label: 'Split' },
            { key: 'accordion', icon: LayoutList, label: 'Accordéon' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => changeViewMode(v.key as ViewMode)}
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
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
              </div>
              <TaskParticipants participants={participants} />
              <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} isReadOnly={isReadOnly} />
            </div>

            {!isAlert && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-cyan-500 p-5">
                  <TaskDiamondEvents
                    taskDiamonds={taskDiamonds}
                    caseKillChainType={caseKillChainType}
                    canEditDiamond={canEditDiamond}
                    onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                    onEditDiamond={startEditDiamond}
                    onDeleteDiamond={handleDeleteDiamond}
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
                  <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ======================== VIEW B: SPLIT ======================== */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className={`bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500 p-5 min-w-0 overflow-hidden ${isAlert ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
              <div className="flex items-center gap-2.5 mb-4">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
              </div>
              <TaskParticipants participants={participants} />
              <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} isReadOnly={isReadOnly} />
            </div>

            {!isAlert && (
              <div className="lg:col-span-1 space-y-6 min-w-0 overflow-hidden">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-cyan-500 p-5">
                  <TaskDiamondEvents
                    taskDiamonds={taskDiamonds}
                    caseKillChainType={caseKillChainType}
                    canEditDiamond={canEditDiamond}
                    onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                    onEditDiamond={startEditDiamond}
                    onDeleteDiamond={handleDeleteDiamond}
                  />
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
                  <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================== VIEW C: ACCORDION ======================== */}
        {viewMode === 'accordion' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-blue-500">
              <button onClick={() => toggleSection('discussion')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                <div className="flex items-center gap-2.5">
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Discussion</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">{commentCount}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${sectionOpen.discussion ? '' : '-rotate-90'}`} />
              </button>
              {sectionOpen.discussion && (
                <div className="px-5 pb-5 pt-1">
                  <TaskParticipants participants={participants} />
                  <TaskComments taskId={taskId} isClosed={isEffectivelyClosed} caseAuthorId={caseAuthorId} onCountChange={setCommentCount} isReadOnly={isReadOnly} />
                </div>
              )}
            </div>

            {!isAlert && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-cyan-500">
                  <button onClick={() => toggleSection('diamond')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                    <div className="flex items-center gap-2.5">
                      <Diamond className="w-4 h-4 text-cyan-500" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">Diamants</span>
                      {taskDiamonds.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">{taskDiamonds.length}</span>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${sectionOpen.diamond ? '' : '-rotate-90'}`} />
                  </button>
                  {sectionOpen.diamond && (
                    <div className="px-5 pb-5 pt-1">
                      <TaskDiamondEvents
                        taskDiamonds={taskDiamonds}
                        caseKillChainType={caseKillChainType}
                        canEditDiamond={canEditDiamond}
                        onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                        onEditDiamond={startEditDiamond}
                        onDeleteDiamond={handleDeleteDiamond}
                      />
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500">
                  <button onClick={() => toggleSection('objects')} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition rounded-t-lg">
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{t('auto.elements_techniques', 'Éléments techniques')}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${sectionOpen.objects ? '' : '-rotate-90'}`} />
                  </button>
                  {sectionOpen.objects && (
                    <div className="px-5 pb-5 pt-1">
                      <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
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
          stixObjects={caseStixObjects.filter(o => o.x_oris_task_id === taskId && !['report', 'observed-data', 'relationship', 'grouping', 'note', 'opinion', 'identity', 'course-of-action', 'attack-pattern', 'threat-actor', 'campaign', 'intrusion-set'].includes(o.type))}
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
              <button onClick={() => setShowEditClosureComment(false)} className="text-gray-500 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
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




      {showDiamondForm && (
        <TaskDiamondWizard
          taskId={taskId}
          caseId={caseId}
          caseKillChainType={caseKillChainType || 'lockheed-martin'}
          existingObjects={caseStixObjects}
          editingDiamond={editingDiamond}
          onSuccess={() => {
            setShowDiamondForm(false);
            setEditingDiamond(null);
            fetchTaskDiamonds();
            fetchCaseStixObjects();
            setStixRefreshKey(prev => prev + 1);
          }}
          onClose={() => setShowDiamondForm(false)}
        />
      )}
      {editingStixObject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingStixObject(false)}
              className="absolute top-4 right-4 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full p-1 z-10 shadow"
            >
              <X className="w-5 h-5" />
            </button>
            <StixDynamicForm 
              caseId={caseId}
              initialData={linkedStixObject}
              onCreated={() => {
                setEditingStixObject(false);
                fetchCaseStixObjects();
              }}
              onClose={() => setEditingStixObject(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
