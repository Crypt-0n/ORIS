import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { useKillChain } from '../../contexts/KillChainContext';
import { getKillChainColors } from '../../lib/killChainDefinitions';
import {
  GitBranch,
  Monitor,
  Server,
  Smartphone,
  Tablet,
  Tv,
  Router,
  Cpu,
  HelpCircle,
  Skull,
  Mail,
  Bug,
  Save,
  Trash2,
} from 'lucide-react';
import { useTranslation } from "react-i18next";

interface SystemNode {
  id: string;
  name: string;
  systemType: string;
  x: number;
  y: number;
  hasMaliciousMalware: boolean;
  investigationStatus: string | null;
}

interface LateralEdge {
  id: string;
  sourceId: string;
  targetId: string;
  description: string;
  datetime: string;
  eventType: string;
  killChain: string | null;
  pairIndex: number;
  pairCount: number;
  attackPatternName?: string | null;
  killChainPhases?: { kill_chain_name: string; phase_name: string }[] | null;
}

interface EmailMarker {
  id: string;
  systemId: string;
  description: string;
  datetime: string;
  killChain: string | null;
}

interface AttackerInfraNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface InfraLink {
  infraId: string;
  systemId: string;
}

interface Props {
  caseId: string;
  killChainType?: string;
  startDate?: string;
  endDate?: string;
  isReportView?: boolean;
  forceTheme?: 'light' | 'dark';
  layoutMode?: 'force' | 'chronological';
}






const FALLBACK_COLOR = '#94a3b8';

const STATUS_COLORS: Record<string, string> = {
  infected: '#ef4444',
  compromised: '#f59e0b',
  clean: '#10b981',
};

const SYSTEM_ICONS: Record<string, typeof Monitor> = {
  ordinateur: Monitor,
  serveur: Server,
  telephone: Smartphone,
  tablette: Tablet,
  tv: Tv,
  equipement_reseau: Router,
  equipement_iot: Cpu,
  autre: HelpCircle,
  infrastructure_attaquant: Skull,
};

const VW = 900;
const NODE_R = 26;
const PAD = 80;
const ROW_SPACING = 120;

function computeVH(nodeCount: number): number {
  return Math.max(550, PAD * 2 + (nodeCount - 1) * ROW_SPACING + 60);
}

function getEdgeColor(edge: LateralEdge, killChainColors: Record<string, { color: string; label: string }>): string {
  if (!edge.killChain) return FALLBACK_COLOR;
  return killChainColors[edge.killChain]?.color || FALLBACK_COLOR;
}

function layoutNodesForce(nodes: SystemNode[], edges: LateralEdge[], vh: number) {
  if (nodes.length === 0) return;
  if (nodes.length === 1) { nodes[0].x = VW / 2; nodes[0].y = vh / 2; return; }
  const cx = VW / 2;
  const cy = vh / 2;
  const r = Math.min(VW, vh) * 0.3;
  nodes.forEach((n, i) => { const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2; n.x = cx + r * Math.cos(a); n.y = cy + r * Math.sin(a); });
  const vel = new Map<string, [number, number]>();
  nodes.forEach(n => vel.set(n.id, [0, 0]));
  const map = new Map(nodes.map(n => [n.id, n]));
  for (let iter = 0; iter < 300; iter++) {
    const t = 1 - iter / 300;
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const dx = nodes[a].x - nodes[b].x; const dy = nodes[a].y - nodes[b].y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1); const f = (5000 * t) / (d * d);
        vel.get(nodes[a].id)![0] += (dx / d) * f; vel.get(nodes[a].id)![1] += (dy / d) * f;
        vel.get(nodes[b].id)![0] -= (dx / d) * f; vel.get(nodes[b].id)![1] -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const s = map.get(e.sourceId); const tgt = map.get(e.targetId); if (!s || !tgt) continue;
      const dx = tgt.x - s.x; const dy = tgt.y - s.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1); const f = (d - 160) * 0.006 * t;
      vel.get(s.id)![0] += (dx / d) * f; vel.get(s.id)![1] += (dy / d) * f;
      vel.get(tgt.id)![0] -= (dx / d) * f; vel.get(tgt.id)![1] -= (dy / d) * f;
    }
    for (const n of nodes) {
      const v = vel.get(n.id)!;
      v[0] = (v[0] + (cx - n.x) * 0.001) * 0.85; v[1] = (v[1] + (cy - n.y) * 0.001) * 0.85;
      n.x = Math.max(PAD, Math.min(VW - PAD, n.x + v[0])); n.y = Math.max(PAD, Math.min(vh - PAD, n.y + v[1]));
    }
  }
}

