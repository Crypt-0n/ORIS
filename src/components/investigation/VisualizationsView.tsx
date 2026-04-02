/**
 * VisualizationsView.tsx
 * 
 * Combined visualization view with internal tabs:
 * - Timeline visuelle
 * - Mouvements latéraux (Graphe réseau + Vue chronologique)
 * - Analyse temporelle (ActivityPlot)
 */

import { useState } from 'react';
import { Clock, GitBranch, BarChart3 } from 'lucide-react';
import { VisualTimeline } from '../reporting/VisualTimeline';
import { LateralMovementGraph } from '../reporting/LateralMovementGraph';
import { ChronologicalTreeView } from '../reporting/ChronologicalTreeView';
import { ActivityPlot } from '../reporting/ActivityPlot';
import { useTranslation } from 'react-i18next';

interface VisualizationsViewProps {
  caseId: string;
  killChainType: string | null;
}

type VizTab = 'timeline' | 'lateral' | 'activity';

export function VisualizationsView({ caseId, killChainType }: VisualizationsViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<VizTab>('timeline');
  const [lateralSub, setLateralSub] = useState<'force' | 'chronological'>('force');

  const tabs: { id: VizTab; label: string; icon: typeof Clock }[] = [
    { id: 'timeline', label: t('visualizations.timeline', 'Chronologie'), icon: Clock },
    { id: 'lateral', label: t('visualizations.lateral', 'Propagation'), icon: GitBranch },
    { id: 'activity', label: t('visualizations.activity', 'Analyse temporelle'), icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
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
      {activeTab === 'timeline' && (
        <VisualTimeline caseId={caseId} killChainType={killChainType} />
      )}

      {activeTab === 'lateral' && (
        <div>
          {/* Sub-tabs for lateral movement */}
          <div className="flex border-b border-gray-200 dark:border-slate-700 mb-4">
            <button
              onClick={() => setLateralSub('force')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${lateralSub === 'force' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
            >
              {t('visualizations.networkGraph', 'Graphe réseau')}
            </button>
            <button
              onClick={() => setLateralSub('chronological')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${lateralSub === 'chronological' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'}`}
            >
              {t('visualizations.chronologicalView', 'Vue chronologique')}
            </button>
          </div>
          {lateralSub === 'chronological' ? (
            <ChronologicalTreeView caseId={caseId} />
          ) : (
            <LateralMovementGraph caseId={caseId} layoutMode="force" />
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityPlot caseId={caseId} />
      )}
    </div>
  );
}
