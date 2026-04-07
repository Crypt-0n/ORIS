/**
 * StixWorkspace.tsx
 * 
 * Combined view for STIX objects: List view + Graph view with internal tabs.
 * Replaces the separate "Éléments STIX" and "Graphe STIX" sidebar entries.
 */

import { useState } from 'react';
import { List, Share2, Search } from 'lucide-react';
import { StixObjectsList } from './StixObjectsList';
import { StixGraphView } from './StixGraphView';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../common/Tooltip';

interface StixWorkspaceProps {
  caseId: string;
  isClosed: boolean;
}

type WorkspaceTab = 'list' | 'graph';

export function StixWorkspace({ caseId, isClosed }: StixWorkspaceProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('list');

  const tabs: { id: WorkspaceTab; label: string; icon: typeof List }[] = [
    { id: 'list', label: t('stixWorkspace.list', 'Liste'), icon: List },
    { id: 'graph', label: t('stixWorkspace.graph', 'Carte des relations'), icon: Share2 },
  ];

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {t('stixWorkspace.title', 'Objets d\'investigation')}
            <Tooltip content="Espace de synthèse en lecture seule regroupant tous les éléments techniques de l'affaire. La création se fait depuis les tâches." position="right" iconSize={16} />
          </h3>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-slate-800/50 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'list' && (
        <StixObjectsList caseId={caseId} isClosed={isClosed} />
      )}
      {activeTab === 'graph' && (
        <StixGraphView caseId={caseId} />
      )}
    </div>
  );
}