function layoutNodesChronological(nodes: SystemNode[], edges: LateralEdge[], vh: number) {
  if (nodes.length === 0) return;
  if (nodes.length === 1) {
    nodes[0].x = VW / 2;
    nodes[0].y = PAD + 40;
    return;
  }

  // Sort edges chronologically
  const sortedEdges = [...edges].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  // Build parent-child tree: for each node, the first edge that targets it determines its parent
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Initialize children map
  nodes.forEach(n => children.set(n.id, []));

  sortedEdges.forEach(e => {
    // If target doesn't have a parent yet, assign source as parent
    if (!parent.has(e.targetId) && nodeMap.has(e.sourceId) && nodeMap.has(e.targetId) && e.sourceId !== e.targetId) {
      parent.set(e.targetId, e.sourceId);
      const parentChildren = children.get(e.sourceId) || [];
      parentChildren.push(e.targetId);
      children.set(e.sourceId, parentChildren);
    }
  });

  // Find root nodes (nodes with no parent)
  const roots = nodes.filter(n => !parent.has(n.id));

  // If no roots (circular references), use the first-seen node as root
  if (roots.length === 0) {
    const firstNode = sortedEdges.length > 0 ? nodeMap.get(sortedEdges[0].sourceId) : nodes[0];
    if (firstNode) roots.push(firstNode);
  }

  // Assign depth levels using BFS from roots
  const depth = new Map<string, number>();
  const queue: string[] = [];

  roots.forEach(r => {
    depth.set(r.id, 0);
    queue.push(r.id);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depth.get(current) || 0;
    const kids = children.get(current) || [];
    kids.forEach(kid => {
      if (!depth.has(kid)) {
        depth.set(kid, currentDepth + 1);
        queue.push(kid);
      }
    });
  }

  // Assign orphan nodes (not reached by BFS) to depth 0
  nodes.forEach(n => {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  });

  // Group nodes by depth level
  const maxDepth = Math.max(...Array.from(depth.values()));
  const levels: string[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    levels[d] = nodes.filter(n => depth.get(n.id) === d).map(n => n.id);
  }

  // Calculate subtree widths for better positioning
  const subtreeWidth = new Map<string, number>();
  const calcWidth = (nodeId: string): number => {
    const kids = children.get(nodeId) || [];
    if (kids.length === 0) {
      subtreeWidth.set(nodeId, 1);
      return 1;
    }
    const w = kids.reduce((sum, kid) => sum + calcWidth(kid), 0);
    subtreeWidth.set(nodeId, w);
    return w;
  };
  roots.forEach(r => calcWidth(r.id));
  // Also calc for orphans
  nodes.forEach(n => { if (!subtreeWidth.has(n.id)) subtreeWidth.set(n.id, 1); });

  // Position nodes: Y by depth, X by subtree position
  const levelHeight = Math.min(ROW_SPACING, (vh - PAD * 2) / Math.max(maxDepth, 1));
  const usableWidth = VW - PAD * 2;

  // Position using recursive tree positioning
  const positionSubtree = (nodeId: string, xStart: number, xEnd: number) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const d = depth.get(nodeId) || 0;
    node.y = PAD + 40 + d * levelHeight;
    node.x = (xStart + xEnd) / 2;

    const kids = children.get(nodeId) || [];
    if (kids.length === 0) return;

    const totalW = kids.reduce((sum, kid) => sum + (subtreeWidth.get(kid) || 1), 0);
    let cx = xStart;
    kids.forEach(kid => {
      const kidW = subtreeWidth.get(kid) || 1;
      const kidXEnd = cx + (kidW / totalW) * (xEnd - xStart);
      positionSubtree(kid, cx, kidXEnd);
      cx = kidXEnd;
    });
  };

  // Position all root subtrees
  const totalRootWidth = roots.reduce((sum, r) => sum + (subtreeWidth.get(r.id) || 1), 0);
  let rx = PAD;
  roots.forEach(r => {
    const rW = subtreeWidth.get(r.id) || 1;
    const rEnd = rx + (rW / totalRootWidth) * usableWidth;
    positionSubtree(r.id, rx, rEnd);
    rx = rEnd;
  });

  // Position orphan nodes that weren't reached by subtree positioning
  const positioned = new Set<string>();
  const markPositioned = (nodeId: string) => {
    positioned.add(nodeId);
    (children.get(nodeId) || []).forEach(markPositioned);
  };
  roots.forEach(r => markPositioned(r.id));

  const orphans = nodes.filter(n => !positioned.has(n.id));
  if (orphans.length > 0) {
    const orphanSpacing = usableWidth / (orphans.length + 1);
    orphans.forEach((n, i) => {
      n.x = PAD + orphanSpacing * (i + 1);
      n.y = PAD + 40;
    });
  }

  // Final overlap resolution: push apart nodes at the same depth
  for (let iter = 0; iter < 30; iter++) {
    for (const level of levels) {
      const levelNodes = level.map(id => nodeMap.get(id)!).filter(Boolean).sort((a, b) => a.x - b.x);
      for (let i = 1; i < levelNodes.length; i++) {
        const minGap = NODE_R * 4;
        const gap = levelNodes[i].x - levelNodes[i - 1].x;
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          levelNodes[i - 1].x = Math.max(PAD, levelNodes[i - 1].x - push);
          levelNodes[i].x = Math.min(VW - PAD, levelNodes[i].x + push);
        }
      }
    }
  }
}

