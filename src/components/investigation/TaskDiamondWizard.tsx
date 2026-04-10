import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, Check, AlertCircle, Calendar, Zap, Link as LinkIcon, ChevronDown } from 'lucide-react';
import type { StixSDO, StixSDOType } from '../../lib/stix.types';
import { generateStixId, nowIso } from '../../lib/stixApi';
import { Tooltip } from '../common/Tooltip';
import { getKillChainPhases } from '../../lib/killChainDefinitions';
import { api } from '../../lib/api';
import { OffCanvas } from '../common/OffCanvas';
import { DiamondRelationsEditor } from './DiamondRelationsEditor';

interface TaskDiamondWizardProps {
    taskId?: string;
    caseId: string;
    caseKillChainType: string;
    existingObjects: StixSDO[];
    editingDiamond?: any;
    onSuccess: () => void;
    onClose: () => void;
}

type StepKey = 'event' | 'relations';


export interface SelectedNode {
    mode: 'existing' | 'new';
    id: string; // STIX ID (existing or newly generated)
    label: string; // Display name
    sdoType: StixSDOType;
    newData?: any; // If 'new', the form data needed to POST it
}

export interface ManualRelation {
    id: string; // Local ID for the list
    sourceId: string;
    targetId: string;
    type: string;
}

const STEPS: { key: StepKey; label: string; icon: any; types: string[]; defaultType: StixSDOType | 'relationship'; color: string; desc: string }[] = [
    { key: 'event', label: 'Événement', icon: Zap, types: [], defaultType: 'observed-data', color: 'text-cyan-500', desc: "L'événement central décrit l'action malveillante spécifique (ex: Exfiltration, Chiffrement, Phishing) au moment où elle s'est produite." },
    { key: 'relations', label: 'Diamant', icon: LinkIcon, types: [], defaultType: 'relationship', color: 'text-amber-500', desc: "Gérez les sommets du Modèle Diamant et les relations STIX entre les objets en cliquant directement sur le graphe interactif." },
];

