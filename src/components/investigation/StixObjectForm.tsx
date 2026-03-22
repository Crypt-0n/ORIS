/**
 * StixObjectForm — Modal form to create/edit STIX 2.1 objects.
 *
 * Generates compliant STIX JSON with proper IDs, timestamps, and type-specific fields.
 * Supports 8 SDO types: ThreatActor, Infrastructure, Malware, Identity,
 * AttackPattern, Tool, Indicator, and ObservedData.
 * Plus Relationship SROs between existing objects.
 */
import React, { useState } from 'react';
import { X, Plus, Link2 } from 'lucide-react';
import type { StixSDO, Relationship, StixSDOType } from '../../lib/stix.types';
import { STIX_TYPE_META, RELATIONSHIP_TYPES, TLP_MARKING_DEFINITIONS } from '../../lib/stix.types';
import { generateStixId, nowIso } from '../../lib/stixApi';

interface StixObjectFormProps {
    caseId: string;
    existingObjects: StixSDO[];
    onCreateObject: (obj: StixSDO) => Promise<void>;
    onCreateRelationship: (rel: Relationship) => Promise<void>;
    onClose: () => void;
}

type FormMode = 'object' | 'relationship';

const StixObjectForm: React.FC<StixObjectFormProps> = ({
    caseId: _caseId,
    existingObjects,
    onCreateObject,
    onCreateRelationship,
    onClose,
}) => {
    void _caseId;
    const [mode, setMode] = useState<FormMode>('object');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // SDO fields
    const [sdoType, setSdoType] = useState<StixSDOType>('threat-actor');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tlp, setTlp] = useState<string>('');

    // Threat Actor specific
    const [sophistication, setSophistication] = useState('');
    // Malware specific
    const [isFamily, setIsFamily] = useState(false);
    // Identity specific
    const [identityClass, setIdentityClass] = useState('');
    // Infrastructure specific
    const [infraTypes, setInfraTypes] = useState('');
    // Indicator specific
    const [pattern, setPattern] = useState('');
    const [patternType, setPatternType] = useState<'stix' | 'snort' | 'sigma' | 'yara'>('stix');
    // Kill Chain (for attack-pattern, tool, malware)
    const [killChainName, setKillChainName] = useState('mitre_attack');
    const [phaseName, setPhaseName] = useState('');
    // Observed-data specific
    const [firstObserved, setFirstObserved] = useState('');
    const [lastObserved, setLastObserved] = useState('');
    const [objectRefs, setObjectRefs] = useState<string[]>([]);

    // Relationship fields
    const [relType, setRelType] = useState<string>('uses');
    const [sourceRef, setSourceRef] = useState('');
    const [targetRef, setTargetRef] = useState('');
    const [confidence, setConfidence] = useState<number>(50);
    const [startTime, setStartTime] = useState('');
    const [stopTime, setStopTime] = useState('');

    // Does this type require a name?
    const typeRequiresName = sdoType !== 'observed-data';

    const handleSubmitObject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeRequiresName && !name.trim()) { setError('Le nom est requis'); return; }
        if (sdoType === 'indicator' && !pattern.trim()) { setError('Le pattern est requis'); return; }
        if (sdoType === 'observed-data' && (!firstObserved || !lastObserved)) {
            setError('Les dates d\'observation sont requises'); return;
        }

        setLoading(true);
        setError(null);

        try {
            const now = nowIso();

            let stixObj: StixSDO;
            switch (sdoType) {
                case 'threat-actor':
                    stixObj = {
                        type: 'threat-actor',
                        id: generateStixId('threat-actor'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        sophistication: sophistication as any || undefined,
                    } as StixSDO;
                    break;
                case 'infrastructure':
                    stixObj = {
                        type: 'infrastructure',
                        id: generateStixId('infrastructure'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        infrastructure_types: infraTypes ? [infraTypes] : undefined,
                    } as StixSDO;
                    break;
                case 'malware':
                    stixObj = {
                        type: 'malware',
                        id: generateStixId('malware'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        is_family: isFamily,
                        kill_chain_phases: phaseName ? [{ kill_chain_name: killChainName, phase_name: phaseName }] : undefined,
                    } as StixSDO;
                    break;
                case 'identity':
                    stixObj = {
                        type: 'identity',
                        id: generateStixId('identity'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        identity_class: identityClass as any || undefined,
                    } as StixSDO;
                    break;
                case 'attack-pattern':
                    stixObj = {
                        type: 'attack-pattern',
                        id: generateStixId('attack-pattern'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        kill_chain_phases: phaseName ? [{ kill_chain_name: killChainName, phase_name: phaseName }] : undefined,
                    } as StixSDO;
                    break;
                case 'tool':
                    stixObj = {
                        type: 'tool',
                        id: generateStixId('tool'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        kill_chain_phases: phaseName ? [{ kill_chain_name: killChainName, phase_name: phaseName }] : undefined,
                    } as StixSDO;
                    break;
                case 'indicator':
                    stixObj = {
                        type: 'indicator',
                        id: generateStixId('indicator'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        name: name.trim(),
                        description: description.trim() || undefined,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        pattern: pattern.trim(),
                        pattern_type: patternType,
                        valid_from: now,
                        kill_chain_phases: phaseName ? [{ kill_chain_name: killChainName, phase_name: phaseName }] : undefined,
                    } as StixSDO;
                    break;
                case 'observed-data':
                    stixObj = {
                        type: 'observed-data',
                        id: generateStixId('observed-data'),
                        spec_version: '2.1',
                        created: now, modified: now,
                        first_observed: new Date(firstObserved).toISOString(),
                        last_observed: new Date(lastObserved).toISOString(),
                        number_observed: 1,
                        object_refs: objectRefs,
                        object_marking_refs: tlp ? [tlp] : undefined,
                        x_oris_description: description.trim() || undefined,
                    } as StixSDO;
                    break;
                default:
                    throw new Error('Type inconnu');
            }

            await onCreateObject(stixObj);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitRelationship = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceRef || !targetRef) { setError('Source et cible sont requis'); return; }
        if (sourceRef === targetRef) { setError('Source et cible doivent être différents'); return; }

        setLoading(true);
        setError(null);

        try {
            const now = nowIso();
            const rel: Relationship = {
                type: 'relationship',
                id: generateStixId('relationship'),
                created: now,
                modified: now,
                relationship_type: relType as Relationship['relationship_type'],
                source_ref: sourceRef,
                target_ref: targetRef,
                confidence,
                start_time: startTime ? new Date(startTime).toISOString() : undefined,
                stop_time: stopTime ? new Date(stopTime).toISOString() : undefined,
            };

            await onCreateRelationship(rel);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création');
        } finally {
            setLoading(false);
        }
    };

    const toggleObjectRef = (id: string) => {
        setObjectRefs(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    // Check if type has kill_chain_phases
    const hasKillChain = ['attack-pattern', 'tool', 'malware'].includes(sdoType);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        {mode === 'object' ? (
                            <><Plus size={18} /> Ajouter un objet STIX</>
                        ) : (
                            <><Link2 size={18} /> Ajouter une relation STIX</>
                        )}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Mode tabs */}
                <div className="flex gap-1 p-2 mx-4 mt-3 bg-gray-900 rounded-lg">
                    <button
                        onClick={() => setMode('object')}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                            mode === 'object'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        📦 Objet (SDO)
                    </button>
                    <button
                        onClick={() => setMode('relationship')}
                        disabled={existingObjects.length < 2}
                        className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                            mode === 'relationship'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:text-white'
                        } ${existingObjects.length < 2 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        🔗 Relation (SRO)
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-4 mt-3 px-3 py-2 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                        {error}
                    </div>
                )}

                {/* Object Form */}
                {mode === 'object' && (
                    <form onSubmit={handleSubmitObject} className="p-4 space-y-4">
                        {/* Type selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Type STIX</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.entries(STIX_TYPE_META) as [StixSDOType, typeof STIX_TYPE_META[StixSDOType]][]).map(([type, meta]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setSdoType(type)}
                                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                                            sdoType === type
                                                ? 'border-blue-500 bg-blue-500/10'
                                                : 'border-gray-700 hover:border-gray-500'
                                        }`}
                                    >
                                        <span className="text-lg">{meta.icon}</span>
                                        <span className="ml-2 text-sm font-medium text-gray-200">{meta.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name (not for observed-data) */}
                        {typeRequiresName && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Nom *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Ex: APT28, Cobalt Strike, ACME Corp..."
                                    required
                                />
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                rows={3}
                                placeholder="Description de l'objet..."
                            />
                        </div>

                        {/* TLP */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Marquage TLP</label>
                            <select
                                value={tlp}
                                onChange={(e) => setTlp(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Aucun</option>
                                {Object.entries(TLP_MARKING_DEFINITIONS).map(([level, id]) => (
                                    <option key={id} value={id}>TLP:{level}</option>
                                ))}
                            </select>
                        </div>

                        {/* ── Type-specific fields ── */}

                        {sdoType === 'threat-actor' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Sophistication</label>
                                <select
                                    value={sophistication}
                                    onChange={(e) => setSophistication(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Non spécifié</option>
                                    <option value="none">None</option>
                                    <option value="minimal">Minimal</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="strategic">Strategic</option>
                                </select>
                            </div>
                        )}

                        {sdoType === 'infrastructure' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Type d'infrastructure</label>
                                <select
                                    value={infraTypes}
                                    onChange={(e) => setInfraTypes(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Non spécifié</option>
                                    <option value="hosting-target-system">Système victime</option>
                                    <option value="command-and-control">Commande & Contrôle (C2)</option>
                                    <option value="botnet">Botnet</option>
                                    <option value="anonymization">Anonymisation</option>
                                    <option value="hosting-malware">Hébergement malware</option>
                                    <option value="phishing">Phishing</option>
                                </select>
                            </div>
                        )}

                        {sdoType === 'malware' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={isFamily}
                                    onChange={(e) => setIsFamily(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
                                    id="is-family"
                                />
                                <label htmlFor="is-family" className="text-sm text-gray-300">
                                    C'est une famille de malware (pas un échantillon unique)
                                </label>
                            </div>
                        )}

                        {sdoType === 'identity' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Classe d'identité</label>
                                <select
                                    value={identityClass}
                                    onChange={(e) => setIdentityClass(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Non spécifié</option>
                                    <option value="individual">Individu</option>
                                    <option value="group">Groupe</option>
                                    <option value="system">Système</option>
                                    <option value="organization">Organisation</option>
                                    <option value="class">Classe</option>
                                    <option value="unknown">Inconnu</option>
                                </select>
                            </div>
                        )}

                        {sdoType === 'indicator' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Pattern STIX *</label>
                                    <input
                                        type="text"
                                        value={pattern}
                                        onChange={(e) => setPattern(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        placeholder="[ipv4-addr:value = '203.0.113.0']"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Type de pattern</label>
                                    <select
                                        value={patternType}
                                        onChange={(e) => setPatternType(e.target.value as typeof patternType)}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="stix">STIX Pattern</option>
                                        <option value="snort">Snort</option>
                                        <option value="sigma">Sigma</option>
                                        <option value="yara">YARA</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {sdoType === 'observed-data' && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Première observation *</label>
                                        <input
                                            type="datetime-local"
                                            value={firstObserved}
                                            onChange={(e) => setFirstObserved(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Dernière observation *</label>
                                        <input
                                            type="datetime-local"
                                            value={lastObserved}
                                            onChange={(e) => setLastObserved(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                </div>
                                {existingObjects.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Références d'objets ({objectRefs.length} sélectionnés)
                                        </label>
                                        <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-900 rounded-lg p-2 border border-gray-700">
                                            {existingObjects.map((obj) => {
                                                const meta = STIX_TYPE_META[obj.type as StixSDOType];
                                                const displayName = 'name' in obj ? obj.name : obj.id;
                                                return (
                                                    <label
                                                        key={obj.id}
                                                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                                                            objectRefs.includes(obj.id) ? 'bg-blue-900/30' : 'hover:bg-gray-800'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={objectRefs.includes(obj.id)}
                                                            onChange={() => toggleObjectRef(obj.id)}
                                                            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-900 text-blue-600"
                                                        />
                                                        <span className="text-sm">{meta?.icon}</span>
                                                        <span className="text-sm text-gray-300 truncate">{displayName}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Kill Chain Phase (attack-pattern, tool, malware) */}
                        {hasKillChain && (
                            <div className="bg-gray-900/50 rounded-lg p-3 space-y-3 border border-gray-700">
                                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Phase Kill Chain (optionnel)
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Kill Chain</label>
                                        <select
                                            value={killChainName}
                                            onChange={(e) => setKillChainName(e.target.value)}
                                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="mitre_attack">MITRE ATT&CK</option>
                                            <option value="cyber_kill_chain">Cyber Kill Chain</option>
                                            <option value="unified_kill_chain">Unified Kill Chain</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Phase</label>
                                        <input
                                            type="text"
                                            value={phaseName}
                                            onChange={(e) => setPhaseName(e.target.value)}
                                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-600 focus:ring-2 focus:ring-blue-500"
                                            placeholder="ex: att_lateral_movement"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Création...' : 'Créer l\'objet STIX'}
                        </button>
                    </form>
                )}

                {/* Relationship Form */}
                {mode === 'relationship' && (
                    <form onSubmit={handleSubmitRelationship} className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Source</label>
                            <select
                                value={sourceRef}
                                onChange={(e) => setSourceRef(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Sélectionner la source...</option>
                                {existingObjects.map((obj) => {
                                    const meta = STIX_TYPE_META[obj.type as StixSDOType];
                                    const displayName = 'name' in obj ? obj.name : obj.id;
                                    return (
                                        <option key={obj.id} value={obj.id}>
                                            {meta?.icon} {displayName} ({meta?.label})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Type de relation</label>
                            <select
                                value={relType}
                                onChange={(e) => setRelType(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            >
                                {RELATIONSHIP_TYPES.map((rt) => (
                                    <option key={rt.value} value={rt.value}>
                                        {rt.label} ({rt.value})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Cible</label>
                            <select
                                value={targetRef}
                                onChange={(e) => setTargetRef(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Sélectionner la cible...</option>
                                {existingObjects.map((obj) => {
                                    const meta = STIX_TYPE_META[obj.type as StixSDOType];
                                    const displayName = 'name' in obj ? obj.name : obj.id;
                                    return (
                                        <option key={obj.id} value={obj.id}>
                                            {meta?.icon} {displayName} ({meta?.label})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Confiance: {confidence}%
                            </label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={confidence}
                                onChange={(e) => setConfidence(Number(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        {/* Temporal bounds */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Début (optionnel)</label>
                                <input
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Fin (optionnel)</label>
                                <input
                                    type="datetime-local"
                                    value={stopTime}
                                    onChange={(e) => setStopTime(e.target.value)}
                                    className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Création...' : 'Créer la relation STIX'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StixObjectForm;
