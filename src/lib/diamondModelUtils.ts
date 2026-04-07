import { getKillChainPhase, getKillChainPhases } from './killChainDefinitions';
import type { LinkedObject } from '../components/investigation/LinkedObjectTag';

export type { LinkedObject };

export interface CaseEvent {
  id: string;
  event_datetime: string;
  description: string;
  kill_chain: string | null;
  task_id?: string | null;
  source_system?: { id: string; name: string };
  target_system?: { id: string; name: string };
  malware?: { id: string; file_name: string };
  compromised_account?: { id: string; account_name: string; domain: string };
}

export interface CaseSystem {
  id: string;
  name: string;
  os_type?: string;
  role?: string;
}

export interface CaseMalware {
  id: string;
  file_name: string;
  malware_type?: string;
  family?: string;
}

export interface CaseNetworkIndicator {
  id: string;
  indicator_type: string | null;
  value: string;
}

export interface CaseCompromisedAccount {
  id: string;
  account_name: string;
  domain: string;
  privileges?: string;
}

export interface CaseExfiltration {
  id: string;
  data_type?: string;
  estimated_volume?: string;
  destination?: string;
  method?: string;
}

export interface DiamondAxes {
  adversary: LinkedObject[];
  infrastructure: LinkedObject[];
  capability: LinkedObject[];
  victim: LinkedObject[];
}

export interface DiamondNode {
  id: string;
  eventId: string | null;
  taskId: string | null;
  label: string;
  killChainPhase: string | null;
  killChainPhaseLabel: string;
  killChainHexColor: string;
  eventDatetime: string | null;
  axes: DiamondAxes;
  order: number;
  notes: string;
}

// Kill chain phases that correspond to lateral movement behavior
const LATERAL_PHASES = new Set([
  'ukc_lateral_movement', 'att_lateral_movement',
  'lateral_movement',
]);

// Kill chain phases that correspond to C2 behavior
const C2_PHASES = new Set([
  'c2', 'ukc_c2', 'att_c2',
]);

// Kill chain phases that correspond to exfiltration behavior
const EXFILTRATION_PHASES = new Set([
  'ukc_exfiltration', 'att_exfiltration',
  'exfiltration',
]);

/**
 * Derive the semantic behavior of an event from its kill chain phase and linked data.
 * Replaces the old event_type field.
 */
export function deriveEventBehavior(killChain: string | null, axes: DiamondAxes): 'lateralisation' | 'c2' | 'exfiltration' | 'generic' {
  if (killChain && EXFILTRATION_PHASES.has(killChain)) return 'exfiltration';
  if (axes.capability.some(o => o.type === 'exfiltration')) return 'exfiltration';
  if (killChain && LATERAL_PHASES.has(killChain)) return 'lateralisation';
  if (killChain && C2_PHASES.has(killChain)) return 'c2';
  return 'generic';
}

