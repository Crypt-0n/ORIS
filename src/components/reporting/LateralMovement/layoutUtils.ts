import { Monitor, Server, Smartphone, Tablet, Tv, Router, Cpu, HelpCircle, Skull } from 'lucide-react';
import { SystemNode, LateralEdge } from './types';

export const FALLBACK_COLOR = '#94a3b8';

export const STATUS_COLORS: Record<string, string> = {
  infected: '#ef4444',
  compromised: '#f59e0b',
  clean: '#10b981',
};

export const SYSTEM_ICONS: Record<string, typeof Monitor> = {
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

export const VW = 900;
export const NODE_R = 26;
export const PAD = 80;
export const ROW_SPACING = 120;

export function computeVH(nodeCount: number): number {
  return Math.max(550, PAD * 2 + (nodeCount - 1) * ROW_SPACING + 60);
}

export function getEdgeColor(edge: LateralEdge, killChainColors: Record<string, { color: string; label: string }>): string {
  if (!edge.killChain) return FALLBACK_COLOR;
  return killChainColors[edge.killChain]?.color || FALLBACK_COLOR;
}

export function layoutNodesForce(nodes: SystemNode[], edges: LateralEdge[], vh: number) {
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

export function layoutNodesChronological(nodes: SystemNode[], edges: LateralEdge[], vh: number) {
  if (nodes.length === 0) return;
  if (nodes.length === 1) {
    nodes[0].x = VW / 2;
    nodes[0].y = PAD + 40;
    return;
  }

  const sortedEdges = [...edges].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  nodes.forEach(n => children.set(n.id, []));

  sortedEdges.forEach(e => {
    if (!parent.has(e.targetId) && nodeMap.has(e.sourceId) && nodeMap.has(e.targetId) && e.sourceId !== e.targetId) {
      parent.set(e.targetId, e.sourceId);
      const parentChildren = children.get(e.sourceId) || [];
      parentChildren.push(e.targetId);
      children.set(e.sourceId, parentChildren);
    }
  });

  const roots = nodes.filter(n => !parent.has(n.id));

  if (roots.length === 0) {
    const firstNode = sortedEdges.length > 0 ? nodeMap.get(sortedEdges[0].sourceId) : nodes[0];
    if (firstNode) roots.push(firstNode);
  }

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

  nodes.forEach(n => {
    if (!depth.has(n.id)) depth.set(n.id, 0);
  });

  const maxDepth = Math.max(...Array.from(depth.values()));
  const levels: string[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    levels[d] = nodes.filter(n => depth.get(n.id) === d).map(n => n.id);
  }

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
  nodes.forEach(n => { if (!subtreeWidth.has(n.id)) subtreeWidth.set(n.id, 1); });

  const levelHeight = Math.min(ROW_SPACING, (vh - PAD * 2) / Math.max(maxDepth, 1));
  const usableWidth = VW - PAD * 2;

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

  const totalRootWidth = roots.reduce((sum, r) => sum + (subtreeWidth.get(r.id) || 1), 0);
  let rx = PAD;
  roots.forEach(r => {
    const rW = subtreeWidth.get(r.id) || 1;
    const rEnd = rx + (rW / totalRootWidth) * usableWidth;
    positionSubtree(r.id, rx, rEnd);
    rx = rEnd;
  });

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

export function curvedPath(
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

export function buildLegendItems(edges: LateralEdge[], killChainColors: Record<string, { color: string; label: string }>) {
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
