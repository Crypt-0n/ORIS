import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ChevronRight, Server, Bug, Radar, ClipboardList } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { useTranslation } from "react-i18next";

interface TaskData {
  id: string;
  title: string;
  description: string;
  created_at: string;
  assigned_to: string | null;
  status: string;
  created_by_user: {
    full_name: string;
  };
  assigned_to_user: {
    full_name: string;
  } | null;
  result: {
    label: string;
    color: string;
  } | null;
  system: {
    name: string;
  } | null;
  malware: {
    file_name: string;
    is_malicious: boolean;
  } | null;
  is_osint: boolean;
}

interface TasksListProps {
  caseId: string;
  isClosed: boolean;
  onTaskSelect?: (taskId: string) => void;
}

export function TasksList({ caseId, isClosed, onTaskSelect }: TasksListProps) {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canWrite = hasAnyRole(['admin', 'team_leader', 'user', 'case_manager', 'case_user']);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open');

  useEffect(() => {
    fetchTasks();
  }, [caseId]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/tasks/by-case/${caseId}`);
      setTasks(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center text-gray-500 dark:text-slate-400">{t('auto.chargement')}</div>;
  }

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="space-y-4">
      {!isClosed && canWrite && (
        <button
          onClick={() => setShowTaskModal(true)}
          className="w-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-3 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 dark:border-blue-800"
        >
          <Plus className="w-4 h-4" />
          {t('auto.ajouter_une_t_che')}</button>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1">
          {([
            { key: 'all' as const, label: t('auto.filter_all'), count: tasks.length },
            { key: 'open' as const, label: t('auto.filter_open'), count: tasks.filter(t => t.status === 'open').length },
            { key: 'closed' as const, label: t('auto.filter_closed'), count: tasks.filter(t => t.status === 'closed').length },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-xs ${statusFilter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="glass-panel dark:bg-slate-900/50 rounded-xl p-8 text-center animate-fade-in border border-dashed border-gray-300 dark:border-slate-700 mt-4">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ClipboardList className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-heading font-medium text-gray-900 dark:text-white mb-1">{t('auto.aucune_t_che_cr_e')}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto">{t('auto.no_task_open')}</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-panel dark:bg-slate-900/50 rounded-xl p-8 text-center animate-fade-in border border-dashed border-gray-300 dark:border-slate-700 mt-4">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ClipboardList className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-heading font-medium text-gray-900 dark:text-white mb-1">{t('auto.aucune_t_che')}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto">{statusFilter === 'open' ? t('auto.no_task_open') : t('auto.no_task_closed')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskSelect?.(task.id)}
              className="w-full border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-800 dark:text-white">{task.title}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${task.status === 'closed'
                      ? 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                      {task.status === 'closed' ? t('auto.status_closed') : t('auto.status_open')}
                    </span>
                    {task.result && (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${task.result.color}20`,
                          color: task.result.color,
                        }}
                      >
                        {task.result.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
                    <p>
                      {t('auto.cr_le')} {new Date(task.created_at).toLocaleDateString('fr-FR')} {t('auto.par')} {task.created_by_user.full_name}
                    </p>
                    {task.assigned_to_user && (
                      <p className="flex items-center gap-1">
                        <span className="font-medium">{t('auto.assign')}</span> {task.assigned_to_user.full_name}
                      </p>
                    )}
                    {task.system && (
                      <p className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                        <Server className="w-3 h-3" />
                        <span className="font-medium">{t('auto.investigation')}</span> {task.system.name}
                      </p>
                    )}
                    {task.malware && (
                      <p className={`flex items-center gap-1 ${task.malware.is_malicious ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                        <Bug className="w-3 h-3" />
                        <span className="font-medium">{t('auto.analyse_malware')}</span> {task.malware.file_name}
                      </p>
                    )}
                    {task.is_osint && (
                      <p className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                        <Radar className="w-3 h-3" />
                        <span className="font-medium">OSINT</span>
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 dark:text-slate-400 ml-4" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          caseId={caseId}
          task={null}
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => {
            setShowTaskModal(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}
