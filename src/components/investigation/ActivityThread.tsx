import React from 'react';
import { useMemo } from 'react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import { deriveEventBehavior } from '../../lib/diamondModelUtils';

import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from "react-i18next";
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';



interface ActivityThreadProps {
  nodes: DiamondNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onReorder: (newNodes: DiamondNode[]) => void;
  killChainType: string | null;
  allSystems?: { id: string; label: string }[];
}

interface Column {
  id: string;
  label: string;
  isExternal: boolean;
}

interface EventRow {
  node: DiamondNode;
  index: number;
  involvedColumnIds: string[];
  sourceColumnId: string | null;
  targetColumnId: string | null;
  behavior: string;
}

function extractSystemsFromNode(node: DiamondNode): { sourceId: string | null; targetId: string | null; allIds: string[], behavior: string } {
  const behavior = deriveEventBehavior(node.killChainPhase, node.axes);
  const isLat = behavior === 'lateralisation' || behavior === 'c2';

  let sourceId: string | null = null;
  let targetId: string | null = null;
  
  const infraSystems = node.axes.infrastructure.filter((o) => o.type === 'system' || o.type === 'attacker_infra');
  const victimSystems = node.axes.victim.filter((o) => o.type === 'system');

  if (isLat) {
    if (behavior === 'c2') {
      // C2: Machine (Victim) -> C2 Server (Infra)
      if (victimSystems.length > 0) sourceId = victimSystems[0].id;
      if (infraSystems.length > 0) targetId = infraSystems[0].id;
    } else {
      // PIVOT: Source (Infra) -> Target (Victim)
      if (infraSystems.length > 0) sourceId = infraSystems[0].id;
      if (victimSystems.length > 0) targetId = victimSystems[0].id;
    }
  } else {
    // Standard event: infrastructure -> victim
    if (infraSystems.length > 0 && victimSystems.length > 0) {
      sourceId = infraSystems[0].id;
      targetId = victimSystems[0].id;
    } else if (victimSystems.length > 0) {
      sourceId = victimSystems[0].id;
    } else if (infraSystems.length > 0) {
      sourceId = infraSystems[0].id;
    }
  }

  // Fallback: If we have multiple systems but missed assigning source/target
  if (!sourceId || !targetId) {
    const allAvailable = [...infraSystems, ...victimSystems];
    if (allAvailable.length >= 2) {
      if (!sourceId) sourceId = allAvailable[0].id;
      if (!targetId || targetId === sourceId) targetId = allAvailable.find(s => s.id !== sourceId)?.id || null;
    } else if (allAvailable.length === 1) {
      if (!sourceId) sourceId = allAvailable[0].id;
    }
  }

  const allIds: string[] = [];
  if (sourceId) allIds.push(sourceId);
  if (targetId && targetId !== sourceId) allIds.push(targetId);
  
  const allAvailable = [...infraSystems, ...victimSystems];
  allAvailable.forEach(sys => {
    if (!allIds.includes(sys.id)) allIds.push(sys.id);
  });

  return { sourceId, targetId, allIds, behavior };
}

function truncateLabel(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}



