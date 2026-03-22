import { ArrowRight, Monitor, Server, AlertTriangle } from 'lucide-react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import type { LinkedObject } from './LinkedObjectTag';
import { useTranslation } from "react-i18next";

interface RoleTransitionViewProps {
  nodes: DiamondNode[];
}

interface InfraRef {
  nodeId: string;
  nodeLabel: string;
  phase: string;
  phaseColor: string;
  datetime: string | null;
  targetsVictim: { id: string; label: string }[];
}

interface SystemRole {
  systemId: string;
  systemLabel: string;
  asVictim: { nodeId: string; nodeLabel: string; phase: string; phaseColor: string; datetime: string | null }[];
  asInfrastructure: InfraRef[];
}

function buildRoleTransitions(nodes: DiamondNode[]): SystemRole[] {
  const systemMap = new Map<string, SystemRole>();

  const ensureEntry = (obj: LinkedObject) => {
    if (!systemMap.has(obj.id)) {
      systemMap.set(obj.id, {
        systemId: obj.id,
        systemLabel: obj.label,
        asVictim: [],
        asInfrastructure: [],
      });
    }
    return systemMap.get(obj.id)!;
  };

  for (const node of nodes) {
    const victimSystems = node.axes.victim.filter((o) => o.type === 'system');

    node.axes.victim.forEach((obj) => {
      if (obj.type !== 'system') return;
      const entry = ensureEntry(obj);
      if (!entry.asVictim.some((r) => r.nodeId === node.id)) {
        entry.asVictim.push({
          nodeId: node.id,
          nodeLabel: node.label,
          phase: node.killChainPhaseLabel,
          phaseColor: node.killChainHexColor,
          datetime: node.eventDatetime,
        });
      }
    });

    node.axes.infrastructure.forEach((obj) => {
      if (obj.type !== 'system' && obj.type !== 'attacker_infra') return;
      const entry = ensureEntry(obj);
      if (!entry.asInfrastructure.some((r) => r.nodeId === node.id)) {
        entry.asInfrastructure.push({
          nodeId: node.id,
          nodeLabel: node.label,
          phase: node.killChainPhaseLabel,
          phaseColor: node.killChainHexColor,
          datetime: node.eventDatetime,
          targetsVictim: victimSystems
            .filter((v) => v.id !== obj.id)
            .map((v) => ({ id: v.id, label: v.label })),
        });
      }
    });
  }

  return Array.from(systemMap.values())
    .filter((s) => s.asVictim.length > 0 || s.asInfrastructure.length > 0)
    .sort((a, b) => {
      const aTransition = a.asVictim.length > 0 && a.asInfrastructure.length > 0 ? 1 : 0;
      const bTransition = b.asVictim.length > 0 && b.asInfrastructure.length > 0 ? 1 : 0;
      return bTransition - aTransition;
    });
}

function formatDate(dt: string | null): string {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RoleChip({ label, color }: { label: string; color: string }) {

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: color + '33', color: color, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  );
}

export function RoleTransitionView({ nodes }: RoleTransitionViewProps) {
  const { t } = useTranslation();
  const transitions = buildRoleTransitions(nodes);
  const transitioned = transitions.filter((s) => s.asVictim.length > 0 && s.asInfrastructure.length > 0);
  const victimOnly = transitions.filter((s) => s.asVictim.length > 0 && s.asInfrastructure.length === 0);
  const infraOnly = transitions.filter((s) => s.asVictim.length === 0 && s.asInfrastructure.length > 0);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Monitor className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_evenement_dans_le_modele')}</p>
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Monitor className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_systeme_identifie_dans_l_26')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        {t('auto.cette_vue_identifie_les_system')}<span className="text-green-600 dark:text-green-400">{t('auto.victime')}</span> {t('auto.et_comme')}<span className="text-orange-500 dark:text-orange-400">{t('auto.infrastructure')}</span> {t('auto.attaquante_selon_les_evenement')}</p>

      {transitioned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-300">{t('auto.systemes_en_transition_de_role')}</h4>
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 px-1.5 py-0.5 rounded-full">{transitioned.length}</span>
          </div>
          <div className="space-y-3">
            {transitioned.map((sys) => (
              <div key={sys.systemId} className="bg-white dark:bg-slate-800/60 border border-amber-200 dark:border-amber-700/30 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-slate-700/50 bg-amber-50/50 dark:bg-amber-900/10">
                  <Monitor className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{sys.systemLabel}</span>
                  <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/50 px-2 py-0.5 rounded-full font-medium">
                    {t('auto.pivot_detecte')}</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-700/50">
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">{t('auto.victime_27')}</span>
                    </div>
                    <div className="space-y-1.5">
                      {sys.asVictim.map((ref) => (
                        <div key={ref.nodeId} className="flex items-start gap-2">
                          <RoleChip label={ref.phase} color={ref.phaseColor} />
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-700 dark:text-slate-300 truncate">{ref.nodeLabel}</p>
                            {ref.datetime && <p className="text-[9px] text-slate-400 dark:text-slate-600">{formatDate(ref.datetime)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      <span className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wide">{t('auto.infrastructure_28')}</span>
                    </div>
                    <div className="space-y-2.5">
                      {sys.asInfrastructure.map((ref) => (
                        <div key={ref.nodeId} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <RoleChip label={ref.phase} color={ref.phaseColor} />
                            <div className="min-w-0">
                              <p className="text-[10px] text-gray-700 dark:text-slate-300 truncate">{ref.nodeLabel}</p>
                              {ref.datetime && <p className="text-[9px] text-slate-400 dark:text-slate-600">{formatDate(ref.datetime)}</p>}
                            </div>
                          </div>
                          {ref.targetsVictim.length > 0 && (
                            <div className="ml-2 pl-2 border-l border-gray-300 dark:border-slate-600/50 space-y-0.5">
                              <p className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-wide">{t('auto.cibles')}</p>
                              {ref.targetsVictim.map((v) => (
                                <div key={v.id} className="flex items-center gap-1">
                                  <ArrowRight className="w-2.5 h-2.5 text-red-500 dark:text-red-400 flex-shrink-0" />
                                  <span className="text-[10px] text-red-600 dark:text-red-300 truncate">{v.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(victimOnly.length > 0 || infraOnly.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {victimOnly.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-green-500 dark:text-green-400" />
                <h4 className="text-sm font-semibold text-green-600 dark:text-green-300">{t('auto.victimes_uniquement')}</h4>
                <span className="text-[10px] bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-300 dark:border-green-700/50 px-1.5 py-0.5 rounded-full">{victimOnly.length}</span>
              </div>
              <div className="space-y-2">
                {victimOnly.map((sys) => (
                  <div key={sys.systemId} className="bg-white dark:bg-slate-800/60 border border-green-200 dark:border-green-700/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{sys.systemLabel}</span>
                    <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{sys.asVictim.length} {t('auto.evt_29')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {infraOnly.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-300">{t('auto.infrastructure_uniquement')}</h4>
                <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-700/50 px-1.5 py-0.5 rounded-full">{infraOnly.length}</span>
              </div>
              <div className="space-y-2">
                {infraOnly.map((sys) => (
                  <div key={sys.systemId} className="bg-white dark:bg-slate-800/60 border border-orange-200 dark:border-orange-700/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 flex-shrink-0" />
                    <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{sys.systemLabel}</span>
                    <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{sys.asInfrastructure.length} {t('auto.evt_30')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/50 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">{t('auto.legende')}</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.systeme_victime_cible_de_l_att')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.infrastructure_utilise_par_l_a')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3 h-3 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.transition_systeme_compromis_u')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
