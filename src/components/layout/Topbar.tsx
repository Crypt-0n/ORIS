import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FolderOpen, ClipboardList, Moon, Sun, LogOut, LayoutDashboard, User, ChevronDown, Shield, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Logo } from '../Logo';
import { UserAvatar } from '../UserAvatar';
import { NotificationBell } from '../NotificationBell';
import { GlobalSearch } from '../GlobalSearch';

export function Topbar() {
  const { profile, signOut, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = hasRole('admin');
  const isOnDashboardRoute = location.pathname === '/';
  const isOnCasesRoute = location.pathname.startsWith('/cases');

  const isOnProfileRoute = location.pathname === '/profile';
  const isOnTasksRoute = location.pathname === '/tasks';
  const isOnAlertsRoute = location.pathname.startsWith('/alerts');


  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  // Close dropdown on route change
  useEffect(() => { setUserMenuOpen(false); }, [location.pathname]);

  return (
    <header className="fixed top-0 right-0 left-0 h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 z-30 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <Logo size="sm" showText />
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={isOnDashboardRoute}
            onClick={() => navigate('/')}
          />
          {profile?.canSeeCases && (
            <NavItem
              icon={FolderOpen}
              label={t('nav.cases')}
              active={isOnCasesRoute}
              onClick={() => navigate('/cases')}
            />
          )}
          {profile?.canSeeAlerts && (
            <NavItem
              icon={AlertTriangle}
              label="Alertes"
              active={isOnAlertsRoute}
              onClick={() => navigate('/alerts')}
            />
          )}
          <NavItem
            icon={ClipboardList}
            label={t('nav.tasks')}
            active={isOnTasksRoute}
            onClick={() => navigate('/tasks')}
          />

        </nav>
      </div>

      {/* Search: on mobile renders just the icon, on desktop renders centered inline bar */}
      <div className="lg:flex-1 lg:flex lg:justify-center lg:px-4 lg:max-w-xl">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell />

        {/* User dropdown — all screen sizes */}
        <div className="relative" ref={menuRef}>
          {/* Mobile trigger: avatar only */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="sm:hidden flex items-center"
            aria-label="Menu utilisateur"
            aria-expanded={userMenuOpen}
          >
            <UserAvatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="sm" />
          </button>

          {/* Desktop trigger: avatar + name + chevron */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-gray-200 dark:border-slate-700 hover:opacity-80 transition"
          >
            <UserAvatar
              name={profile?.full_name}
              avatarUrl={profile?.avatar_url}
              size="sm"
              className={isOnProfileRoute ? 'ring-2 ring-blue-400' : ''}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300 max-w-[120px] truncate">
              {profile?.full_name}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 dark:text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg dark:shadow-slate-900/50 py-1.5 z-50">
              <button
                onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
              >
                <User className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                Mon profil
              </button>

              {isAdmin && (
                <button
                  onClick={() => { navigate('/admin'); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                >
                  <Shield className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  Administration
                </button>
              )}

              <div className="border-t border-gray-100 dark:border-slate-700 my-1" />

              <button
                onClick={() => { toggleTheme(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
                aria-label="Basculer le thème"
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    Thème sombre
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    Thème clair
                  </>
                )}
              </button>

              <div className="border-t border-gray-100 dark:border-slate-700 my-1" />

              <button
                onClick={() => { signOut(); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof FolderOpen;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${active
          ? 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-blue-600 dark:text-blue-500' : 'opacity-70'}`} />
      {label}
    </button>
  );
}
