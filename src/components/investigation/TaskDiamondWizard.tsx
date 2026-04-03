import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, Check, Bug, Server, Globe, AlertCircle, Calendar, Zap, Link as LinkIcon, Plus, Trash2, ChevronDown } from 'lucide-react';
import type { StixSDO, StixSDOType } from '../../lib/stix.types';
import { STIX_TYPE_META, RELATIONSHIP_TYPES } from '../../lib/stix.types';
import { generateStixId, nowIso } from '../../lib/stixApi';
import { Tooltip } from '../common/Tooltip';
import { getKillChainPhases } from '../../lib/killChainDefinitions';
import { api } from '../../lib/api';
import { OffCanvas } from '../common/OffCanvas';

interface TaskDiamondWizardProps {
    taskId?: string;
    caseId: string;
    caseKillChainType: string;
    existingObjects: StixSDO[];
    editingDiamond?: any;
    onSuccess: () => void;
    onClose: () => void;
}

type StepKey = 'event' | 'adversary' | 'capability' | 'infrastructure' | 'victim' | 'relations';
type SelectionMode = 'none' | 'existing' | 'new';

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
    { key: 'capability', label: 'Capacités', icon: Bug, types: ['malware', 'tool', 'attack-pattern'], defaultType: 'malware', color: 'text-purple-400', desc: "Les outils techniques, les modes opératoires (TTPs MITRE ATT&CK) ou les malwares utilisés par l'adversaire pour accomplir l'événement." },
    { key: 'infrastructure', label: 'Infrastructures', icon: Server, types: ['infrastructure', 'ipv4-addr', 'domain-name', 'url', 'mac-addr'], defaultType: 'infrastructure', color: 'text-blue-400', desc: "Les éléments matériels ou de communication utilisés pour héberger des capacités, envoyer des commandes (C2) ou lancer l'attaque." },
    { key: 'victim', label: 'Victimes', icon: Globe, types: ['identity', 'infrastructure', 'user-account', 'ipv4-addr', 'domain-name'], defaultType: 'identity', color: 'text-green-400', desc: "La cible de l'événement. Cela peut être une entité (Organisation, Secteur, Personne) ou l'infrastructure technique ciblée." },
    { key: 'relations', label: 'Liens', icon: LinkIcon, types: [], defaultType: 'relationship', color: 'text-amber-500', desc: "Génération automatique ou manuelle des relations STIX unissant tous les objets sélectionnés au centre de ce Diamant." },
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

    // Draft state for adding a new node in the current step
    const [draftMode, setDraftMode] = useState<SelectionMode>('none');
    const [draftExistingId, setDraftExistingId] = useState('');
    const [draftNewData, setDraftNewData] = useState<any>({ sdoType: 'threat-actor', name: '', description: '', tlp: '', isFamily: false, hashes: [] });
    
    // Mitre Patterns
    const [mitrePatterns, setMitrePatterns] = useState<{ id: string; name: string; mitre_id: string }[]>([]);
    React.useEffect(() => {
        api.get('/kb/mitre/attack-patterns').then(res => setMitrePatterns(res || [])).catch(() => {});
    }, []);

    // State for manual relations
    const [initialRelationIds] = useState<Set<string>>(() => {
        if (!editingDiamond || !existingObjects) return new Set();
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

    // Get all valid objects defined across axes for relationships
    const allAvailableNodes = useMemo(() => {
        return ['capability', 'infrastructure', 'victim'].flatMap(k => axesNodes[k]);
    }, [axesNodes]);

    // Update draft mode and reset correctly when navigating
    // Reset draft state when opening step
    React.useEffect(() => {
        if (currentStep && currentStep.key !== 'event' && currentStep.key !== 'relations') {
            setDraftMode('none');
            setDraftExistingId('');
            setDraftNewData({ sdoType: currentStep.defaultType, name: '', description: '', tlp: '', isFamily: false, hashes: [] });
        }
    }, [stepIndex]);

    const handleAddNode = (directId?: any) => {
        const isEvent = directId && typeof directId === 'object' && 'preventDefault' in directId;
        const targetId = (!isEvent && typeof directId === 'string') ? directId : draftExistingId;

        setError(null);
        if (!currentStep) return;
        
        if (draftMode === 'existing') {
            if (!targetId) { setError('Veuillez sélectionner un objet.'); return; }
            const obj = existingObjects.find(o => o && o.id === targetId);
            const mitreTtp = !obj ? mitrePatterns.find(p => p && p.id === targetId) : null;
            if (!obj && !mitreTtp) return;
            
            const label = obj ? (('name' in obj) ? (obj as any).name : ('value' in obj) ? (obj as any).value : obj.type) : `${mitreTtp?.mitre_id} - ${mitreTtp?.name}`;
            const sdoType = obj ? obj.type : 'attack-pattern';
            
            // Avoid duplicates
            if (axesNodes[currentStep.key].some(n => n.id === targetId)) {
                setError('Cet objet est déjà ajouté à cet axe.');
                return;
            }

            // Clone to case seamlessly if it's a TTP
            if (mitreTtp && currentStep.key === 'capability') {
                api.post('/kb/mitre/clone-to-case', { case_id: caseId, stix_id: mitreTtp.id }).catch(() => {});
            }

            setAxesNodes(prev => ({
                ...prev,
                [currentStep.key]: [...prev[currentStep.key], { mode: 'existing', id: targetId, label, sdoType }]
            }));
            // Restes en mode 'existing' pour permettre les ajouts multiples rapides
            setDraftExistingId('');
        } else if (draftMode === 'new') {
            if (!draftNewData.name.trim()) { setError('Le nom est requis.'); return; }
            const newId = generateStixId(draftNewData.sdoType);
            setAxesNodes(prev => ({
                ...prev,
                [currentStep.key]: [...prev[currentStep.key], { mode: 'new', id: newId, label: draftNewData.name.trim(), sdoType: draftNewData.sdoType, newData: {...draftNewData} }]
            }));
            setDraftMode('none');
            setDraftNewData({ sdoType: currentStep.defaultType, name: '', description: '', tlp: '', isFamily: false, hashes: [] });
        }
    };

    const handleRemoveNode = (stepKey: string, id: string) => {
        setAxesNodes(prev => ({
            ...prev,
            [stepKey]: prev[stepKey].filter(n => n.id !== id)
        }));
        // Remove relationships involving this id
        setRelations(prev => prev.filter(r => r.sourceId !== id && r.targetId !== id));
    };

    const handleAddRelation = () => {
        setError(null);
        if (!draftRelSource || !draftRelTarget || !draftRelType) {
            setError('Veuillez remplir tous les champs de la relation.');
            return;
        }
        if (draftRelSource === draftRelTarget) {
            setError('La source et la cible doivent être différentes.');
            return;
        }
        // Avoid duplicate
        if (relations.some(r => r.sourceId === draftRelSource && r.targetId === draftRelTarget && r.type === draftRelType)) {
            setError('Cette relation existe déjà.');
            return;
        }
        setRelations(prev => [...prev, { id: generateStixId('relationship'), sourceId: draftRelSource, targetId: draftRelTarget, type: draftRelType }]);
        setDraftRelSource('');
        setDraftRelTarget('');
        setDraftRelType('uses');
    };

    const handleRemoveRelation = (id: string) => {
        setRelations(prev => prev.filter(r => r.id !== id));
    };

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
            setStepIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        setError(null);
        setStepIndex(prev => Math.max(0, prev - 1));
    };

    const handleSubmit = async () => {
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
                });
            }

            // 3. Create manual relationships
            const finalRelationIds = new Set<string>();
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

    return (
        <OffCanvas
            isOpen={true}
            onClose={onClose}
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

                                {/* OTHER STEPS: STIX NODES (Axes) */}
                                {['capability', 'infrastructure', 'victim'].includes(currentStep.key) && (
                                    <div className="space-y-6">
                                        {/* List of currently selected nodes */}
                                        <div className="space-y-2">
                                            {axesNodes[currentStep.key].length > 0 ? (
                                                <ul className="space-y-2">
                                                    {axesNodes[currentStep.key].map(node => (
                                                        <li key={node.id} className={`flex items-center justify-between p-3 rounded-lg border ${node.mode === 'new' ? 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800' : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'}`}>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{node.label}</span>
                                                                <span className="text-[10px] text-gray-500 dark:text-slate-400 flex items-center gap-1">
                                                                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">{STIX_TYPE_META[node.sdoType]?.label || node.sdoType}</span>
                                                                    {node.mode === 'new' && <span className="text-cyan-600 dark:text-cyan-400">(Nouveau)</span>}
                                                                </span>
                                                            </div>
                                                            <button onClick={() => handleRemoveNode(currentStep.key, node.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-slate-400 italic text-center py-4 bg-gray-50 dark:bg-slate-800/30 rounded-lg border border-dashed border-gray-200 dark:border-slate-700">Aucun élément ajouté pour cet axe.</p>
                                            )}
                                        </div>

                                        <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                            <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                                                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300">Ajouter un objet</h4>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-slate-900 space-y-4">
                                                {/* Draft Mode toggles */}
                                                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                                                    <button onClick={() => setDraftMode('existing')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${draftMode === 'existing' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>Utiliser un existant</button>
                                                    <button onClick={() => setDraftMode('new')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${draftMode === 'new' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>Créer un nouveau</button>
                                                </div>

                                                {draftMode === 'existing' && (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Sélectionner dans l'affaire</label>
                                                            <SearchableSelect
                                                                value={draftExistingId}
                                                                onChange={(val) => {
                                                                    setDraftExistingId(val);
                                                                    if (val) handleAddNode(val);
                                                                }}
                                                                options={(() => {
                                                                    const opts = existingObjects.filter(o => o && currentStep.types.includes(o.type)).map(o => ({
                                                                        value: o.id,
                                                                        label: ('name' in o ? (o as any).name : ('value' in o ? (o as any).value : o.type))
                                                                    }));
                                                                    if (currentStep.key === 'capability') {
                                                                        const existingIds = new Set(opts.map(o => o.value));
                                                                        mitrePatterns.filter(p => p && !existingIds.has(p.id)).forEach(p => {
                                                                            opts.push({ value: p.id, label: `${p.mitre_id} - ${p.name}` });
                                                                        });
                                                                    }
                                                                    return opts;
                                                                })()}
                                                                placeholder="Sélectionnez un objet..."
                                                            />
                                                        </div>
                                                        <button onClick={handleAddNode} disabled={!draftExistingId} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1">
                                                            <Plus className="w-4 h-4" /> Ajouter
                                                        </button>
                                                    </div>
                                                )}

                                                {draftMode === 'new' && (
                                                    <div className="space-y-4">
                                                        {currentStep.types.filter(t => t !== 'attack-pattern').length > 1 && (
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Type STIX exact</label>
                                                                <SearchableSelect
                                                                    value={draftNewData.sdoType}
                                                                    onChange={(v) => setDraftNewData((p:any) => ({...p, sdoType: v}))}
                                                                    options={currentStep.types.filter(t => t !== 'attack-pattern').map(t => ({ value: t, label: STIX_TYPE_META[t as StixSDOType]?.label || t }))}
                                                                />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Nom *</label>
                                                            <input
                                                                type="text"
                                                                value={draftNewData.name}
                                                                onChange={e => setDraftNewData((p:any) => ({...p, name: e.target.value}))}
                                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                                                                placeholder={draftNewData.sdoType === 'infrastructure' ? "ex: Serveur Web" : "ex: APT28"}
                                                            />
                                                        </div>

                                                        {(draftNewData.sdoType === 'malware' || draftNewData.sdoType === 'tool') && (
                                                            <div className="space-y-3 pt-2">
                                                                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">Hashes associés</label>
                                                                {draftNewData.hashes && draftNewData.hashes.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        {draftNewData.hashes.map((h: any, idx: number) => (
                                                                            <div key={idx} className="flex gap-2 items-center">
                                                                                <select
                                                                                    value={h.type}
                                                                                    onChange={e => {
                                                                                        const newHashes = [...draftNewData.hashes];
                                                                                        newHashes[idx].type = e.target.value;
                                                                                        setDraftNewData((p:any) => ({...p, hashes: newHashes}));
                                                                                    }}
                                                                                    className="px-2 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white"
                                                                                >
                                                                                    {['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'SSDEEP', 'IMPHASH', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                                                                                </select>
                                                                                <input
                                                                                    type="text"
                                                                                    value={h.value}
                                                                                    onChange={e => {
                                                                                        const newHashes = [...draftNewData.hashes];
                                                                                        newHashes[idx].value = e.target.value;
                                                                                        setDraftNewData((p:any) => ({...p, hashes: newHashes}));
                                                                                    }}
                                                                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-900 dark:text-white font-mono"
                                                                                    placeholder="Valeur du hash..."
                                                                                />
                                                                                <button type="button" onClick={() => {
                                                                                    setDraftNewData((p:any) => ({...p, hashes: p.hashes.filter((_:any, i:number) => i !== idx)}));
                                                                                }} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition">
                                                                                    <Trash2 className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <button type="button" onClick={() => setDraftNewData((p:any) => ({...p, hashes: [...(p.hashes || []), { type: 'SHA-256', value: '' }]}))} className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 font-medium hover:text-cyan-700 transition w-fit px-2 py-1 rounded bg-cyan-50 dark:bg-cyan-900/20">
                                                                    <Plus className="w-3.5 h-3.5" /> Ajouter un hash
                                                                </button>
                                                            </div>
                                                        )}

                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Description (Optionnel)</label>
                                                            <textarea
                                                                value={draftNewData.description}
                                                                onChange={e => setDraftNewData((p:any) => ({...p, description: e.target.value}))}
                                                                rows={2}
                                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 resize-none"
                                                            />
                                                        </div>
                                                        <button onClick={handleAddNode} disabled={!draftNewData.name.trim()} className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1">
                                                            <Plus className="w-4 h-4" /> Créer et Ajouter
                                                        </button>
                                                    </div>
                                                )}

                                                {draftMode === 'none' && (
                                                    <p className="text-xs text-center text-gray-500 dark:text-slate-400">Sélectionnez une option ci-dessus pour ajouter un objet.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* RELATIONS STEP */}
                                {currentStep.key === 'relations' && (
                                    <div className="space-y-6">
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                                            <p className="text-sm text-amber-800 dark:text-amber-400">
                                                Vous pouvez déclarer les relations spécifiques entre les objets de ce diamant. Elles seront matérialisées dans le graphe analytique de l'investigation.
                                            </p>
                                        </div>

                                        {/* New Relation Form */}
                                        <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg border border-gray-200 dark:border-slate-700 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Source</label>
                                                    <SearchableSelect
                                                        value={draftRelSource}
                                                        onChange={setDraftRelSource}
                                                        options={allAvailableNodes.map(n => ({ value: n.id, label: n.label }))}
                                                        placeholder="Sélectionner..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Relation</label>
                                                    <SearchableSelect
                                                        value={draftRelType}
                                                        onChange={setDraftRelType}
                                                        options={RELATIONSHIP_TYPES.map(rt => ({ value: rt.value, label: rt.label }))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Cible</label>
                                                    <SearchableSelect
                                                        value={draftRelTarget}
                                                        onChange={setDraftRelTarget}
                                                        options={allAvailableNodes.map(n => ({ value: n.id, label: n.label }))}
                                                        placeholder="Sélectionner..."
                                                    />
                                                </div>
                                            </div>
                                            <button onClick={handleAddRelation} className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition flex justify-center items-center gap-2">
                                                <Plus className="w-4 h-4"/> Ajouter le lien
                                            </button>
                                        </div>

                                        {/* Existing Relations List */}
                                        <div className="space-y-2">
                                            {relations.length > 0 ? (
                                                <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {relations.map(rel => {
                                                        const src = allAvailableNodes.find(n => n.id === rel.sourceId);
                                                        const tgt = allAvailableNodes.find(n => n.id === rel.targetId);
                                                        const rtLabel = RELATIONSHIP_TYPES.find(r => r.value === rel.type)?.label || rel.type;
                                                        return (
                                                            <li key={rel.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg">
                                                                <div className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                                                                    <span className="font-semibold">{src?.label || '?'}</span>
                                                                    <span className="text-gray-500">-{rtLabel}-&gt;</span>
                                                                    <span className="font-semibold">{tgt?.label || '?'}</span>
                                                                </div>
                                                                <button onClick={() => handleRemoveRelation(rel.id)} className="p-1 text-gray-500 hover:text-red-500 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            ) : (
                                                <p className="text-center text-xs text-gray-500 italic py-2">Aucune relation définie.</p>
                                            )}
                                        </div>
                                    </div>
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
    );
};
