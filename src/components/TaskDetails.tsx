import { useState, useEffect, useMemo } from 'react';
import { sanitizeHtml } from '../lib/sanitize';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, X, Columns, LayoutList, List, Diamond, Database, RotateCcw, Pencil } from 'lucide-react';
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

import { TaskDiamondEvents, getDiamondCompleteness } from './tasks/TaskDiamondEvents';


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
  // Diamond creation state
  const [showDiamondForm, setShowDiamondForm] = useState(false);
  const [caseKillChainType, setCaseKillChainType] = useState<string | null>(null);
  const [taskDiamonds, setTaskDiamonds] = useState<any[]>([]);
  const [editingDiamond, setEditingDiamond] = useState<any | null>(null);
  const [caseStixObjects, setCaseStixObjects] = useState<any[]>([]);
  const [editingStixObject, setEditingStixObject] = useState(false);

  const linkedStixObject = useMemo(() => {
    if (!taskData) return null;
    const secondaryTypes = [
      'observed-data', 'relationship', 'report', 'note', 'grouping', 'opinion', 'identity', 
      'course-of-action', 'attack-pattern', 'threat-actor', 'campaign', 'intrusion-set',
      'indicator', 'ipv4-addr', 'ipv6-addr', 'domain-name', 'url', 'file', 'mac-addr', 
      'email-addr', 'mutex', 'network-traffic', 'process', 'software', 'windows-registry-key', 'autonomous-system'
    ];
    
    const linked = caseStixObjects.filter(o => o.x_oris_task_id === taskId);
    
    // Si la tâche a un système ou un malware explicitement lié, on le priorise
    const explicitIdFragment = taskData.system_id || taskData.malware_id;
    if (explicitIdFragment) {
       const explicitObj = linked.find(o => o.id.includes(explicitIdFragment));
       if (explicitObj) return explicitObj;
    }

    // Sinon on trie par date de création (le plus ancien d'abord, l'objet originel)
    const sortedLinked = [...linked].sort((a, b) => {
      const dateA = a.created ? new Date(a.created).getTime() : 0;
      const dateB = b.created ? new Date(b.created).getTime() : 0;
      return dateA - dateB;
    });

    // 1. Chercher un objet SDO principal (Infrastructure, Malware, User-Account...)
    const primary = sortedLinked.find(o => !secondaryTypes.includes(o.type));
    if (primary) return primary;
    
    // 2. Si pas de SDO, fallback sur le premier objet valide (hors metadata pure)
    return sortedLinked.find(o => !['observed-data', 'relationship', 'report', 'note', 'grouping', 'opinion', 'identity'].includes(o.type));
  }, [caseStixObjects, taskId, taskData]);
  type ViewMode = 'timeline' | 'split' | 'tabs';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('oris_task_view_mode');
    if (saved === 'accordion') return 'tabs';
    return (saved === 'timeline' || saved === 'split' || saved === 'tabs') ? saved : 'split';
  });
  const changeViewMode = (mode: ViewMode) => { setViewMode(mode); localStorage.setItem('oris_task_view_mode', mode); };
  const [activeTab, setActiveTab] = useState<'discussion' | 'diamond' | 'objects'>('discussion');

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
      const objects = await api.get(`/stix/objects/by-case/${caseId}`) || [];
      const rels = await api.get(`/stix/relationships/by-case/${caseId}`) || [];
      const allItems = [...objects, ...rels];
      const diamonds = allItems.filter((o: any) => o && o.type === 'observed-data' && o.x_oris_task_id === taskId);
      const allRelations = allItems.filter((o: any) => o && o.type === 'relationship');
      const merged = diamonds.map((d: any) => {
        const axes = d.x_oris_diamond_axes || {};
        const axesData = { adversary: axes.adversary || [], infrastructure: axes.infrastructure || [], capability: axes.capability || [], victim: axes.victim || [] };
        // Collect all node IDs to find relevant relations
        const nodeIds = new Set<string>();
        Object.values(axesData).forEach((arr: any) => arr.forEach((v: any) => {
          const id = typeof v === 'string' ? v : v.id;
          if (id) nodeIds.add(id);
        }));
        let diamondRelations = [];
        if (Array.isArray(d.x_oris_diamond_relations)) {
          diamondRelations = allRelations.filter((r: any) => d.x_oris_diamond_relations.includes(r.id));
        } else if (d.x_oris_diamond_axes) {
          // It's a modernized diamond but maybe somehow the array was stripped. Default to empty to prevent global relations.
          diamondRelations = [];
        } else {
          // Legacy inherited diamonds fallback to global inference
          diamondRelations = allRelations.filter((r: any) => nodeIds.has(r.source_ref) && nodeIds.has(r.target_ref));
        }
        return { ...d, _axes: axesData, _relations: diamondRelations };
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
            { key: 'tabs', icon: LayoutList, label: 'Onglets' },
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
              <TaskComments 
                taskId={taskId} 
                isClosed={isEffectivelyClosed} 
                caseAuthorId={caseAuthorId} 
                onCountChange={setCommentCount} 
                isReadOnly={isReadOnly}
                taskDiamonds={taskDiamonds}
                caseKillChainType={caseKillChainType}
                canEditDiamond={canEditDiamond}
                onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                onEditDiamond={startEditDiamond}
                onDeleteDiamond={handleDeleteDiamond}
              />
            </div>

            {!isAlert && (
              <>
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
              <TaskComments 
                taskId={taskId} 
                isClosed={isEffectivelyClosed} 
                caseAuthorId={caseAuthorId} 
                onCountChange={setCommentCount} 
                isReadOnly={isReadOnly}
                taskDiamonds={taskDiamonds}
                caseKillChainType={caseKillChainType}
                canEditDiamond={canEditDiamond}
                onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                onEditDiamond={startEditDiamond}
                onDeleteDiamond={handleDeleteDiamond}
              />
            </div>

            {!isAlert && (
              <div className="lg:col-span-1 space-y-6 min-w-0 overflow-hidden">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border-l-4 border-purple-500 p-5">
                  <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================== VIEW C: TABS ======================== */}
        {viewMode === 'tabs' && (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50">
            <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('discussion')}
                className={`flex items-center gap-2.5 px-6 py-4 text-sm font-semibold transition-colors relative ${activeTab === 'discussion' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'}`}
              >
                <MessageCircle className="w-4 h-4" />
                Discussion
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'discussion' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>{commentCount}</span>
                {activeTab === 'discussion' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />}
              </button>

              {!isAlert && (
                <>
                  <button
                    onClick={() => setActiveTab('diamond')}
                    className={`flex items-center gap-2.5 px-6 py-4 text-sm font-semibold transition-colors relative ${activeTab === 'diamond' ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-500 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'}`}
                  >
                    <Diamond className="w-4 h-4" />
                    Diamants
                    {taskDiamonds.length > 0 && <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'diamond' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>{taskDiamonds.length}</span>}
                    {activeTab === 'diamond' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 rounded-t-full" />}
                  </button>

                  <button
                    onClick={() => setActiveTab('objects')}
                    className={`flex items-center gap-2.5 px-6 py-4 text-sm font-semibold transition-colors relative ${activeTab === 'objects' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300'}`}
                  >
                    <Database className="w-4 h-4" />
                    {t('auto.elements_techniques', 'Éléments techniques')}
                    {activeTab === 'objects' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-full" />}
                  </button>
                </>
              )}
            </div>

            <div className="p-5 min-h-[400px]">
              {activeTab === 'discussion' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <TaskComments 
                    taskId={taskId} 
                    isClosed={isEffectivelyClosed} 
                    caseAuthorId={caseAuthorId} 
                    onCountChange={setCommentCount} 
                    isReadOnly={isReadOnly}
                    taskDiamonds={taskDiamonds}
                    caseKillChainType={caseKillChainType}
                    canEditDiamond={canEditDiamond}
                    onAddDiamond={() => { setEditingDiamond(null); setShowDiamondForm(true); }}
                    onEditDiamond={startEditDiamond}
                    onDeleteDiamond={handleDeleteDiamond}
                  />
                </div>
              )}

              {activeTab === 'diamond' && !isAlert && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
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

              {activeTab === 'objects' && !isAlert && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <StixObjectsList key={stixRefreshKey} taskId={taskId} caseId={caseId} isClosed={isEffectivelyClosed} />
                </div>
              )}
            </div>
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
          hasIncompleteDiamonds={taskDiamonds.some((d: any) => !getDiamondCompleteness(d).complete)}
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
