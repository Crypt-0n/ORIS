import React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { ChevronDown, ChevronRight, Shield, Search, ExternalLink, Database } from 'lucide-react';

interface AttackPattern {
  id: string;
  name: string;
  description: string;
  mitre_id: string;
  kill_chain_phases: { kill_chain_name: string; phase_name: string }[] | null;
  x_mitre_platforms: string[] | null;
}

/**
 * Mapping from MITRE ATT&CK tactic short-names (phase_name in kill_chain_phases)
 * to display labels and colors.
 */
const TACTIC_META: Record<string, { label: string; hexColor: string }> = {
  'reconnaissance': { label: 'Reconnaissance', hexColor: '#0ea5e9' },
  'resource-development': { label: 'Développement de ressources', hexColor: '#06b6d4' },
  'initial-access': { label: 'Accès initial', hexColor: '#f59e0b' },
  'execution': { label: 'Exécution', hexColor: '#f97316' },
  'persistence': { label: 'Persistance', hexColor: '#f43f5e' },
  'privilege-escalation': { label: 'Élévation de privilèges', hexColor: '#ef4444' },
  'defense-evasion': { label: 'Évasion défensive', hexColor: '#d946ef' },
  'credential-access': { label: 'Accès aux credentials', hexColor: '#eab308' },
  'discovery': { label: 'Découverte', hexColor: '#84cc16' },
  'lateral-movement': { label: 'Mouvement latéral', hexColor: '#10b981' },
  'collection': { label: 'Collecte', hexColor: '#14b8a6' },
  'command-and-control': { label: 'Commande & Contrôle', hexColor: '#ec4899' },
  'exfiltration': { label: 'Exfiltration', hexColor: '#b91c1c' },
  'impact': { label: 'Impact', hexColor: '#334155' },
};

const TACTIC_ORDER = Object.keys(TACTIC_META);

export function TtpManagementPanel() {
  const [patterns, setPatterns] = useState<AttackPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTactics, setExpandedTactics] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dbStatus, setDbStatus] = useState<{ total: number } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/kb/mitre/attack-patterns');
      setPatterns(data || []);
      setDbStatus({ total: data?.length || 0 });
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Group patterns by tactic (a pattern can appear in multiple tactics)
  const tacticGroups = useMemo(() => {
    const groups: Record<string, AttackPattern[]> = {};
    for (const tactic of TACTIC_ORDER) groups[tactic] = [];

    const q = search.toLowerCase();
    for (const p of patterns) {
      if (q && !p.name.toLowerCase().includes(q) && !p.mitre_id?.toLowerCase().includes(q)) continue;
      const phases = p.kill_chain_phases || [];
      const assignedTactics = phases
        .filter(ph => ph.kill_chain_name === 'mitre-attack')
        .map(ph => ph.phase_name);
      if (assignedTactics.length === 0) {
        // orphan — put in first group
        groups[TACTIC_ORDER[0]]?.push(p);
      } else {
        for (const tactic of assignedTactics) {
          if (!groups[tactic]) groups[tactic] = [];
          groups[tactic].push(p);
        }
      }
    }
    return groups;
  }, [patterns, search]);

  const toggleTactic = (tactic: string) => {
    setExpandedTactics(prev => {
      const next = new Set(prev);
      if (next.has(tactic)) next.delete(tactic); else next.add(tactic);
      return next;
    });
  };

  const expandAll = () => setExpandedTactics(new Set(TACTIC_ORDER));
  const collapseAll = () => setExpandedTactics(new Set());

  const filteredTotal = Object.values(tacticGroups).reduce((sum, g) => sum + g.length, 0);

  return (
    <div className="space-y-4">
      {/* Header: DB status */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Database className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">MITRE ATT&CK Enterprise</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Shield className="w-4 h-4" />
          <span>{search ? `${filteredTotal} / ` : ''}{dbStatus?.total ?? '...'} techniques</span>
        </div>

        <div className="ml-auto flex items-center">
          <button
            onClick={async () => {
              if (!window.confirm('Voulez-vous lancer la synchronisation de la base MITRE depuis CTI Github ? Cela peut prendre 1 à 2 minutes en arrière-plan.')) return;
              setSyncing(true);
              try {
                await api.post('/kb/mitre/seed', {});
                alert('Synchronisation lancée en arrière-plan. Les techniques apparaîtront au fur et à mesure. Rafraîchissez la page plus tard pour mettre à jour le compte.');
              } catch (err) {
                console.error(err);
                alert('Erreur lors du lancement de la synchronisation.');
              }
              setSyncing(false);
            }}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            {syncing ? (
              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Database className="w-3 h-3 text-slate-500" />
            )}
            Synchroniser depuis MITRE CTI
          </button>
        </div>
      </div>

      {/* Search bar + expand/collapse */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une technique MITRE (ex: T1566, phishing)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-200 placeholder-slate-400"
          />
        </div>
        <button onClick={expandAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Tout déplier
        </button>
        <button onClick={collapseAll} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
          Tout replier
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
          Chargement de la base MITRE ATT&CK...
        </div>
      ) : (
        <div className="space-y-2">
          {TACTIC_ORDER.map(tactic => {
            const meta = TACTIC_META[tactic];
            if (!meta) return null;
            const group = tacticGroups[tactic] || [];
            const isExpanded = expandedTactics.has(tactic);

            return (
              <div key={tactic} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleTactic(tactic)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.hexColor }}
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 flex-1 text-left">
                    {meta.label}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {group.length} technique{group.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
                    {group.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-600 italic py-4 text-center">
                        {search ? 'Aucun résultat' : 'Aucune technique'}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-slate-700/30">
                        {group.map(ap => (
                          <div key={`${tactic}-${ap.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-slate-800/40 transition group">
                            <span
                              className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                              style={{ backgroundColor: `${meta.hexColor}20`, color: meta.hexColor }}
                            >
                              {ap.mitre_id}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 dark:text-slate-200 font-medium truncate">{ap.name}</p>
                              {ap.description && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{ap.description.slice(0, 120)}</p>
                              )}
                            </div>
                            {ap.mitre_id && (
                              <a
                                href={`https://attack.mitre.org/techniques/${ap.mitre_id.replace('.', '/')}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-slate-400 hover:text-blue-500 transition opacity-0 group-hover:opacity-100"
                                title="Voir sur attack.mitre.org"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