function curvedPath(
  sx: number, sy: number,
  tx: number, ty: number,
  curve: number
): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const ux = dx / len;
  const uy = dy / len;
  const sx2 = sx + ux * NODE_R;
  const sy2 = sy + uy * NODE_R;
  const tx2 = tx - ux * (NODE_R + 6);
  const ty2 = ty - uy * (NODE_R + 6);
  const mx = (sx2 + tx2) / 2;
  const my = (sy2 + ty2) / 2;
  const dx2 = tx2 - sx2;
  const dy2 = ty2 - sy2;
  const len2 = Math.max(Math.sqrt(dx2 * dx2 + dy2 * dy2), 1);
  const nx = -dy2 / len2;
  const ny = dx2 / len2;
  return `M ${sx2} ${sy2} Q ${mx + nx * curve} ${my + ny * curve} ${tx2} ${ty2}`;
}

function buildLegendItems(edges: LateralEdge[], killChainColors: Record<string, { color: string; label: string }>) {
  const seen = new Map<string, { color: string; label: string; count: number }>();

  for (const e of edges) {
    const key = e.killChain || '_none';
    if (!seen.has(key)) {
      if (e.killChain) {
        const kc = killChainColors[e.killChain];
        seen.set(key, { color: kc?.color || FALLBACK_COLOR, label: `killChain.${e.killChain}`, count: 0 });
      } else {
        seen.set(key, { color: FALLBACK_COLOR, label: 'auto.non_specifie', count: 0 });
      }
    }
    seen.get(key)!.count++;
  }

  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
}

