/**
 * DiamondVisualizer — Visualisation du Diamant d'intrusion STIX 2.1.
 *
 * Uses @xyflow/react v12 to render the Diamond Model with STIX objects:
 *   - Adversary    (top)    — threat-actor
 *   - Infrastructure (right) — infrastructure
 *   - Capability   (left)   — malware, tool, attack-pattern
 *   - Victim       (bottom) — identity, observed-data
 *   - Indicator    (center) — indicator
 *
 * Edges represent STIX Relationships (SROs).
 */
import React, { useMemo, useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    type Node,
    type Edge,
    type NodeTypes,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { StixSDO, Relationship } from '../../lib/stix.types';
import { STIX_TYPE_META } from '../../lib/stix.types';

// ─── Custom Node Component ──────────────────────────────────────

interface StixNodeData {
    label: string;
    stixType: string;
    description?: string;
    [key: string]: unknown;
}

function StixNode({ data }: { data: StixNodeData }) {
    const meta = STIX_TYPE_META[data.stixType as keyof typeof STIX_TYPE_META];
    const bgColor = meta?.color || '#6b7280';

    return (
        <div
            className="px-4 py-3 rounded-xl shadow-lg border-2 min-w-[160px] text-center transition-all hover:scale-105"
            style={{
                backgroundColor: `${bgColor}15`,
                borderColor: bgColor,
                color: bgColor,
            }}
        >
            <div className="text-lg mb-1">{meta?.icon || '📦'}</div>
            <div className="font-bold text-sm truncate max-w-[180px]">{data.label}</div>
            <div className="text-[10px] uppercase tracking-wider opacity-70 mt-1">
                {meta?.label || data.stixType}
            </div>
            {data.description && (
                <div className="text-[10px] opacity-50 mt-1 truncate max-w-[180px]">
                    {data.description}
                </div>
            )}
        </div>
    );
}

const nodeTypes: NodeTypes = {
    stixNode: StixNode as any,
};

// ─── Diamond Quadrant Mapping ───────────────────────────────────

/**
 * Maps STIX types to Diamond Model quadrants:
 * - Adversary    (top)    : threat-actor
 * - Infrastructure (right): infrastructure
 * - Capability   (left)   : malware, tool, attack-pattern
 * - Victim       (bottom) : identity, observed-data
 * - Indicator    (center) : indicator
 */
function getDiamondQuadrant(type: string): string {
    switch (type) {
        case 'threat-actor':
            return 'adversary';
        case 'infrastructure':
            return 'infrastructure';
        case 'malware':
        case 'tool':
        case 'attack-pattern':
            return 'capability';
        case 'identity':
        case 'observed-data':
            return 'victim';
        case 'indicator':
            return 'center';
        default:
            return 'center';
    }
}

const QUADRANT_POSITIONS: Record<string, { x: number; y: number }> = {
    adversary:      { x: 300, y: 0 },     // Top
    infrastructure: { x: 600, y: 200 },   // Right
    capability:     { x: 0, y: 200 },     // Left
    victim:         { x: 300, y: 400 },   // Bottom
    center:         { x: 300, y: 200 },   // Center
};

function getPosition(type: string, index: number, countByQuadrant: Record<string, number>): { x: number; y: number } {
    const quadrant = getDiamondQuadrant(type);
    const base = QUADRANT_POSITIONS[quadrant] || { x: 300, y: 200 };
    const count = countByQuadrant[quadrant] || 1;

    if (count <= 1) return base;

    // Spread multiple objects in the same quadrant
    const offset = 200;
    const angle = ((index / count) * 2 * Math.PI) - Math.PI / 2;
    return {
        x: base.x + Math.cos(angle) * offset * 0.4,
        y: base.y + Math.sin(angle) * offset * 0.4,
    };
}

// ─── Component Props ────────────────────────────────────────────

interface DiamondVisualizerProps {
    objects: StixSDO[];
    relationships: Relationship[];
    onObjectClick?: (obj: StixSDO) => void;
}

// ─── Main Component ─────────────────────────────────────────────

const DiamondVisualizer: React.FC<DiamondVisualizerProps> = ({
    objects,
    relationships,
    onObjectClick,
}) => {
    const { initialNodes, initialEdges } = useMemo(() => {
        // Count objects by quadrant for layout spreading
        const countByQuadrant: Record<string, number> = {};
        const indexByQuadrant: Record<string, number> = {};
        objects.forEach((obj) => {
            const q = getDiamondQuadrant(obj.type);
            countByQuadrant[q] = (countByQuadrant[q] || 0) + 1;
        });

        const nodes: Node[] = objects.map((obj) => {
            const q = getDiamondQuadrant(obj.type);
            const qIndex = indexByQuadrant[q] || 0;
            indexByQuadrant[q] = qIndex + 1;
            const position = getPosition(obj.type, qIndex, countByQuadrant);

            // Get a display name — observed-data doesn't have .name
            const displayName = 'name' in obj && obj.name
                ? obj.name
                : (obj as any).x_oris_description || obj.id.split('--')[1]?.substring(0, 8) || obj.type;

            return {
                id: obj.id,
                type: 'stixNode',
                position,
                data: {
                    label: displayName,
                    stixType: obj.type,
                    description: 'description' in obj ? obj.description : undefined,
                } as StixNodeData,
            };
        });

        const edges: Edge[] = relationships.map((rel) => {
            return {
                id: rel.id,
                source: rel.source_ref,
                target: rel.target_ref,
                label: rel.relationship_type,
                animated: true,
                style: { stroke: '#64748b', strokeWidth: 2 },
                labelStyle: {
                    fontSize: 11,
                    fontWeight: 600,
                    fill: '#475569',
                },
                labelBgStyle: {
                    fill: '#f8fafc',
                    fillOpacity: 0.9,
                },
                labelBgPadding: [6, 4] as [number, number],
                labelBgBorderRadius: 4,
            };
        });

        return { initialNodes: nodes, initialEdges: edges };
    }, [objects, relationships]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update when props change
    React.useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    const onNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            if (onObjectClick) {
                const obj = objects.find((o) => o.id === node.id);
                if (obj) onObjectClick(obj);
            }
        },
        [objects, onObjectClick],
    );

    if (objects.length === 0) {
        return (
            <div className="h-[500px] w-full border-2 border-dashed border-gray-600 rounded-xl bg-gray-800/50 flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <div className="text-4xl mb-3">💎</div>
                    <p className="text-sm font-medium">Aucun objet STIX</p>
                    <p className="text-xs opacity-70 mt-1">
                        Ajoutez des objets STIX pour visualiser le Modèle Diamant
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mt-3 text-[10px]">
                        <span className="px-2 py-1 bg-red-900/20 text-red-400 rounded">👤 Adversaire ↑</span>
                        <span className="px-2 py-1 bg-blue-900/20 text-blue-400 rounded">🖥️ Infrastructure →</span>
                        <span className="px-2 py-1 bg-purple-900/20 text-purple-400 rounded">🦠 Capacité ←</span>
                        <span className="px-2 py-1 bg-green-900/20 text-green-400 rounded">🏢 Victime ↓</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[500px] w-full border border-gray-700 rounded-xl bg-gray-900/50 overflow-hidden relative">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 bg-gray-800/80 px-2 py-1 rounded-md backdrop-blur-sm">
                    💎 Modèle Diamant STIX 2.1
                </span>
            </div>

            {/* Quadrant labels */}
            <div className="absolute top-3 right-3 z-10 text-[10px] text-gray-500 space-y-0.5 text-right">
                <div>↑ Adversaire</div>
                <div>← Capacité &nbsp; Infrastructure →</div>
                <div>↓ Victime</div>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#374151" gap={20} />
                <Controls
                    className="!bg-gray-800 !border-gray-700 !rounded-lg !shadow-lg"
                    showInteractive={false}
                />
                <MiniMap
                    nodeColor={(node) => {
                        const meta = STIX_TYPE_META[(node.data as StixNodeData)?.stixType as keyof typeof STIX_TYPE_META];
                        return meta?.color || '#6b7280';
                    }}
                    className="!bg-gray-800 !border-gray-700 !rounded-lg"
                    maskColor="rgba(0, 0, 0, 0.5)"
                />
            </ReactFlow>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
                {Object.entries(STIX_TYPE_META).map(([type, meta]) => (
                    <span
                        key={type}
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{
                            backgroundColor: `${meta.color}20`,
                            color: meta.color,
                            border: `1px solid ${meta.color}40`,
                        }}
                    >
                        {meta.icon} {meta.label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default DiamondVisualizer;
