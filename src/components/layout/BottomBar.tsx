import { useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, ClipboardList, LayoutDashboard, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

export function BottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { profile } = useAuth();

  const isOnDashboardRoute = location.pathname === '/';
  const isOnCasesRoute = location.pathname.startsWith('/cases');
  const isOnTasksRoute = location.pathname === '/tasks';
  const isOnAlertsRoute = location.pathname.startsWith('/alerts');

  const items = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', active: isOnDashboardRoute },
    ...(profile?.canSeeCases ? [{ icon: FolderOpen, label: t('nav.cases'), path: '/cases', active: isOnCasesRoute }] : []),
    ...(profile?.canSeeAlerts ? [{ icon: AlertTriangle, label: 'Alertes', path: '/alerts', active: isOnAlertsRoute }] : []),
    { icon: ClipboardList, label: t('nav.tasks'), path: '/tasks', active: isOnTasksRoute },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-30 flex items-center justify-around px-2 pb-safe">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
              item.active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium truncate max-w-full">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