export function buildDiamondNodes(
  events: CaseEvent[],
  _systems: CaseSystem[],
  _malwares: CaseMalware[],
  networkIndicators: CaseNetworkIndicator[],
  _compromisedAccounts: CaseCompromisedAccount[],
  exfiltrations: CaseExfiltration[],
  killChainType: string | null
): DiamondNode[] {
  const phases = getKillChainPhases(killChainType);
  const phaseOrder = Object.fromEntries(phases.map((p, i) => [p.value, i]));

  const sortedEvents = [...events].sort((a, b) => {
    const phaseA = a.kill_chain ? (phaseOrder[a.kill_chain] ?? 999) : 999;
    const phaseB = b.kill_chain ? (phaseOrder[b.kill_chain] ?? 999) : 999;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime();
  });

  const infrastructureObjects: LinkedObject[] = networkIndicators.slice(0, 3).map((ni) => {
    const typeLabel = ni.indicator_type === 'ip' ? 'IP' :
      ni.indicator_type === 'domain' ? 'Domaine' :
        ni.indicator_type === 'url' ? 'URL' :
          ni.indicator_type === 'email' ? 'Email' : ni.indicator_type;
    return { id: ni.id, label: `${typeLabel}: ${ni.value}`, type: 'network' as const };
  });

  const nodes: DiamondNode[] = sortedEvents.map((event, index) => {
    const phase = event.kill_chain ? getKillChainPhase(killChainType, event.kill_chain) : undefined;

    const victimObjects: LinkedObject[] = [];
    const eventInfrastructureObjects: LinkedObject[] = [...infrastructureObjects];

    // Derive behavior from kill chain phase (replaces event_type)
    const isLateral = event.kill_chain ? LATERAL_PHASES.has(event.kill_chain) : false;
    const isC2 = event.kill_chain ? C2_PHASES.has(event.kill_chain) : false;

    if (isLateral) {
      // Lateral movement: source = infrastructure, target = victim
      if (event.source_system) {
        eventInfrastructureObjects.push({ id: event.source_system.id, label: event.source_system.name, type: 'system' });
      }
      if (event.target_system) {
        victimObjects.push({ id: event.target_system.id, label: event.target_system.name, type: 'system' });
      }
    } else if (isC2) {
      // C2: source = victim (affected machine), target = infrastructure (C2 server)
      if (event.source_system) {
        victimObjects.push({ id: event.source_system.id, label: event.source_system.name, type: 'system' });
      }
      if (event.target_system) {
        eventInfrastructureObjects.push({ id: event.target_system.id, label: event.target_system.name, type: 'system' });
      }
    } else {
      // Default: systems are victims
      if (event.source_system) {
        victimObjects.push({ id: event.source_system.id, label: event.source_system.name, type: 'system' });
      }
      if (event.target_system && event.target_system.id !== event.source_system?.id) {
        victimObjects.push({ id: event.target_system.id, label: event.target_system.name, type: 'system' });
      }
    }

    const adversaryObjects: LinkedObject[] = [];
    if (event.compromised_account) {
      const acc = event.compromised_account;
      const label = acc.domain ? `${acc.domain}\\${acc.account_name}` : acc.account_name;
      adversaryObjects.push({ id: acc.id, label, type: 'account' });
    }

    const capabilityObjects: LinkedObject[] = [];
    if (event.malware) {
      capabilityObjects.push({ id: event.malware.id, label: event.malware.file_name, type: 'malware' });
    }

    // Exfiltration: derive from kill chain phase or linked exfiltration objects
    const isExfil = event.kill_chain ? EXFILTRATION_PHASES.has(event.kill_chain) : false;
    if (isExfil) {
      exfiltrations.forEach((ex) => {
        const parts: string[] = [];
        if (ex.data_type) parts.push(ex.data_type);
        if (ex.destination) parts.push(`→ ${ex.destination}`);
        capabilityObjects.push({ id: ex.id, label: parts.join(' ') || 'Exfiltration', type: 'exfiltration' });
      });
    }

    // Add kill chain phase label as fallback capability if nothing else
    if (capabilityObjects.length === 0 && phase) {
      capabilityObjects.push({ id: `${event.id}_phase`, label: phase.label, type: 'malware' });
    }

    const baseAxes: DiamondAxes = {
      adversary: adversaryObjects,
      infrastructure: eventInfrastructureObjects,
      capability: capabilityObjects,
      victim: victimObjects,
    };

    const node: DiamondNode = {
      id: event.id,
      eventId: event.id,
      taskId: event.task_id || null,
      label: event.description
        ? event.description.slice(0, 60) + (event.description.length > 60 ? '...' : '')
        : (phase?.label || `#${index + 1}`),
      killChainPhase: event.kill_chain,
      killChainPhaseLabel: phase?.label || 'Non specifie',
      killChainHexColor: phase?.hexColor || '#64748b',
      eventDatetime: event.event_datetime,
      axes: baseAxes,
      order: index,
      notes: '',
    };

    return node;
  });

  return nodes;
}

export function getKillChainLabel(killChain: string | null): string {
  if (!killChain) return 'Non spécifié';
  const labels: Record<string, string> = {
    reconnaissance: 'Reconnaissance',
    weaponization: 'Armement',
    delivery: 'Livraison',
    exploitation: 'Exploitation',
    installation: 'Installation',
    c2: 'C2 / Pilotage',
    actions_on_objectives: 'Actions sur objectifs',
    ukc_reconnaissance: 'Reconnaissance',
    ukc_resource_development: 'Dev. ressources',
    ukc_initial_access: 'Accès initial',
    ukc_execution: 'Exécution',
    ukc_persistence: 'Persistance',
    ukc_privilege_escalation: 'Élévation de privilèges',
    ukc_defense_evasion: 'Évasion',
    ukc_credential_access: 'Vol d\'identifiants',
    ukc_discovery: 'Découverte',
    ukc_lateral_movement: 'Mouvement latéral',
    ukc_collection: 'Collecte',
    ukc_c2: 'C2 / Commande',
    ukc_exfiltration: 'Exfiltration',
    ukc_impact: 'Impact',
    att_reconnaissance: 'Reconnaissance',
    att_initial_access: 'Accès initial',
    att_execution: 'Exécution',
    att_persistence: 'Persistance',
    att_privilege_escalation: 'Élévation de privilèges',
    att_defense_evasion: 'Évasion',
    att_credential_access: 'Vol d\'identifiants',
    att_discovery: 'Découverte',
    att_lateral_movement: 'Mouvement latéral',
    att_collection: 'Collecte',
    att_c2: 'C2',
    att_exfiltration: 'Exfiltration',
    att_impact: 'Impact',
  };
  return labels[killChain] || killChain;
}

export function getIsolatedSystems(stixObjects: any[]) {
  // Ne renvoyer que les infrastructures, les observables isolés (IP/Domaine) n'ont pas à être considérés 
  // comme des "systèmes" à part entière, pour éviter les doublons (PC1 et son IP).
  return stixObjects.filter(o => o.type === 'infrastructure');
}