export function ActivityThread({ nodes, selectedNodeId, onSelectNode, allSystems = [] }: ActivityThreadProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { visibleItems: visibleNodes, hasMore, loadMoreRef } = useInfiniteScroll(nodes, 50, 50);

  const lineColor = isDark ? '#334155' : '#cbd5e1';
  const colLabelColor = isDark ? '#94a3b8' : '#475569';
  const colExternalColor = isDark ? '#64748b' : '#94a3b8';
  const colBarColor = '#3b82f6';
  const colBarExternalColor = isDark ? '#475569' : '#94a3b8';
  const dateColor = isDark ? '#64748b' : '#94a3b8';
  const labelColor = isDark ? '#94a3b8' : '#475569';

  const { columns, rows } = useMemo(() => {
    const systemMap = new Map<string, string>();

    visibleNodes.forEach((node) => {
      [...node.axes.infrastructure, ...node.axes.victim].forEach((obj) => {
        if ((obj.type === 'system' || obj.type === 'attacker_infra') && !systemMap.has(obj.id)) {
          systemMap.set(obj.id, obj.label);
        }
      });
    });

    // Add all explicitly provided systems to the graph columns
    allSystems.forEach(sys => {
      if (!systemMap.has(sys.id)) {
        systemMap.set(sys.id, sys.label);
      }
    });

    const cols: Column[] = [];
    systemMap.forEach((label, id) => {
      cols.push({ id, label, isExternal: false });
    });

    const hasExternal = visibleNodes.some((node) => {
      const { allIds } = extractSystemsFromNode(node);
      return allIds.length === 0;
    });
    if (hasExternal) {
      cols.push({ id: '__external__', label: 'Externe / Inconnu', isExternal: true });
    }

    const eventRows: EventRow[] = visibleNodes.map((node, index) => {
      const { sourceId, targetId, allIds } = extractSystemsFromNode(node);
      const beh = deriveEventBehavior(node.killChainPhase, node.axes);

      let involvedIds = allIds;
      if (involvedIds.length === 0) involvedIds = ['__external__'];

      return {
        node,
        index,
        involvedColumnIds: involvedIds,
        sourceColumnId: sourceId || (involvedIds[0] === '__external__' ? '__external__' : null),
        targetColumnId: targetId,
        behavior: beh,
      };
    });

    return { columns: cols, rows: eventRows };
  }, [visibleNodes, allSystems]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <p className="text-sm">{t('auto.aucun_evenement_dans_la_timeli')}</p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="overflow-x-auto">
        <FallbackVerticalList nodes={nodes} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />
      </div>
    );
  }

  const COL_WIDTH = 160;
  const ROW_HEIGHT = 72;
  const LABEL_HEIGHT = 40;
  const GUTTER = 24;
  const DOT_R = 9;
  const totalWidth = columns.length * COL_WIDTH + (columns.length - 1) * GUTTER;
  const totalHeight = rows.length * ROW_HEIGHT;

  const colCenter = (colIdx: number) => colIdx * (COL_WIDTH + GUTTER) + COL_WIDTH / 2;
  const rowCenter = (rowIdx: number) => LABEL_HEIGHT + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalWidth + 32, paddingBottom: 16 }}>
        <svg
          width={totalWidth}
          height={LABEL_HEIGHT + totalHeight + 16}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {columns.map((col, ci) => {
            const cx = colCenter(ci);
            return (
              <g key={col.id}>
                <line
                  x1={cx}
                  y1={LABEL_HEIGHT}
                  x2={cx}
                  y2={LABEL_HEIGHT + totalHeight}
                  stroke={lineColor}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <foreignObject x={cx - COL_WIDTH / 2} y={0} width={COL_WIDTH} height={LABEL_HEIGHT}>
                  <div
                    style={{
                      width: COL_WIDTH,
                      height: LABEL_HEIGHT,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: col.isExternal ? colExternalColor : colLabelColor,
                        textAlign: 'center',
                        lineHeight: 1.2,
                        maxWidth: COL_WIDTH - 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={col.label}
                    >
                      {col.label}
                    </div>
                    <div style={{ width: 28, height: 2, borderRadius: 1, backgroundColor: col.isExternal ? colBarExternalColor : colBarColor, opacity: 0.5 }} />
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {rows.map((row) => {
            const { node, index, involvedColumnIds, sourceColumnId, targetColumnId, behavior } = row;
            const isLateralisation = behavior === 'lateralisation' || behavior === 'c2';
            const ry = rowCenter(index);
            const color = node.killChainHexColor;
            const isSelected = selectedNodeId === node.id;

            const sourceColIdx = sourceColumnId ? columns.findIndex((c) => c.id === sourceColumnId) : -1;
            const targetColIdx = targetColumnId ? columns.findIndex((c) => c.id === targetColumnId) : -1;

            return (
              <g key={node.id}>
                {sourceColIdx !== -1 && targetColIdx !== -1 && sourceColIdx !== targetColIdx && (
                  <g>
                    <line
                      x1={colCenter(sourceColIdx)}
                      y1={ry}
                      x2={colCenter(targetColIdx)}
                      y2={ry}
                      stroke={color}
                      strokeWidth="2.5"
                      strokeDasharray="none"
                      opacity="0.7"
                    />
                    <polygon
                      points={buildArrowHead(colCenter(sourceColIdx), colCenter(targetColIdx), ry)}
                      fill={color}
                      opacity="0.85"
                    />
                    {isLateralisation && (
                      <foreignObject
                        x={(colCenter(sourceColIdx) + colCenter(targetColIdx)) / 2 - 22}
                        y={ry - 22}
                        width={44}
                        height={16}
                      >
                        <div
                          style={{
                            background: color,
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 800,
                            textAlign: 'center',
                            borderRadius: 4,
                            padding: '1px 4px',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {deriveEventBehavior(node.killChainPhase, node.axes) === 'c2' ? 'C2' : 'PIVOT'}
                        </div>
                      </foreignObject>
                    )}
                  </g>
                )}

                {involvedColumnIds.map((colId) => {
                  const ci = columns.findIndex((c) => c.id === colId);
                  if (ci === -1) return null;
                  const cx = colCenter(ci);
                  const isSource = colId === sourceColumnId;
                  const isTarget = colId === targetColumnId;

                  return (
                    <g
                      key={colId}
                      onClick={() => onSelectNode(node.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {isSelected && (
                        <circle cx={cx} cy={ry} r={DOT_R + 5} fill={color} opacity="0.15" />
                      )}
                      <circle
                        cx={cx}
                        cy={ry}
                        r={DOT_R}
                        fill={isSelected ? color : `${color}40`}
                        stroke={color}
                        strokeWidth={isSelected ? 2 : 1.5}
                      />
                      {isLateralisation && (
                        <text
                          x={cx}
                          y={ry + 1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={8}
                          fontWeight="800"
                          fill="#fff"
                        >
                          {isSource ? 'S' : isTarget ? 'T' : '•'}
                        </text>
                      )}
                    </g>
                  );
                })}

                <foreignObject
                  x={totalWidth + 8}
                  y={ry - ROW_HEIGHT / 2}
                  width={220}
                  height={ROW_HEIGHT}
                  onClick={() => onSelectNode(node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div
                    style={{
                      height: ROW_HEIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      paddingLeft: 4,
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        background: isSelected ? color : `${color}30`,
                        border: `1px solid ${color}`,
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontSize: 8,
                        fontWeight: 700,
                        color: isSelected ? '#fff' : color,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {node.killChainPhaseLabel ? node.killChainPhaseLabel.slice(0, 10) : '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {node.eventDatetime && (
                        <div style={{ fontSize: 9, color: dateColor, marginBottom: 1 }}>
                          {new Date(node.eventDatetime).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 10,
                          color: isSelected ? (isDark ? '#e2e8f0' : '#1e293b') : labelColor,
                          fontWeight: isSelected ? 600 : 400,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: 1.3,
                        }}
                      >
                        {truncateLabel(node.label, 60)}
                      </div>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {rows.map((row, i) => {
            if (i === rows.length - 1) return null;
            const nextRow = rows[i + 1];
            const ry1 = rowCenter(i);
            const ry2 = rowCenter(i + 1);

            const sharedCols = row.involvedColumnIds.filter((id) =>
              nextRow.involvedColumnIds.includes(id)
            );

            return sharedCols.map((colId) => {
              const ci = columns.findIndex((c) => c.id === colId);
              if (ci === -1) return null;
              const cx = colCenter(ci);
              const color1 = row.node.killChainHexColor;
              return (
                <line
                  key={`${row.node.id}-${nextRow.node.id}-${colId}`}
                  x1={cx}
                  y1={ry1 + DOT_R}
                  x2={cx}
                  y2={ry2 - DOT_R}
                  stroke={`${color1}50`}
                  strokeWidth="1.5"
                  style={{
                    stroke: `url(#grad-${row.node.id}-${colId})`,
                  }}
                />
              );
            });
          })}

          <defs>
            {rows.map((row, i) => {
              if (i === rows.length - 1) return null;
              const nextRow = rows[i + 1];
              const sharedCols = row.involvedColumnIds.filter((id) =>
                nextRow.involvedColumnIds.includes(id)
              );
              return sharedCols.map((colId) => {
                const ry1 = rowCenter(i);
                const ry2 = rowCenter(i + 1);
                return (
                  <linearGradient
                    key={`grad-${row.node.id}-${colId}`}
                    id={`grad-${row.node.id}-${colId}`}
                    x1="0" y1={ry1} x2="0" y2={ry2}
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor={row.node.killChainHexColor} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={nextRow.node.killChainHexColor} stopOpacity="0.4" />
                  </linearGradient>
                );
              });
            })}
          </defs>
        </svg>
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-slate-700/50 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
        <span>{t('auto.cliquer_sur_un_noeud_pour_voir')}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-400" />
          {t('auto.systeme_victime')}<span className="inline-block w-3 h-3 rounded-full bg-orange-400 ml-2" />
          {t('auto.pivot_c2_s_source_t_cible')}
        </span>
      </div>
      
      {hasMore && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

function buildArrowHead(x1: number, x2: number, y: number): string {
  const dir = x2 > x1 ? 1 : -1;
  const tip = x2 - dir * 12;
  const size = 6;
  return `${x2},${y} ${tip},${y - size} ${tip},${y + size}`;
}

function FallbackVerticalList({
  nodes,
  selectedNodeId,
  onSelectNode,
}: {
  nodes: DiamondNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const { visibleItems: visibleNodes, hasMore, loadMoreRef } = useInfiniteScroll(nodes, 50, 50);

  return (
    <div className="space-y-2 py-2">
      {visibleNodes.map((node, index) => {
        const color = node.killChainHexColor;
        const isSelected = selectedNodeId === node.id;
        return (
          <div
            key={node.id}
            onClick={() => onSelectNode(node.id)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {index + 1}
            </div>
            <div
              className={`flex-1 p-2 rounded-lg border transition ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-slate-800' : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${color}30`, color }}
                >
                  {node.killChainPhaseLabel ? node.killChainPhaseLabel.slice(0, 10) : '?'}
                </span>
                {node.eventDatetime && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">
                    {new Date(node.eventDatetime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-700 dark:text-slate-300 mt-0.5 truncate">{node.label}</p>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
