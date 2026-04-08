import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Pencil, User, Bug, Server, Shield, X } from 'lucide-react';
import { RELATIONSHIP_TYPES, STIX_TYPE_META } from '../../lib/stix.types';
import type { StixSDO, StixSDOType } from '../../lib/stix.types';
import type { SelectedNode, ManualRelation } from './TaskDiamondWizard';
import { generateStixId } from '../../lib/stixApi';

interface DiamondRelationsEditorProps {
    axesNodes: Record<string, SelectedNode[]>;
    relations: ManualRelation[];
    onAddRelation: (sourceId: string, targetId: string, type: string) => boolean;
    onRemoveRelation: (id: string) => void;
    onUpdateRelationType: (id: string, newType: string) => void;
    // Vertex editing
    existingObjects: StixSDO[];
    onAddNode: (axisKey: string, node: SelectedNode) => void;
    onRemoveNode: (axisKey: string, id: string) => void;
    axisTypes: Record<string, { types: string[]; defaultType: StixSDOType }>;
    mitrePatterns?: any[];
    caseId: string;
}

type AxisKey = 'adversary' | 'capability' | 'infrastructure' | 'victim';

interface EdgeDef {
    from: AxisKey;
    to: AxisKey;
    label: string;
}

const EDGES: EdgeDef[] = [
    { from: 'adversary', to: 'capability', label: 'Adversaire ↔ Capacité' },
    { from: 'adversary', to: 'infrastructure', label: 'Adversaire ↔ Infrastructure' },
    { from: 'adversary', to: 'victim', label: 'Adversaire ↔ Victime' },
    { from: 'capability', to: 'infrastructure', label: 'Capacité ↔ Infrastructure' },
    { from: 'capability', to: 'victim', label: 'Capacité ↔ Victime' },
    { from: 'infrastructure', to: 'victim', label: 'Infrastructure ↔ Victime' },
];

const AXIS_CONFIG: Record<AxisKey, { label: string; color: string; icon: typeof User; cx: number; cy: number }> = {
    adversary:      { label: 'Adversaire',      color: '#ef4444', icon: User,   cx: 250, cy: 30 },
    victim:         { label: 'Victime',          color: '#22c55e', icon: Shield, cx: 430, cy: 175 },
    capability:     { label: 'Capacité',         color: '#a855f7', icon: Bug,    cx: 250, cy: 320 },
    infrastructure: { label: 'Infrastructure',   color: '#3b82f6', icon: Server, cx: 70,  cy: 175 },
};

type PopoverMode = 'edge' | 'vertex';

