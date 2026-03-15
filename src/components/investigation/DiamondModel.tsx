import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
  Diamond,
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  Save,
  AlertCircle,
  User,
  Server,
  Bug,
  Shield,
  Plus,
  Monitor,
  Globe,
  KeyRound,
  DatabaseZap,
  ExternalLink,
  Skull,
} from 'lucide-react';
import { buildDiamondNodes, getKillChainLabel } from '../../lib/diamondModelUtils';
import type { DiamondNode, DiamondAxes } from '../../lib/diamondModelUtils';
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

interface DiamondModelProps {
  caseId: string;
  killChainType: string | null;
  isClosed: boolean;
}

interface NodeOverride {
  axes?: DiamondAxes;
  notes?: string;
  label?: string;
}

interface CaseObjects {
  systems: { id: string; name: string; system_type?: string }[];
  malware: { id: string; file_name: string }[];
  accounts: { id: string; account_name: string; domain: string }[];
  networkIndicators: { id: string; ip: string | null; domain_name: string | null; url: string | null }[];
  exfiltrations: { id: string; file_name: string | null }[];
  attackerInfra: { id: string; name: string; infra_type: string }[];
}

const AXIS_KEYS = [
  { key: 'adversary' as const, icon: User, hexColor: '#ef4444', allowedTypes: ['account'] as LinkedObjectType[] },
  { key: 'infrastructure' as const, icon: Server, hexColor: '#f97316', allowedTypes: ['network', 'system', 'attacker_infra'] as LinkedObjectType[] },
  { key: 'capability' as const, icon: Bug, hexColor: '#eab308', allowedTypes: ['malware', 'exfiltration', 'ttp'] as LinkedObjectType[] },
  { key: 'victim' as const, icon: Shield, hexColor: '#22c55e', allowedTypes: ['system', 'account'] as LinkedObjectType[] },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  system: Monitor,
  malware: Bug,
  account: KeyRound,
  network: Globe,
  exfiltration: DatabaseZap,
  ttp: Shield,
  attacker_infra: Skull,
};

interface TtpOption {
  id: string;
  ttp_id: string;
  name: string;
  description: string;
  phase_value: string;
}

function getPickerOptions(axisKey: keyof DiamondAxes, objects: CaseObjects, currentValues: LinkedObject[], availableTtps?: TtpOption[]): LinkedObject[] {
  const existing = new Set(currentValues.map(v => v.id));
  const options: LinkedObject[] = [];

  if (axisKey === 'adversary' || axisKey === 'victim') {
    objects.accounts.forEach(a => {
      if (!existing.has(a.id)) {
        const label = a.domain ? `${a.domain}\\${a.account_name}` : a.account_name;
        options.push({ id: a.id, label, type: 'account' });
      }
    });
  }
  if (axisKey === 'infrastructure' || axisKey === 'victim') {
    objects.systems.forEach(s => {
      if (!existing.has(s.id)) {
        options.push({ id: s.id, label: s.name, type: 'system' });
      }
    });
  }
  if (axisKey === 'infrastructure') {
    objects.networkIndicators.forEach(ni => {
      if (!existing.has(ni.id)) {
        const val = ni.ip || ni.domain_name || ni.url || 'Indicateur';
        options.push({ id: ni.id, label: val, type: 'network' });
      }
    });
    objects.attackerInfra.forEach(ai => {
      if (!existing.has(ai.id)) {
        options.push({ id: ai.id, label: ai.name, type: 'attacker_infra' });
      }
    });
  }
  if (axisKey === 'capability') {
    objects.malware.forEach(m => {
      if (!existing.has(m.id)) {
        options.push({ id: m.id, label: m.file_name, type: 'malware' });
      }
    });
    objects.exfiltrations.forEach(e => {
      if (!existing.has(e.id)) {
        options.push({ id: e.id, label: e.file_name || 'Exfiltration', type: 'exfiltration' });
      }
    });
    // TTPs for the current phase
    if (availableTtps) {
      availableTtps.forEach(ttp => {
        const ttpLinkedId = `ttp_${ttp.id}`;
        if (!existing.has(ttpLinkedId)) {
          options.push({ id: ttpLinkedId, label: `${ttp.ttp_id} — ${ttp.name}`, type: 'ttp' });
        }
      });
    }
  }

  return options;
}

