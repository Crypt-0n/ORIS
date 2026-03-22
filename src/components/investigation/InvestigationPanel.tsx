import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Bug,
  KeyRound,
  Globe,
  DatabaseZap,
  Server,
  Search,
  ChevronDown,
  Diamond,
  Plus,
  Trash2,
} from 'lucide-react';
import { InvestigationSystems } from './InvestigationSystems';
import { TimelineEvents } from './TimelineEvents';
import { MalwareTools } from './MalwareTools';
import { NetworkIndicators } from './NetworkIndicators';
import { CompromisedAccounts } from './CompromisedAccounts';
import { Exfiltrations } from './Exfiltrations';
import DiamondVisualizer from './DiamondVisualizer';
import StixObjectForm from './StixObjectForm';
import { useTranslation } from "react-i18next";
import type { StixSDO, Relationship, StixSDOType } from '../../lib/stix.types';
import { STIX_TYPE_META } from '../../lib/stix.types';
import {
  fetchStixObjects,
  fetchStixRelationships,
  createStixObject,
  createStixRelationship,
  deleteStixObject,
  deleteStixRelationship,
} from '../../lib/stixApi';

interface InvestigationPanelProps {
  caseId: string;
  isClosed: boolean;
}

const TABS = [
  { id: 'diamond_stix', label: 'Diamond STIX', icon: Diamond },
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
  const [activeTab, setActiveTab] = useState<TabId>('diamond_stix');

  // STIX state
  const [stixObjects, setStixObjects] = useState<StixSDO[]>([]);
  const [stixRelationships, setStixRelationships] = useState<Relationship[]>([]);
  const [showStixForm, setShowStixForm] = useState(false);
  const [stixLoading, setStixLoading] = useState(false);

  const loadStixData = useCallback(async () => {
    setStixLoading(true);
    try {
      const [objects, rels] = await Promise.all([
        fetchStixObjects(caseId),
        fetchStixRelationships(caseId),
      ]);
      setStixObjects(objects);
      setStixRelationships(rels);
    } catch (err) {
      console.error('Error loading STIX data:', err);
    } finally {
      setStixLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (activeTab === 'diamond_stix') {
      loadStixData();
    }
  }, [activeTab, loadStixData]);

  const handleCreateStixObject = async (obj: StixSDO) => {
    await createStixObject(caseId, obj);
    await loadStixData();
  };

  const handleCreateStixRelationship = async (rel: Relationship) => {
    await createStixRelationship(caseId, rel);
    await loadStixData();
  };

  const handleDeleteStixObject = async (id: string) => {
    if (!confirm('Supprimer cet objet STIX et ses relations ?')) return;
    await deleteStixObject(id);
    await loadStixData();
  };

  const handleDeleteStixRelationship = async (id: string) => {
    if (!confirm('Supprimer cette relation ?')) return;
    await deleteStixRelationship(id);
    await loadStixData();
  };

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

        {activeTab === 'diamond_stix' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Diamond className="w-5 h-5 text-blue-400" />
                <h4 className="text-sm font-semibold text-gray-200">Modèle Diamant STIX 2.1</h4>
                <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                  {stixObjects.length} objets · {stixRelationships.length} relations
                </span>
              </div>
              {!isClosed && (
                <button
                  onClick={() => setShowStixForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              )}
            </div>

            {/* Diamond Visualizer */}
            {stixLoading ? (
              <div className="h-[500px] flex items-center justify-center text-gray-400">
                Chargement...
              </div>
            ) : (
              <DiamondVisualizer
                objects={stixObjects}
                relationships={stixRelationships}
              />
            )}

            {/* Object list */}
            {stixObjects.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Objets STIX</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stixObjects.map((obj) => {
                    const meta = STIX_TYPE_META[obj.type as StixSDOType];
                    return (
                      <div
                        key={obj.id}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">{meta?.icon}</span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-200 truncate">{'name' in obj ? obj.name : ((obj as any).x_oris_description || meta?.label || obj.type)}</div>
                            <div className="text-xs text-gray-500">{meta?.label}</div>
                          </div>
                        </div>
                        {!isClosed && (
                          <button
                            onClick={() => handleDeleteStixObject(obj.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Relationship list */}
            {stixRelationships.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Relations STIX</h5>
                <div className="space-y-1">
                  {stixRelationships.map((rel) => {
                    const source = stixObjects.find((o) => o.id === rel.source_ref);
                    const target = stixObjects.find((o) => o.id === rel.target_ref);
                    return (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg text-sm"
                      >
                        <span className="text-gray-300">
                          <span className="font-medium">{source ? ('name' in source ? source.name : source.type) : '?'}</span>
                          {' '}
                          <span className="text-blue-400">→ {rel.relationship_type} →</span>
                          {' '}
                          <span className="font-medium">{target ? ('name' in target ? target.name : target.type) : '?'}</span>
                        </span>
                        {!isClosed && (
                          <button
                            onClick={() => handleDeleteStixRelationship(rel.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STIX Object Form Modal */}
            {showStixForm && (
              <StixObjectForm
                caseId={caseId}
                existingObjects={stixObjects}
                onCreateObject={handleCreateStixObject}
                onCreateRelationship={handleCreateStixRelationship}
                onClose={() => setShowStixForm(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
