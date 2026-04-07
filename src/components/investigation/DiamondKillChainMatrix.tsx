import { useMemo, useRef, useEffect, useState } from 'react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import { deriveEventBehavior } from '../../lib/diamondModelUtils';
import { getKillChainPhases } from '../../lib/killChainDefinitions';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from "react-i18next";

interface DiamondKillChainMatrixProps {
  nodes: DiamondNode[];
  allSystems: { id: string; label: string; type: string }[];
  killChainType: string | null;
  onSelectNode: (id: string) => void;
  selectedNodeId: string | null;
}

const NODE_SIZE = 52;
const NODE_HALF = NODE_SIZE / 2;
const CELL_W = 160;
const CELL_H = 120;
const ROW_LABEL_W = 160;
const COL_HEADER_H = 64;

function MiniDiamond({
  node,
  isSelected,
  onClick,
  index,
  isDark,
}: {
  node: DiamondNode;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  isDark: boolean;
}) {

  const color = node.killChainHexColor;
  const s = NODE_SIZE;
  const h = NODE_HALF;
  const hasAdversary = node.axes.adversary.length > 0;
  const hasInfra = node.axes.infrastructure.length > 0;
  const hasCapability = node.axes.capability.length > 0;
  const hasVictim = node.axes.victim.length > 0;
  const dot = (filled: boolean) => (filled ? color : (isDark ? '#475569' : '#64748b'));

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ cursor: 'pointer' }}
    >
      <polygon
        points={`${h},2 ${s - 2},${h} ${h},${s - 2} 2,${h}`}
        fill={isSelected ? `${color}30` : `${color}14`}
        stroke={isSelected ? color : `${color}70`}
        strokeWidth={isSelected ? 2 : 1.2}
      />
      <line x1={h} y1="2" x2={h} y2={s - 2} stroke={`${color}35`} strokeWidth="0.7" strokeDasharray="2,2" />
      <line x1="2" y1={h} x2={s - 2} y2={h} stroke={`${color}35`} strokeWidth="0.7" strokeDasharray="2,2" />

      <circle cx={h} cy={7} r={2.5} fill={dot(hasAdversary)} />
      <circle cx={s - 7} cy={h} r={2.5} fill={dot(hasInfra)} />
      <circle cx={7} cy={h} r={2.5} fill={dot(hasCapability)} />
      <circle cx={h} cy={s - 7} r={2.5} fill={dot(hasVictim)} />

      <text x={h} y={h - 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>
        {index + 1}
      </text>
      <text x={h} y={h + 7} textAnchor="middle" fontSize="5.5" fill={isDark ? '#94a3b8' : '#475569'} style={{ fontFamily: 'monospace' }}>
        {(node.killChainPhaseLabel || '').slice(0, 8)}
      </text>
    </g>
  );
}

interface Arrow {
  fromCell: { col: number; row: number; nodeIdx: number; cx: number; cy: number };
  toCell: { col: number; row: number; nodeIdx: number; cx: number; cy: number };
  isLateral: boolean;
  color: string;
}

function getSystemsForNode(node: DiamondNode): string[] {
  const ids: string[] = [];
  node.axes.victim.forEach((v) => { if (v.type === 'system') ids.push(v.id); });
  node.axes.infrastructure.forEach((i) => { if (i.type === 'system' || i.type === 'attacker_infra') ids.push(i.id); });
  return [...new Set(ids)];
}

function getPrimarySystem(node: DiamondNode): string | null {
  const victims = node.axes.victim.filter((v) => v.type === 'system');
  if (victims.length > 0) return victims[0].id;
  const infra = node.axes.infrastructure.filter((i) => i.type === 'system' || i.type === 'attacker_infra');
  if (infra.length > 0) return infra[0].id;
  return null;
}

