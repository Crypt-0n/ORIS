/**
 * stixGraphUtils.ts
 *
 * Utility functions for transforming STIX 2.1 objects and relationships
 * into React Flow nodes and edges, with dagre-based automatic layout.
 */

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

// ─── STIX Type Visual Definitions ────────────────────────────

export interface StixNodeStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
  darkBgColor: string;
  darkBorderColor: string;
  darkTextColor: string;
  icon: string;
  label: string;
  shape: 'rectangle' | 'hexagon' | 'diamond' | 'circle' | 'octagon';
}

export const STIX_NODE_STYLES: Record<string, StixNodeStyle> = {
  'threat-actor': {
    bgColor: '#fef2f2', borderColor: '#ef4444', textColor: '#991b1b',
    darkBgColor: '#450a0a', darkBorderColor: '#f87171', darkTextColor: '#fca5a5',
    icon: '👤', label: 'Adversaire', shape: 'hexagon',
  },
  'intrusion-set': {
    bgColor: '#fff1f2', borderColor: '#f43f5e', textColor: '#9f1239',
    darkBgColor: '#4c0519', darkBorderColor: '#fb7185', darkTextColor: '#fda4af',
    icon: '🥷', label: 'Intrusion Set', shape: 'hexagon',
  },
  'campaign': {
    bgColor: '#fff1f2', borderColor: '#fb7185', textColor: '#be123c',
    darkBgColor: '#4c0519', darkBorderColor: '#fda4af', darkTextColor: '#fecdd3',
    icon: '🎌', label: 'Campagne', shape: 'hexagon',
  },
  infrastructure: {
    bgColor: '#eff6ff', borderColor: '#3b82f6', textColor: '#1e40af',
    darkBgColor: '#172554', darkBorderColor: '#60a5fa', darkTextColor: '#93c5fd',
    icon: '🖥️', label: 'Infrastructure', shape: 'rectangle',
  },
  malware: {
    bgColor: '#faf5ff', borderColor: '#a855f7', textColor: '#6b21a8',
    darkBgColor: '#3b0764', darkBorderColor: '#c084fc', darkTextColor: '#d8b4fe',
    icon: '🦠', label: 'Malware', shape: 'diamond',
  },
  identity: {
    bgColor: '#f0fdf4', borderColor: '#22c55e', textColor: '#166534',
    darkBgColor: '#052e16', darkBorderColor: '#4ade80', darkTextColor: '#86efac',
    icon: '🏢', label: 'Identité', shape: 'rectangle',
  },
  'attack-pattern': {
    bgColor: '#fff7ed', borderColor: '#f97316', textColor: '#9a3412',
    darkBgColor: '#431407', darkBorderColor: '#fb923c', darkTextColor: '#fdba74',
    icon: '⚔️', label: 'Technique', shape: 'octagon',
  },
  tool: {
    bgColor: '#ecfeff', borderColor: '#06b6d4', textColor: '#155e75',
    darkBgColor: '#083344', darkBorderColor: '#22d3ee', darkTextColor: '#67e8f9',
    icon: '🔧', label: 'Outil', shape: 'rectangle',
  },
  indicator: {
    bgColor: '#fefce8', borderColor: '#eab308', textColor: '#854d0e',
    darkBgColor: '#422006', darkBorderColor: '#facc15', darkTextColor: '#fde047',
    icon: '🎯', label: 'Indicateur', shape: 'circle',
  },
  'observed-data': {
    bgColor: '#f8fafc', borderColor: '#64748b', textColor: '#334155',
    darkBgColor: '#1e293b', darkBorderColor: '#94a3b8', darkTextColor: '#cbd5e1',
    icon: '📊', label: 'Événement', shape: 'rectangle',
  },
  'ipv4-addr': {
    bgColor: '#eff6ff', borderColor: '#60a5fa', textColor: '#1d4ed8',
    darkBgColor: '#1e3a5f', darkBorderColor: '#93c5fd', darkTextColor: '#bfdbfe',
    icon: '🌐', label: 'IPv4', shape: 'circle',
  },
  'ipv6-addr': {
    bgColor: '#eff6ff', borderColor: '#60a5fa', textColor: '#1d4ed8',
    darkBgColor: '#1e3a5f', darkBorderColor: '#93c5fd', darkTextColor: '#bfdbfe',
    icon: '🌐', label: 'IPv6', shape: 'circle',
  },
  'domain-name': {
    bgColor: '#eef2ff', borderColor: '#818cf8', textColor: '#3730a3',
    darkBgColor: '#1e1b4b', darkBorderColor: '#a5b4fc', darkTextColor: '#c7d2fe',
    icon: '🌐', label: 'Domaine', shape: 'circle',
  },
  url: {
    bgColor: '#f5f3ff', borderColor: '#8b5cf6', textColor: '#5b21b6',
    darkBgColor: '#2e1065', darkBorderColor: '#a78bfa', darkTextColor: '#c4b5fd',
    icon: '🔗', label: 'URL', shape: 'circle',
  },
  file: {
    bgColor: '#f9fafb', borderColor: '#9ca3af', textColor: '#374151',
    darkBgColor: '#1f2937', darkBorderColor: '#d1d5db', darkTextColor: '#e5e7eb',
    icon: '📄', label: 'Fichier', shape: 'rectangle',
  },
  'user-account': {
    bgColor: '#fffbeb', borderColor: '#f59e0b', textColor: '#92400e',
    darkBgColor: '#451a03', darkBorderColor: '#fbbf24', darkTextColor: '#fcd34d',
    icon: '🔑', label: 'Compte', shape: 'hexagon',
  },
  'network-traffic': {
    bgColor: '#f0fdfa', borderColor: '#14b8a6', textColor: '#115e59',
    darkBgColor: '#042f2e', darkBorderColor: '#2dd4bf', darkTextColor: '#5eead4',
    icon: '📡', label: 'Trafic réseau', shape: 'rectangle',
  },
};

