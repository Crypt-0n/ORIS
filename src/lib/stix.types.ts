/**
 * STIX 2.1 TypeScript interfaces — used across the React frontend.
 * Aligned with the Zod schemas in server/services/validation/stix.schema.ts.
 */

// ─── Kill Chain Phase ───────────────────────────────────────────

export interface KillChainPhase {
    kill_chain_name: string;
    phase_name: string;
}

// ─── Core STIX (SDOs with name) ─────────────────────────────────

export interface StixCore {
    type: string;
    id: string;
    spec_version: '2.1';
    created: string;
    modified: string;
    name: string;
    description?: string;
    object_marking_refs?: string[];
}

// ─── STIX Domain Objects (SDO) ──────────────────────────────────

export interface ThreatActor extends StixCore {
    type: 'threat-actor';
    threat_actor_types?: string[];
    sophistication?: 'none' | 'minimal' | 'intermediate' | 'advanced' | 'strategic';
}

export interface Infrastructure extends StixCore {
    type: 'infrastructure';
    infrastructure_types?: string[];
}

export interface Malware extends StixCore {
    type: 'malware';
    malware_types?: string[];
    is_family: boolean;
    kill_chain_phases?: KillChainPhase[];
}

export interface Identity extends StixCore {
    type: 'identity';
    identity_class?: 'individual' | 'group' | 'system' | 'organization' | 'class' | 'unknown';
    sectors?: string[];
}

export interface AttackPattern extends StixCore {
    type: 'attack-pattern';
    kill_chain_phases?: KillChainPhase[];
}

export interface Tool extends StixCore {
    type: 'tool';
    tool_types?: string[];
    kill_chain_phases?: KillChainPhase[];
}

export interface Indicator extends StixCore {
    type: 'indicator';
    pattern: string;
    pattern_type: 'stix' | 'snort' | 'sigma' | 'yara';
    valid_from: string;
    valid_until?: string;
    kill_chain_phases?: KillChainPhase[];
}

// ─── Observed Data (SDO — NO name property) ─────────────────────

export interface ObservedData {
    type: 'observed-data';
    id: string;
    spec_version: '2.1';
    created?: string;
    modified?: string;
    first_observed: string;
    last_observed: string;
    number_observed: number;
    object_refs: string[];
    object_marking_refs?: string[];
    x_oris_description?: string;
    x_oris_kill_chain?: string | null;
    x_oris_task_id?: string | null;
}

// ─── STIX Cyber Observables (SCO) ───────────────────────────────

export interface Ipv4Addr {
    type: 'ipv4-addr';
    id: string;
    spec_version: '2.1';
    value: string;
}

export interface DomainName {
    type: 'domain-name';
    id: string;
    spec_version: '2.1';
    value: string;
}

export interface UrlSCO {
    type: 'url';
    id: string;
    spec_version: '2.1';
    value: string;
}

export interface FileSCO {
    type: 'file';
    id: string;
    spec_version: '2.1';
    name?: string;
    hashes?: Record<string, string>;
    size?: number;
}

export interface UserAccountSCO {
    type: 'user-account';
    id: string;
    spec_version: '2.1';
    user_id?: string;
    display_name?: string;
    account_login?: string;
}

export interface NetworkTraffic {
    type: 'network-traffic';
    id: string;
    spec_version: '2.1';
    src_ref?: string;
    dst_ref?: string;
    src_port?: number;
    dst_port?: number;
    protocols?: string[];
}

// ─── STIX Relationship Object (SRO) ─────────────────────────────

export interface Relationship {
    type: 'relationship';
    id: string;
    created: string;
    modified: string;
    relationship_type:
        | 'uses' | 'targets' | 'originates-from' | 'located-at' | 'mitigates'
        | 'lateral-movement' | 'based-on' | 'consists-of' | 'delivers' | 'indicates'
        | 'attributed-to' | 'communicates-with' | 'drops' | 'exploits';
    source_ref: string;
    target_ref: string;
    confidence?: number;
    start_time?: string;
    stop_time?: string;
}

// ─── Union Types ────────────────────────────────────────────────

export type StixSDO = ThreatActor | Infrastructure | Malware | Identity
    | AttackPattern | Tool | Indicator | ObservedData;
export type StixSCO = Ipv4Addr | DomainName | UrlSCO | FileSCO | UserAccountSCO | NetworkTraffic;
export type StixObject = StixSDO | StixSCO | Relationship;

// ─── STIX Bundle ────────────────────────────────────────────────

export interface StixBundle {
    type: 'bundle';
    id: string;
    objects: StixObject[];
}

// ─── TLP Marking Definitions ────────────────────────────────────

export const TLP_MARKING_DEFINITIONS = {
    CLEAR: 'marking-definition--94868c89-83c2-464b-929b-a1a8aa3c8487',
    GREEN: 'marking-definition--bab4a63c-aed9-4571-9c39-3e01f9d42dcc',
    AMBER: 'marking-definition--55d920b0-5e8b-4f79-9ee9-91f868d9b421',
    'AMBER+STRICT': 'marking-definition--939a9414-2ddd-4d32-a0cd-b7571b03b061',
    RED: 'marking-definition--5e57c739-391a-4eb3-b6be-7d15ca92d5ed',
} as const;

export type TlpLevel = keyof typeof TLP_MARKING_DEFINITIONS;

// ─── STIX Type Metadata (for UI) ────────────────────────────────

export type StixSDOType =
    | 'threat-actor' | 'infrastructure' | 'malware' | 'identity'
    | 'attack-pattern' | 'tool' | 'indicator' | 'observed-data';

export const STIX_TYPE_META: Record<StixSDOType, { label: string; color: string; icon: string }> = {
    'threat-actor':   { label: 'Adversaire',      color: '#ef4444', icon: '👤' },
    infrastructure:   { label: 'Infrastructure',   color: '#3b82f6', icon: '🖥️' },
    malware:          { label: 'Malware',          color: '#a855f7', icon: '🦠' },
    identity:         { label: 'Victime / Identité', color: '#22c55e', icon: '🏢' },
    'attack-pattern': { label: 'Technique d\'attaque', color: '#f97316', icon: '⚔️' },
    tool:             { label: 'Outil',            color: '#06b6d4', icon: '🔧' },
    indicator:        { label: 'Indicateur',       color: '#eab308', icon: '🎯' },
    'observed-data':  { label: 'Donnée observée',  color: '#64748b', icon: '📊' },
};

export const RELATIONSHIP_TYPES = [
    { value: 'uses', label: 'Utilise' },
    { value: 'targets', label: 'Cible' },
    { value: 'originates-from', label: 'Provient de' },
    { value: 'located-at', label: 'Situé à' },
    { value: 'mitigates', label: 'Atténue' },
    { value: 'lateral-movement', label: 'Mouvement latéral' },
    { value: 'based-on', label: 'Basé sur' },
    { value: 'consists-of', label: 'Composé de' },
    { value: 'delivers', label: 'Délivre' },
    { value: 'indicates', label: 'Indique' },
    { value: 'attributed-to', label: 'Attribué à' },
    { value: 'communicates-with', label: 'Communique avec' },
    { value: 'drops', label: 'Dépose' },
    { value: 'exploits', label: 'Exploite' },
] as const;