export function DiamondKillChainMatrix({ nodes, allSystems, killChainType, onSelectNode, selectedNodeId }: DiamondKillChainMatrixProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const phases = useMemo(() => getKillChainPhases(killChainType), [killChainType]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });

  const systems = useMemo(() => {
    // On ignore le calcul basé sur les événements et on utilise tous les systèmes identifiés
    return allSystems.map(s => ({ id: s.id, name: s.label }));
  }, [allSystems]);

  const cellMap = useMemo(() => {
    const map = new Map<string, DiamondNode[]>();
    nodes.forEach((n) => {
      if (!n.killChainPhase) return;
      const sysList = getSystemsForNode(n);
      if (sysList.length === 0) {
        const key = `__none__:${n.killChainPhase}`;
        map.set(key, [...(map.get(key) || []), n]);
      } else {
        sysList.forEach((sysId) => {
          const key = `${sysId}:${n.killChainPhase}`;
          map.set(key, [...(map.get(key) || []), n]);
        });
      }
    });
    return map;
  }, [nodes]);

  const activePhasesSet = useMemo(() => {
    const s = new Set<string>();
    nodes.forEach((n) => { if (n.killChainPhase) s.add(n.killChainPhase); });
    return s;
  }, [nodes]);

  const activePhases = useMemo(
    () => phases.filter((p) => activePhasesSet.has(p.value)),
    [phases, activePhasesSet]
  );

  const hasNoSystemNodes = useMemo(() => {
    return nodes.some((n) => getSystemsForNode(n).length === 0 && n.killChainPhase);
  }, [nodes]);

  const displaySystems = useMemo(() => {
    const cols = [...systems];
    if (hasNoSystemNodes) cols.push({ id: '__none__', name: 'Systeme inconnu' });
    return cols;
  }, [systems, hasNoSystemNodes]);

  const colCount = displaySystems.length;
  const rowCount = activePhases.length;

  const cellNodePositions = useMemo(() => {
    const positions = new Map<string, { col: number; row: number; nodeIdx: number; cx: number; cy: number }>();
    activePhases.forEach((phase, rowIdx) => {
      displaySystems.forEach((sys, colIdx) => {
        const key = `${sys.id}:${phase.value}`;
        const cellNodes = cellMap.get(key) || [];
        if (cellNodes.length === 0) return;
        cellNodes.forEach((n, ni) => {
          const totalWNodes = cellNodes.length * (NODE_SIZE + 4) - 4;
          const startX = ROW_LABEL_W + colIdx * CELL_W + (CELL_W - totalWNodes) / 2 + ni * (NODE_SIZE + 4);
          const startY = COL_HEADER_H + rowIdx * CELL_H + (CELL_H - NODE_SIZE) / 2;
          positions.set(n.id, { col: colIdx, row: rowIdx, nodeIdx: ni, cx: startX + NODE_HALF, cy: startY + NODE_HALF });
        });
      });
    });
    return positions;
  }, [activePhases, displaySystems, cellMap]);

  const arrows = useMemo((): Arrow[] => {
    const result: Arrow[] = [];
    const sortedNodes = [...nodes].sort(
      (a, b) => new Date(a.eventDatetime || 0).getTime() - new Date(b.eventDatetime || 0).getTime()
    );

    const lateralNodes = sortedNodes.filter((n) => deriveEventBehavior(n.killChainPhase, n.axes) === 'lateralisation');
    lateralNodes.forEach((n) => {
      const infraSystems = n.axes.infrastructure.filter((i) => i.type === 'system' || i.type === 'attacker_infra');
      const victimSystems = n.axes.victim.filter((v) => v.type === 'system');
      if (infraSystems.length === 0 || victimSystems.length === 0) return;

      const srcId = infraSystems[0].id;
      const dstId = victimSystems[0].id;

      const srcColIdx = displaySystems.findIndex((s) => s.id === srcId);
      const dstColIdx = displaySystems.findIndex((s) => s.id === dstId);
      if (srcColIdx === -1 || dstColIdx === -1) return;

      const rowIdx = activePhases.findIndex((p) => p.value === n.killChainPhase);
      if (rowIdx === -1) return;

      const srcCx = ROW_LABEL_W + srcColIdx * CELL_W + CELL_W / 2;
      const dstCx = ROW_LABEL_W + dstColIdx * CELL_W + CELL_W / 2;
      const rowCy = COL_HEADER_H + rowIdx * CELL_H + CELL_H / 2;

      result.push({
        fromCell: { col: srcColIdx, row: rowIdx, nodeIdx: 0, cx: srcCx, cy: rowCy },
        toCell: { col: dstColIdx, row: rowIdx, nodeIdx: 0, cx: dstCx, cy: rowCy },
        isLateral: true,
        color: n.killChainHexColor,
      });
    });

    const bySys = new Map<string, DiamondNode[]>();
    sortedNodes.forEach((n) => {
      const prim = getPrimarySystem(n);
      const sysId = prim || '__none__';
      if (!bySys.has(sysId)) bySys.set(sysId, []);
      bySys.get(sysId)!.push(n);
    });

    bySys.forEach((sysNodes) => {
      const withPos = sysNodes.filter((n) => cellNodePositions.has(n.id));
      for (let i = 0; i < withPos.length - 1; i++) {
        const from = withPos[i];
        const to = withPos[i + 1];
        if (deriveEventBehavior(from.killChainPhase, from.axes) === 'lateralisation' || deriveEventBehavior(to.killChainPhase, to.axes) === 'lateralisation') continue;
        const fromPos = cellNodePositions.get(from.id);
        const toPos = cellNodePositions.get(to.id);
        if (!fromPos || !toPos) continue;
        if (fromPos.col !== toPos.col) continue;

        result.push({
          fromCell: fromPos,
          toCell: toPos,
          isLateral: false,
          color: from.killChainHexColor,
        });
      }
    });

    return result;
  }, [nodes, displaySystems, activePhases, cellNodePositions]);

  const totalW = ROW_LABEL_W + colCount * CELL_W;
  const totalH = COL_HEADER_H + rowCount * CELL_H + 32;

  useEffect(() => {
    setSvgSize({ w: totalW, h: totalH });
  }, [totalW, totalH]);

  void svgSize;

  if (nodes.length === 0 || activePhases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <p className="text-sm">{t('auto.aucun_evenement_avec_une_phase')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto w-full">
      <svg
        ref={svgRef}
        width={totalW}
        height={totalH}
        style={{ display: 'block', minWidth: totalW }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" opacity="0.85" />
          </marker>
          <marker id="arrowhead-gray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={isDark ? '#64748b' : '#94a3b8'} opacity="0.6" />
          </marker>
          {displaySystems.map((_, ci) =>
            activePhases.map((_, ri) => (
              <clipPath key={`clip-${ci}-${ri}`} id={`clip-${ci}-${ri}`}>
                <rect
                  x={ROW_LABEL_W + ci * CELL_W + 2}
                  y={COL_HEADER_H + ri * CELL_H + 2}
                  width={CELL_W - 4}
                  height={CELL_H - 4}
                />
              </clipPath>
            ))
          )}
        </defs>

        <rect x={0} y={0} width={totalW} height={totalH} fill={isDark ? '#0f172a' : '#ffffff'} />

        {activePhases.map((_, ri) => (
          <rect
            key={`row-bg-${ri}`}
            x={0}
            y={COL_HEADER_H + ri * CELL_H}
            width={totalW}
            height={CELL_H}
            fill={ri % 2 === 0 ? (isDark ? '#0f172a' : '#ffffff') : (isDark ? '#111827' : '#f8fafc')}
          />
        ))}

        {displaySystems.map((_, ci) => (
          <line
            key={`col-sep-${ci}`}
            x1={ROW_LABEL_W + ci * CELL_W}
            y1={0}
            x2={ROW_LABEL_W + ci * CELL_W}
            y2={totalH}
            stroke={isDark ? '#1e293b' : '#f1f5f9'}
            strokeWidth="1"
          />
        ))}
        <line x1={ROW_LABEL_W + colCount * CELL_W} y1={0} x2={ROW_LABEL_W + colCount * CELL_W} y2={totalH} stroke={isDark ? '#1e293b' : '#f1f5f9'} strokeWidth="1" />

        {activePhases.map((_, ri) => (
          <line
            key={`row-sep-${ri}`}
            x1={0}
            y1={COL_HEADER_H + ri * CELL_H}
            x2={totalW}
            y2={COL_HEADER_H + ri * CELL_H}
            stroke={isDark ? '#1e293b' : '#f1f5f9'}
            strokeWidth="1"
          />
        ))}
        <line x1={0} y1={COL_HEADER_H + rowCount * CELL_H} x2={totalW} y2={COL_HEADER_H + rowCount * CELL_H} stroke={isDark ? '#1e293b' : '#f1f5f9'} strokeWidth="1" />

        <rect x={0} y={0} width={ROW_LABEL_W} height={COL_HEADER_H} fill={isDark ? '#0f172a' : '#ffffff'} />
        <line x1={ROW_LABEL_W} y1={0} x2={ROW_LABEL_W} y2={totalH} stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="1.5" />
        <line x1={0} y1={COL_HEADER_H} x2={totalW} y2={COL_HEADER_H} stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="1.5" />

        {displaySystems.map((sys, ci) => {
          const cx = ROW_LABEL_W + ci * CELL_W + CELL_W / 2;
          const isUnknown = sys.id === '__none__';
          return (
            <g key={`col-header-${ci}`}>
              <rect
                x={ROW_LABEL_W + ci * CELL_W + 4}
                y={8}
                width={CELL_W - 8}
                height={COL_HEADER_H - 16}
                rx={6}
                fill={isUnknown ? (isDark ? '#1e293b' : '#f1f5f9') : (isDark ? '#1e3a5f' : '#dbeafe')}
                stroke={isUnknown ? (isDark ? '#334155' : '#e2e8f0') : '#2563eb40'}
                strokeWidth="1"
              />
              <text
                x={cx}
                y={COL_HEADER_H / 2 - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={isUnknown ? (isDark ? '#475569' : '#64748b') : (isDark ? '#93c5fd' : '#2563eb')}
              >
                {sys.name.length > 16 ? sys.name.slice(0, 14) + '...' : sys.name}
              </text>
              <text
                x={cx}
                y={COL_HEADER_H / 2 + 8}
                textAnchor="middle"
                fontSize="8"
                fill={isUnknown ? (isDark ? '#334155' : '#e2e8f0') : '#3b82f6'}
              >
                {isUnknown ? 'inconnu' : 'systeme'}
              </text>
            </g>
          );
        })}

        {activePhases.map((phase, ri) => {
          const cy = COL_HEADER_H + ri * CELL_H + CELL_H / 2;
          return (
            <g key={`row-label-${ri}`}>
              <rect
                x={8}
                y={COL_HEADER_H + ri * CELL_H + 8}
                width={ROW_LABEL_W - 16}
                height={CELL_H - 16}
                rx={6}
                fill={`${phase.hexColor}12`}
                stroke={`${phase.hexColor}30`}
                strokeWidth="1"
              />
              <rect
                x={8}
                y={COL_HEADER_H + ri * CELL_H + 8}
                width={3}
                height={CELL_H - 16}
                rx={1.5}
                fill={phase.hexColor}
              />
              <text
                x={ROW_LABEL_W / 2 + 4}
                y={cy - 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={phase.hexColor}
              >
                {phase.label.length > 20 ? phase.label.slice(0, 18) + '...' : phase.label}
              </text>
              <text
                x={ROW_LABEL_W / 2 + 4}
                y={cy + 10}
                textAnchor="middle"
                fontSize="8"
                fill={isDark ? '#475569' : '#64748b'}
              >
                {phase.shortLabel}
              </text>
            </g>
          );
        })}

        {arrows.map((arrow, ai) => {
          const fromPos = arrow.fromCell;
          const toPos = arrow.toCell;

          if (arrow.isLateral) {
            const srcCxCenter = ROW_LABEL_W + fromPos.col * CELL_W + CELL_W / 2;
            const dstCxCenter = ROW_LABEL_W + toPos.col * CELL_W + CELL_W / 2;
            const rowCy = COL_HEADER_H + fromPos.row * CELL_H + CELL_H / 2;
            const dir = dstCxCenter > srcCxCenter ? 1 : -1;
            const x1 = srcCxCenter + dir * (NODE_HALF + 2);
            const x2 = dstCxCenter - dir * (NODE_HALF + 8);
            const controlY = rowCy - 24;

            return (
              <path
                key={`arrow-lateral-${ai}`}
                d={`M ${x1} ${rowCy} Q ${(x1 + x2) / 2} ${controlY} ${x2} ${rowCy}`}
                fill="none"
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="5,3"
                markerEnd="url(#arrowhead)"
                opacity="0.8"
              />
            );
          } else {
            const x = fromPos.cx;
            const y1 = fromPos.cy + NODE_HALF + 2;
            const y2 = toPos.cy - NODE_HALF - 8;
            if (y2 <= y1) return null;

            return (
              <line
                key={`arrow-seq-${ai}`}
                x1={x}
                y1={y1}
                x2={x}
                y2={y2}
                stroke={arrow.color}
                strokeWidth="1.2"
                markerEnd="url(#arrowhead)"
                opacity="0.55"
              />
            );
          }
        })}

        {activePhases.map((phase, ri) =>
          displaySystems.map((sys, ci) => {
            const key = `${sys.id}:${phase.value}`;
            const cellNodes = cellMap.get(key) || [];
            if (cellNodes.length === 0) return null;

            const totalW_nodes = cellNodes.length * (NODE_SIZE + 4) - 4;
            const startX = ROW_LABEL_W + ci * CELL_W + (CELL_W - totalW_nodes) / 2;
            const startY = COL_HEADER_H + ri * CELL_H + (CELL_H - NODE_SIZE) / 2;

            return (
              <g key={`cell-${ci}-${ri}`} clipPath={`url(#clip-${ci}-${ri})`}>
                {cellNodes.map((n, ni) => {
                  const nx = startX + ni * (NODE_SIZE + 4);
                  const ny = startY;
                  const globalIdx = nodes.indexOf(n);

                  return (
                    <g key={n.id} transform={`translate(${nx}, ${ny})`}>
                      <MiniDiamond
                        node={n}
                        isSelected={selectedNodeId === n.id}
                        onClick={() => onSelectNode(n.id)}
                        index={globalIdx}
                        isDark={isDark}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })
        )}

        <g>
          <rect
            x={ROW_LABEL_W + 8}
            y={COL_HEADER_H + rowCount * CELL_H + 6}
            width={280}
            height={22}
            rx={4}
            fill={isDark ? '#0f172a' : '#ffffff'}
          />
          <circle cx={ROW_LABEL_W + 20} cy={COL_HEADER_H + rowCount * CELL_H + 17} r={4} fill={isDark ? '#64748b' : '#94a3b8'} />
          <text x={ROW_LABEL_W + 30} y={COL_HEADER_H + rowCount * CELL_H + 21} fontSize="8" fill={isDark ? '#64748b' : '#94a3b8'}>
            {t('auto.sequence_chronologique_par_sys')}</text>
          <line
            x1={ROW_LABEL_W + 160}
            y1={COL_HEADER_H + rowCount * CELL_H + 17}
            x2={ROW_LABEL_W + 190}
            y2={COL_HEADER_H + rowCount * CELL_H + 17}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="5,3"
          />
          <path
            d={`M ${ROW_LABEL_W + 186} ${COL_HEADER_H + rowCount * CELL_H + 14} L ${ROW_LABEL_W + 192} ${COL_HEADER_H + rowCount * CELL_H + 17} L ${ROW_LABEL_W + 186} ${COL_HEADER_H + rowCount * CELL_H + 20} z`}
            fill="#ef4444"
            opacity="0.85"
          />
          <text x={ROW_LABEL_W + 196} y={COL_HEADER_H + rowCount * CELL_H + 21} fontSize="8" fill="#ef4444">
            {t('auto.mouvement_lateral')}</text>
        </g>
      </svg>
    </div>
  );
}
