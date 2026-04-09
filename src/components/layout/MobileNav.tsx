import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, ClipboardList, LayoutDashboard, AlertTriangle } from 'lucide-react';

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isOnDashboardRoute = location.pathname === '/';
  const isOnCasesRoute = location.pathname.startsWith('/cases');
  const isOnTasksRoute = location.pathname === '/tasks';
  const isOnAlertsRoute = location.pathname.startsWith('/alerts');

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-30 flex items-center justify-around px-2 pb-safe">
      
      {/* Dashboard */}
      <button
        onClick={() => navigate('/')}
        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
          isOnDashboardRoute ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 flex-shrink-0" size={20} />
        <span className="text-[10px] font-medium truncate max-w-full">Dashboard</span>
      </button>

      {/* Cases */}
      <button
        onClick={() => navigate('/cases')}
        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
          isOnCasesRoute ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
        }`}
      >
        <FolderOpen className="w-5 h-5 flex-shrink-0" size={20} />
        <span className="text-[10px] font-medium truncate max-w-full">Dossiers</span>
      </button>

      {/* Alerts */}
      <button
        onClick={() => navigate('/alerts')}
        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
          isOnAlertsRoute ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
        }`}
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0" size={20} />
        <span className="text-[10px] font-medium truncate max-w-full">Alertes</span>
      </button>

      {/* Tasks */}
      <button
        onClick={() => navigate('/tasks')}
        className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 flex-1 ${
          isOnTasksRoute ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400'
        }`}
      >
        <ClipboardList className="w-5 h-5 flex-shrink-0" size={20} />
        <span className="text-[10px] font-medium truncate max-w-full">Tâches</span>
      </button>

    </nav>
  );
}
