import { useState } from 'react';
import {
  Clock,
  Bug,
  KeyRound,
  Globe,
  DatabaseZap,
  Server,
  Search,
  ChevronDown,
} from 'lucide-react';
import { InvestigationSystems } from './InvestigationSystems';
import { TimelineEvents } from './TimelineEvents';
import { MalwareTools } from './MalwareTools';
import { NetworkIndicators } from './NetworkIndicators';
import { CompromisedAccounts } from './CompromisedAccounts';
import { Exfiltrations } from './Exfiltrations';
import { useTranslation } from "react-i18next";

interface InvestigationPanelProps {
  caseId: string;
  isClosed: boolean;
}

const TABS = [
  { id: 'systems', label: 'Systemes', icon: Server },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'malware', label: 'Malware / Outils', icon: Bug },
  { id: 'compromised_accounts', label: 'Comptes compromis', icon: KeyRound },
  { id: 'network_indicators', label: 'Indic. reseau', icon: Globe },
  { id: 'exfiltration', label: 'Exfiltration', icon: DatabaseZap },
] as const;

type TabId = (typeof TABS)[number]['id'];


export function InvestigationPanel({ caseId, isClosed }: InvestigationPanelProps) {
    const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('systems');

  const activeConfig = TABS.find((t) => t.id === activeTab)!;
  const ActiveIcon = activeConfig.icon;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50">
      <div className="border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-0">
          <Search className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{t('auto.investigation_21')}</h3>
        </div>

        <div className="px-4 pb-3 sm:hidden">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <ActiveIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabId)}
              className="w-full pl-9 pr-8 py-2.5 text-sm font-medium bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-white"
            >
              {TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-400" />
            </div>
          </div>
        </div>

        <nav className="hidden sm:flex px-6 pt-2 gap-1 flex-wrap" aria-label={t('auto.onglets_investigation')}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t-lg
                  whitespace-nowrap transition-colors border-b-2
                  ${isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:text-blue-400 dark:bg-blue-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'}
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'systems' && (
          <InvestigationSystems caseId={caseId} isClosed={isClosed} />
        )}
        {activeTab === 'timeline' && (
          <TimelineEvents caseId={caseId} isClosed={isClosed} />
        )}
        {activeTab === 'malware' && (
          <MalwareTools caseId={caseId} isClosed={isClosed} />
        )}
        {activeTab === 'compromised_accounts' && (
          <CompromisedAccounts
            caseId={caseId}
            isClosed={isClosed}
            onNavigateToSystems={() => setActiveTab('systems')}
          />
        )}
        {activeTab === 'network_indicators' && (
          <NetworkIndicators caseId={caseId} isClosed={isClosed} />
        )}
        {activeTab === 'exfiltration' && (
          <Exfiltrations caseId={caseId} isClosed={isClosed} />
        )}
      </div>
    </div>
  );
}
