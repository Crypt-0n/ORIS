import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { motion, Variants } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  FolderOpen, ClipboardList, UserX, AlertTriangle,
  Activity, ChevronRight, Shield, Loader2, Target
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function Dashboard() {
  const { t } = useTranslation();
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
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const totalCases = data.stats.openCases + data.stats.closedCases;
  const closureRate = totalCases > 0 ? Math.round((data.stats.closedCases / totalCases) * 100) : 0;

  return (
    <div className="space-y-6 lg:space-y-8 pb-10 overflow-x-hidden">
      <Helmet>
        <title>Tableau de bord | ORIS</title>
        <meta name="description" content="Aperçu global de votre activité, dossiers, alertes et tâches sur ORIS." />
      </Helmet>
      
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-gray-900 dark:text-white tracking-tight">
            Bonjour, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-2 text-sm lg:text-base max-w-xl leading-relaxed">
            Voici l'état vital du centre d'investigation. Naviguez rapidement vers vos urgences.
          </p>
        </div>
      </motion.div>

      {/* Metrics Row (Horizontal scroll on mobile, Grid on desktop) */}
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-5 pb-4"
      >
        <StatCard icon={FolderOpen} label="Dossiers ouverts" value={data.stats.openCases} color="blue" onClick={() => navigate('/cases')} />
        {(data as any).canSeeAlerts !== false && <StatCard icon={AlertTriangle} label="Alertes" value={data.stats.openAlerts || 0} color="rose" onClick={() => navigate('/alerts')} />}
        <StatCard icon={ClipboardList} label="Mes tâches" value={data.stats.myOpenTasks} color="emerald" onClick={() => navigate('/tasks')} />
        <StatCard icon={UserX} label="Non assignées" value={data.stats.unassignedTasks} color="amber" onClick={() => navigate('/tasks')} />
        
        {/* Taux de résolution Visuel */}
        <motion.div variants={itemVariants} className="col-span-2 md:col-span-3 lg:col-span-1 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 rounded-2xl p-6 shadow-xl shadow-blue-900/20 relative overflow-hidden text-white flex items-center justify-between group">
            <div className="z-10">
                <Target className="w-5 h-5 text-indigo-200 mb-3 drop-shadow-sm group-hover:scale-110 transition-transform" />
                <div className="text-3xl font-heading font-bold drop-shadow-md">{closureRate}%</div>
                <div className="text-[11px] text-indigo-100 uppercase tracking-widest font-semibold mt-1">Résolution</div>
            </div>
            
            <div className="relative w-16 h-16 z-10 drop-shadow-lg">
                <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.15)" strokeWidth="8" fill="none" />
                    <motion.circle 
                      initial={{ strokeDashoffset: 175 }} 
                      animate={{ strokeDashoffset: 175 - (175 * closureRate) / 100 }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                      cx="32" cy="32" r="28" stroke="white" strokeWidth="8" fill="none" strokeDasharray="175" strokeLinecap="round" 
                    />
                </svg>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -top-4 w-20 h-20 bg-black/10 rounded-full blur-xl"></div>
        </motion.div>
      </motion.div>

      {/* Main Content Split */}
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mt-4">
        {/* Défense / Urgences */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.2, type: 'spring' } }}
            className={`flex flex-col bg-white dark:bg-slate-900 border rounded-2xl shadow-sm overflow-hidden ${data.criticalCases.length > 0 ? 'border-rose-200 dark:border-rose-900/50 relative shadow-rose-900/5' : 'border-gray-200 dark:border-slate-800'}`}
        >
          {data.criticalCases.length > 0 && (
             <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500 animate-pulse"></div>
          )}
          
          <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className={`w-4 h-4 ${data.criticalCases.length > 0 ? 'text-rose-500' : 'text-gray-400'}`} />
              Dossiers à haut risque
            </h2>
          </div>

          <div className="flex-1 p-5 overflow-y-auto max-h-[400px]">
             {data.criticalCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                        <Shield className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Aucune urgence</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Le périmètre est sécurisé.</p>
                </div>
            ) : (
                <div className="space-y-3">
                {data.criticalCases.map((c, i) => (
                    <motion.button
                        key={c.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: 0.3 + (i * 0.1) } }}
                        onClick={() => navigate(`/cases/${c.id}`)}
                        className="w-full relative group overflow-hidden bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 rounded-xl p-4 text-left hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700 transition-all"
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                        <div className="pl-3 flex flex-col gap-1">
                            <div className="flex justify-between items-start">
                                <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{c.case_number}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide" style={{ backgroundColor: `${c.severity_color}15`, color: c.severity_color }}>
                                    {c.severity_label.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight mt-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                {c.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                                Créé {formatDate(c.created_at)}
                                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-rose-500" />
                            </p>
                        </div>
                    </motion.button>
                ))}
                </div>
            )}
          </div>
        </motion.div>

        {/* Historique/Flux d'activité */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.3, type: 'spring' } }}
            className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col"
        >
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Flux d'activité en direct
                </h2>
            </div>
            
            <div className="p-5 flex-1 max-h-[400px] overflow-y-auto">
                {data.recentActivity.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Aucune activité récente</p>
                ) : (
                    <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[1.125rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-gray-200 before:via-gray-200 dark:before:from-slate-700 dark:before:via-slate-700 before:to-transparent">
                        {data.recentActivity.map((item, i) => {
                            let details: any = {};
                            try { details = JSON.parse(item.details || '{}'); } catch {}

                            return (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0, transition: { delay: 0.4 + (i * 0.05) } }}
                                    key={item.id} 
                                    className="relative flex items-center justify-between pb-6 last:pb-0 group"
                                >
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 z-10 shadow-sm group-hover:border-blue-400 dark:group-hover:border-blue-500 transition-colors">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {(item.user_name || '?')[0].toUpperCase()}
                                            </span>
                                        </div>
                                        
                                        <button
                                            onClick={() => navigate(`/cases/${item.case_id}`)}
                                            className="flex-1 min-w-0 p-3.5 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/80 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/50 transition-all text-left"
                                        >
                                            <div className="flex justify-between items-start gap-3 mb-1">
                                                <p className="text-sm text-gray-900 dark:text-slate-100 font-semibold truncate">
                                                    {item.user_name} <span className="text-gray-500 dark:text-slate-400 font-normal">{t(`dashboard.actions.${item.action}`, { defaultValue: item.action })}</span>
                                                </p>
                                                <span className="text-[11px] text-gray-400 dark:text-slate-500 whitespace-nowrap pt-0.5 font-medium uppercase tracking-wider">
                                                    {formatDate(item.created_at)}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-gray-600 dark:text-slate-400 truncate flex items-center gap-2">
                                                <span className="font-mono text-[10px] bg-slate-200/50 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{item.case_number}</span> 
                                                {details.title || details.task_title || item.case_title}
                                            </p>
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color, onClick
}: {
  icon: typeof FolderOpen; label: string; value: number; color: 'blue' | 'emerald' | 'amber' | 'rose'; onClick?: () => void;
}) {
  const colors = {
    blue: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/10 border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400',
    emerald: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border-emerald-100 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border-amber-100 dark:border-amber-800/30 text-amber-600 dark:text-amber-400',
    rose: 'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/10 border-rose-100 dark:border-rose-800/30 text-rose-600 dark:text-rose-400',
  };

  const Wrapper = onClick ? motion.button : motion.div;

  return (
    <Wrapper
      variants={itemVariants}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 text-left flex flex-col justify-between transition-shadow relative overflow-hidden group ${onClick ? 'cursor-pointer hover:shadow-lg' : 'shadow-sm'} border-gray-200 dark:border-slate-800`}
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br opacity-50 dark:opacity-20 blur-2xl group-hover:blur-3xl transition-all ${colors[color]}`}></div>
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="text-3xl font-heading font-black text-gray-900 dark:text-white tracking-tight mb-1">
          {value}
        </div>
        <div className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest line-clamp-1">
          {label}
        </div>
      </div>
    </Wrapper>
  );
}