export const DiamondRelationsEditor: React.FC<DiamondRelationsEditorProps> = ({
    axesNodes,
    relations,
    onAddRelation,
    onRemoveRelation,
    onUpdateRelationType,
    existingObjects,
    onAddNode,
    onRemoveNode,
    axisTypes,
    mitrePatterns = [],
}) => {
    const [popoverMode, setPopoverMode] = useState<PopoverMode | null>(null);
    const [activeEdge, setActiveEdge] = useState<EdgeDef | null>(null);
    const [activeVertex, setActiveVertex] = useState<AxisKey | null>(null);
    const [popoverPos, setPopoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [draftSource, setDraftSource] = useState('');
    const [draftTarget, setDraftTarget] = useState('');
    const [draftType, setDraftType] = useState('uses');
    const [error, setError] = useState('');
    const [editingRelId, setEditingRelId] = useState<string | null>(null);
    // Vertex editing state
    const [vertexSearch, setVertexSearch] = useState('');
    const [vertexMode, setVertexMode] = useState<'existing' | 'new'>('existing');
    const [newObjName, setNewObjName] = useState('');
    const [newObjType, setNewObjType] = useState<StixSDOType>('infrastructure');
    const [newObjDesc, setNewObjDesc] = useState('');
    const svgRef = useRef<SVGSVGElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const isPopoverOpen = popoverMode !== null;

    // Close popover on outside click
    useEffect(() => {
        if (!isPopoverOpen) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                closePopover();
            }
        };
        setTimeout(() => document.addEventListener('mousedown', handler), 0);
        return () => document.removeEventListener('mousedown', handler);
    }, [isPopoverOpen]);

    const closePopover = () => {
        setPopoverMode(null);
        setActiveEdge(null);
        setActiveVertex(null);
        setError('');
        setVertexSearch('');
        setVertexMode('existing');
        setNewObjName('');
        setNewObjDesc('');
    };

    const handleEdgeClick = (edge: EdgeDef, e: React.MouseEvent) => {
        const fromNodes = axesNodes[edge.from] || [];
        const toNodes = axesNodes[edge.to] || [];
        if (fromNodes.length === 0 || toNodes.length === 0) return;

        setPopoverMode('edge');
        setActiveEdge(edge);
        setActiveVertex(null);
        setPopoverPos({ x: e.clientX, y: e.clientY });
        setDraftSource(fromNodes.length === 1 ? fromNodes[0].id : '');
        setDraftTarget(toNodes.length === 1 ? toNodes[0].id : '');
        setDraftType('uses');
        setError('');
    };

    const handleVertexClick = (axisKey: AxisKey, e: React.MouseEvent) => {
        setPopoverMode('vertex');
        setActiveVertex(axisKey);
        setActiveEdge(null);
        setPopoverPos({ x: e.clientX, y: e.clientY });
        setError('');
        setVertexSearch('');
        setVertexMode('existing');
        setNewObjName('');
        setNewObjDesc('');
        if (activeVertex) {
            const config = axisTypes[axisKey];
            if (config) setNewObjType(config.defaultType);
        } else {
            const config = axisTypes[axisKey];
            if (config) setNewObjType(config.defaultType);
        }
    };

    const handleSubmitRelation = () => {
        if (!draftSource || !draftTarget || !draftType) {
            setError('Remplissez tous les champs.');
            return;
        }
        if (draftSource === draftTarget) {
            setError('Source et cible doivent être différents.');
            return;
        }
        const success = onAddRelation(draftSource, draftTarget, draftType);
        if (success === false) {
            setError('Cette relation existe déjà.');
            return;
        }
        closePopover();
    };

    const handleVertexAddExisting = (objId: string) => {
        if (!activeVertex) return;
        const existingObj = existingObjects.find(o => o && o.id === objId);
        const mitreTtp = !existingObj ? mitrePatterns.find(p => p && p.id === objId) : null;
        if (!existingObj && !mitreTtp) return;

        // Check duplicate
        if (axesNodes[activeVertex]?.some(n => n.id === objId)) {
            setError('Cet objet est déjà ajouté.');
            return;
        }

        let label = existingObj
            ? (('name' in existingObj) ? (existingObj as any).name : ('value' in existingObj) ? (existingObj as any).value : existingObj.type)
            : `${mitreTtp?.mitre_id} - ${mitreTtp?.name}`;

        if (existingObj && existingObj.type === 'attack-pattern' && (existingObj as any).external_references) {
            const extRef = (existingObj as any).external_references.find((r: any) => r.source_name === 'mitre-attack');
            if (extRef && extRef.external_id) {
                label = `${extRef.external_id} - ${label}`;
            }
        }

        const sdoType = existingObj ? existingObj.type as StixSDOType : 'attack-pattern' as StixSDOType;
        onAddNode(activeVertex, { mode: 'existing', id: objId, label, sdoType });
        setVertexSearch('');
        setError('');
    };

    const getEdgeMidpoint = (edge: EdgeDef) => {
        const from = AXIS_CONFIG[edge.from];
        const to = AXIS_CONFIG[edge.to];
        let midX = (from.cx + to.cx) / 2;
        let midY = (from.cy + to.cy) / 2;

        // Offset the inner crossing edges so their buttons don't overlap
        const isAdvCap = (edge.from === 'adversary' && edge.to === 'capability') || (edge.to === 'adversary' && edge.from === 'capability');
        const isInfVic = (edge.from === 'infrastructure' && edge.to === 'victim') || (edge.to === 'infrastructure' && edge.from === 'victim');

        if (isAdvCap) {
            midY -= 25; // Move the vertical center line's button slightly up
        }
        if (isInfVic) {
            midX += 25; // Move the horizontal center line's button slightly right
        }

        return {
            x: midX,
            y: midY,
        };
    };

    const getRelationsForEdge = (edge: EdgeDef): ManualRelation[] => {
        const fromIds = new Set((axesNodes[edge.from] || []).map(n => n.id));
        const toIds = new Set((axesNodes[edge.to] || []).map(n => n.id));
        return relations.filter(r =>
            (fromIds.has(r.sourceId) && toIds.has(r.targetId)) ||
            (toIds.has(r.sourceId) && fromIds.has(r.targetId))
        );
    };

    const getNodeLabel = (id: string): string => {
        for (const axis of Object.values(axesNodes)) {
            const found = axis.find(n => n.id === id);
            if (found) return found.label;
        }
        return '?';
    };

    const isEdgeActive = (edge: EdgeDef): boolean => {
        const fromNodes = axesNodes[edge.from] || [];
        const toNodes = axesNodes[edge.to] || [];
        return fromNodes.length > 0 && toNodes.length > 0;
    };

    const getVertexOptions = (axisKey: AxisKey) => {
        const config = axisTypes[axisKey];
        if (!config) return [];

        const existingIds = new Set((axesNodes[axisKey] || []).map(n => n.id));
        const opts = existingObjects
            .filter(o => o && config.types.includes(o.type) && !existingIds.has(o.id))
            .map(o => ({
                id: o.id,
                label: ('name' in o ? (o as any).name : ('value' in o ? (o as any).value : o.type)) as string,
            }));

        // Add MITRE patterns for capability axis
        if (axisKey === 'capability') {
            const allIds = new Set([...existingIds, ...opts.map(o => o.id)]);
            mitrePatterns.filter(p => p && !allIds.has(p.id)).forEach(p => {
                opts.push({ id: p.id, label: `${p.mitre_id} - ${p.name}` });
            });
        }

        return opts;
    };

    const SVG_W = 500;
    const SVG_H = 350;

    return (
        <div className="space-y-5">
            {/* Diamond SVG */}
            <div className="flex justify-center">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    className="w-full max-w-[480px]"
                    style={{ minHeight: 320 }}
                >
                    {/* Background diamond shape */}
                    <polygon
                        points={`${AXIS_CONFIG.adversary.cx},${AXIS_CONFIG.adversary.cy + 20} ${AXIS_CONFIG.victim.cx - 20},${AXIS_CONFIG.victim.cy} ${AXIS_CONFIG.capability.cx},${AXIS_CONFIG.capability.cy - 20} ${AXIS_CONFIG.infrastructure.cx + 20},${AXIS_CONFIG.infrastructure.cy}`}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.06}
                        strokeWidth={1}
                        className="text-slate-500"
                    />

                    {/* Edges */}
                    {EDGES.map((edge, i) => {
                        const from = AXIS_CONFIG[edge.from];
                        const to = AXIS_CONFIG[edge.to];
                        const active = isEdgeActive(edge);
                        const edgeRels = getRelationsForEdge(edge);
                        const hasRels = edgeRels.length > 0;
                        const mid = getEdgeMidpoint(edge);

                        return (
                            <g key={i}>
                                {/* Edge line */}
                                <line
                                    x1={from.cx}
                                    y1={from.cy}
                                    x2={to.cx}
                                    y2={to.cy}
                                    stroke={hasRels ? '#06b6d4' : active ? '#475569' : '#1e293b'}
                                    strokeWidth={hasRels ? 2.5 : 1.5}
                                    strokeOpacity={hasRels ? 0.9 : active ? 0.5 : 0.15}
                                    strokeDasharray={active ? undefined : '4 4'}
                                />

                                {/* Glow effect for edges with relations */}
                                {hasRels && (
                                    <line
                                        x1={from.cx}
                                        y1={from.cy}
                                        x2={to.cx}
                                        y2={to.cy}
                                        stroke="#06b6d4"
                                        strokeWidth={6}
                                        strokeOpacity={0.15}
                                    />
                                )}

                                {/* Relation badges on edge */}
                                {edgeRels.map((rel, ri) => {
                                    const rtLabel = RELATIONSHIP_TYPES.find(r => r.value === rel.type)?.label || rel.type;
                                    const offsetY = ri * 18;
                                    return (
                                        <g key={rel.id} transform={`translate(${mid.x}, ${mid.y + offsetY - (edgeRels.length - 1) * 9})`}>
                                            <rect
                                                x={-30}
                                                y={-8}
                                                width={60}
                                                height={16}
                                                rx={8}
                                                fill="#0e7490"
                                                fillOpacity={0.9}
                                            />
                                            <text
                                                x={0}
                                                y={4}
                                                textAnchor="middle"
                                                fontSize={8}
                                                fill="white"
                                                fontWeight={600}
                                                fontFamily="system-ui"
                                            >
                                                {rtLabel.length > 10 ? rtLabel.slice(0, 10) + '…' : rtLabel}
                                            </text>
                                        </g>
                                    );
                                })}

                                {/* "+" button on edge if active */}
                                {active && (
                                    <g
                                        className="cursor-pointer"
                                        onClick={(e) => handleEdgeClick(edge, e)}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <circle
                                            cx={hasRels ? mid.x + (edgeRels.length > 0 ? 40 : 0) : mid.x}
                                            cy={mid.y}
                                            r={10}
                                            fill="#0f172a"
                                            stroke="#475569"
                                            strokeWidth={1.5}
                                            className="hover:stroke-cyan-400 transition-colors"
                                        />
                                        <text
                                            x={hasRels ? mid.x + (edgeRels.length > 0 ? 40 : 0) : mid.x}
                                            y={mid.y + 4}
                                            textAnchor="middle"
                                            fontSize={14}
                                            fill="#94a3b8"
                                            fontWeight={700}
                                            fontFamily="system-ui"
                                            className="pointer-events-none"
                                        >
                                            +
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Vertex nodes - CLICKABLE */}
                    {(Object.entries(AXIS_CONFIG) as [AxisKey, typeof AXIS_CONFIG[AxisKey]][]).map(([key, cfg]) => {
                        const nodes = axesNodes[key] || [];
                        const hasNodes = nodes.length > 0;
                        const isActive = activeVertex === key;

                        return (
                            <g
                                key={key}
                                className="cursor-pointer"
                                onClick={(e) => handleVertexClick(key, e)}
                                role="button"
                                tabIndex={0}
                            >
                                {/* Node background */}
                                <rect
                                    x={cfg.cx - 55}
                                    y={cfg.cy - 20}
                                    width={110}
                                    height={40}
                                    rx={12}
                                    fill={hasNodes ? '#0f172a' : '#1e293b'}
                                    stroke={isActive ? '#06b6d4' : cfg.color}
                                    strokeWidth={isActive ? 2 : hasNodes ? 1.5 : 0.5}
                                    strokeOpacity={isActive ? 1 : hasNodes ? 0.8 : 0.3}
                                    className="transition-all"
                                />

                                {/* Icon */}
                                <foreignObject x={cfg.cx - 50} y={cfg.cy - 14} width={16} height={16}>
                                    <cfg.icon
                                        style={{ color: cfg.color, width: 12, height: 12 }}
                                    />
                                </foreignObject>

                                {/* Axis label */}
                                <text
                                    x={cfg.cx + 2}
                                    y={cfg.cy - 5}
                                    textAnchor="middle"
                                    fontSize={8}
                                    fill={cfg.color}
                                    fontWeight={700}
                                    fontFamily="system-ui"
                                    letterSpacing={0.5}
                                >
                                    {cfg.label.toUpperCase()}
                                </text>

                                {/* Node values */}
                                <text
                                    x={cfg.cx + 2}
                                    y={cfg.cy + 10}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fill={hasNodes ? '#e2e8f0' : '#475569'}
                                    fontWeight={500}
                                    fontFamily="system-ui"
                                    fontStyle={hasNodes ? 'normal' : 'italic'}
                                >
                                    {hasNodes
                                        ? (nodes.length === 1
                                            ? (nodes[0].label.length > 14 ? nodes[0].label.slice(0, 14) + '…' : nodes[0].label)
                                            : `${nodes.length} objets`)
                                        : 'Cliquer pour ajouter'
                                    }
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* POPOVER (EDGE or VERTEX) */}
            {isPopoverOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popoverRef}
                    className="fixed z-[99999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-2xl p-4 w-80 max-h-[400px] overflow-y-auto"
                    style={{
                        left: Math.min(popoverPos.x - 160, window.innerWidth - 340),
                        top: Math.min(popoverPos.y + 10, window.innerHeight - 420),
                    }}
                >
                    {/* ===== EDGE POPOVER ===== */}
                    {popoverMode === 'edge' && activeEdge && (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-cyan-500" />
                                    {activeEdge.label}
                                </h4>
                                <button onClick={closePopover} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                        Source ({AXIS_CONFIG[activeEdge.from].label})
                                    </label>
                                    {(axesNodes[activeEdge.from] || []).length === 1 ? (
                                        <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-800 dark:text-white border border-gray-200 dark:border-slate-600">
                                            {axesNodes[activeEdge.from][0].label}
                                        </div>
                                    ) : (
                                        <select
                                            value={draftSource}
                                            onChange={(e) => setDraftSource(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white"
                                        >
                                            <option value="">Sélectionner...</option>
                                            {(axesNodes[activeEdge.from] || []).map(n => (
                                                <option key={n.id} value={n.id}>{n.label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                        Type de relation
                                    </label>
                                    <select
                                        value={draftType}
                                        onChange={(e) => setDraftType(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white"
                                    >
                                        {RELATIONSHIP_TYPES.map(rt => (
                                            <option key={rt.value} value={rt.value}>{rt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                                        Cible ({AXIS_CONFIG[activeEdge.to].label})
                                    </label>
                                    {(axesNodes[activeEdge.to] || []).length === 1 ? (
                                        <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700 rounded-lg text-sm text-gray-800 dark:text-white border border-gray-200 dark:border-slate-600">
                                            {axesNodes[activeEdge.to][0].label}
                                        </div>
                                    ) : (
                                        <select
                                            value={draftTarget}
                                            onChange={(e) => setDraftTarget(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white"
                                        >
                                            <option value="">Sélectionner...</option>
                                            {(axesNodes[activeEdge.to] || []).map(n => (
                                                <option key={n.id} value={n.id}>{n.label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                                <button
                                    onClick={handleSubmitRelation}
                                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4" /> Ajouter la relation
                                </button>
                            </div>
                        </>
                    )}

                    {/* ===== VERTEX POPOVER ===== */}
                    {popoverMode === 'vertex' && activeVertex && (() => {
                        const cfg = AXIS_CONFIG[activeVertex];
                        const currentNodes = axesNodes[activeVertex] || [];
                        const options = getVertexOptions(activeVertex);
                        const filtered = vertexSearch
                            ? options.filter(o => o.label.toLowerCase().includes(vertexSearch.toLowerCase()))
                            : options;

                        return (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <cfg.icon className="w-4 h-4" style={{ color: cfg.color }} />
                                        {cfg.label}
                                    </h4>
                                    <button onClick={closePopover} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Current nodes for this axis */}
                                {currentNodes.length > 0 && (
                                    <div className="mb-3 space-y-1.5">
                                        <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                                            Éléments actuels ({currentNodes.length})
                                        </span>
                                        {currentNodes.map(node => (
                                            <div key={node.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{node.label}</span>
                                                    <span className="text-[10px] text-gray-500 dark:text-slate-400">
                                                        {STIX_TYPE_META[node.sdoType]?.label || node.sdoType}
                                                        {node.mode === 'new' && <span className="text-cyan-500 ml-1">(Nouveau)</span>}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveNode(activeVertex, node.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition flex-shrink-0"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add from existing or create new */}
                                <div className="space-y-2">
                                    {/* Toggle */}
                                    <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg">
                                        <button
                                            onClick={() => { setVertexMode('existing'); setError(''); }}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition ${vertexMode === 'existing' ? 'bg-white dark:bg-slate-600 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                                        >
                                            Utiliser un existant
                                        </button>
                                        <button
                                            onClick={() => { setVertexMode('new'); setError(''); }}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition ${vertexMode === 'new' ? 'bg-white dark:bg-slate-600 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
                                        >
                                            Créer un nouveau
                                        </button>
                                    </div>

                                    {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                                    {/* Existing mode */}
                                    {vertexMode === 'existing' && (
                                        <>
                                            <input
                                                type="text"
                                                value={vertexSearch}
                                                onChange={(e) => setVertexSearch(e.target.value)}
                                                placeholder="Rechercher..."
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-slate-400"
                                                autoFocus
                                            />
                                            <div className="max-h-[150px] overflow-y-auto space-y-0.5">
                                                {filtered.length === 0 ? (
                                                    <p className="text-xs text-gray-500 dark:text-slate-400 italic text-center py-2">
                                                        {vertexSearch ? 'Aucun résultat.' : 'Aucun objet disponible.'}
                                                    </p>
                                                ) : (
                                                    filtered.slice(0, 30).map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => handleVertexAddExisting(opt.id)}
                                                            className="w-full text-left px-3 py-2 text-xs text-gray-800 dark:text-gray-200 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition flex items-center gap-2"
                                                        >
                                                            <Plus className="w-3 h-3 text-cyan-500 flex-shrink-0" />
                                                            <span className="truncate">{opt.label}</span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* New mode */}
                                    {vertexMode === 'new' && (() => {
                                        const config = axisTypes[activeVertex];
                                        const availableTypes = (config?.types || []).filter(t => t !== 'attack-pattern');
                                        return (
                                            <div className="space-y-3">
                                                {availableTypes.length > 1 && (
                                                    <div>
                                                        <label className="block text-[10px] font-medium text-gray-600 dark:text-slate-400 mb-1">Type STIX</label>
                                                        <select
                                                            value={newObjType}
                                                            onChange={(e) => setNewObjType(e.target.value as StixSDOType)}
                                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white"
                                                        >
                                                            {availableTypes.map(t => (
                                                                <option key={t} value={t}>{STIX_TYPE_META[t as StixSDOType]?.label || t}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-600 dark:text-slate-400 mb-1">Nom *</label>
                                                    <input
                                                        type="text"
                                                        value={newObjName}
                                                        onChange={(e) => setNewObjName(e.target.value)}
                                                        placeholder="ex: Serveur Web"
                                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-slate-400"
                                                        autoFocus
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-600 dark:text-slate-400 mb-1">Description (optionnel)</label>
                                                    <textarea
                                                        value={newObjDesc}
                                                        onChange={(e) => setNewObjDesc(e.target.value)}
                                                        rows={2}
                                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white resize-none"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (!newObjName.trim()) {
                                                            setError('Le nom est requis.');
                                                            return;
                                                        }
                                                        const newId = generateStixId(newObjType);
                                                        onAddNode(activeVertex, {
                                                            mode: 'new',
                                                            id: newId,
                                                            label: newObjName.trim(),
                                                            sdoType: newObjType,
                                                            newData: { sdoType: newObjType, name: newObjName.trim(), description: newObjDesc }
                                                        });
                                                        setNewObjName('');
                                                        setNewObjDesc('');
                                                        setError('');
                                                    }}
                                                    disabled={!newObjName.trim()}
                                                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Créer et Ajouter
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </>
                        );
                    })()}
                </div>,
                document.body
            )}

            {/* Relations list */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Relations ({relations.length})
                </h4>
                {relations.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-slate-500 italic text-center py-3 bg-gray-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-gray-200 dark:border-slate-700">
                        Cliquez sur un bouton "+" entre deux sommets du diamant pour créer une relation.
                    </p>
                ) : (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {relations.map(rel => {
                            const rtLabel = RELATIONSHIP_TYPES.find(r => r.value === rel.type)?.label || rel.type;
                            const isEditing = editingRelId === rel.id;
                            return (
                                <li key={rel.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg">
                                    <div className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 min-w-0">
                                        <span className="font-semibold truncate max-w-[100px]">{getNodeLabel(rel.sourceId)}</span>
                                        {isEditing ? (
                                            <select
                                                autoFocus
                                                value={rel.type}
                                                onChange={(e) => {
                                                    onUpdateRelationType(rel.id, e.target.value);
                                                    setEditingRelId(null);
                                                }}
                                                onBlur={() => setEditingRelId(null)}
                                                className="px-1.5 py-0.5 text-xs bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-300 dark:border-cyan-700 rounded text-cyan-700 dark:text-cyan-300 font-medium focus:ring-1 focus:ring-cyan-500 outline-none"
                                            >
                                                {RELATIONSHIP_TYPES.map(rt => (
                                                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/20 font-medium flex-shrink-0">{rtLabel}</span>
                                        )}
                                        <span className="font-semibold truncate max-w-[100px]">{getNodeLabel(rel.targetId)}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        <button
                                            onClick={() => setEditingRelId(isEditing ? null : rel.id)}
                                            className="p-1 text-gray-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded transition"
                                            title="Modifier le type"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => onRemoveRelation(rel.id)}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
