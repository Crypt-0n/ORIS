import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeProps,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Monitor, Server, Smartphone, Tablet, Tv, Router, Cpu, HelpCircle } from 'lucide-react';
import { api } from '../../lib/api';

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_ICONS: Record<string, typeof Monitor> = {
  ordinateur: Monitor,
  serveur: Server,
  telephone: Smartphone,
  tablette: Tablet,
  tv: Tv,
  equipement_reseau: Router,
  equipement_iot: Cpu,
  infrastructure_attaquant: Server,
  autre: HelpCircle,
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string; hex: string }> = {
  infected: { bg: 'bg-red-500', text: 'text-white', label: 'infecté', hex: '#ef4444' },
  compromised: { bg: 'bg-amber-500', text: 'text-white', label: 'compromis', hex: '#f59e0b' },
  clean: { bg: 'bg-emerald-500', text: 'text-white', label: 'sain', hex: '#10b981' },
  unknown: { bg: 'bg-slate-500', text: 'text-white', label: 'inconnu', hex: '#64748b' },
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

// ─── Shared types ────────────────────────────────────────────────────────────

interface SystemNodeData {
  label: string;
  systemType: string;
  status: string;
  isPatientZero: boolean;
  [key: string]: unknown;
}

interface LayoutedNode {
  id: string;
  x: number;
  y: number;
  data: SystemNodeData;
}

interface LayoutedEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  isTreeEdge: boolean;
}

// ─── Custom Node (for React Flow mode) ───────────────────────────────────────

function SystemTreeNode({ data }: NodeProps<Node<SystemNodeData>>) {
  const Icon = SYSTEM_ICONS[data.systemType] || Monitor;
  const statusStyle = STATUS_COLORS[data.status] || STATUS_COLORS.unknown;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      {data.isPatientZero && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-medium text-slate-400 bg-slate-800 border border-slate-600 px-2 py-0.5 rounded-full">
            Patient zéro
          </span>
        </div>
      )}
      <div className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 shadow-xl min-w-[200px] hover:border-blue-400 transition-colors cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-slate-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{data.label}</div>
            <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
              {statusStyle.label}
            </span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

const nodeTypes = { systemTree: SystemTreeNode };

// ─── Dagre Layout ────────────────────────────────────────────────────────────

export function runDagreLayout(nodes: { id: string; data: SystemNodeData }[], edgePairs: { source: string; target: string }[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', ranksep: 120, nodesep: 80, marginx: 40, marginy: 40 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edgePairs.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return { ...n, x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 };
  });
}

// ─── Edge Label ──────────────────────────────────────────────────────────────

