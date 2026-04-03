import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Diamond,
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  User,
  Server,
  Bug,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { getKillChainLabel } from '../../lib/diamondModelUtils';
import { DiamondNode, getIsolatedSystems } from '../../lib/diamondModelUtils';
import type { LinkedObject, LinkedObjectType } from './LinkedObjectTag';
import { LinkedObjectTag } from './LinkedObjectTag';
import { ActivityThread } from './ActivityThread';
import { RoleTransitionView } from './RoleTransitionView';
import { SharedVertexView } from './SharedVertexView';
import { PropagationGraphView } from './PropagationGraphView';
import { ActivitySwimlaneView } from './ActivitySwimlaneView';
import { CorrelationMatrixView } from './CorrelationMatrixView';
import { DiamondKillChainMatrix } from './DiamondKillChainMatrix';
import { useTranslation } from "react-i18next";
import type { StixSDO } from '../../lib/stix.types';
import { fetchStixObjects } from '../../lib/stixApi';

interface DiamondModelProps {
  caseId: string;
  killChainType: string | null;
  caseAdversary?: string | null;
  isClosed: boolean;
}

const AXIS_KEYS = [
  { key: 'adversary' as const, icon: User, hexColor: '#ef4444', allowedTypes: ['account'] as LinkedObjectType[] },
  { key: 'infrastructure' as const, icon: Server, hexColor: '#f97316', allowedTypes: ['network', 'system', 'attacker_infra'] as LinkedObjectType[] },
  { key: 'capability' as const, icon: Bug, hexColor: '#eab308', allowedTypes: ['malware', 'exfiltration', 'ttp'] as LinkedObjectType[] },
  { key: 'victim' as const, icon: Shield, hexColor: '#22c55e', allowedTypes: ['system', 'account'] as LinkedObjectType[] },
];

interface TtpOption {
  id: string;
  ttp_id: string;
  name: string;
  description: string;
  phase_value: string;
}