export function LateralMovementGraph({ caseId, killChainType, startDate, endDate, isReportView, forceTheme, layoutMode = 'force' }: Props) {
  const { t } = useTranslation();
  const { theme: globalTheme } = useTheme();
  const { activeKillChain } = useKillChain();
  const theme = forceTheme || globalTheme;
  const isDark = theme === 'dark';
  const killChainColors = getKillChainColors(killChainType ?? null);
  const [nodes, setNodes] = useState<SystemNode[]>([]);
  const [edges, setEdges] = useState<LateralEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const markerIdCounter = useRef(0);
  const [markerColors, setMarkerColors] = useState<string[]>([]);
  const [emailMarkers, setEmailMarkers] = useState<EmailMarker[]>([]);
  const [hoveredEmail, setHoveredEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasCustomLayout, setHasCustomLayout] = useState(false);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [infraNodes, setInfraNodes] = useState<AttackerInfraNode[]>([]);
  const [infraLinks, setInfraLinks] = useState<InfraLink[]>([]);

  const loadLayout = useCallback(async (currentNodes: SystemNode[]): Promise<SystemNode[] | null> => {
    try {
      const data = await api.get(`/investigation/graph-layouts/by-case/${caseId}`);
      const layout = (data || []).find((l: any) => l.graph_type === 'lateral_movement');

      if (layout) {
        setLayoutId(layout.id);
        const positions = JSON.parse(layout.layout_data);
        const newNodes = currentNodes.map(n => {
          if (positions[n.id]) {
            return { ...n, x: positions[n.id].x, y: positions[n.id].y };
          }
          return n;
        });
        setHasCustomLayout(true);
        return newNodes;
      }
    } catch (err) {
      console.error('Error loading layout:', err);
    }
    return null;
  }, [caseId]);

  const saveLayout = async () => {
    setSaving(true);
    try {
      const positions: Record<string, { x: number, y: number }> = {};
      nodes.forEach(n => {
        positions[n.id] = { x: n.x, y: n.y };
      });

      const payload = {
        case_id: caseId,
        graph_type: 'lateral_movement',
        layout_data: JSON.stringify(positions)
      };

      if (layoutId) {
        await api.put(`/investigation/graph-layouts/${layoutId}`, payload);
      } else {
        const res = await api.post('/investigation/graph-layouts', payload);
        setLayoutId(res.id);
      }
      setHasCustomLayout(true);
    } catch (err) {
      console.error('Error saving layout:', err);
    }
    setSaving(false);
  };

  const resetLayout = async () => {
    if (layoutId) {
      try {
        await api.delete(`/investigation/graph-layouts/${layoutId}`);
        setLayoutId(null);
      } catch (err) {
        console.error('Error deleting layout:', err);
      }
    }

    // Re-run auto-layout
    const newNodes = [...nodes];
    if (layoutMode === 'chronological') {
      layoutNodesChronological(newNodes, edges, computeVH(newNodes.length));
    } else {
      layoutNodesForce(newNodes, edges, computeVH(newNodes.length));
    }
    setNodes(newNodes);
    setHasCustomLayout(false);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        console.log('Fetching lateral movements from STIX graph...');

        const [lateralRes, bundleRes] = await Promise.all([
          api.get(`/stix/lateral/${caseId}`),
          api.get(`/stix/bundle/${caseId}`)
        ]);

        const movements = lateralRes || [];
        const stixObjects = bundleRes?.objects || [];

        // Extract unique systems from movements (source and target)
        const sysIds = new Set<string>();
        movements.forEach((m: any) => {
          sysIds.add(m.source.id);
          sysIds.add(m.target.id);
        });

        if (sysIds.size === 0) {
          setNodes([]);
          setEdges([]);
          setEmailMarkers([]);
          setInfraNodes([]);
          setInfraLinks([]);
          setLoading(false);
          return;
        }

        // Get full STIX objects for systems to retrieve systemType, status, etc.
        const systems = stixObjects.filter((o: any) => o.type === 'infrastructure' && sysIds.has(o.id));

        const graphNodes: SystemNode[] = systems.map((s: any) => {
          return {
            id: s.id,
            name: s.name || 'Unknown',
            systemType: s.infrastructure_types?.[0] || 'serveur',
            x: 0,
            y: 0,
            hasMaliciousMalware: false, // Could be enhanced by checking malware relationships
            investigationStatus: null, // Could be enhanced by checking task/grouping relationships
          };
        });

        // Filter movements based on date range if applicable
        let validMovements = movements;
        if (startDate || endDate) {
          validMovements = validMovements.filter((m: any) => {
            const dt = m.event_datetime;
            if (!dt) return true;
            const time = new Date(dt.includes('T') ? dt : dt.replace(' ', 'T') + 'Z').getTime();
            if (startDate && time < new Date(startDate).getTime()) return false;
            if (endDate && time > new Date(endDate).getTime()) return false;
            return true;
          });
        }

        const graphEdges: LateralEdge[] = validMovements.map((m: any, idx: number) => ({
          id: `edge-${idx}`,
          sourceId: m.source.id,
          targetId: m.target.id,
          description: m.relationship_type,
          datetime: m.event_datetime,
          eventType: 'lateral-movement',
          killChain: m.kill_chain_phases?.[0]?.kill_chain_name || null,
          pairIndex: 0,
          pairCount: 1,
          attackPatternName: m.attack_pattern_name || null,
          killChainPhases: m.kill_chain_phases || null,
        }));

        const pairCounts = new Map<string, number>();
        const pairIdx = new Map<string, number>();
        graphEdges.forEach(e => {
          const k = [e.sourceId, e.targetId].sort().join(':');
          pairCounts.set(k, (pairCounts.get(k) || 0) + 1);
        });
        graphEdges.forEach(e => {
          const k = [e.sourceId, e.targetId].sort().join(':');
          const idx = pairIdx.get(k) || 0;
          pairIdx.set(k, idx + 1);
          e.pairIndex = idx;
          e.pairCount = pairCounts.get(k) || 1;
        });

        // We don't have email events directly in this graph for now, can be expanded later
        setEmailMarkers([]);
        
        // Setup attacker infra nodes if any
        const infraNodesArr: AttackerInfraNode[] = [];
        const infraSystemLinks: InfraLink[] = [];
        // Optional: Extract attacker_infra from bundle if they have 'targets' relationships

        const nodesWithSavedLayout = await loadLayout(graphNodes);

        let finalNodes;
        if (nodesWithSavedLayout) {
          finalNodes = nodesWithSavedLayout;
        } else {
          if (layoutMode === 'chronological') {
            layoutNodesChronological(graphNodes, graphEdges, computeVH(graphNodes.length));
          } else {
            layoutNodesForce(graphNodes, graphEdges, computeVH(graphNodes.length));
          }
          finalNodes = graphNodes;
        }

        setNodes(finalNodes);
        setEdges(graphEdges);
        setInfraNodes(infraNodesArr);
        setInfraLinks(infraSystemLinks);

        setLoading(false);
      } catch (err) {
        console.error('Error fetching lateral movements:', err);
        setLoading(false);
      }
    })();
  }, [caseId, loadLayout, startDate, endDate, layoutMode]);

  useEffect(() => {
    const allColors = new Set<string>();
    edges.forEach(e => {
      allColors.add(getEdgeColor(e, killChainColors));
    });
    setMarkerColors(Array.from(allColors));
    markerIdCounter.current++;
  }, [edges]);

  const toSvg = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }, []);

  const onDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setDragging(id);
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const { x, y } = toSvg(e);
    setNodes(prev => prev.map(n =>
      n.id === dragging
        ? { ...n, x: Math.max(PAD, Math.min(VW - PAD, x)), y: Math.max(PAD, Math.min(VH - PAD, y)) }
        : n
    ));
    setInfraNodes(prev => prev.map(n =>
      n.id === dragging
        ? { ...n, x: Math.max(PAD, Math.min(VW - PAD, x)), y: Math.max(PAD, Math.min(VH - PAD, y)) }
        : n
    ));
  }, [dragging, toSvg]);

  const onUp = useCallback(() => setDragging(null), []);

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  if (edges.length === 0 && emailMarkers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-slate-400">
        <GitBranch className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium mb-1">{t('auto.aucun_mouvement_entre_systemes')}</p>
        <p className="text-xs">{t('auto.ajoutez_des_evenements_avec_un')}</p>
      </div>
    );
  }

  const nMap = new Map(nodes.map(n => [n.id, n]));
  const VH = computeVH(nodes.length);
  const nodeBg = isDark ? '#1e293b' : '#f1f5f9';
  const nodeBorder = isDark ? '#475569' : '#94a3b8';
  const nodeTextFill = isDark ? '#e2e8f0' : '#1e293b';
  const iconColor = isDark ? '#94a3b8' : '#475569';
  const legendItems = buildLegendItems(edges, killChainColors);
  const batchId = markerIdCounter.current;

  return (
    <div className="space-y-4">
      {!isReportView && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={saveLayout}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? t('auto.sauvegarde') : t('auto.enregistrer_la_disposition')}
            </button>

            {hasCustomLayout && (
              <button
                onClick={resetLayout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('auto.reinitialiser')}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {legendItems.map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">
                  {t(item.label)} ({item.count})
                </span>
              </div>
            ))}
            {emailMarkers.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-teal-500" />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">
                  {t('eventTypes.email')} ({emailMarkers.length})
                </span>
              </div>
            )}
            {nodes.some(n => n.hasMaliciousMalware) && (
              <div className="flex items-center gap-1.5">
                <Bug className="w-3 h-3 text-red-500" />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">
                  {t('auto.malware_malveillant')} ({nodes.filter(n => n.hasMaliciousMalware).length})
                </span>
              </div>
            )}
            {infraNodes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Skull className="w-3 h-3 text-rose-500" />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">
                  Infra. attaquant ({infraNodes.length})
                </span>
              </div>
            )}
            <div className="h-4 w-px bg-gray-200 dark:bg-slate-700 mx-1" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">{t('investigationStatus.infected')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">{t('investigationStatus.compromised')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <span className="text-[11px] text-gray-600 dark:text-slate-400">{t('investigationStatus.clean')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-hidden rounded-lg">
        <svg
          id="lateral-movement-svg"
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full rounded-lg border border-gray-200 dark:border-slate-700"
          style={{ aspectRatio: `${VW}/${VH}` }}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <rect width={VW} height={VH} fill={isDark ? '#0f172a' : '#ffffff'} />

          <defs>
            {markerColors.map(c => (
              <marker
                key={`${batchId}-${c}`}
                id={`lm-a-${batchId}-${c.replace('#', '')}`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1 L 10 6 L 0 11 Z" fill={c} />
              </marker>
            ))}
            {emailMarkers.length > 0 && (
              <marker
                id={`lm-email-arr-${batchId}`}
                viewBox="0 0 12 12"
                refX="10"
                refY="6"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 2 L 10 6 L 0 10 Z" fill="#14b8a6" />
              </marker>
            )}
          </defs>

          {edges.map(edge => {
            const s = nMap.get(edge.sourceId);
            const t = nMap.get(edge.targetId);
            if (!s || !t) return null;

            let curve = 50;
            if (edge.pairCount > 1) {
              curve = 50 + (edge.pairIndex - (edge.pairCount - 1) / 2) * 45;
            }

            const color = getEdgeColor(edge, killChainColors);
            const isH = hovered === edge.id;
            const dim = (hovered !== null && !isH) || hoveredEmail !== null;

            return (
              <g key={edge.id}>
                <path
                  d={curvedPath(s.x, s.y, t.x, t.y, curve)}
                  stroke={color}
                  strokeWidth={isH ? 5.5 : 3.5}
                  fill="none"
                  strokeLinecap="round"
                  markerEnd={`url(#lm-a-${batchId}-${color.replace('#', '')})`}
                  opacity={dim ? 0.12 : 1}
                  style={{ transition: 'opacity 200ms, stroke-width 150ms' }}
                />
                <path
                  d={curvedPath(s.x, s.y, t.x, t.y, curve)}
                  stroke="transparent"
                  strokeWidth={20}
                  fill="none"
                  onMouseEnter={() => setHovered(edge.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                />
              </g>
            );
          })}

          {/* Permanent timestamp labels on edges */}
          {edges.map(edge => {
            const s = nMap.get(edge.sourceId);
            const tNode = nMap.get(edge.targetId);
            if (!s || !tNode) return null;

            let curve = 50;
            if (edge.pairCount > 1) {
              curve = 50 + (edge.pairIndex - (edge.pairCount - 1) / 2) * 45;
            }

            const mx = (s.x + tNode.x) / 2;
            const my = (s.y + tNode.y) / 2;
            const dx2 = tNode.x - s.x;
            const dy2 = tNode.y - s.y;
            const len2 = Math.max(Math.sqrt(dx2 * dx2 + dy2 * dy2), 1);
            const nx2 = -dy2 / len2;
            const ny2 = dx2 / len2;
            const labelX = mx + nx2 * (curve * 0.4);
            const labelY = my + ny2 * (curve * 0.4);

            const dt = new Date(edge.datetime);
            const timeLabel = `${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
            const dim = (hovered !== null && hovered !== edge.id) || hoveredEmail !== null;

            const matchingPhase = edge.killChainPhases?.find((p) => p.kill_chain_name === activeKillChain);
            const phaseLabel = matchingPhase ? matchingPhase.phase_name : '';

            return (
              <g key={`lbl-g-${edge.id}`}>
                {phaseLabel && (
                  <text
                    x={labelX}
                    y={labelY - 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isDark ? '#e2e8f0' : '#334155'}
                    style={{ fontSize: 10, fontWeight: 600, pointerEvents: 'none' }}
                    opacity={dim ? 0.1 : 1}
                  >
                    {phaseLabel}
                  </text>
                )}
                <text
                  x={labelX}
                  y={labelY + (phaseLabel ? 2 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isDark ? '#94a3b8' : '#64748b'}
                  style={{ fontSize: 9, fontWeight: 500, pointerEvents: 'none' }}
                  opacity={dim ? 0.1 : 0.85}
                >
                  {timeLabel}
                </text>
              </g>
            );
          })}

          {(() => {
            const emailsBySystem = new Map<string, EmailMarker[]>();
            emailMarkers.forEach(em => {
              const list = emailsBySystem.get(em.systemId) || [];
              list.push(em);
              emailsBySystem.set(em.systemId, list);
            });

            const elements: JSX.Element[] = [];
            emailsBySystem.forEach((emails, sysId) => {
              const node = nMap.get(sysId);
              if (!node) return;

              const awayDx = node.x - VW / 2;
              const awayDy = node.y - VH / 2;
              const baseAngle = Math.atan2(awayDy, awayDx);
              const spread = Math.PI / 3;

              emails.forEach((email, idx) => {
                const angle = emails.length === 1
                  ? baseAngle
                  : baseAngle + spread * ((idx / (emails.length - 1)) - 0.5);

                const envDist = NODE_R + 24;
                const lineStart = NODE_R + 58;
                const lineEnd = NODE_R + 4;

                const ex = node.x + Math.cos(angle) * envDist;
                const ey = node.y + Math.sin(angle) * envDist;
                const lsx = node.x + Math.cos(angle) * lineStart;
                const lsy = node.y + Math.sin(angle) * lineStart;
                const lex = node.x + Math.cos(angle) * lineEnd;
                const ley = node.y + Math.sin(angle) * lineEnd;

                const isH = hoveredEmail === email.id;
                const dimE = (hoveredEmail !== null && !isH) || hovered !== null;

                elements.push(
                  <g key={`email-${email.id}`} opacity={dimE ? 0.15 : 1} style={{ transition: 'opacity 200ms' }}>
                    <line
                      x1={lsx} y1={lsy}
                      x2={lex} y2={ley}
                      stroke="#14b8a6"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      markerEnd={`url(#lm-email-arr-${batchId})`}
                    />
                    <circle
                      cx={ex} cy={ey}
                      r={13}
                      fill={isDark ? '#134e4a' : '#ccfbf1'}
                      stroke="#14b8a6"
                      strokeWidth={isH ? 2.5 : 1.5}
                    />
                    <g transform={`translate(${ex - 8}, ${ey - 8})`}>
                      <Mail width={16} height={16} color="#14b8a6" />
                    </g>
                    <circle
                      cx={ex} cy={ey}
                      r={16}
                      fill="transparent"
                      onMouseEnter={() => setHoveredEmail(email.id)}
                      onMouseLeave={() => setHoveredEmail(null)}
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                );
              });
            });

            return elements;
          })()}

          {nodes.map(n => {
            const Icon = SYSTEM_ICONS[n.systemType] || Monitor;
            const malwareBorder = n.hasMaliciousMalware ? '#ef4444' : nodeBorder;
            const malwareStrokeW = n.hasMaliciousMalware ? 3.5 : 2.5;
            return (
              <g
                key={n.id}
                onMouseDown={e => onDown(e, n.id)}
                style={{ cursor: dragging === n.id ? 'grabbing' : 'grab' }}
              >
                {n.hasMaliciousMalware && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R + 4}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity={0.5}
                  />
                )}
                {(n.investigationStatus === 'infected' || n.investigationStatus === 'compromised') && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R + 8}
                    fill={STATUS_COLORS[n.investigationStatus] || 'none'}
                    opacity={0.15}
                    className="animate-pulse"
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={NODE_R + 3}
                  fill="none"
                  stroke={n.investigationStatus ? STATUS_COLORS[n.investigationStatus] : 'transparent'}
                  strokeWidth={2}
                  opacity={0.8}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={NODE_R}
                  fill={nodeBg}
                  stroke={malwareBorder}
                  strokeWidth={malwareStrokeW}
                />
                <g transform={`translate(${n.x - 11}, ${n.y - 11})`}>
                  <Icon
                    width={22}
                    height={22}
                    color={n.hasMaliciousMalware ? '#ef4444' : iconColor}
                  />
                </g>
                {n.hasMaliciousMalware && (
                  <g>
                    <circle
                      cx={n.x + NODE_R * 0.7}
                      cy={n.y - NODE_R * 0.7}
                      r={10}
                      fill="#dc2626"
                      stroke={isDark ? '#0f172a' : '#ffffff'}
                      strokeWidth="2"
                    />
                    <g transform={`translate(${n.x + NODE_R * 0.7 - 7}, ${n.y - NODE_R * 0.7 - 7})`}>
                      <Bug width={14} height={14} color="#ffffff" />
                    </g>
                  </g>
                )}
                <text
                  x={n.x}
                  y={n.y + NODE_R + 15}
                  textAnchor="middle"
                  fill={nodeTextFill}
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  {n.name}
                </text>
              </g>
            );
          })}

          {/* Attacker infrastructure links (undirected, no arrows) */}
          {infraLinks.map((link, idx) => {
            const sysNode = nMap.get(link.systemId);
            const infraNode = infraNodes.find(n => n.id === link.infraId);
            if (!sysNode || !infraNode) return null;
            return (
              <line
                key={`infra-link-${idx}`}
                x1={sysNode.x}
                y1={sysNode.y}
                x2={infraNode.x}
                y2={infraNode.y}
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={0.6}
                style={{ transition: 'opacity 200ms' }}
              />
            );
          })}

          {/* Attacker infrastructure nodes */}
          {infraNodes.map(n => (
            <g
              key={`infra-${n.id}`}
              onMouseDown={e => onDown(e, n.id)}
              style={{ cursor: dragging === n.id ? 'grabbing' : 'grab' }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={NODE_R + 3}
                fill="none"
                stroke="#f43f5e"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.5}
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={NODE_R}
                fill={isDark ? '#1c1017' : '#fff1f2'}
                stroke="#f43f5e"
                strokeWidth={2.5}
              />
              <g transform={`translate(${n.x - 11}, ${n.y - 11})`}>
                <Skull width={22} height={22} color="#f43f5e" />
              </g>
              <text
                x={n.x}
                y={n.y + NODE_R + 15}
                textAnchor="middle"
                fill={nodeTextFill}
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {n.name}
              </text>
            </g>
          ))}

          {hovered && (() => {
            const e = edges.find(x => x.id === hovered);
            if (!e) return null;
            const sourceNode = nMap.get(e.sourceId);
            const targetNode = nMap.get(e.targetId);
            if (!sourceNode || !targetNode) return null;

            const mx = (sourceNode.x + targetNode.x) / 2;
            const my = Math.min(sourceNode.y, targetNode.y) - 50;

            const etLabel = t(`eventTypes.${e.eventType}`);
            const kcLabel = e.killChain ? t(`killChain.${e.killChain}`) : null;

            const lines = [
              `${sourceNode.name}  \u2192  ${targetNode.name}`,
              etLabel + (kcLabel ? ` | ${kcLabel}` : ''),
            ];
            if (e.description) {
              lines.push(e.description.length > 50 ? e.description.slice(0, 50) + '...' : e.description);
            }
            lines.push(new Date(e.datetime).toLocaleString('fr-FR'));

            const w = 280;
            const lineH = 18;
            const h = 14 + lines.length * lineH;

            return (
              <g transform={`translate(${mx},${my})`} style={{ pointerEvents: 'none' }}>
                <rect
                  x={-w / 2}
                  y={-h + 6}
                  width={w}
                  height={h}
                  rx={8}
                  fill="#0f172a"
                  fillOpacity={0.95}
                  stroke="#334155"
                  strokeWidth={1}
                />
                {lines.map((l, i) => (
                  <text
                    key={i}
                    x={0}
                    y={-h + 24 + i * lineH}
                    textAnchor="middle"
                    fill={i === 0 ? '#f1f5f9' : '#94a3b8'}
                    style={{ fontSize: i === 0 ? 12 : 10, fontWeight: i === 0 ? 600 : 400 }}
                  >
                    {l}
                  </text>
                ))}
              </g>
            );
          })()}

          {hoveredEmail && (() => {
            const em = emailMarkers.find(x => x.id === hoveredEmail);
            if (!em) return null;
            const node = nMap.get(em.systemId);
            if (!node) return null;

            const kcLabel = em.killChain ? t(`killChain.${em.killChain}`) : null;
            const lines = [
              `${t('eventTypes.email')} \u2192 ${node.name}`,
            ];
            if (kcLabel) lines.push(kcLabel);
            if (em.description) {
              lines.push(em.description.length > 50 ? em.description.slice(0, 50) + '...' : em.description);
            }
            lines.push(new Date(em.datetime).toLocaleString('fr-FR'));

            const w = 260;
            const lineH = 18;
            const h = 14 + lines.length * lineH;
            const tx = node.x;
            const ty = node.y - NODE_R - 45;

            return (
              <g transform={`translate(${tx},${ty})`} style={{ pointerEvents: 'none' }}>
                <rect
                  x={-w / 2}
                  y={-h + 6}
                  width={w}
                  height={h}
                  rx={8}
                  fill="#0f172a"
                  fillOpacity={0.95}
                  stroke="#14b8a6"
                  strokeWidth={1}
                />
                {lines.map((l, i) => (
                  <text
                    key={i}
                    x={0}
                    y={-h + 24 + i * lineH}
                    textAnchor="middle"
                    fill={i === 0 ? '#5eead4' : '#94a3b8'}
                    style={{ fontSize: i === 0 ? 12 : 10, fontWeight: i === 0 ? 600 : 400 }}
                  >
                    {l}
                  </text>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>
    </div >
  );
}