function formatEdgeDate(datetime: string): string {
  try {
    const d = new Date(datetime.includes('T') ? datetime : datetime.replace(' ', 'T') + 'Z');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hour}:${min}`;
  } catch {
    return datetime;
  }
}

// ─── Shared data fetching ────────────────────────────────────────────────────

export async function fetchTreeData(caseId: string) {
  const [allEvents, overridesRes, systemsRes] = await Promise.all([
    api.get(`/investigation/events/by-case/${caseId}`),
    api.get(`/investigation/diamond-overrides/by-case/${caseId}`),
    api.get(`/investigation/systems/by-case/${caseId}`),
  ]);

  const overridesMap = new Map<string, any>();
  (overridesRes || []).forEach((o: any) => overridesMap.set(o.event_id, o));

  const mappedEvents = (allEvents || []).map((e: any) => {
    let src = null, tgt = null;
    const ov = overridesMap.get(e.id);
    if (ov) {
      try {
        const infra = JSON.parse(ov.infrastructure || '[]');
        if (infra[0]?.type === 'system') src = infra[0].id;
        const vic = JSON.parse(ov.victim || '[]');
        if (vic[0]?.type === 'system') tgt = vic[0].id;
      } catch { /* ignore */ }
    }
    return { ...e, mapped_source: src, mapped_target: tgt };
  });

  const validEvents = mappedEvents
    .filter((e: any) => e.mapped_target && e.mapped_source && e.mapped_source !== e.mapped_target)
    .sort((a: any, b: any) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());

  if (validEvents.length === 0) return null;

  const systemMap = new Map<string, any>();
  (systemsRes || []).forEach((s: any) => systemMap.set(s.id, s));

  const sysIds = new Set<string>();
  validEvents.forEach((e: any) => { sysIds.add(e.mapped_source); sysIds.add(e.mapped_target); });

  let tasksData: any[] = [];
  try { tasksData = await api.get(`/tasks/by-case/${caseId}`); } catch { /* ignore */ }

  const systemStatus = new Map<string, string>();
  const STATUS_PRIORITY = ['infected', 'compromised', 'clean'];
  sysIds.forEach(sysId => {
    const sysTasks = (tasksData || []).filter((t: any) => t.system_id === sysId);
    let status = 'unknown';
    const closedTasks = sysTasks.filter((t: any) => t.status === 'closed' && t.investigation_status);
    for (const s of STATUS_PRIORITY) {
      if (closedTasks.some((t: any) => t.investigation_status === s)) { status = s; break; }
    }
    if (status === 'unknown') {
      const openTasks = sysTasks.filter((t: any) => t.initial_investigation_status);
      for (const s of STATUS_PRIORITY) {
        if (openTasks.some((t: any) => t.initial_investigation_status === s)) { status = s; break; }
      }
    }
    systemStatus.set(sysId, status);
  });

  const parent = new Map<string, string>();
  validEvents.forEach((e: any) => {
    if (!parent.has(e.mapped_target)) parent.set(e.mapped_target, e.mapped_source);
  });

  const roots = [...sysIds].filter(id => !parent.has(id));

  const nodeData = [...sysIds].map(sysId => {
    const sys = systemMap.get(sysId);
    return {
      id: sysId,
      data: {
        label: sys?.name || 'Inconnu',
        systemType: sys?.system_type || 'ordinateur',
        status: systemStatus.get(sysId) || 'unknown',
        isPatientZero: roots.includes(sysId),
      },
    };
  });

  const edgePairs = new Map<string, { source: string; target: string; dates: string[] }>();
  validEvents.forEach((e: any) => {
    const key = `${e.mapped_source}->${e.mapped_target}`;
    const existing = edgePairs.get(key);
    if (existing) { existing.dates.push(e.event_datetime); }
    else { edgePairs.set(key, { source: e.mapped_source, target: e.mapped_target, dates: [e.event_datetime] }); }
  });

  const edges = [...edgePairs.entries()].map(([key, pair]) => ({
    id: key,
    source: pair.source,
    target: pair.target,
    label: pair.dates.map(formatEdgeDate).join('\n'),
    isTreeEdge: parent.get(pair.target) === pair.source,
  }));

  return { nodeData, edges, parent };
}

// ─── Static SVG Render (for PDF/report capture) ─────────────────────────────

function StaticTreeView({ caseId }: { caseId: string }) {
  const [nodes, setNodes] = useState<LayoutedNode[]>([]);
  const [edges, setEdges] = useState<LayoutedEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetchTreeData(caseId);
        if (cancelled || !result) { setLoading(false); return; }

        const layouted = runDagreLayout(result.nodeData, result.edges);
        if (cancelled) return;

        const maxX = Math.max(...layouted.map(n => n.x)) + NODE_WIDTH;
        const maxY = Math.max(...layouted.map(n => n.y)) + NODE_HEIGHT;
        setDims({ w: Math.max(600, maxX + 40), h: Math.max(300, maxY + 60) });
        setNodes(layouted);
        setEdges(result.edges);
        setLoading(false);
      } catch (err) {
        console.error('StaticTreeView error:', err);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-slate-900 rounded-xl border border-slate-700" style={{ height: 300 }}>
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-sm">Chargement de l'arbre...</span>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-900 rounded-xl border border-slate-700" style={{ height: 200 }}>
        <p className="text-sm text-slate-500">Aucun mouvement latéral pour construire l'arbre</p>
      </div>
    );
  }

  // Build a position lookup for edges
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden" style={{ position: 'relative', width: '100%', height: dims.h }}>
      {/* SVG layer for edge lines only */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
          </marker>
        </defs>
        {edges.map(edge => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) return null;

          const x1 = src.x + NODE_WIDTH / 2;
          const y1 = src.y + NODE_HEIGHT;
          const x2 = tgt.x + NODE_WIDTH / 2;
          const y2 = tgt.y;
          const color = edge.isTreeEdge ? '#3b82f6' : '#ef4444';
          const markerId = edge.isTreeEdge ? 'arrow-blue' : 'arrow-red';
          const midY = (y1 + y2) / 2;

          return (
            <path
              key={edge.id}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={2}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}
      </svg>

      {/* HTML layer for edge labels */}
      {edges.map(edge => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt || !edge.label) return null;

        const x1 = src.x + NODE_WIDTH / 2;
        const y1 = src.y + NODE_HEIGHT;
        const x2 = tgt.x + NODE_WIDTH / 2;
        const y2 = tgt.y;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        return (
          <div
            key={`label-${edge.id}`}
            style={{
              position: 'absolute',
              left: midX,
              top: midY,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(30, 41, 59, 0.9)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 500,
              color: edge.isTreeEdge ? '#60a5fa' : '#f87171',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {edge.label.split('\n')[0]}
          </div>
        );
      })}

      {/* Node layer */}
      {nodes.map(node => {
        const Icon = SYSTEM_ICONS[node.data.systemType] || Monitor;
        const status = STATUS_COLORS[node.data.status] || STATUS_COLORS.unknown;

        return (
          <div key={node.id} style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_WIDTH }}>
            {node.data.isPatientZero && (
              <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 10, color: '#94a3b8', background: '#1e293b', border: '1px solid #475569', padding: '1px 8px', borderRadius: 9999 }}>
                  Patient zéro
                </span>
              </div>
            )}
            <div style={{
              background: '#1e293b',
              border: '1px solid #475569',
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#334155',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon style={{ width: 20, height: 20, color: '#cbd5e1' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{node.data.label}</div>
                <span style={{
                  display: 'inline-block', marginTop: 2, fontSize: 10, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 9999, background: status.hex, color: '#ffffff',
                }}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Interactive React Flow Renderer ─────────────────────────────────────────

function InnerFlow({ caseId }: { caseId: string }) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<SystemNodeData>>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const { fitView } = useReactFlow();

  const onInit = useCallback(() => {
    setTimeout(() => fitView({ padding: 0.4 }), 100);
    setTimeout(() => fitView({ padding: 0.4 }), 500);
  }, [fitView]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetchTreeData(caseId);
        if (cancelled || !result) { setLoading(false); return; }

        const layouted = runDagreLayout(result.nodeData, result.edges);
        const rfNodes: Node<SystemNodeData>[] = layouted.map(n => ({
          id: n.id, type: 'systemTree', position: { x: n.x, y: n.y }, data: n.data,
        }));

        const rfEdges: Edge[] = result.edges.map(e => ({
          id: e.id, source: e.source, target: e.target, type: 'default', animated: false,
          label: e.label,
          labelStyle: { fontSize: 11, fontWeight: 500, fill: e.isTreeEdge ? '#60a5fa' : '#f87171', fontFamily: 'ui-monospace, monospace' },
          labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 },
          labelBgPadding: [6, 4] as [number, number],
          labelBgBorderRadius: 4,
          style: { stroke: e.isTreeEdge ? '#3b82f6' : '#ef4444', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: e.isTreeEdge ? '#3b82f6' : '#ef4444', width: 16, height: 16 },
        }));

        if (cancelled) return;
        setFlowNodes(rfNodes);
        setFlowEdges(rfEdges);
        setLoading(false);
        setTimeout(() => fitView({ padding: 0.4 }), 200);
        setTimeout(() => fitView({ padding: 0.4 }), 600);
      } catch (err) {
        console.error('ChronologicalTreeView error:', err);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [caseId]);

  const defaultEdgeOptions = useMemo(() => ({ type: 'default' }), []);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin" />
        <span className="text-sm">Chargement de l'arbre...</span>
      </div>
    </div>
  );

  if (flowNodes.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-slate-500">Aucun mouvement latéral pour construire l'arbre</p>
    </div>
  );

  return (
    <ReactFlow
      nodes={flowNodes} edges={flowEdges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
      onInit={onInit} fitView fitViewOptions={{ padding: 0.4 }}
      minZoom={0.2} maxZoom={2}
      proOptions={{ hideAttribution: true }}
      className="chronological-tree-flow"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#334155" />
      <Controls
        className="!bg-slate-800 !border-slate-600 !rounded-lg !shadow-xl [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600"
        showInteractive={false}
      />
    </ReactFlow>
  );
}

// ─── Public Component ────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  staticRender?: boolean;
}

export function ChronologicalTreeView({ caseId, staticRender }: Props) {
  if (staticRender) {
    return <StaticTreeView caseId={caseId} />;
  }

  return (
    <div className="h-[500px] bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <ReactFlowProvider>
        <InnerFlow caseId={caseId} />
      </ReactFlowProvider>
    </div>
  );
}
