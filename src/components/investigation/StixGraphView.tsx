import React from 'react';
/**
 * StixGraphView.tsx
 * 
 * Interactive STIX 2.1 graph visualizer using React Flow.
 * Displays all STIX objects (SDOs/SCOs) as nodes and relationships (SROs) as edges.
 */

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeProps,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  LayoutGrid,
  X,
  ChevronRight,
  ExternalLink,
  Filter,
  Maximize2,
  Download,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Info,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  buildGraphData,
  applyDagreLayout,
  filterGraph,
  getDistinctTypes,
  getStixNodeStyle,
  getEdgeStyle,
  getObjectLabel,
  type StixNodeStyle,
} from '../../lib/stixGraphUtils';

// ─── Types ───────────────────────────────────────────────────

interface StixGraphViewProps {
  caseId: string;
}

// ─── Custom STIX Node Component ──────────────────────────────

const StixNodeComponent = memo(({ data }: NodeProps) => {
  const style = data.style as StixNodeStyle;
  const isDark = data.isDark as boolean;
  const label = data.label as string;
  const stixType = data.stixType as string;
  const truncatedLabel = label.length > 28 ? label.slice(0, 26) + '…' : label;

  const bg = isDark ? style.darkBgColor : style.bgColor;
  const border = isDark ? style.darkBorderColor : style.borderColor;
  const text = isDark ? style.darkTextColor : style.textColor;

  // Shape via border-radius
  const shapeStyle: React.CSSProperties = {
    borderRadius:
      style.shape === 'circle' ? '50%' :
      style.shape === 'hexagon' ? '12px' :
      style.shape === 'diamond' ? '4px' :
      style.shape === 'octagon' ? '8px' :
      '6px',
    transform: style.shape === 'diamond' ? 'rotate(0deg)' : undefined,
  };

  const isSmallNode = ['ipv4-addr', 'ipv6-addr', 'domain-name', 'url', 'file', 'user-account', 'network-traffic'].includes(stixType);

  return (
    <div
      className="group relative"
      style={{
        minWidth: isSmallNode ? 120 : 170,
        maxWidth: isSmallNode ? 160 : 220,
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-2" style={{ borderColor: border, background: bg }} />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !border-2" style={{ borderColor: border, background: bg }} />

      <div
        className="relative flex items-center gap-2 px-3 py-2 border-2 shadow-sm transition-shadow hover:shadow-lg cursor-pointer"
        style={{
          background: bg,
          borderColor: border,
          color: text,
          ...shapeStyle,
        }}
      >
        <span className="text-base flex-shrink-0">{style.icon}</span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-semibold truncate leading-tight">{truncatedLabel}</span>
          <span className="text-[9px] opacity-70 leading-tight">{style.label}</span>
        </div>
      </div>
    </div>
  );
});
StixNodeComponent.displayName = 'StixNodeComponent';

const nodeTypes = { stixNode: StixNodeComponent };

// ─── Detail Panel Component ─────────────────────────────────

function DetailPanel({
  selectedNode,
  selectedEdge,
  objects,
  relationships,
  onClose,
  isDark,
}: {
  selectedNode: Node | null;
  selectedEdge: Edge | null;
  objects: any[];
  relationships: any[];
  onClose: () => void;
  isDark: boolean;
}) {
  if (!selectedNode && !selectedEdge) return null;

  if (selectedNode) {
    const raw = selectedNode.data.raw as any;
    const style = getStixNodeStyle(raw.type);

    // Find related edges
    const relatedRels = relationships.filter(
      r => r.source_ref === raw.id || r.target_ref === raw.id
    );

    return (
      <div className={`absolute top-0 right-0 h-full w-80 border-l z-20 overflow-y-auto shadow-xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: isDark ? '#334155' : '#e5e7eb', background: isDark ? '#0f172a' : '#ffffff' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{style.icon}</span>
            <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{getObjectLabel(raw)}</h3>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Type badge */}
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: isDark ? style.darkBgColor : style.bgColor, color: isDark ? style.darkTextColor : style.textColor, border: `1px solid ${isDark ? style.darkBorderColor : style.borderColor}` }}
            >
              {style.label}
            </span>
            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{raw.type}</span>
          </div>

          {/* Properties */}
          <div className="space-y-2">
            <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Propriétés</h4>
            <div className="space-y-1.5">
              {raw.name && <PropRow label="Nom" value={raw.name} isDark={isDark} />}
              {raw.value && <PropRow label="Valeur" value={raw.value} isDark={isDark} />}
              {raw.description && <PropRow label="Description" value={raw.description} isDark={isDark} multiline />}
              {raw.pattern && <PropRow label="Pattern" value={raw.pattern} isDark={isDark} mono />}
              {raw.created && <PropRow label="Créé" value={new Date(raw.created).toLocaleString('fr-FR')} isDark={isDark} />}
              {raw.modified && <PropRow label="Modifié" value={new Date(raw.modified).toLocaleString('fr-FR')} isDark={isDark} />}
              {raw.first_observed && <PropRow label="1ère obs." value={new Date(raw.first_observed).toLocaleString('fr-FR')} isDark={isDark} />}
              {raw.x_oris_kill_chain && <PropRow label="Kill Chain" value={raw.x_oris_kill_chain} isDark={isDark} />}
              {raw.infrastructure_types?.length > 0 && <PropRow label="Types infra" value={raw.infrastructure_types.join(', ')} isDark={isDark} />}
              {raw.is_family !== undefined && <PropRow label="Famille" value={raw.is_family ? 'Oui' : 'Non'} isDark={isDark} />}
              {raw.sophistication && <PropRow label="Sophistication" value={raw.sophistication} isDark={isDark} />}
              {raw.identity_class && <PropRow label="Classe" value={raw.identity_class} isDark={isDark} />}
              {raw.x_oris_hashes && Object.entries(raw.x_oris_hashes).map(([k, v]) => (
                <PropRow key={k} label={k} value={v as string} isDark={isDark} mono />
              ))}
            </div>
          </div>

          {/* Relations */}
          {relatedRels.length > 0 && (
            <div className="space-y-2">
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                Relations ({relatedRels.length})
              </h4>
              <div className="space-y-1">
                {relatedRels.map((rel, i) => {
                  const isSource = rel.source_ref === raw.id;
                  const otherId = isSource ? rel.target_ref : rel.source_ref;
                  const otherObj = objects.find(o => o.id === otherId);
                  const edgeStyle = getEdgeStyle(rel.relationship_type);
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}
                    >
                      {isSource ? (
                        <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? edgeStyle.darkColor : edgeStyle.color }} />
                      ) : (
                        <ArrowLeft className="w-3 h-3 flex-shrink-0" style={{ color: isDark ? edgeStyle.darkColor : edgeStyle.color }} />
                      )}
                      <span className="font-medium" style={{ color: isDark ? edgeStyle.darkColor : edgeStyle.color }}>
                        {edgeStyle.label}
                      </span>
                      <span className={`truncate ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {otherObj ? getObjectLabel(otherObj) : otherId.split('--')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STIX ID */}
          <div className="pt-2 border-t" style={{ borderColor: isDark ? '#334155' : '#e5e7eb' }}>
            <span className={`text-[9px] font-mono break-all ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>{raw.id}</span>
          </div>
        </div>
      </div>
    );
  }

  // Edge detail
  if (selectedEdge) {
    const raw = (selectedEdge.data as any)?.raw;
    if (!raw) return null;
    const edgeStyle = getEdgeStyle(raw.relationship_type);
    const srcObj = objects.find(o => o.id === raw.source_ref);
    const tgtObj = objects.find(o => o.id === raw.target_ref);

    return (
      <div className={`absolute top-0 right-0 h-full w-80 border-l z-20 overflow-y-auto shadow-xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: isDark ? '#334155' : '#e5e7eb', background: isDark ? '#0f172a' : '#ffffff' }}>
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Relation</h3>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-col items-center gap-2 py-3">
            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              {srcObj ? getObjectLabel(srcObj) : '?'}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5" style={{ background: isDark ? edgeStyle.darkColor : edgeStyle.color }} />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: isDark ? edgeStyle.darkColor : edgeStyle.color, background: isDark ? '#1e293b' : '#f8fafc', border: `1px solid ${isDark ? edgeStyle.darkColor : edgeStyle.color}` }}>
                {edgeStyle.label}
              </span>
              <div className="w-8 h-0.5" style={{ background: isDark ? edgeStyle.darkColor : edgeStyle.color }} />
            </div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              {tgtObj ? getObjectLabel(tgtObj) : '?'}
            </span>
          </div>
          {raw.created && <PropRow label="Créée" value={new Date(raw.created).toLocaleString('fr-FR')} isDark={isDark} />}
          {raw.confidence !== undefined && <PropRow label="Confiance" value={`${raw.confidence}%`} isDark={isDark} />}
          <div className="pt-2 border-t" style={{ borderColor: isDark ? '#334155' : '#e5e7eb' }}>
            <span className={`text-[9px] font-mono break-all ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>{raw.id}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function PropRow({ label, value, isDark, multiline, mono }: { label: string; value: string; isDark: boolean; multiline?: boolean; mono?: boolean }) {
  return (
    <div className={`flex ${multiline ? 'flex-col gap-0.5' : 'items-center justify-between gap-2'}`}>
      <span className={`text-[10px] uppercase tracking-wider flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-[11px] ${multiline ? '' : 'text-right truncate'} ${mono ? 'font-mono' : ''} ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Inner Graph Component (needs ReactFlowProvider) ─────────

function StixGraphInner({ caseId }: StixGraphViewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const reactFlowInstance = useReactFlow();

  const [objects, setObjects] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Graph state
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // All raw nodes/edges (before filtering)
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);

  // Filters
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR');

  // Selection
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Distinct types
  const distinctTypes = useMemo(() => getDistinctTypes(objects), [objects]);

  // ── Fetch Data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [objs, rels] = await Promise.all([
        api.get(`/stix/objects/by-case/${caseId}`),
        api.get(`/stix/relationships/by-case/${caseId}`),
      ]);
      setObjects(objs || []);
      setRelationships(rels || []);

      // Init active types to all
      const types = getDistinctTypes(objs || []);
      setActiveTypes(new Set(types));
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Build graph when data changes ──
  useEffect(() => {
    if (objects.length === 0) return;

    const { nodes: rawNodes, edges: rawEdges } = buildGraphData(objects, relationships, isDark);

    // Check if any node has a saved position
    const hasSavedPositions = rawNodes.some(n => {
      const r = (n.data.raw as any);
      return r.x_oris_graph_position?.x !== undefined && r.x_oris_graph_position?.x !== 0;
    });

    const layoutNodes = hasSavedPositions ? rawNodes : applyDagreLayout(rawNodes, rawEdges, layoutDirection);
    setAllNodes(layoutNodes);
    setAllEdges(rawEdges);
  }, [objects, relationships, isDark, layoutDirection]);

  // ── Apply filters ──
  useEffect(() => {
    if (allNodes.length === 0) return;
    const { nodes: fNodes, edges: fEdges } = filterGraph(allNodes, allEdges, activeTypes, searchTerm);
    setNodes(fNodes);
    setEdges(fEdges);
  }, [allNodes, allEdges, activeTypes, searchTerm, setNodes, setEdges]);

  // ── Handlers ──
  const handleRelayout = useCallback(() => {
    const layouted = applyDagreLayout(allNodes, allEdges, layoutDirection);
    setAllNodes(layouted);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
  }, [allNodes, allEdges, layoutDirection, reactFlowInstance]);

  const handleToggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const handleSelectAll = () => setActiveTypes(new Set(distinctTypes));
  const handleDeselectAll = () => setActiveTypes(new Set());

  const handleNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleExportJson = useCallback(async () => {
    try {
      const bundle = await api.get(`/stix/bundle/${caseId}`);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stix-bundle-${caseId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }, [caseId]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-3" />
        <span className={isDark ? 'text-slate-400' : 'text-gray-500'}>Chargement du graphe STIX…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Info className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">Réessayer</button>
      </div>
    );
  }

  if (objects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <ExternalLink className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-gray-300'}`} />
        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Aucun objet STIX dans ce dossier</p>
      </div>
    );
  }

  const totalHidden = distinctTypes.length - activeTypes.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-blue-500" />
          <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Graphe STIX 2.1</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
            {nodes.length} nœuds · {edges.length} relations
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-gray-500'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher…"
              className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border w-48 focus:ring-2 focus:ring-blue-500 outline-none transition ${
                isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition ${
              showFilters
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtres
            {totalHidden > 0 && (
              <span className="ml-1 px-1.5 py-0 rounded-full text-[10px] font-bold bg-blue-500 text-white">{totalHidden}</span>
            )}
          </button>

          {/* Layout toggle */}
          <button
            onClick={() => {
              const newDir = layoutDirection === 'LR' ? 'TB' : 'LR';
              setLayoutDirection(newDir);
            }}
            title={layoutDirection === 'LR' ? 'Layout vertical' : 'Layout horizontal'}
            className={`p-1.5 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* Re-layout */}
          <button
            onClick={handleRelayout}
            title="Réorganiser le graphe"
            className={`p-1.5 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            title="Exporter le bundle STIX (JSON)"
            className={`p-1.5 rounded-lg border transition ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={handleSelectAll}
              className={`text-[10px] px-2 py-0.5 rounded transition ${isDark ? 'text-blue-400 hover:bg-blue-900/30' : 'text-blue-600 hover:bg-blue-50'}`}
            >
              Tout
            </button>
            <button
              onClick={handleDeselectAll}
              className={`text-[10px] px-2 py-0.5 rounded transition ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Aucun
            </button>
          </div>
          {distinctTypes.map(type => {
            const s = getStixNodeStyle(type);
            const isActive = activeTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => handleToggleType(type)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-all ${
                  isActive
                    ? ''
                    : 'opacity-40 grayscale'
                }`}
                style={{
                  background: isActive ? (isDark ? s.darkBgColor : s.bgColor) : 'transparent',
                  borderColor: isDark ? s.darkBorderColor : s.borderColor,
                  color: isDark ? s.darkTextColor : s.textColor,
                }}
              >
                {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Graph Canvas */}
      <div
        className={`relative rounded-lg border overflow-hidden ${isDark ? 'border-slate-700' : 'border-gray-200'}`}
        style={{ height: '70vh', minHeight: 500 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements={true}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2.5}
          defaultEdgeOptions={{ type: 'smoothstep' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={isDark ? '#1e293b' : '#e2e8f0'}
          />
          <Controls
            position="bottom-left"
            className={isDark ? '[&>button]:!bg-slate-800 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700' : ''}
          />
          <MiniMap
            position="bottom-right"
            nodeColor={(n) => {
              const s = getStixNodeStyle((n.data as any).stixType);
              return isDark ? s.darkBorderColor : s.borderColor;
            }}
            maskColor={isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)'}
            style={{
              background: isDark ? '#1e293b' : '#f8fafc',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: '8px',
            }}
          />

          {/* Stats panel */}
          <Panel position="top-left" className="!m-2">
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-[10px] shadow-sm border ${isDark ? 'bg-slate-900/90 border-slate-700 text-slate-400' : 'bg-white/90 border-gray-200 text-gray-500'}`}>
              <span>{objects.length} objets</span>
              <span>·</span>
              <span>{relationships.length} relations</span>
              {totalHidden > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-500">{totalHidden} types masqués</span>
                </>
              )}
            </div>
          </Panel>
        </ReactFlow>

        {/* Detail Panel */}
        <DetailPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          objects={objects}
          relationships={relationships}
          onClose={() => { setSelectedNode(null); setSelectedEdge(null); }}
          isDark={isDark}
        />
      </div>

      {/* Legend */}
      <div className={`flex flex-wrap gap-3 px-4 py-3 rounded-lg border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
        <span className={`text-[10px] font-semibold uppercase tracking-wider self-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
          Légende
        </span>
        {distinctTypes.slice(0, 10).map(type => {
          const s = getStixNodeStyle(type);
          return (
            <div key={type} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm border" style={{ background: isDark ? s.darkBgColor : s.bgColor, borderColor: isDark ? s.darkBorderColor : s.borderColor }} />
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{s.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1 ml-2">
          <ChevronRight className={`w-3 h-3 ${isDark ? 'text-slate-500' : 'text-gray-500'}`} />
          <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Flèche = direction du lien</span>
        </div>
      </div>
    </div>
  );
}

// ─── Wrapped Component with Provider ─────────────────────────

export function StixGraphView({ caseId }: StixGraphViewProps) {
  return (
    <ReactFlowProvider>
      <StixGraphInner caseId={caseId} />
    </ReactFlowProvider>
  );
}
