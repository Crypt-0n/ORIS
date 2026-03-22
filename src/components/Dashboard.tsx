import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  FolderOpen, ClipboardList, UserX, AlertTriangle,
  Activity, ChevronRight, Shield, Loader2, TrendingUp
} from 'lucide-react';

interface DashboardData {
  stats: {
    openCases: number;
    closedCases: number;
    openAlerts: number;
    closedAlerts: number;
    myOpenTasks: number;
    unassignedTasks: number;
  };
  canSeeAlerts?: boolean;
  canSeeCases?: boolean;
  recentActivity: Array<{
    id: string;
    action: string;
    user_name: string;
    case_number: string;
    case_title: string;
    case_id: string;
    entity_type: string;
    created_at: string;
    details: string;
  }>;
  criticalCases: Array<{
    id: string;
    case_number: string;
    title: string;
    created_at: string;
    severity_label: string;
    severity_color: string;
  }>;
}

const ACTION_LABELS: Record<string, string> = {
  case_created: 'a créé un dossier',
  case_closed: 'a fermé un dossier',
  case_reopened: 'a réouvert un dossier',
  alert_created: 'a créé une alerte',
  alert_converted_to_case: 'a converti une alerte en dossier',
  task_created: 'a créé une tâche',
  task_closed: 'a fermé une tâche',
  task_updated: 'a modifié une tâche',
  task_reopened: 'a réouvert une tâche',
  comment_added: 'a ajouté un commentaire',
  comment_updated: 'a modifié un commentaire',
  comment_removed: 'a supprimé un commentaire',
  case_updated: 'a modifié un dossier',
  assignment_added: 'a ajouté un intervenant',
  assignment_removed: 'a retiré un intervenant',
  member_added: 'a ajouté un membre',
  member_removed: 'a retiré un membre',
  leader_assigned: 'a assigné un Team Leader',
  leader_removed: 'a retiré un Team Leader',
  highlight_added: 'a ajouté un fait marquant',
  highlight_updated: 'a modifié un fait marquant',
  highlight_removed: 'a supprimé un fait marquant',
  file_added: 'a ajouté un fichier',
  file_removed: 'a supprimé un fichier',
  timezone_changed: 'a modifié le fuseau horaire',
};

export function Dashboard() {
  useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const d = await api.get('/dashboard');
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const totalCases = data.stats.openCases + data.stats.closedCases;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Bonjour, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          Vue d'ensemble de votre activité
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Dossiers ouverts"
          value={data.stats.openCases}
          sublabel={`${data.stats.closedCases} fermés`}
          color="blue"
          onClick={() => navigate('/cases')}
        />
        {(data as any).canSeeAlerts !== false && (
          <StatCard
            icon={AlertTriangle}
            label="Alertes ouvertes"
            value={data.stats.openAlerts || 0}
            sublabel={`${data.stats.closedAlerts || 0} fermées`}
            color="amber"
            onClick={() => navigate('/alerts')}
          />
        )}
        <StatCard
          icon={ClipboardList}
          label="Mes tâches"
          value={data.stats.myOpenTasks}
          sublabel="ouvertes"
          color="emerald"
          onClick={() => navigate('/tasks')}
        />
        <StatCard
          icon={UserX}
          label="Non assignées"
          value={data.stats.unassignedTasks}
          sublabel="tâches"
          color="amber"
          onClick={() => navigate('/tasks')}
        />
        <StatCard
          icon={TrendingUp}
          label="Taux clôture"
          value={totalCases > 0 ? Math.round((data.stats.closedCases / totalCases) * 100) : 0}
          sublabel="%"
          color="violet"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Dossiers critiques */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Dossiers critiques
          </h2>

          {data.criticalCases.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Aucun dossier critique
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.criticalCases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400">
                        {c.case_number}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          backgroundColor: `${c.severity_color}20`,
                          color: c.severity_color,
                        }}
                      >
                        {c.severity_label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {c.title}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-red-500 transition flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Activité récente */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Activité récente
          </h2>

          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
              Aucune activité récente
            </p>
          ) : (
            <div className="space-y-1">
              {data.recentActivity.map((item) => {
                let details: any = {};
                try { details = JSON.parse(item.details || '{}'); } catch {}

                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/cases/${item.case_id}`)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {(item.user_name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-slate-300">
                        <span className="font-medium">{item.user_name}</span>{' '}
                        <span className="text-gray-500 dark:text-slate-400">
                          {ACTION_LABELS[item.action] || item.action}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                        {item.case_number} — {details.title || details.task_title || item.case_title}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap flex-shrink-0 mt-1">
                      {formatDate(item.created_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  onClick,
}: {
  icon: typeof FolderOpen;
  label: string;
  value: number;
  sublabel: string;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
  onClick?: () => void;
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-800/50',
  };

  const iconColors = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    violet: 'text-violet-500',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={`${colors[color]} border rounded-xl p-4 transition ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${iconColors[color]}`} />
      </div>
      <div className="text-2xl font-bold">
        {value}<span className="text-sm font-normal ml-1 text-gray-500 dark:text-slate-400">{sublabel}</span>
      </div>
      <div className="text-xs mt-1 text-gray-600 dark:text-slate-400">{label}</div>
    </Wrapper>
  );
}