export function DiamondModel({ caseId, killChainType, caseAdversary }: DiamondModelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<DiamondNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'thread' | 'transition' | 'shared' | 'propagation' | 'swimlane' | 'matrix' | 'killchain'>('thread');
  const [analysisSubTab, setAnalysisSubTab] = useState<'propagation' | 'swimlane' | 'matrix'>('propagation');

  const [phaseTtps, setPhaseTtps] = useState<TtpOption[]>([]);

  // STIX Workspace Data to properly map Task IDs
  const [stixObjects, setStixObjects] = useState<StixSDO[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [diamondRes, bundleRes] = await Promise.all([
        api.get(`/stix/diamond/${caseId}`),
        fetchStixObjects(caseId),
      ]);

      const objects = bundleRes || [];
      setStixObjects(objects);

      const stixById: Map<string, any> = new Map(objects.map((o: any) => [o.id, o]));

      // Format Diamond Nodes from STIX Diamond endpoint
      import('../../lib/killChainDefinitions').then(({ getKillChainPhase, getKillChainPhases }) => {
        const phases = getKillChainPhases(killChainType);
        const phaseOrder = Object.fromEntries(phases.map((p, i) => [p.value, i]));

        const builtNodes: DiamondNode[] = (diamondRes || []).map((d: any, index: number) => {
          const phase = d.kill_chain ? getKillChainPhase(killChainType, d.kill_chain) : undefined;
          const stixObj = stixById.get(d.event_stix_id);

          // Read axes dynamically returned by backend STIX graph traversal
          // Also merge explicitly defined axes from x_oris_diamond_axes (e.g. from DiamondWizard)
          const getObjType = (type: string, defaultType: LinkedObjectType): LinkedObjectType => {
            if (type === 'infrastructure' || type === 'indicator') return 'system';
            if (['user-account', 'threat-actor', 'intrusion-set', 'campaign', 'identity'].includes(type)) return 'account';
            if (['malware', 'tool', 'attack-pattern'].includes(type)) return 'malware';
            return defaultType;
          };

          const mapAxis = (items: any[], defaultType: LinkedObjectType): LinkedObject[] => 
            (items || []).map(i => ({ 
              id: i.id, 
              label: i.name || i.label || 'Unknown', 
              type: getObjType(i.type, defaultType)
            }));

          const mapAxisRef = (refs: string[], defaultType: LinkedObjectType): LinkedObject[] => {
            return (refs || []).map(id => stixById.get(id)).filter(Boolean).map(obj => ({
              id: obj.id,
              label: obj.name || obj.type || 'Unknown',
              type: getObjType(obj.type, defaultType)
            }));
          };

          const mergeAxis = (arr1: LinkedObject[], arr2: LinkedObject[]) => {
            const m = new Map<string, LinkedObject>();
            [...arr1, ...arr2].forEach(x => m.set(x.id, x));
            return Array.from(m.values());
          };

          const explicitAxes = stixObj?.x_oris_diamond_axes || stixObj?._axes || {};
          
          let baseAdversary = mergeAxis(mapAxis(d.axes.adversary, 'account'), mapAxisRef(explicitAxes.adversary, 'account'));
          if (caseAdversary) {
            baseAdversary = mergeAxis(baseAdversary, [{ id: 'case-global-adversary', label: caseAdversary, type: 'account' }]);
          }

          const axes = {
            adversary: baseAdversary,
            infrastructure: mergeAxis(mapAxis(d.axes.infrastructure, 'system'), mapAxisRef(explicitAxes.infrastructure, 'system')),
            capability: mergeAxis(mapAxis(d.axes.capability, 'malware'), mapAxisRef(explicitAxes.capability, 'malware')),
            victim: mergeAxis(mapAxis(d.axes.victim, 'system'), mapAxisRef(explicitAxes.victim, 'system')),
          };

          return {
            id: d.event_stix_id,
            eventId: d.event_stix_id,
            taskId: stixObj?.x_oris_task_id || null, // Ensure we read task_id if present
            label: stixObj?.name || stixObj?.x_oris_diamond_label || d.event_name || d.event_description || `Event #${index + 1}`,
            killChainPhase: d.kill_chain || null,
            killChainPhaseLabel: phase?.label || 'Non specifie',
            killChainHexColor: phase?.hexColor || '#64748b',
            eventDatetime: d.event_datetime || null,
            axes,
            order: index,
            notes: stixObj?.description || '',
          };
        }).sort((a: DiamondNode, b: DiamondNode) => {
          const phaseA = a.killChainPhase ? (phaseOrder[a.killChainPhase] ?? 999) : 999;
          const phaseB = b.killChainPhase ? (phaseOrder[b.killChainPhase] ?? 999) : 999;
          if (phaseA !== phaseB) return phaseA - phaseB;
          return new Date(a.eventDatetime || 0).getTime() - new Date(b.eventDatetime || 0).getTime();
        });

        setNodes(builtNodes);
        setLoading(false);
      });
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, [caseId, killChainType, caseAdversary]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch MITRE attack patterns for capability suggestions
  useEffect(() => {
    api.get('/kb/mitre/attack-patterns')
      .then((data: any[]) => {
        const mapped = (data || []).map(p => ({
          id: p.id,
          ttp_id: p.mitre_id || '',
          name: p.name,
          description: p.description || '',
          phase_value: p.kill_chain_phases?.[0]?.phase_name || '',
        }));
        setPhaseTtps(mapped);
      })
      .catch(() => setPhaseTtps([]));
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSelectNode = (id: string) => {
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedNodeId(id);
  };

  const handleReorder = async (reorderedNodes: DiamondNode[]) => {
    setNodes(reorderedNodes);
  };

  const navigateNode = (direction: 'prev' | 'next') => {
    if (nodes.length === 0) return;
    const idx = nodes.findIndex((n) => n.id === selectedNodeId);
    let newIdx: number;
    if (idx === -1) {
      newIdx = direction === 'next' ? 0 : nodes.length - 1;
    } else {
      newIdx = direction === 'next' ? (idx + 1) % nodes.length : (idx - 1 + nodes.length) % nodes.length;
    }
    handleSelectNode(nodes[newIdx].id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
        {t('auto.chargement_du_modele_diamant')}</div>
    );
  }

  const processedAllSystems = getIsolatedSystems(stixObjects).map((o: any) => ({ 
    id: String(o.id), 
    label: String(o.name || o.value || 'Unknown'), 
    type: (o.type === 'infrastructure' ? 'system' : 'network') as 'system' | 'network' 
  }));

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Diamond className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {t('auto.modele_diamant')}
            <Tooltip content="Le Modèle Diamant structure l'analyse d'une menace en reliant 4 piliers fondamentaux autour d'un événement : Adversaire, Capacité, Infrastructure et Victime." position="right" iconSize={16} />
          </h3>
          {nodes.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {nodes.length} {t('auto.diamant')}{nodes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'thread' && nodes.length > 0 && (
            <>
              <button
                onClick={() => navigateNode('prev')}
                className="p-1.5 rounded text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                title={t('auto.diamant_precedent')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateNode('next')}
                className="p-1.5 rounded text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                title={t('auto.diamant_suivant')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={fetchData}
            className="p-1.5 rounded text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition"
            title={t('auto.rafraichir')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/50 rounded-xl p-1 w-fit">
        {([
          { key: 'thread', label: t('diamond.activityThread') },
          { key: 'transition', label: t('diamond.roleTransition') },
          { key: 'shared', label: t('diamond.sharedVertex') },
          { key: 'analysis', label: t('diamond.analysisSub') },
          { key: 'killchain', label: t('diamond.killChainMatrix') },
        ] as const).map(({ key, label }) => {
          const isAnalysis = key === 'analysis';
          const isActive = isAnalysis
            ? ['propagation', 'swimlane', 'matrix'].includes(activeTab)
            : activeTab === key;
          return (
            <button
              key={key}
              onClick={() => {
                if (isAnalysis) {
                  setActiveTab(analysisSubTab);
                } else {
                  setActiveTab(key as typeof activeTab);
                }
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition ${isActive
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/50'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === 'thread' && (
        <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-gray-100 dark:border-transparent">
            <div className="text-xs text-slate-500 mb-3 flex items-center gap-2">
              <Diamond className="w-3 h-3" />
              <span>{t('auto.activity_thread')}{killChainType === 'unified_kill_chain' ? 'Unified Kill Chain' : killChainType === 'mitre_attack' ? 'MITRE ATT&CK' : 'Cyber Kill Chain'}</span>
            </div>
            <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-sm custom-scrollbar">
              <ActivityThread
                nodes={nodes}
                allSystems={processedAllSystems}
                killChainType={killChainType}
                selectedNodeId={selectedNodeId}
                onSelectNode={handleSelectNode}
                onReorder={handleReorder}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transition' && (
        <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <RoleTransitionView nodes={nodes} allSystems={processedAllSystems} />
        </div>
      )}

      {activeTab === 'shared' && (
        <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <SharedVertexView nodes={nodes} allSystems={processedAllSystems} onSelectNode={(id: string) => { setActiveTab('thread'); handleSelectNode(id); }} selectedNodeId={selectedNodeId} />
        </div>
      )}

      {activeTab === 'killchain' && (
        <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-500 mb-3 flex items-center gap-2">
            <Diamond className="w-3 h-3" />
            <span>{t('auto.matrice_kill_chain_systemes_en')}</span>
          </div>
          <DiamondKillChainMatrix
            nodes={nodes}
            allSystems={processedAllSystems}
            killChainType={killChainType}
            onSelectNode={(id: string) => { handleSelectNode(id); setActiveTab('thread'); }}
            selectedNodeId={selectedNodeId}
          />
        </div>
      )}

      {(['propagation', 'swimlane', 'matrix'] as const).includes(activeTab as 'propagation' | 'swimlane' | 'matrix') && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/40 rounded-xl p-1 w-fit">
            {([
              { key: 'propagation' as const, label: t('diamond.propagationGraph') },
              { key: 'swimlane' as const, label: t('diamond.temporalSegments') },
              { key: 'matrix' as const, label: t('diamond.correlationMatrix') },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setAnalysisSubTab(key); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${activeTab === key
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/50'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
            {analysisSubTab === 'propagation' && (
              <PropagationGraphView
                nodes={nodes}
                availableSystems={processedAllSystems}
              />
            )}
            {activeTab === 'swimlane' && <ActivitySwimlaneView nodes={nodes} allSystems={processedAllSystems} />}
            {activeTab === 'matrix' && <CorrelationMatrixView nodes={nodes} allSystems={processedAllSystems} />}
          </div>
        </div>
      )}

      {selectedNode && activeTab === 'thread' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700"
            style={{ borderLeftColor: selectedNode.killChainHexColor, borderLeftWidth: 3 }}
          >
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{t('auto.diamant_16')}{nodes.findIndex((n) => n.id === selectedNodeId) + 1}</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedNode.label}</p>
              </div>
              <span
                className="hidden sm:block text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                style={{ backgroundColor: selectedNode.killChainHexColor }}
              >
                {selectedNode.killChainPhaseLabel}
              </span>
              {selectedNode.eventDatetime && (
                <span className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date(selectedNode.eventDatetime).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
              <span className="hidden sm:block text-[10px] text-slate-400 dark:text-slate-600">
                {getKillChainLabel(selectedNode.killChainPhase)}
              </span>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {selectedNode.taskId && (
                    <button
                      onClick={() => navigate(`/cases/${caseId}?tab=tasks&task=${selectedNode.taskId}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ouvrir la Tâche associée
                    </button>
                  )}
                </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-200 dark:divide-slate-700/50">
            {AXIS_KEYS.map(({ key, icon: Icon, hexColor }) => {
              const axisLabels: Record<string, { label: string; desc: string }> = {
                adversary: { label: t('diamond.adversary'), desc: t('diamond.adversaryDesc') },
                infrastructure: { label: t('diamond.infrastructure'), desc: t('diamond.infrastructureDesc') },
                capability: { label: t('diamond.capability'), desc: t('diamond.capabilityDesc') },
                victim: { label: t('diamond.victim'), desc: t('diamond.victimDesc') },
              };
              const { label, desc } = axisLabels[key] || { label: key, desc: '' };
              const values = selectedNode.axes[key];
              return (
                <div key={key} className="p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${hexColor}20` }}
                    >
                      <Icon className="w-3 h-3" style={{ color: hexColor }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-slate-200">{label}</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-600">{desc}</p>
                    </div>
                  </div>
                    <div className="space-y-1 min-h-[24px]">
                      {values.length === 0 ? (
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 italic">{t('auto.non_renseigne')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {values.map((v) => (
                            <LinkedObjectTag key={v.id} object={v} readonly />
                          ))}
                        </div>
                      )}
                    </div>
                </div>
              );
            })}
          </div>

          {/* TTPs for this phase */}
          {selectedNode.killChainPhase && phaseTtps.filter(t => t.phase_value === selectedNode.killChainPhase).length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">TTPs — {selectedNode.killChainPhaseLabel}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {phaseTtps.filter(t => t.phase_value === selectedNode.killChainPhase).map(ttp => (
                  <span
                    key={ttp.id}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/40"
                    title={ttp.description}
                  >
                    <span className="font-mono font-bold">{ttp.ttp_id}</span>
                    <span className="text-emerald-600 dark:text-emerald-300">{ttp.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('auto.notes_d_analyse')}</span>
            </div>
            {selectedNode.notes ? (
              <p className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{selectedNode.notes}</p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-600 italic">{t('auto.aucune_note')}</p>
            )}
          </div>
        </div>
      )}

      {!selectedNode && nodes.length > 0 && activeTab === 'thread' && (
        <div className="bg-gray-50/60 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700/50 rounded-xl p-4 text-center">
          <Diamond className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('auto.cliquez_sur_un_diamant_pour_vo')}</p>
        </div>
      )}
    </div>
  );
}
