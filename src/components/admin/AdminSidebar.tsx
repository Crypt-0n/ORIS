import { Users, Building, Settings, Bot, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type AdminViewType = 'access' | 'beneficiaries' | 'system' | 'knowledge';

interface AdminSidebarProps {
  activeView: AdminViewType;
  onViewChange: (view: AdminViewType) => void;
}

export function AdminSidebar({ activeView, onViewChange }: AdminSidebarProps) {
  const { t } = useTranslation();

  const CATEGORIES = [
    {
      id: 'access' as const,
      label: 'Comptes & Sessions',
      icon: Users,
      color: 'blue'
    },
    {
      id: 'beneficiaries' as const,
      label: 'Bénéficiaires',
      icon: Building,
      color: 'emerald'
    },
    {
      id: 'system' as const,
      label: 'Système & Opérations',
      icon: Settings,
      color: 'slate'
    },
    {
      id: 'knowledge' as const,
      label: "Moteur d'Intelligence",
      icon: Bot,
      color: 'purple'
    }
  ];

  return (
    <>
      {/* Mobile nav — dropdown at top, full width */}
      <div className="lg:hidden mb-4">
        <div className="relative">
          <select
            value={activeView}
            onChange={e => onViewChange(e.target.value as AdminViewType)}
            className="w-full appearance-none bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-medium text-gray-800 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
            aria-label="Catégorie Menu Mobile"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Sidebar — desktop */}
      <nav className="hidden lg:block w-72 flex-shrink-0">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col py-2 sticky top-6">
          <div className="px-4 py-3 mb-2">
            <h2 className="text-xs font-bold text-gray-500 dark:text-slate-500 uppercase tracking-wider">
              {t('admin.title', 'Administration')}
            </h2>
          </div>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = activeView === cat.id;

            const activeColor = cat.color === 'purple'
              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-l-purple-500'
              : cat.color === 'emerald'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-l-emerald-500'
                : cat.color === 'slate'
                  ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 border-l-slate-500'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-blue-500';

            return (
              <button
                key={cat.id}
                onClick={() => onViewChange(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-l-3 ${isActive
                  ? `${activeColor} border-l-[3px]`
                  : 'border-l-[3px] border-l-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