function AxesEditor({
  axisKey,
  label,
  values,
  onChange,
  icon: Icon,
  hexColor,
  objects,
  availableTtps,
}: {
  axisKey: keyof DiamondAxes;
  label: string;
  values: LinkedObject[];
  onChange: (vals: LinkedObject[]) => void;
  icon: React.ElementType;
  hexColor: string;
  objects: CaseObjects;
  availableTtps?: TtpOption[];
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const options = getPickerOptions(axisKey, objects, values, availableTtps).filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  const add = (obj: LinkedObject) => {
    onChange([...values, obj]);
    setSearch('');
  };

  const remove = (id: string) => {
    onChange(values.filter(v => v.id !== id));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: hexColor }} />
          <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition"
        >
          <Plus className="w-3 h-3" />
          {t('auto.ajouter')}</button>
      </div>
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {values.map((v) => (
          <LinkedObjectTag key={v.id} object={v} onRemove={remove} />
        ))}
        {values.length === 0 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-600 italic">{t('auto.aucun_objet')}</span>
        )}
      </div>
      {pickerOpen && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden shadow-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('auto.rechercher')}
            className="w-full px-2 py-1 text-[10px] bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-600 text-gray-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none"
          />
          <div className="max-h-32 overflow-y-auto">
            {options.length === 0 ? (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-2 italic">{t('auto.aucun_objet_disponible')}</p>
            ) : (
              options.slice(0, 15).map(opt => {
                const CatIcon = CATEGORY_ICONS[opt.type] || Bug;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { add(opt); setPickerOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                  >
                    <CatIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-slate-200 truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DiamondModel({ caseId, killChainType, isClosed: _isClosed }: DiamondModelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<DiamondNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, NodeOverride>>({});
  const [, setNodeOrder] = useState<string[]>([]);
  const [editingAxes, setEditingAxes] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAxes, setEditAxes] = useState<DiamondAxes>({ adversary: [], infrastructure: [], capability: [], victim: [] });
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'thread' | 'transition' | 'shared' | 'propagation' | 'swimlane' | 'matrix' | 'killchain'>('thread');
  const [analysisSubTab, setAnalysisSubTab] = useState<'propagation' | 'swimlane' | 'matrix'>('propagation');
  const [caseObjects, setCaseObjects] = useState<CaseObjects>({ systems: [], malware: [], accounts: [], networkIndicators: [], exfiltrations: [], attackerInfra: [] });

  const [phaseTtps, setPhaseTtps] = useState<TtpOption[]>([]);

  const loadOverridesFromDB = useCallback(async (): Promise<Record<string, NodeOverride>> => {
    try {
      const data = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
      if (!data) return {};

      const result: Record<string, NodeOverride> = {};
      for (const row of data) {
        const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : (val || []);
        result[row.event_id] = {
          label: row.label,
          notes: row.notes,
          axes: {
            adversary: parseJson(row.adversary),
            infrastructure: parseJson(row.infrastructure),
            capability: parseJson(row.capability),
            victim: parseJson(row.victim),
          },
        };
      }
      return result;
    } catch { return {}; }
  }, [caseId]);

  const loadNodeOrderFromDB = useCallback(async (): Promise<string[]> => {
    try {
      const data = await api.get(`/investigation/diamond-node-order/by-case/${caseId}`);
      if (data && data.length > 0) {
        const orderAttr = data[0].node_order;
        return typeof orderAttr === 'string' ? JSON.parse(orderAttr) : (orderAttr || []);
      }
      return [];
    } catch { return []; }
  }, [caseId]);

  const saveOverrideToDB = useCallback(async (eventId: string, override: NodeOverride) => {
    try {
      const prevOverrides = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
      const existing = (prevOverrides || []).find((o: any) => o.event_id === eventId);

      const payload = {
        case_id: caseId,
        event_id: eventId,
        label: override.label || '',
        notes: override.notes || '',
        adversary: JSON.stringify(override.axes?.adversary || []),
        infrastructure: JSON.stringify(override.axes?.infrastructure || []),
        capability: JSON.stringify(override.axes?.capability || []),
        victim: JSON.stringify(override.axes?.victim || [])
      };

      if (existing) {
        await api.put(`/investigation/diamond-overrides/${existing.id}`, payload);
      } else {
        await api.post('/investigation/diamond-overrides', payload);
      }
    } catch (err) { console.error(err); }
  }, [caseId]);

  const deleteOverrideFromDB = useCallback(async (eventId: string) => {
    try {
      const prevOverrides = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
      const existing = (prevOverrides || []).find((o: any) => o.event_id === eventId);
      if (existing) {
        await api.delete(`/investigation/diamond-overrides/${existing.id}`);
      }
    } catch (err) { console.error(err); }
  }, [caseId]);

  const saveNodeOrderToDB = useCallback(async (order: string[]) => {
    try {
      const prevOrders = await api.get(`/investigation/diamond-node-order/by-case/${caseId}`);
      const existing = (prevOrders || [])[0];
      const payload = {
        case_id: caseId,
        node_order: JSON.stringify(order)
      };
      if (existing) {
        await api.put(`/investigation/diamond-node-order/${existing.id}`, payload);
      } else {
        await api.post('/investigation/diamond-node-order', payload);
      }
    } catch (err) { console.error(err); }
  }, [caseId]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [eventsRes, systemsRes, malwareRes, indicatorsRes, accountsRes, exfilRes, attackerInfraRes, savedOverrides, orderArr] = await Promise.all([
        api.get(`/investigation/events/by-case/${caseId}`),
        api.get(`/investigation/systems/by-case/${caseId}`),
        api.get(`/investigation/malware/by-case/${caseId}`),
        api.get(`/investigation/indicators/by-case/${caseId}`),
        api.get(`/investigation/accounts/by-case/${caseId}`),
        api.get(`/investigation/exfiltrations/by-case/${caseId}`),
        api.get(`/investigation/attacker-infra/by-case/${caseId}`),
        loadOverridesFromDB(),
        loadNodeOrderFromDB(),
      ]);

      const events = (eventsRes || []).sort((a: any, b: any) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());
      const systems = systemsRes || [];
      const malwares = malwareRes || [];
      const indicators = indicatorsRes || [];
      const accounts = accountsRes || [];
      const exfils = exfilRes || [];
      const attackerInfraData = attackerInfraRes || [];

      setCaseObjects({
        systems,
        malware: malwares,
        accounts,
        networkIndicators: indicators,
        exfiltrations: exfils,
        attackerInfra: attackerInfraData,
      });

      const systemMap = new Map(systems.map((s: any) => [s.id, s]));
      const malwareMap = new Map(malwares.map((m: any) => [m.id, m]));
      const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

      const enrichedEvents = events.map((e: any) => ({
        ...e,
        source_system: systemMap.get(e.source_system_id),
        target_system: e.target_system_id ? systemMap.get(e.target_system_id) : undefined,
        malware: e.malware_id ? malwareMap.get(e.malware_id) : undefined,
        compromised_account: e.compromised_account_id ? accountMap.get(e.compromised_account_id) : undefined,
      }));

      const niForUtils = indicators.map((ni: any) => ({
        id: ni.id,
        indicator_type: null,
        value: ni.ip || ni.domain_name || ni.url || '',
      }));

      const built = buildDiamondNodes(enrichedEvents, systems, malwares, niForUtils, accounts, exfils, killChainType);

      const applyOverrides = (nodeList: DiamondNode[]) =>
        nodeList.map((n) => {
          const ov = savedOverrides[n.id];
          if (!ov) return n;
          return {
            ...n,
            label: ov.label ?? n.label,
            notes: ov.notes ?? n.notes,
            axes: ov.axes ?? n.axes,
          };
        });

      let finalNodes = applyOverrides(built);

      if (orderArr.length > 0) {
        const indexed = new Map(finalNodes.map((n) => [n.id, n]));
        const ordered = orderArr.map((id) => indexed.get(id)).filter(Boolean) as DiamondNode[];
        const rest = finalNodes.filter((n) => !orderArr.includes(n.id));
        finalNodes = [...ordered, ...rest].map((n, i) => ({ ...n, order: i }));
      }

      setNodes(finalNodes);
      setOverrides(savedOverrides);
      setNodeOrder(orderArr);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [caseId, killChainType, loadOverridesFromDB, loadNodeOrderFromDB]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch TTPs for the kill chain type
  useEffect(() => {
    if (!killChainType) return;
    api.get(`/config/ttps?kill_chain_type=${killChainType}`)
      .then(data => setPhaseTtps(data || []))
      .catch(() => setPhaseTtps([]));
  }, [killChainType]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSelectNode = (id: string) => {
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setEditingAxes(false);
      return;
    }
    setSelectedNodeId(id);
    setEditingAxes(false);
    const node = nodes.find((n) => n.id === id);
    if (node) {
      setEditLabel(node.label);
      setEditNotes(node.notes || '');
      setEditAxes({
        adversary: [...node.axes.adversary],
        infrastructure: [...node.axes.infrastructure],
        capability: [...node.axes.capability],
        victim: [...node.axes.victim],
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedNode) return;
    setSaving(true);

    const newOverride: NodeOverride = {
      label: editLabel,
      notes: editNotes,
      axes: { ...editAxes },
    };

    await saveOverrideToDB(selectedNode.id, newOverride);

    const newOverrides = { ...overrides, [selectedNode.id]: newOverride };
    setOverrides(newOverrides);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNode.id
          ? { ...n, label: editLabel, notes: editNotes, axes: { ...editAxes } }
          : n
      )
    );
    setEditingAxes(false);
    setSaving(false);
  };

  const handleCancelEdit = () => {
    if (!selectedNode) return;
    setEditLabel(selectedNode.label);
    setEditNotes(selectedNode.notes || '');
    setEditAxes({ ...selectedNode.axes });
    setEditingAxes(false);
  };

  const handleReorder = async (reorderedNodes: DiamondNode[]) => {
    setNodes(reorderedNodes);
    const newOrder = reorderedNodes.map((n) => n.id);
    setNodeOrder(newOrder);
    await saveNodeOrderToDB(newOrder);
  };

  const handleResetNode = async () => {
    if (!selectedNode) return;
    await deleteOverrideFromDB(selectedNode.id);
    const newOverrides = { ...overrides };
    delete newOverrides[selectedNode.id];
    setOverrides(newOverrides);
    fetchData();
    setEditingAxes(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Diamond className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('auto.modele_diamant')}</h3>
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
            <ActivityThread
              nodes={nodes}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onReorder={handleReorder}
              killChainType={killChainType}
            />
          </div>
        </div>
      )}

      {activeTab === 'transition' && (
        <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <RoleTransitionView nodes={nodes} />
        </div>
      )}

      {activeTab === 'shared' && (
        <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <SharedVertexView nodes={nodes} onSelectNode={(id) => { setActiveTab('thread'); handleSelectNode(id); }} selectedNodeId={selectedNodeId} />
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
            killChainType={killChainType}
            onSelectNode={(id) => { handleSelectNode(id); setActiveTab('thread'); }}
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
            {activeTab === 'propagation' && <PropagationGraphView nodes={nodes} />}
            {activeTab === 'swimlane' && <ActivitySwimlaneView nodes={nodes} />}
            {activeTab === 'matrix' && <CorrelationMatrixView nodes={nodes} />}
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
                {!editingAxes ? (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedNode.label}</p>
                ) : (
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full text-sm font-semibold bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-2 py-0.5 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-transparent mt-0.5"
                  />
                )}
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
              {!editingAxes ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingAxes(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                  >
                    <Plus className="w-3 h-3" />
                    Modifier les axes
                  </button>
                  {selectedNode.taskId && (
                    <button
                      onClick={() => navigate(`/cases/${caseId}?tab=tasks&task=${selectedNode.taskId}`)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t('auto.ouvrir_la_tache')}</button>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    {saving ? t('diamond.saving') : t('diamond.save')}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
                  >
                    <X className="w-3 h-3" />
                    {t('auto.annuler')}</button>
                  <button
                    onClick={handleResetNode}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('auto.reinitialiser')}</button>
                </>
              )}
              <button
                onClick={() => { setSelectedNodeId(null); setEditingAxes(false); }}
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
              const values = editingAxes ? editAxes[key] : selectedNode.axes[key];
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
                  {editingAxes ? (
                    <AxesEditor
                      axisKey={key}
                      label={label}
                      values={editAxes[key]}
                      onChange={(vals) => setEditAxes((prev) => ({ ...prev, [key]: vals }))}
                      icon={Icon}
                      hexColor={hexColor}
                      objects={caseObjects}
                      availableTtps={key === 'capability' && selectedNode?.killChainPhase ? phaseTtps.filter(t => t.phase_value === selectedNode.killChainPhase) : undefined}
                    />
                  ) : (
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
                  )}
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
            {editingAxes ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={t('auto.observations_hypotheses_ttp_mi_17')}
                rows={3}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 resize-none"
              />
            ) : selectedNode.notes ? (
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
