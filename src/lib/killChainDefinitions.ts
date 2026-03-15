export type KillChainType = 'cyber_kill_chain' | 'unified_kill_chain' | 'mitre_attack';

export interface KillChainPhase {
  value: string;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  bgLight: string;
  border: string;
  hexColor: string;
}

export interface KillChainDefinition {
  type: KillChainType;
  label: string;
  description: string;
  phases: KillChainPhase[];
}

export const KILL_CHAIN_DEFINITIONS: Record<KillChainType, KillChainDefinition> = {
  cyber_kill_chain: {
    type: 'cyber_kill_chain',
    label: 'Cyber Kill Chain',
    description: 'Modèle Lockheed Martin — 7 phases',
    phases: [
      { value: 'reconnaissance', label: 'Reconnaissance', shortLabel: 'Recon', color: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400', bgLight: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-sky-300 dark:border-sky-700', hexColor: '#0ea5e9' },
      { value: 'weaponization', label: 'Militarisation', shortLabel: 'Milit.', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400', bgLight: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', hexColor: '#f59e0b' },
      { value: 'delivery', label: 'Diffusion', shortLabel: 'Diff.', color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400', bgLight: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', hexColor: '#f97316' },
      { value: 'exploitation', label: 'Exploitation', shortLabel: 'Exploit.', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400', bgLight: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', hexColor: '#ef4444' },
      { value: 'installation', label: 'Installation', shortLabel: 'Install.', color: 'bg-rose-500', textColor: 'text-rose-700 dark:text-rose-400', bgLight: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', hexColor: '#f43f5e' },
      { value: 'c2', label: 'C2 / Pilotage', shortLabel: 'C2', color: 'bg-teal-500', textColor: 'text-teal-700 dark:text-teal-400', bgLight: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-300 dark:border-teal-700', hexColor: '#14b8a6' },
      { value: 'actions_on_objectives', label: 'Actions sur Objectifs', shortLabel: 'Actions', color: 'bg-slate-500', textColor: 'text-slate-700 dark:text-slate-300', bgLight: 'bg-slate-200 dark:bg-slate-700', border: 'border-slate-300 dark:border-slate-600', hexColor: '#64748b' },
    ],
  },

  unified_kill_chain: {
    type: 'unified_kill_chain',
    label: 'Unified Kill Chain',
    description: 'UKC — 18 phases (Pre/In/Post réseau)',
    phases: [
      { value: 'ukc_reconnaissance', label: 'Reconnaissance', shortLabel: 'Recon', color: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400', bgLight: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-sky-300 dark:border-sky-700', hexColor: '#0ea5e9' },
      { value: 'ukc_weaponization', label: 'Militarisation', shortLabel: 'Milit.', color: 'bg-cyan-500', textColor: 'text-cyan-700 dark:text-cyan-400', bgLight: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300 dark:border-cyan-700', hexColor: '#06b6d4' },
      { value: 'ukc_social_engineering', label: 'Ingenierie sociale', shortLabel: 'Social', color: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-400', bgLight: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', hexColor: '#3b82f6' },
      { value: 'ukc_exploitation', label: 'Exploitation', shortLabel: 'Exploit.', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400', bgLight: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', hexColor: '#ef4444' },
      { value: 'ukc_persistence', label: 'Persistance', shortLabel: 'Persist.', color: 'bg-rose-500', textColor: 'text-rose-700 dark:text-rose-400', bgLight: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', hexColor: '#f43f5e' },
      { value: 'ukc_defense_evasion', label: 'Evasion defensive', shortLabel: 'Evasion', color: 'bg-fuchsia-500', textColor: 'text-fuchsia-700 dark:text-fuchsia-400', bgLight: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', border: 'border-fuchsia-300 dark:border-fuchsia-700', hexColor: '#d946ef' },
      { value: 'ukc_c2', label: 'C2 / Commande', shortLabel: 'C2', color: 'bg-teal-500', textColor: 'text-teal-700 dark:text-teal-400', bgLight: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-300 dark:border-teal-700', hexColor: '#14b8a6' },
      { value: 'ukc_pivoting', label: 'Pivotement', shortLabel: 'Pivot', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400', bgLight: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', hexColor: '#10b981' },
      { value: 'ukc_discovery', label: 'Decouverte', shortLabel: 'Decouv.', color: 'bg-lime-500', textColor: 'text-lime-700 dark:text-lime-400', bgLight: 'bg-lime-100 dark:bg-lime-900/30', border: 'border-lime-300 dark:border-lime-700', hexColor: '#84cc16' },
      { value: 'ukc_privilege_escalation', label: 'Elevation de privileges', shortLabel: 'Priv. Esc.', color: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400', bgLight: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700', hexColor: '#eab308' },
      { value: 'ukc_execution', label: 'Execution', shortLabel: 'Exec.', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400', bgLight: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', hexColor: '#f59e0b' },
      { value: 'ukc_credential_access', label: 'Acces aux credentials', shortLabel: 'Creds', color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400', bgLight: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', hexColor: '#f97316' },
      { value: 'ukc_lateral_movement', label: 'Mouvement lateral', shortLabel: 'Lateral', color: 'bg-pink-500', textColor: 'text-pink-700 dark:text-pink-400', bgLight: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-300 dark:border-pink-700', hexColor: '#ec4899' },
      { value: 'ukc_collection', label: 'Collecte', shortLabel: 'Collecte', color: 'bg-slate-400', textColor: 'text-slate-700 dark:text-slate-400', bgLight: 'bg-slate-100 dark:bg-slate-900/30', border: 'border-slate-300 dark:border-slate-700', hexColor: '#94a3b8' },
      { value: 'ukc_exfiltration', label: 'Exfiltration', shortLabel: 'Exfil.', color: 'bg-red-700', textColor: 'text-red-800 dark:text-red-300', bgLight: 'bg-red-200 dark:bg-red-900/40', border: 'border-red-400 dark:border-red-700', hexColor: '#b91c1c' },
      { value: 'ukc_impact', label: 'Impact', shortLabel: 'Impact', color: 'bg-slate-700', textColor: 'text-slate-800 dark:text-slate-200', bgLight: 'bg-slate-300 dark:bg-slate-700', border: 'border-slate-400 dark:border-slate-500', hexColor: '#334155' },
      { value: 'ukc_objectives', label: 'Objectifs', shortLabel: 'Objectifs', color: 'bg-slate-500', textColor: 'text-slate-700 dark:text-slate-300', bgLight: 'bg-slate-200 dark:bg-slate-700', border: 'border-slate-300 dark:border-slate-600', hexColor: '#64748b' },
      { value: 'ukc_non_cyber', label: 'Actions non-cyber', shortLabel: 'Non-cyber', color: 'bg-gray-500', textColor: 'text-gray-700 dark:text-gray-300', bgLight: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', hexColor: '#6b7280' },
    ],
  },

  mitre_attack: {
    type: 'mitre_attack',
    label: 'MITRE ATT&CK',
    description: 'MITRE ATT&CK Enterprise — 14 tactiques',
    phases: [
      { value: 'att_reconnaissance', label: 'Reconnaissance', shortLabel: 'Recon', color: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400', bgLight: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-sky-300 dark:border-sky-700', hexColor: '#0ea5e9' },
      { value: 'att_resource_development', label: 'Developpement de ressources', shortLabel: 'Ressources', color: 'bg-cyan-500', textColor: 'text-cyan-700 dark:text-cyan-400', bgLight: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-300 dark:border-cyan-700', hexColor: '#06b6d4' },
      { value: 'att_initial_access', label: 'Acces initial', shortLabel: 'Acces init.', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400', bgLight: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', hexColor: '#f59e0b' },
      { value: 'att_execution', label: 'Execution', shortLabel: 'Exec.', color: 'bg-orange-500', textColor: 'text-orange-700 dark:text-orange-400', bgLight: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', hexColor: '#f97316' },
      { value: 'att_persistence', label: 'Persistance', shortLabel: 'Persist.', color: 'bg-rose-500', textColor: 'text-rose-700 dark:text-rose-400', bgLight: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', hexColor: '#f43f5e' },
      { value: 'att_privilege_escalation', label: 'Elevation de privileges', shortLabel: 'Priv. Esc.', color: 'bg-red-500', textColor: 'text-red-700 dark:text-red-400', bgLight: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', hexColor: '#ef4444' },
      { value: 'att_defense_evasion', label: 'Evasion defensive', shortLabel: 'Evasion', color: 'bg-fuchsia-500', textColor: 'text-fuchsia-700 dark:text-fuchsia-400', bgLight: 'bg-fuchsia-100 dark:bg-fuchsia-900/30', border: 'border-fuchsia-300 dark:border-fuchsia-700', hexColor: '#d946ef' },
      { value: 'att_credential_access', label: 'Acces aux credentials', shortLabel: 'Creds', color: 'bg-yellow-500', textColor: 'text-yellow-700 dark:text-yellow-400', bgLight: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700', hexColor: '#eab308' },
      { value: 'att_discovery', label: 'Decouverte', shortLabel: 'Decouv.', color: 'bg-lime-500', textColor: 'text-lime-700 dark:text-lime-400', bgLight: 'bg-lime-100 dark:bg-lime-900/30', border: 'border-lime-300 dark:border-lime-700', hexColor: '#84cc16' },
      { value: 'att_lateral_movement', label: 'Mouvement lateral', shortLabel: 'Lateral', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400', bgLight: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', hexColor: '#10b981' },
      { value: 'att_collection', label: 'Collecte', shortLabel: 'Collecte', color: 'bg-teal-500', textColor: 'text-teal-700 dark:text-teal-400', bgLight: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-300 dark:border-teal-700', hexColor: '#14b8a6' },
      { value: 'att_c2', label: 'Commande & Controle', shortLabel: 'C2', color: 'bg-pink-500', textColor: 'text-pink-700 dark:text-pink-400', bgLight: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-300 dark:border-pink-700', hexColor: '#ec4899' },
      { value: 'att_exfiltration', label: 'Exfiltration', shortLabel: 'Exfil.', color: 'bg-red-700', textColor: 'text-red-800 dark:text-red-300', bgLight: 'bg-red-200 dark:bg-red-900/40', border: 'border-red-400 dark:border-red-700', hexColor: '#b91c1c' },
      { value: 'att_impact', label: 'Impact', shortLabel: 'Impact', color: 'bg-slate-700', textColor: 'text-slate-800 dark:text-slate-200', bgLight: 'bg-slate-300 dark:bg-slate-700', border: 'border-slate-400 dark:border-slate-500', hexColor: '#334155' },
    ],
  },
};

export function getKillChainPhases(type: KillChainType | string | null): KillChainPhase[] {
  const t = (type as KillChainType) || 'cyber_kill_chain';
  return KILL_CHAIN_DEFINITIONS[t]?.phases ?? KILL_CHAIN_DEFINITIONS.cyber_kill_chain.phases;
}

export function getKillChainPhase(type: KillChainType | string | null, value: string): KillChainPhase | undefined {
  return getKillChainPhases(type).find((p) => p.value === value);
}

export function getKillChainColors(type: KillChainType | string | null): Record<string, { color: string; label: string }> {
  const phases = getKillChainPhases(type);
  return Object.fromEntries(phases.map((p) => [p.value, { color: p.hexColor, label: p.label }]));
}
