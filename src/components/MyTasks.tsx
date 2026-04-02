import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, User, UserX, Loader2, FolderOpen, ChevronRight, ChevronLeft, Monitor, Bug, Layers, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from "react-i18next";
import { Helmet } from 'react-helmet-async';

/** Darken a hex color for WCAG-compliant text contrast on light backgrounds */
function darkenColor(hex: string, factor = 0.65): string {
  try {
    const c = hex.replace('#', '');
    const r = Math.round(parseInt(c.substring(0, 2), 16) * factor);
    const g = Math.round(parseInt(c.substring(2, 4), 16) * factor);
    const b = Math.round(parseInt(c.substring(4, 6), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return hex; }
}

interface TaskWithCase {
  id: string;
  title: string;
  description: string;
  created_at: string;
  assigned_to: string | null;
  status: string;
  case_id: string;
  created_by_user: { full_name: string };
  assigned_to_user: { full_name: string } | null;
  result: { label: string; color: string } | null;
  case: {
    id: string;
    case_number: string;
    title: string;
    severity: { label: string; color: string } | null;
    status: string;
    beneficiary?: { id: string; name: string };
  };
  system: { id: string; name: string; system_type: string } | null;
  malware: { id: string; file_name: string; is_malicious: boolean } | null;
}

type TabKey = 'assigned' | 'unassigned';

export function MyTasks() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('assigned');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [assignedTasks, setAssignedTasks] = useState<TaskWithCase[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<TaskWithCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [groupBy, setGroupBy] = useState<'none' | 'case.beneficiary' | 'case.severity' | 'status' | 'assigned_to'>('none');
  const [filterBeneficiary, setFilterBeneficiary] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAssignedTo, setFilterAssignedTo] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (user) fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const data = await api.get('/tasks/my-tasks');
      if (data) {
        setAssignedTasks(data.assigned || []);
        setUnassignedTasks(data.unassigned || []);
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: typeof User; count: number }[] = [
    { key: 'assigned', label: t('tasks.assigned'), icon: User, count: assignedTasks.length },
    { key: 'unassigned', label: t('tasks.unassigned'), icon: UserX, count: unassignedTasks.length },
  ];

  const baseTasks = activeTab === 'assigned' ? assignedTasks : unassignedTasks;
  
  const resetFilters = () => {
    setStatusFilter('all');
    setFilterBeneficiary('all');
    setFilterSeverity('all');
    setFilterAssignedTo('all');
    setCurrentPage(1);
  };

  const availableBeneficiaries = Array.from(
    new Map(baseTasks.filter(t => t.case?.beneficiary?.name).map(t => [t.case.beneficiary!.id, t.case.beneficiary!.name]))
  ).sort((a,b) => String(a[1] || '').localeCompare(String(b[1] || '')));

  const availableSeverities = Array.from(
    new Map(baseTasks.filter(t => t.case?.severity?.label).map(t => [t.case.severity!.label, t.case.severity!.label]))
  ).sort((a,b) => String(a[1] || '').localeCompare(String(b[1] || '')));

  const availableAssignedTo = Array.from(
    new Map(baseTasks.filter(t => t.assigned_to_user?.full_name).map(t => [t.assigned_to_user!.full_name, t.assigned_to_user!.full_name]))
  ).sort((a,b) => String(a[1] || '').localeCompare(String(b[1] || '')));

  const currentTasks = baseTasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (filterBeneficiary !== 'all' && t.case.beneficiary?.id !== filterBeneficiary) return false;
    if (filterSeverity !== 'all' && t.case.severity?.label !== filterSeverity) return false;
    if (filterAssignedTo !== 'all' && t.assigned_to_user?.full_name !== filterAssignedTo) return false;
    return true;
  });

  // Grouping Logic
  let groupedTasks: Record<string, TaskWithCase[]> | null = null;
  
  if (groupBy !== 'none') {
    groupedTasks = currentTasks.reduce((acc, curr) => {
      let key = 'Inconnu';
      if (groupBy === 'case.beneficiary') key = (curr.case as any).beneficiary?.name || 'Aucun bénéficiaire';
      else if (groupBy === 'case.severity') key = curr.case.severity?.label || 'Aucune sévérité';
      else if (groupBy === 'status') key = curr.status === 'open' ? 'Ouvertes' : 'Clôturées';
      else if (groupBy === 'assigned_to') key = curr.assigned_to_user?.full_name || 'Non assigné';
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    }, {} as Record<string, TaskWithCase[]>);
    
    // Sort groups alphabetically
    const sortedKeys = Object.keys(groupedTasks).sort((a, b) => a.localeCompare(b));
    const sortedGroupedTasks: Record<string, TaskWithCase[]> = {};
    sortedKeys.forEach(k => sortedGroupedTasks[k] = groupedTasks![k]);
    groupedTasks = sortedGroupedTasks;
  }

  const totalPages = Math.ceil(currentTasks.length / ITEMS_PER_PAGE);
  const paginatedTasks = currentTasks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: prev[group] === undefined ? false : !prev[group] }));
  };

  const isGroupExpanded = (group: string) => {
    if (expandedGroups[group] !== undefined) return expandedGroups[group];
    return true; // Expanded by default
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Mes Tâches | ORIS</title>
        <meta name="description" content="Gestion de vos tâches d'investigation assignées et non-assignées." />
      </Helmet>
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('tasks.myTasks')}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtres Tous/Ouvert/Fermé */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg w-max flex-shrink-0">
            {([
              { key: 'all' as const, label: t('tasks.allTasks'), count: baseTasks.length },
              { key: 'open' as const, label: t('tasks.openTasks'), count: baseTasks.filter(t => t.status === 'open').length },
              { key: 'closed' as const, label: t('tasks.closedTasks'), count: baseTasks.filter(t => t.status === 'closed').length },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${statusFilter === f.key
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                  }`}
              >
                {f.label} <span className="ml-1 opacity-70 text-[10px] font-mono">({f.count})</span>
              </button>
            ))}
          </div>

          {/* Sélecteur Groupage */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-1.5 rounded-lg w-max flex-shrink-0">
            <Layers className="w-4 h-4 text-gray-400 ml-1" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer"
            >
              <option value="none">Ne pas grouper</option>
              <option value="case.beneficiary">Bénéficiaire du dossier</option>
              <option value="case.severity">Sévérité du dossier</option>
              <option value="status">Statut de la tâche</option>
              <option value="assigned_to">Assigné à</option>
            </select>
          </div>

          {/* Filtres croisés */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-1.5 rounded-lg w-max flex-shrink-0">
            <Filter className="w-4 h-4 text-gray-400 ml-1" />
            <select
              value={filterBeneficiary}
              onChange={(e) => { setFilterBeneficiary(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer max-w-[140px] truncate"
            >
              <option value="all">Bénéficiaire (Tous)</option>
              {availableBeneficiaries.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-700 mx-1"></div>
            <select
              value={filterSeverity}
              onChange={(e) => { setFilterSeverity(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer"
            >
              <option value="all">Sévérité (Toutes)</option>
              {availableSeverities.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-700 mx-1"></div>
            <select
              value={filterAssignedTo}
              onChange={(e) => { setFilterAssignedTo(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer max-w-[140px] truncate"
            >
              <option value="all">Assigné à (Tous)</option>
              {availableAssignedTo.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 mt-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); resetFilters(); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${activeTab === tab.key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : currentTasks.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : groupedTasks ? (
        <div className="space-y-4">
          {Object.entries(groupedTasks).map(([groupName, groupItems]) => (
            <div key={groupName} className="border border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-900/30 overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition -mb-px"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{groupName}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200/50 dark:border-slate-700">
                    {groupItems.length}
                  </span>
                </div>
                {isGroupExpanded(groupName) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              
              {isGroupExpanded(groupName) && (
                <div className="p-3.5 pt-4 grid gap-3 border-t border-gray-100 dark:border-slate-800">
                  {groupItems.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onNavigate={() => navigate(`/cases/${task.case_id}?task=${task.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onNavigate={() => navigate(`/cases/${task.case_id}?task=${task.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && groupBy === 'none' && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, currentTasks.length)} sur {currentTasks.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label={t('common.previous')}
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-500 dark:text-slate-400 px-1">…</span>}
                  <button
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[2rem] h-8 rounded-lg text-sm font-medium transition ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label={t('common.next')}
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



function TaskCard({
  task,
  onNavigate,
}: {
  task: TaskWithCase;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const createdDate = new Date(task.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <button
      onClick={onNavigate}
      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition text-left group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {task.title}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${task.status === 'closed'
              ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              }`}>
              {task.status === 'closed' ? t('tasks.closed') : t('tasks.open')}
            </span>
            {task.result && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium flex-shrink-0"
                style={{
                  backgroundColor: `${task.result.color}20`,
                  color: darkenColor(task.result.color),
                }}
              >
                {task.result.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="font-medium">{task.case.case_number}</span>
              <span className="text-gray-300 dark:text-slate-600">|</span>
              <span className="truncate max-w-[200px]">{task.case.title}</span>
            </div>
            {task.case.severity && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase flex-shrink-0"
                style={{
                  backgroundColor: `${task.case.severity.color}20`,
                  color: darkenColor(task.case.severity.color),
                }}
              >
                {task.case.severity.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {task.system && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium border border-blue-100 dark:border-blue-800/50">
                <Monitor className="w-3 h-3" />
                {t('diamond.system')}: {task.system.name}
              </div>
            )}
            {task.malware && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded text-[10px] font-medium border border-purple-100 dark:border-purple-800/50">
                <Bug className="w-3 h-3" />
                {t('diamond.malware')}: {task.malware.file_name}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
            <span>{createdDate}</span>
            <span>{t('common.by')}{task.created_by_user.full_name}</span>
            {task.assigned_to_user && (
              <>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {task.assigned_to_user.full_name}
                </span>
              </>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-300 dark:text-slate-600 group-hover:text-blue-500 transition flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-3 rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
        <ClipboardList className="w-8 h-8 text-gray-500 dark:text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">
        {tab === 'assigned' ? t('tasks.noAssigned') : t('tasks.noUnassigned')}
      </h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs">
        {tab === 'assigned'
          ? t('tasks.noAssignedDesc')
          : t('tasks.noUnassignedDesc')}
      </p>
    </div>
  );
}
