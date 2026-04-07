import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  ListTodo,
  Users,
  Lock,
  Diamond,
  Pin,
  Search,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

export type CaseSection =
  | 'description'
  | 'closure'
  | 'tasks'
  | 'team'
  | 'stix_workspace'
  | 'diamond_model'
  | 'visualizations'
  | 'reports';

interface SidebarGroupDef {
  labelKey: string;
  items: Array<{ id: CaseSection; labelKey: string; icon: LucideIcon }>;
}

const CASE_MANAGEMENT_DEF: SidebarGroupDef = {
  labelKey: 'sidebar.caseManagement',
  items: [
    { id: 'description', labelKey: 'sidebar.summary', icon: FileText },
    { id: 'team', labelKey: 'sidebar.investigators', icon: Users },
    { id: 'tasks', labelKey: 'sidebar.tasks', icon: ListTodo },
  ],
};



const REPORTING_DEF: SidebarGroupDef = {
  labelKey: 'sidebar.reporting',
  items: [
    { id: 'stix_workspace', labelKey: 'sidebar.stixWorkspace', icon: Search },
    { id: 'diamond_model', labelKey: 'sidebar.diamondModel', icon: Diamond },
    { id: 'visualizations', labelKey: 'sidebar.visualizations', icon: BarChart3 },
    { id: 'reports', labelKey: 'sidebar.reports', icon: FileText },
  ],
};

interface CaseSidebarProps {
  activeSection: CaseSection;
  onSectionChange: (section: CaseSection) => void;
  isClosed: boolean;
  showInvestigation?: boolean;
  showReporting?: boolean;
}

function buildGroups(isClosed: boolean, _showInvestigation: boolean, showReporting: boolean): SidebarGroupDef[] {
  const mgmt = { ...CASE_MANAGEMENT_DEF, items: [...CASE_MANAGEMENT_DEF.items] };
  if (isClosed) {
    const closureItem = { id: 'closure' as CaseSection, labelKey: 'sidebar.closure', icon: Lock };
    mgmt.items = [mgmt.items[0], closureItem, ...mgmt.items.slice(1)];
  }
  const groups: SidebarGroupDef[] = [mgmt];
  if (showReporting) groups.push(REPORTING_DEF);
  return groups;
}

export function CaseSidebar({ activeSection, onSectionChange, isClosed, showInvestigation = true, showReporting = true }: CaseSidebarProps) {
  const groups = buildGroups(isClosed, showInvestigation, showReporting);
  const [pinned, setPinned] = useState(() => localStorage.getItem('oris_sidebar_pinned') === 'true');
  const [hovered, setHovered] = useState(false);
  const { t } = useTranslation();

  const expanded = pinned || hovered;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem('oris_sidebar_pinned', String(next));
  };

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`hidden lg:block flex-shrink-0 self-start sticky top-[72px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl py-4 px-2 shadow-sm transition-all duration-200 ${
        expanded ? 'w-60' : 'w-16'
      }`}
    >
      <div className="max-h-[calc(100vh-80px)] overflow-y-auto">
        <nav className="space-y-5">
          {groups.map((group, groupIndex) => (
            <div key={group.labelKey}>
              {expanded ? (
                <div className="flex items-center justify-between mb-1.5 px-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-500 whitespace-nowrap overflow-hidden">
                    {t(group.labelKey)}
                  </h4>
                  {groupIndex === 0 && (
                    <button
                      onClick={togglePin}
                      title={pinned ? 'Réduire le menu' : 'Épingler le menu'}
                      className={`p-1 rounded transition-colors flex-shrink-0 ${
                        pinned
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <Pin className={`w-3 h-3 transition-transform ${pinned ? 'rotate-0' : '-rotate-45'}`} />
                    </button>
                  )}
                </div>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      title={t(item.labelKey)}
                      aria-label={t(item.labelKey)}
                      className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-2 whitespace-nowrap overflow-hidden ${
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-white font-medium ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-500' : 'opacity-70'}`} aria-hidden="true" />
                      {expanded && <span>{t(item.labelKey)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function CaseSectionSelect({ activeSection, onSectionChange, isClosed, showInvestigation = true, showReporting = true }: CaseSidebarProps) {
  const groups = buildGroups(isClosed, showInvestigation, showReporting);
  const { t } = useTranslation();

  return (
    <div className="lg:hidden mb-4">
      <select
        value={activeSection}
        onChange={(e) => onSectionChange(e.target.value as CaseSection)}
        className="w-full px-3 py-2.5 text-sm font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-white"
        aria-label={t('sidebar.navigation')}
      >
        {groups.map((group) => (
          <optgroup key={group.labelKey} label={t(group.labelKey)}>
            {group.items.map((item) => (
              <option key={item.id} value={item.id}>{t(item.labelKey)}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
