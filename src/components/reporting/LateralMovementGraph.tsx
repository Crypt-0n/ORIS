import React from 'react';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Trash2, GitBranch, Skull } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getKillChainColors } from '../../lib/killChainDefinitions';
import { useLateralMovementData } from './LateralMovement/hooks/useLateralMovementData';
import {
  VW, computeVH, NODE_R, getEdgeColor, curvedPath, buildLegendItems,
  STATUS_COLORS, SYSTEM_ICONS
} from './LateralMovement/layoutUtils';
import { LateralMovementGraphProps } from './LateralMovement/types';

export function LateralMovementGraph(props: LateralMovementGraphProps) {
  const { t } = useTranslation();
  const { theme: globalTheme } = useTheme();
  const theme = props.forceTheme || globalTheme;
  const isDark = theme === 'dark';
  const killChainColors = getKillChainColors(props.killChainType ?? null);

  const {
    nodes, edges, loading, emailMarkers, infraNodes,
    saving, hasCustomLayout, setNodes, setInfraNodes, saveLayout, resetLayout
  } = useLateralMovementData(props);

  const [dragging, setDragging] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredEmail, ] = useState<string | null>(null);
  const [markerColors, setMarkerColors] = useState<string[]>([]);
  const markerIdCounter = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const allColors = new Set<string>();
    edges.forEach(e => allColors.add(getEdgeColor(e, killChainColors)));
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
    const VH = computeVH(nodes.length);
    const { x, y } = toSvg(e);
    const PAD = 80;
    const nx = Math.max(PAD, Math.min(VW - PAD, x));
    const ny = Math.max(PAD, Math.min(VH - PAD, y));
    
    setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x: nx, y: ny } : n));
    setInfraNodes(prev => prev.map(n => n.id === dragging ? { ...n, x: nx, y: ny } : n));
  }, [dragging, toSvg, nodes.length, setNodes, setInfraNodes]);

  const onUp = useCallback(() => setDragging(null), []);

  if (loading) return <p className="text-sm text-center py-8 text-gray-500">{t('auto.chargement')}</p>;
  if (edges.length === 0 && emailMarkers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <GitBranch className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium mb-1">{t('auto.aucun_mouvement_entre_systemes')}</p>
        <p className="text-xs">{t('auto.ajoutez_des_evenements_avec_un')}</p>
      </div>
    );
  }

  const VH = computeVH(nodes.length);
  const nMap = new Map(nodes.map(n => [n.id, n]));
  const batchId = markerIdCounter.current;
  const legendItems = buildLegendItems(edges, killChainColors);

  const nodeBg = isDark ? '#1e293b' : '#f1f5f9';
  const nodeBorder = isDark ? '#475569' : '#94a3b8';
  const nodeTextFill = isDark ? '#e2e8f0' : '#1e293b';
  const iconColor = isDark ? '#94a3b8' : '#475569';

  return (
    <div className="space-y-4">
      {!props.isReportView && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={saveLayout} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Save className="w-3.5 h-3.5" /> {saving ? t('auto.sauvegarde') : t('auto.enregistrer_la_disposition')}
            </button>
            {hasCustomLayout && (
              <button onClick={resetLayout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200">
                <Trash2 className="w-3.5 h-3.5" /> {t('auto.reinitialiser')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {legendItems.map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] text-gray-500">{t(item.label)} ({item.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full overflow-hidden rounded-lg">
        <svg
          id="lateral-movement-svg"
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full rounded-lg"
          style={{ aspectRatio: `${VW}/${VH}` }}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <rect width={VW} height={VH} fill={isDark ? '#0f172a' : '#ffffff'} />
          <defs>
            {markerColors.map(c => (
              <marker key={`${batchId}-${c}`} id={`lm-a-${batchId}-${c.replace('#', '')}`} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 1 L 10 6 L 0 11 Z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* Edges */}
          {edges.map(edge => {
            const s = nMap.get(edge.sourceId);
            const tNode = nMap.get(edge.targetId);
            if (!s || !tNode) return null;
            const curve = edge.pairCount > 1 ? 50 + (edge.pairIndex - (edge.pairCount - 1) / 2) * 45 : 50;
            const color = getEdgeColor(edge, killChainColors);
            const dim = (hovered !== null && hovered !== edge.id) || hoveredEmail !== null;
            
            return (
              <g key={edge.id}>
                <path
                  d={curvedPath(s.x, s.y, tNode.x, tNode.y, curve)}
                  stroke={color}
                  strokeWidth={hovered === edge.id ? 5.5 : 3.5}
                  fill="none"
                  markerEnd={`url(#lm-a-${batchId}-${color.replace('#', '')})`}
                  opacity={dim ? 0.12 : 1}
                  className="transition-opacity"
                />
                <path
                  d={curvedPath(s.x, s.y, tNode.x, tNode.y, curve)}
                  stroke="transparent"
                  strokeWidth={20}
                  fill="none"
                  onMouseEnter={() => setHovered(edge.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const Icon = SYSTEM_ICONS[n.systemType] || SYSTEM_ICONS.ordinateur;
            return (
              <g key={n.id} onMouseDown={e => onDown(e, n.id)} style={{ cursor: dragging === n.id ? 'grabbing' : 'grab' }}>
                {n.investigationStatus && (
                  <circle cx={n.x} cy={n.y} r={NODE_R + 8} fill={STATUS_COLORS[n.investigationStatus]} opacity={0.15} className="animate-pulse" />
                )}
                <circle cx={n.x} cy={n.y} r={NODE_R} fill={nodeBg} stroke={n.hasMaliciousMalware ? '#ef4444' : nodeBorder} strokeWidth={n.hasMaliciousMalware ? 3.5 : 2.5} />
                <g transform={`translate(${n.x - 11}, ${n.y - 11})`}>
                  <Icon width={22} height={22} color={n.hasMaliciousMalware ? '#ef4444' : iconColor} />
                </g>
                <text x={n.x} y={n.y + NODE_R + 15} textAnchor="middle" fill={nodeTextFill} className="text-[12px] font-semibold">{n.name}</text>
              </g>
            );
          })}

          {/* Infra Nodes */}
          {infraNodes.map(n => (
            <g key={`infra-${n.id}`} onMouseDown={e => onDown(e, n.id)} style={{ cursor: dragging === n.id ? 'grabbing' : 'grab' }}>
              <circle cx={n.x} cy={n.y} r={NODE_R} fill={isDark ? '#1c1017' : '#fff1f2'} stroke="#f43f5e" strokeWidth={2.5} />
              <g transform={`translate(${n.x - 11}, ${n.y - 11})`}><Skull width={22} height={22} color="#f43f5e" /></g>
              <text x={n.x} y={n.y + NODE_R + 15} textAnchor="middle" fill={nodeTextFill} className="text-[12px] font-semibold">{n.name}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