const SearchableSelect = ({ value, onChange, options, placeholder = "Sélectionner..." }: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
}) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const ref = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [rect, setRect] = React.useState<React.CSSProperties>({});
    
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const tgt = event.target as Node;
            if (ref.current && !ref.current.contains(tgt) && (!dropdownRef.current || !dropdownRef.current.contains(tgt))) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Ensure the modal scroll container is styled properly, and set portal placement
    React.useEffect(() => {
        if (open && ref.current) {
            const r = ref.current.getBoundingClientRect();
            setRect({ top: r.bottom + 4, left: r.left, width: r.width });
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [open]);

    // Recalculate on window resize or modal scroll
    React.useEffect(() => {
        if (!open) return;
        const updatePos = () => {
             if (ref.current) {
                 const r = ref.current.getBoundingClientRect();
                 setRect({ top: r.bottom + 4, left: r.left, width: r.width });
             }
        };
        window.addEventListener('resize', updatePos);
        window.addEventListener('scroll', updatePos, true); // true to capture scroll on inner elements
        return () => {
            window.removeEventListener('resize', updatePos);
            window.removeEventListener('scroll', updatePos, true);
        };
    }, [open]);

    const selectedOption = options.find(o => o.value === value);
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    const dropdown = (
        <div ref={dropdownRef} style={{ ...rect, zIndex: 99999 }} className="fixed bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl overflow-hidden">
            <div className="p-1.5 border-b border-gray-100 dark:border-slate-700">
                <input
                    type="text"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-400"
                />
            </div>
            <div className="max-h-48 overflow-y-auto overflow-x-hidden">
                {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500 italic text-center">Aucun résultat</div>
                ) : (
                    filtered.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/30 truncate ${value === opt.value ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300 font-medium' : 'text-gray-700 dark:text-slate-300'}`}
                        >
                            {opt.label}
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div ref={ref} className="w-full">
            <div 
                onClick={() => { setOpen(!open); setSearch(''); }}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 cursor-pointer flex justify-between items-center"
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </div>
            {open && typeof document !== 'undefined' && createPortal(dropdown, document.body)}
        </div>
    );
};

export const TaskDiamondWizard: React.FC<TaskDiamondWizardProps> = ({
    taskId,
    caseId,
    caseKillChainType,
    existingObjects,
    editingDiamond,
    onSuccess,
    onClose,
}) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warningModalConfig, setWarningModalConfig] = useState<{ action: 'close' | 'save', items: string[] } | null>(null);

    // Event specific state
    const [eventDate, setEventDate] = useState(() => {
        if (editingDiamond && editingDiamond.first_observed) {
            const dt = new Date(editingDiamond.first_observed);
            return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        return '';
    });
    const [eventKillChain, setEventKillChain] = useState(() => editingDiamond?.x_oris_kill_chain || '');
    const [eventDescription, setEventDescription] = useState(() => editingDiamond?.x_oris_description || editingDiamond?.name || '');

    // State for selected nodes on axes
    const [axesNodes, setAxesNodes] = useState<Record<string, SelectedNode[]>>(() => {
        const defaultNodes: Record<string, SelectedNode[]> = {
            adversary: [],
            capability: [],
            infrastructure: [],
            victim: []
        };
        if (editingDiamond) {
            const axes = editingDiamond.x_oris_diamond_axes || editingDiamond._axes || {};
            const keys = ['adversary', 'capability', 'infrastructure', 'victim'];
            keys.forEach(k => {
                const vals = axes[k] || [];
                vals.forEach((val: any) => {
                    const id = typeof val === 'string' ? val : (val.id || '');
                    if (id && id.includes('--')) {
                        const existingObj = existingObjects.find(o => o && o.id === id);
                        let label = id;
                        let sdoType = id.split('--')[0] as StixSDOType;
                        if (existingObj) {
                           label = ('name' in existingObj) ? (existingObj as any).name : ('value' in existingObj) ? (existingObj as any).value : existingObj.type;
                           if (existingObj.type === 'attack-pattern' && (existingObj as any).external_references) {
                               const extRef = (existingObj as any).external_references.find((r: any) => r.source_name === 'mitre-attack');
                               if (extRef && extRef.external_id) {
                                   label = `${extRef.external_id} - ${label}`;
                               }
                           }
                           sdoType = existingObj.type;
                        } else if (typeof val !== 'string' && val.label) {
                           label = val.label;
                        }
                        defaultNodes[k].push({
                            mode: 'existing',
                            id,
                            label,
                            sdoType
                        });
                    }
                });
            });
        }
        return defaultNodes;
    });


    
    // Mitre Patterns
    const [mitrePatterns, setMitrePatterns] = useState<{ id: string; name: string; mitre_id: string }[]>([]);
    React.useEffect(() => {
        api.get('/kb/mitre/attack-patterns').then(res => setMitrePatterns(res || [])).catch(() => {});
    }, []);

    // State for manual relations
    const [initialRelationIds] = useState<Set<string>>(() => {
        if (!editingDiamond || !existingObjects) return new Set();
        if (editingDiamond.x_oris_diamond_relations) {
            return new Set(editingDiamond.x_oris_diamond_relations);
        }
        
        const nodeIds = new Set<string>();
        const axes = editingDiamond.x_oris_diamond_axes || editingDiamond._axes || {};
        ['adversary', 'capability', 'infrastructure', 'victim'].forEach(k => {
             (axes[k] || []).forEach((val: any) => {
                 const id = typeof val === 'string' ? val : val.id;
                 if (id) nodeIds.add(id);
             });
        });
        
        const existingRels = existingObjects.filter(obj => {
            const o = obj as any;
            return o && o.type === 'relationship' && 
            nodeIds.has(o.source_ref) && 
            nodeIds.has(o.target_ref);
        });
        
        return new Set(existingRels.map((r: any) => r.id));
    });

    const [relations, setRelations] = useState<ManualRelation[]>(() => {
        if (!editingDiamond || !existingObjects) return [];
        let existingRels: any[] = [];
        if (Array.isArray(editingDiamond.x_oris_diamond_relations)) {
            existingRels = existingObjects.filter(obj => {
                const o = obj as any;
                return o && o.type === 'relationship' && editingDiamond.x_oris_diamond_relations.includes(o.id);
            });
        } else if (editingDiamond.x_oris_diamond_axes) {
            existingRels = [];
        } else {
            const nodeIds = new Set<string>();
            const axes = editingDiamond.x_oris_diamond_axes || editingDiamond._axes || {};
            ['adversary', 'capability', 'infrastructure', 'victim'].forEach(k => {
                 (axes[k] || []).forEach((val: any) => {
                     const id = typeof val === 'string' ? val : val.id;
                     if (id) nodeIds.add(id);
                 });
            });
            
            existingRels = existingObjects.filter(obj => {
                const o = obj as any;
                return o && o.type === 'relationship' && 
                nodeIds.has(o.source_ref) && 
                nodeIds.has(o.target_ref);
            });
        }
        
        return existingRels.map(rel => {
            const r = rel as any;
            return {
                id: r.id,
                sourceId: r.source_ref,
                targetId: r.target_ref,
                type: r.relationship_type
            };
        });
    });
    const [draftRelSource, setDraftRelSource] = useState('');
    const [draftRelTarget, setDraftRelTarget] = useState('');
    const [draftRelType, setDraftRelType] = useState('uses');

    const isSummary = stepIndex === STEPS.length;
    const currentStep = !isSummary ? STEPS[stepIndex] : null;
    const phases = getKillChainPhases(caseKillChainType);



    const handleRemoveNode = React.useCallback((stepKey: string, id: string) => {
        setAxesNodes(prev => ({
            ...prev,
            [stepKey]: prev[stepKey].filter(n => n.id !== id)
        }));
        // Remove relationships involving this id
        setRelations(prev => prev.filter(r => r.sourceId !== id && r.targetId !== id));
    }, []);

    const handleAddRelation = React.useCallback((sourceId?: string, targetId?: string, relType?: string): boolean => {
        setError(null);
        const src = sourceId || draftRelSource;
        const tgt = targetId || draftRelTarget;
        const rt = relType || draftRelType;
        if (!src || !tgt || !rt) {
            setError('Veuillez remplir tous les champs de la relation.');
            return false;
        }
        if (src === tgt) {
            setError('La source et la cible doivent être différentes.');
            return false;
        }
        // Avoid duplicate
        // Use a functional state update to ensure the latest relations are seen safely
        let isDuplicate = false;
        setRelations(prev => {
            if (prev.some(r => r.sourceId === src && r.targetId === tgt && r.type === rt)) {
                isDuplicate = true;
                return prev;
            }
            return [...prev, { id: generateStixId('relationship'), sourceId: src, targetId: tgt, type: rt }];
        });
        if (isDuplicate) {
            setError('Cette relation existe déjà.');
            return false;
        }
        setDraftRelSource('');
        setDraftRelTarget('');
        setDraftRelType('uses');
        return true;
    }, [draftRelSource, draftRelTarget, draftRelType]);

    const handleRemoveRelation = React.useCallback((id: string) => {
        setRelations(prev => prev.filter(r => r.id !== id));
    }, []);

    const handleUpdateRelationType = React.useCallback((id: string, newType: string) => {
        setRelations(prev => prev.map(r => r.id === id ? { ...r, type: newType } : r));
    }, []);

    const handleAddNodeAxis = React.useCallback((axisKey: string, node: SelectedNode) => {
        setAxesNodes(prev => ({
            ...prev,
            [axisKey]: [...prev[axisKey], node]
        }));
    }, []);

    const validateStep = (): boolean => {
        if (!currentStep) return true;
        
        if (currentStep.key === 'event') {
            if (!eventDate) { setError('La date et l\'heure sont requises.'); return false; }
            if (!eventKillChain) { setError('La phase de Kill Chain est requise.'); return false; }
            if (!eventDescription.trim()) { setError('La description de l\'événement est requise.'); return false; }
            return true;
        }

        return true; // Other steps (nodes lists & relations) don't have mandatory blocks, they can be empty
    };

    const handleNext = () => {
        setError(null);
        if (validateStep()) {
            if (currentStep && currentStep.key === 'event') {
                // Auto-generate relations between adversary and capability before entering diamond step
                const newRels: ManualRelation[] = [];
                axesNodes.adversary.forEach(adv => {
                    axesNodes.capability.forEach(cap => {
                        const exists = relations.some(r => 
                            (r.sourceId === adv.id && r.targetId === cap.id) || 
                            (r.sourceId === cap.id && r.targetId === adv.id)
                        );
                        if (!exists) {
                            newRels.push({
                                id: generateStixId('relationship'),
                                sourceId: adv.id,
                                targetId: cap.id,
                                type: 'uses'
                            });
                        }
                    });
                });
                if (newRels.length > 0) {
                    setRelations(prev => [...prev, ...newRels]);
                }
            }
            setStepIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        setError(null);
        setStepIndex(prev => Math.max(0, prev - 1));
    };

    const processSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Create SDOs for new diamond nodes
            const now = nowIso();
            const allNodes = ['capability', 'infrastructure', 'victim'].flatMap(k => axesNodes[k]);
            
            for (const node of allNodes) {
                if (node.mode === 'new' && node.newData) {
                    const data = node.newData;
                    const baseStix: any = {
                        case_id: caseId,
                        type: data.sdoType,
                        id: node.id,
                        spec_version: '2.1',
                        created: now,
                        modified: now,
                        name: data.name.trim(),
                        description: data.description.trim() || undefined,
                        object_marking_refs: data.tlp ? [data.tlp] : undefined,
                        x_oris_task_id: taskId,
                    };

                    if (data.sdoType === 'threat-actor') baseStix.sophistication = data.sophistication || undefined;
                    if (data.sdoType === 'malware' || data.sdoType === 'tool') {
                        if (data.sdoType === 'malware') baseStix.is_family = data.isFamily;
                        if (data.hashes && data.hashes.length > 0) {
                            const hashDict: Record<string, string> = {};
                            data.hashes.forEach((h: any) => {
                                if (h.value.trim()) hashDict[h.type === 'Autre' ? 'UNKNOWN' : h.type] = h.value.trim();
                            });
                            if (Object.keys(hashDict).length > 0) {
                                baseStix.x_oris_hashes = hashDict;
                            }
                        }
                    }
                    if (data.sdoType === 'infrastructure') baseStix.infrastructure_types = data.infraTypes ? [data.infraTypes] : undefined;
                    if (data.sdoType === 'identity') baseStix.identity_class = data.identityClass || undefined;

                    await api.post('/stix/objects', baseStix);
                }
            }

            // 2. Create the Timeline Event (Task Diamond)
            const eventId = editingDiamond ? editingDiamond.id : generateStixId('observed-data');
            const isoDatetime = new Date(eventDate).toISOString();
            
            const diamondAxes: any = {
                adversary: axesNodes.adversary.map(n => n.id),
                capability: axesNodes.capability.map(n => n.id),
                infrastructure: axesNodes.infrastructure.map(n => n.id),
                victim: axesNodes.victim.map(n => n.id)
            };
            const hasAxes = Object.values(diamondAxes).some((arr: any) => arr.length > 0);

            const finalRelationIds = new Set<string>(relations.map(r => r.id));

            if (editingDiamond) {
                await api.put(`/stix/objects/${editingDiamond.id}`, {
                    ...editingDiamond,
                    type: 'observed-data',
                    spec_version: '2.1',
                    first_observed: isoDatetime,
                    last_observed: isoDatetime,
                    x_oris_kill_chain: eventKillChain,
                    x_oris_description: eventDescription.trim(),
                    name: eventDescription.trim(),
                    x_oris_diamond_axes: hasAxes ? diamondAxes : {},
                    x_oris_diamond_relations: Array.from(finalRelationIds),
                });
            } else {
                await api.post('/stix/objects', {
                    case_id: caseId,
                    type: 'observed-data',
                    id: eventId,
                    spec_version: '2.1',
                    first_observed: isoDatetime,
                    last_observed: isoDatetime,
                    number_observed: 1,
                    x_oris_kill_chain: eventKillChain,
                    x_oris_description: eventDescription.trim(),
                    name: eventDescription.trim(),
                    x_oris_task_id: taskId,
                    created: now,
                    ...(hasAxes ? { x_oris_diamond_axes: diamondAxes } : {}),
                    x_oris_diamond_relations: Array.from(finalRelationIds),
                });
            }

            // 3. Create manual relationships
            for (const rel of relations) {
                finalRelationIds.add(rel.id);
                const relObj = {
                    case_id: caseId,
                    type: 'relationship',
                    id: rel.id,
                    created: now,
                    modified: now,
                    relationship_type: rel.type,
                    source_ref: rel.sourceId,
                    target_ref: rel.targetId,
                };
                await api.post('/stix/relationships', relObj);
            }

            // 4. Delete removed relationships
            for (const initialId of Array.from(initialRelationIds)) {
                if (!finalRelationIds.has(initialId)) {
                    await api.delete(`/stix/relationships/${initialId}`).catch(() => {});
                }
            }

            onSuccess();
        } catch (err: any) {
            setError(err?.message || 'Erreur lors de la sauvegarde du diamant.');
            setLoading(false);
        }
    };

    const getDiamondMissing = (): string[] => {
        const missing: string[] = [];
        const requiredAxes = [
            { key: 'capability', label: 'Capacité' },
            { key: 'infrastructure', label: 'Infrastructure' },
            { key: 'victim', label: 'Victime' },
        ];
        for (const { key, label } of requiredAxes) {
            if (!axesNodes[key] || axesNodes[key].length === 0) {
                missing.push(`Sommet "${label}" vide`);
            }
        }
        const requiredEdges: { from: string; to: string; label: string }[] = [
            { from: 'capability', to: 'infrastructure', label: 'Capacité ↔ Infrastructure' },
            { from: 'capability', to: 'victim', label: 'Capacité ↔ Victime' },
            { from: 'infrastructure', to: 'victim', label: 'Infrastructure ↔ Victime' },
        ];
        if (axesNodes.adversary && axesNodes.adversary.length > 0) {
            requiredEdges.push(
                { from: 'adversary', to: 'capability', label: 'Adversaire ↔ Capacité' },
                { from: 'adversary', to: 'infrastructure', label: 'Adversaire ↔ Infrastructure' },
                { from: 'adversary', to: 'victim', label: 'Adversaire ↔ Victime' }
            );
        }
        for (const edge of requiredEdges) {
            const fromIds = new Set((axesNodes[edge.from] || []).map(n => n.id));
            const toIds = new Set((axesNodes[edge.to] || []).map(n => n.id));
            const hasRelation = relations.some(r =>
                (fromIds.has(r.sourceId) && toIds.has(r.targetId)) ||
                (toIds.has(r.sourceId) && fromIds.has(r.targetId))
            );
            if (!hasRelation) {
                missing.push(`Lien "${edge.label}" manquant`);
            }
        }
        return missing;
    };

    const handleClose = () => {
        const missing = getDiamondMissing();
        if (missing.length > 0) {
            setWarningModalConfig({ action: 'close', items: missing });
        } else {
            onClose();
        }
    };

    const handleSubmit = () => {
        const missing = getDiamondMissing();
        if (missing.length > 0) {
            setWarningModalConfig({ action: 'save', items: missing });
        } else {
            processSubmit();
        }
    };

    return (
        <>
        <OffCanvas
            isOpen={true}
            onClose={handleClose}
            title={editingDiamond ? 'Modifier le Diamant' : 'Ajouter un Diamant'}
            width="lg"
        >
            <div className="flex flex-col h-full">
                <div className="flex-1 p-6 pb-20 bg-white dark:bg-slate-900">
                    <div className="max-w-full">
                        {/* Progress Tracker */}
                        <div className="flex justify-between mb-8 relative px-2">
                            <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200 dark:bg-slate-700 -z-10" />
                            {[...STEPS, { key: 'summary', label: 'Valider', icon: Check }].map((s, idx) => {
                                const isPast = idx < stepIndex;
                                const isCurrent = idx === stepIndex;
                                const Icon = s.icon;
                                let bgClass = "bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500";
                                if (isCurrent) bgClass = "bg-cyan-600 border-cyan-600 text-white ring-2 ring-cyan-100 dark:ring-cyan-900/30";
                                else if (isPast) bgClass = "bg-cyan-600 border-cyan-600 text-white";

                                return (
                                    <div key={s.key} className="flex flex-col items-center gap-1 group relative">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${bgClass}`}>
                                            <Icon className="w-3 h-3" />
                                        </div>
                                        <div className="absolute top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition whitespace-nowrap bg-gray-800 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                                            {s.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {!isSummary && currentStep && (
                            <div className="space-y-6">
                                <div className="mb-6 border-b border-gray-200 dark:border-slate-700 pb-3">
                                    <h3 className={`text-xl font-bold flex items-center gap-2 ${currentStep.color}`}>
                                        <currentStep.icon className="w-5 h-5" />
                                        {currentStep.label}
                                        {currentStep.desc && (
                                            <Tooltip content={currentStep.desc} position="right" iconSize={18} className="ml-1 text-gray-500 hover:text-gray-600 dark:hover:text-gray-200" />
                                        )}
                                    </h3>
                                </div>

                                {/* STEP 1: EVENT DETAILS */}
                                {currentStep.key === 'event' && (
                                    <div className="space-y-5 px-1">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                <Calendar className="w-4 h-4 text-cyan-500" /> Date et heure *
                                            </label>
                                            <input 
                                                type="datetime-local" 
                                                value={eventDate} 
                                                onChange={(e) => setEventDate(e.target.value)} 
                                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-white" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                <Zap className="w-4 h-4 text-cyan-500" /> Phase de Kill Chain *
                                            </label>
                                            <SearchableSelect
                                                value={eventKillChain}
                                                onChange={setEventKillChain}
                                                options={phases.filter(p => p.value !== 'unassigned').map(p => ({ value: p.value, label: p.label })).concat([{ value: 'unassigned', label: 'Non assigné' }])}
                                                placeholder="Sélectionnez une phase..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description *</label>
                                            <textarea 
                                                value={eventDescription} 
                                                onChange={(e) => setEventDescription(e.target.value)} 
                                                placeholder="Décrire l'événement observé..." 
                                                rows={4} 
                                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-white placeholder-slate-400 resize-none" 
                                            />
                                        </div>
                                    </div>
                                )}



                                {/* RELATIONS STEP */}
                                {currentStep.key === 'relations' && (
                                    <DiamondRelationsEditor
                                        axesNodes={axesNodes}
                                        relations={relations}
                                        onAddRelation={(sourceId, targetId, type) => handleAddRelation(sourceId, targetId, type)}
                                        onRemoveRelation={handleRemoveRelation}
                                        onUpdateRelationType={handleUpdateRelationType}
                                        existingObjects={existingObjects}
                                        onAddNode={handleAddNodeAxis}
                                        onRemoveNode={handleRemoveNode}
                                        axisTypes={{
                                            adversary: { types: ['threat-actor', 'intrusion-set', 'campaign'], defaultType: 'threat-actor' },
                                            capability: { types: ['malware', 'tool', 'attack-pattern'], defaultType: 'malware' },
                                            infrastructure: { types: ['infrastructure', 'ipv4-addr', 'domain-name', 'url', 'mac-addr'], defaultType: 'infrastructure' },
                                            victim: { types: ['identity', 'infrastructure', 'user-account', 'ipv4-addr', 'domain-name'], defaultType: 'identity' },
                                        }}
                                        mitrePatterns={mitrePatterns}
                                        caseId={caseId}
                                    />
                                )}

                            </div>
                        )}

                        {isSummary && (
                            <div className="space-y-6">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Check className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Validation</h3>
                                    <p className="text-gray-600 dark:text-slate-400 mt-2">Le diamant est prêt à être {editingDiamond ? "mis à jour" : "créé"}.</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500 dark:text-slate-400 block mb-1">Date:</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">{new Date(eventDate).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-slate-400 block mb-1">Phase Kill Chain:</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">{phases.find(p => p.value === eventKillChain)?.label}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4 grid grid-cols-2 gap-4 text-xs">
                                        <div><span className="text-red-500 font-semibold mb-1 block">Adversaires ({axesNodes.adversary.length})</span>
                                            {axesNodes.adversary.map(n => <div key={n.id} className="text-gray-700 dark:text-slate-300 truncate">{n.label}</div>)}
                                        </div>
                                        <div><span className="text-purple-500 font-semibold mb-1 block">Capacités ({axesNodes.capability.length})</span>
                                            {axesNodes.capability.map(n => <div key={n.id} className="text-gray-700 dark:text-slate-300 truncate">{n.label}</div>)}
                                        </div>
                                        <div><span className="text-blue-500 font-semibold mb-1 block">Infrastructures ({axesNodes.infrastructure.length})</span>
                                            {axesNodes.infrastructure.map(n => <div key={n.id} className="text-gray-700 dark:text-slate-300 truncate">{n.label}</div>)}
                                        </div>
                                        <div><span className="text-green-500 font-semibold mb-1 block">Victimes ({axesNodes.victim.length})</span>
                                            {axesNodes.victim.map(n => <div key={n.id} className="text-gray-700 dark:text-slate-300 truncate">{n.label}</div>)}
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 dark:border-slate-700 pt-4 text-xs">
                                        <span className="text-amber-500 font-semibold mb-1 block">Relations manuelles ({relations.length})</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/90 backdrop-blur-md flex justify-between shrink-0 sticky bottom-0 z-10 w-full">
                    <button
                        onClick={handlePrev}
                        disabled={stepIndex === 0 || loading}
                        className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <ChevronLeft className="w-4 h-4" /> Précédent
                    </button>

                    {isSummary ? (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                            <Check className="w-4 h-4" />
                            {loading ? 'Traitement...' : (editingDiamond ? 'Mettre à jour' : 'Créer le diamant')}
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            disabled={loading || (currentStep?.key === 'event' && (!eventDate || !eventKillChain || !eventDescription.trim()))}
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                        >
                            Suivant <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </OffCanvas>

        {/* Close/Save warning modal */}
        {warningModalConfig && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                    <div className="p-5 border-b border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Diamant incomplet</h3>
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Des éléments manquent pour considérer ce diamant complet.</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5">
                        <ul className="space-y-1.5 mb-5">
                            {warningModalConfig.items.map((item, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setWarningModalConfig(null)}
                                className="flex-1 py-2 px-4 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm font-medium transition"
                            >
                                Continuer l'édition
                            </button>
                            <button
                                onClick={() => { 
                                    const action = warningModalConfig.action;
                                    setWarningModalConfig(null); 
                                    if (action === 'close') onClose(); else processSubmit();
                                }}
                                className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition"
                            >
                                {warningModalConfig.action === 'close' ? 'Fermer quand même' : 'Enregistrer quand même'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