export function getStixNodeStyle(type: string): StixNodeStyle {
  return STIX_NODE_STYLES[type] || {
    bgColor: '#f1f5f9', borderColor: '#94a3b8', textColor: '#475569',
    darkBgColor: '#1e293b', darkBorderColor: '#64748b', darkTextColor: '#94a3b8',
    icon: '❓', label: type, shape: 'rectangle',
  };
}

// ─── Edge Style by Relationship Type ─────────────────────────

export interface StixEdgeStyle {
  color: string;
  darkColor: string;
  label: string;
  animated: boolean;
}

const EDGE_STYLES: Record<string, StixEdgeStyle> = {
  uses: { color: '#f97316', darkColor: '#fb923c', label: 'utilise', animated: false },
  targets: { color: '#ef4444', darkColor: '#f87171', label: 'cible', animated: true },
  'originates-from': { color: '#3b82f6', darkColor: '#60a5fa', label: 'provient de', animated: false },
  'lateral-movement': { color: '#a855f7', darkColor: '#c084fc', label: 'mvt latéral', animated: true },
  'based-on': { color: '#6366f1', darkColor: '#818cf8', label: 'basé sur', animated: false },
  'consists-of': { color: '#06b6d4', darkColor: '#22d3ee', label: 'composé de', animated: false },
  delivers: { color: '#ef4444', darkColor: '#f87171', label: 'délivre', animated: false },
  indicates: { color: '#eab308', darkColor: '#facc15', label: 'indique', animated: false },
  'attributed-to': { color: '#f43f5e', darkColor: '#fb7185', label: 'attribué à', animated: false },
  'communicates-with': { color: '#14b8a6', darkColor: '#2dd4bf', label: 'communique', animated: true },
  drops: { color: '#dc2626', darkColor: '#f87171', label: 'dépose', animated: false },
  exploits: { color: '#f97316', darkColor: '#fb923c', label: 'exploite', animated: false },
  mitigates: { color: '#22c55e', darkColor: '#4ade80', label: 'atténue', animated: false },
  'located-at': { color: '#64748b', darkColor: '#94a3b8', label: 'situé à', animated: false },
};

export function getEdgeStyle(type: string): StixEdgeStyle {
  return EDGE_STYLES[type] || {
    color: '#94a3b8', darkColor: '#64748b', label: type, animated: false,
  };
}

// ─── Get Object Label ────────────────────────────────────────

export function getObjectLabel(obj: any): string {
  return obj.name || obj.value || obj.display_name || obj.user_id || obj.pattern?.slice(0, 40) || obj.type || '?';
}

// ─── Build React Flow Graph Data ─────────────────────────────

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export function buildGraphData(
  objects: any[],
  relationships: any[],
  isDark: boolean,
): GraphData {
  const objectIds = new Set(objects.map(o => o.id));

  const nodes: Node[] = objects.map(obj => {
    const style = getStixNodeStyle(obj.type);
    return {
      id: obj.id,
      type: 'stixNode',
      position: obj.x_oris_graph_position || { x: 0, y: 0 },
      data: {
        label: getObjectLabel(obj),
        stixType: obj.type,
        style,
        isDark,
        raw: obj,
      },
    };
  });

  const edges: Edge[] = relationships
    .filter(r => objectIds.has(r.source_ref) && objectIds.has(r.target_ref))
    .map(rel => {
      const edgeStyle = getEdgeStyle(rel.relationship_type);
      const edgeColor = isDark ? edgeStyle.darkColor : edgeStyle.color;
      return {
        id: rel.id || `${rel.source_ref}-${rel.relationship_type}-${rel.target_ref}`,
        source: rel.source_ref,
        target: rel.target_ref,
        label: edgeStyle.label,
        animated: edgeStyle.animated,
        type: 'smoothstep',
        style: { stroke: edgeColor, strokeWidth: 1.5 },
        labelStyle: { fill: edgeColor, fontWeight: 600, fontSize: 10 },
        labelBgStyle: { fill: isDark ? '#0f172a' : '#ffffff', fillOpacity: 0.85 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: 'arrowclosed' as const, color: edgeColor, width: 16, height: 16 },
        data: { raw: rel, relType: rel.relationship_type },
      };
    });

  return { nodes, edges };
}

// ─── Dagre Auto-Layout (Hybrid: dagre for connected, grid for isolated) ──

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const GRID_COL_WIDTH = 230;
const GRID_ROW_HEIGHT = 80;

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR',
): Node[] {
  if (nodes.length === 0) return nodes;

  // Identify connected vs isolated nodes
  const connectedIds = new Set<string>();
  edges.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });

  const connectedNodes = nodes.filter(n => connectedIds.has(n.id));
  const isolatedNodes = nodes.filter(n => !connectedIds.has(n.id));

  const positionMap = new Map<string, { x: number; y: number }>();

  // ── 1. Layout connected nodes with dagre ──
  if (connectedNodes.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120, edgesep: 30 });

    connectedNodes.forEach(node => {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });
    edges.forEach(edge => {
      if (connectedIds.has(edge.source) && connectedIds.has(edge.target)) {
        g.setEdge(edge.source, edge.target);
      }
    });
    dagre.layout(g);

    connectedNodes.forEach(node => {
      const pos = g.node(node.id);
      positionMap.set(node.id, { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 });
    });
  }

  // ── 2. Layout isolated nodes in a typed grid ──
  if (isolatedNodes.length > 0) {
    // Find the bottom of the connected layout
    let startY = 0;
    positionMap.forEach(p => { startY = Math.max(startY, p.y + NODE_HEIGHT + 60); });
    if (connectedNodes.length > 0) startY += 40;

    // Group isolated by type, then lay out each group
    const typeOrder = [
      'observed-data', 'infrastructure', 'malware', 'threat-actor', 'intrusion-set',
      'identity', 'attack-pattern', 'tool', 'indicator', 'user-account',
      'ipv4-addr', 'ipv6-addr', 'domain-name', 'url', 'file', 'network-traffic',
    ];

    const byType = new Map<string, Node[]>();
    isolatedNodes.forEach(n => {
      const t = n.data.stixType as string;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(n);
    });

    // Sort type groups by typeOrder
    const sortedGroups = [...byType.entries()].sort(([a], [b]) => {
      const ia = typeOrder.indexOf(a);
      const ib = typeOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    // Determine how many columns to use (aim for ~6 cols)
    const maxCols = Math.max(4, Math.min(8, Math.ceil(Math.sqrt(isolatedNodes.length * 1.5))));
    let curY = startY;

    for (const [, groupNodes] of sortedGroups) {
      for (let i = 0; i < groupNodes.length; i++) {
        const col = i % maxCols;
        const row = Math.floor(i / maxCols);
        positionMap.set(groupNodes[i].id, {
          x: col * GRID_COL_WIDTH,
          y: curY + row * GRID_ROW_HEIGHT,
        });
      }
      const groupRows = Math.ceil(groupNodes.length / maxCols);
      curY += groupRows * GRID_ROW_HEIGHT + 30; // gap between type groups
    }
  }

  return nodes.map(node => ({
    ...node,
    position: positionMap.get(node.id) || node.position,
  }));
}

// ─── Filtering ───────────────────────────────────────────────

export function filterGraph(
  nodes: Node[],
  edges: Edge[],
  activeTypes: Set<string>,
  searchTerm: string,
): GraphData {
  let filteredNodes = nodes.filter(n => activeTypes.has(n.data.stixType as string));

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filteredNodes = filteredNodes.filter(n =>
      (n.data.label as string).toLowerCase().includes(term) ||
      (n.data.stixType as string).toLowerCase().includes(term)
    );
  }

  const visibleIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

  return { nodes: filteredNodes, edges: filteredEdges };
}

// ─── Get all distinct types from objects ─────────────────────

export function getDistinctTypes(objects: any[]): string[] {
  const types = new Set<string>();
  objects.forEach(o => types.add(o.type));
  // Sort: SDOs first, then SCOs
  const sdoOrder = [
    'threat-actor', 'intrusion-set', 'campaign', 'infrastructure', 'malware',
    'identity', 'attack-pattern', 'tool', 'indicator', 'observed-data',
  ];
  const sorted = [...types].sort((a, b) => {
    const ia = sdoOrder.indexOf(a);
    const ib = sdoOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return sorted;
}
