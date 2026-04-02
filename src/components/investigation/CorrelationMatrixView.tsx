import { useMemo } from 'react';
import { Monitor, User, Server, Bug, Shield, Globe, DatabaseZap, CheckCircle, XCircle, AlertTriangle, EyeOff, HelpCircle } from 'lucide-react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import { useTranslation } from "react-i18next";

interface CorrelationMatrixViewProps {
  nodes: DiamondNode[];
  allSystems?: { id: string; label: string; type: string }[];
}

interface SystemCorrelation {
  systemId: string;
  systemLabel: string;
  hasAdversary: boolean;
  hasInfrastructure: boolean;
  hasCapability: boolean;
  asVictim: boolean;
  hasIncomingEvent: boolean;
  hasOutgoingEvent: boolean;
  identifiedSource: boolean;
  adversaryLabels: string[];
  infrastructureLabels: string[];
  capabilityLabels: string[];
  firstEvent: string | null;
  lastEvent: string | null;
  eventCount: number;
  shadowScore: number;
  shadowReason: string[];
}

function buildCorrelationMatrix(nodes: DiamondNode[], allSystems: { id: string; label: string; type: string }[] = []): SystemCorrelation[] {
  const systemMap = new Map<string, SystemCorrelation>();

  allSystems.forEach((sys) => {
    systemMap.set(sys.id, {
      systemId: sys.id,
      systemLabel: sys.label,
      hasAdversary: false,
      hasInfrastructure: false,
      hasCapability: false,
      asVictim: false,
      hasIncomingEvent: false,
      hasOutgoingEvent: false,
      identifiedSource: false,
      adversaryLabels: [],
      infrastructureLabels: [],
      capabilityLabels: [],
      firstEvent: null,
      lastEvent: null,
      eventCount: 0,
      shadowScore: 0,
      shadowReason: [],
    });
  });

  const ensureSystem = (id: string, label: string) => {
    if (!systemMap.has(id)) {
      systemMap.set(id, {
        systemId: id,
        systemLabel: label,
        hasAdversary: false,
        hasInfrastructure: false,
        hasCapability: false,
        asVictim: false,
        hasIncomingEvent: false,
        hasOutgoingEvent: false,
        identifiedSource: false,
        adversaryLabels: [],
        infrastructureLabels: [],
        capabilityLabels: [],
        firstEvent: null,
        lastEvent: null,
        eventCount: 0,
        shadowScore: 0,
        shadowReason: [],
      });
    }
    return systemMap.get(id)!;
  };

  for (const node of nodes) {
    const dt = node.eventDatetime;
    const victimSystems = node.axes.victim.filter((o) => o.type === 'system');
    const infraSystems = node.axes.infrastructure.filter((o) => o.type === 'system' || o.type === 'attacker_infra');
    const networkItems = node.axes.infrastructure.filter((o) => o.type === 'network');
    const malwareItems = node.axes.capability.filter((o) => o.type === 'malware');
    const accountItems = node.axes.adversary.filter((o) => o.type === 'account');

    const hasSourceContext = infraSystems.length > 0;

    victimSystems.forEach((v) => {
      const s = ensureSystem(v.id, v.label);
      s.asVictim = true;
      s.hasIncomingEvent = true;
      s.eventCount++;
      if (dt) {
        if (!s.firstEvent || dt < s.firstEvent) s.firstEvent = dt;
        if (!s.lastEvent || dt > s.lastEvent) s.lastEvent = dt;
      }
      if (accountItems.length > 0) {
        s.hasAdversary = true;
        accountItems.forEach((a) => { if (!s.adversaryLabels.includes(a.label)) s.adversaryLabels.push(a.label); });
      }
      if (networkItems.length > 0 || infraSystems.length > 0) {
        s.hasInfrastructure = true;
        networkItems.forEach((n) => { if (!s.infrastructureLabels.includes(n.label)) s.infrastructureLabels.push(n.label); });
        infraSystems.forEach((i) => { if (!s.infrastructureLabels.includes(i.label)) s.infrastructureLabels.push(i.label); });
      }
      if (malwareItems.length > 0) {
        s.hasCapability = true;
        malwareItems.forEach((m) => { if (!s.capabilityLabels.includes(m.label)) s.capabilityLabels.push(m.label); });
      }
      if (hasSourceContext) s.identifiedSource = true;
    });

    infraSystems.forEach((inf) => {
      const s = ensureSystem(inf.id, inf.label);
      s.hasOutgoingEvent = true;
      s.eventCount++;
      if (dt) {
        if (!s.firstEvent || dt < s.firstEvent) s.firstEvent = dt;
        if (!s.lastEvent || dt > s.lastEvent) s.lastEvent = dt;
      }
      if (hasSourceContext) s.identifiedSource = true;
    });
  }

  systemMap.forEach((s) => {
    const reasons: string[] = [];
    let score = 0;

    if (!s.identifiedSource && (s.hasIncomingEvent || s.hasOutgoingEvent)) {
      score += 5;
      reasons.push('Aucun systeme source dans l\'axe Infrastructure');
    }
    if (!s.hasAdversary) { score += 1; reasons.push('Adversaire non identifie'); }
    if (!s.hasInfrastructure) { score += 1; reasons.push('Infrastructure non documentee'); }
    if (!s.hasCapability) { score += 1; reasons.push('Outil/capacite non identifie'); }
    if (s.hasOutgoingEvent && !s.hasIncomingEvent) {
      score += 3;
      reasons.push('Active sans evenement entrant connu');
    }

    s.shadowScore = score;
    s.shadowReason = reasons;
  });

  return Array.from(systemMap.values()).sort((a, b) => {
    if (b.shadowScore !== a.shadowScore) return b.shadowScore - a.shadowScore;
    return a.systemLabel.localeCompare(b.systemLabel);
  });
}

function formatDate(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CellCheck({ ok, labels, emptyLabel }: { ok: boolean; labels?: string[]; emptyLabel: string }) {

  if (ok && labels && labels.length > 0) {
    return (
      <div className="flex flex-col gap-0.5">
        <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
        <div className="flex flex-col gap-0.5 mt-0.5">
          {labels.slice(0, 2).map((l) => (
            <span key={l} className="text-[8px] text-green-400/80 truncate max-w-[90px]">{l}</span>
          ))}
          {labels.length > 2 && <span className="text-[8px] text-slate-400 dark:text-slate-600">+{labels.length - 2}</span>}
        </div>
      </div>
    );
  }
  if (ok) return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <XCircle className="w-3.5 h-3.5 text-red-400" />
      <span className="text-[8px] text-red-400/60 text-center">{emptyLabel}</span>
    </div>
  );
}

function ShadowBadge({ score }: { score: number }) {
  const { t } = useTranslation();
  if (score >= 7) return (
    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-red-900/30 text-red-400 border-red-700/40">
      <EyeOff className="w-2.5 h-2.5" />
      {t('auto.critique')}</span>
  );
  if (score >= 4) return (
    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-orange-900/30 text-orange-400 border-orange-700/40">
      <AlertTriangle className="w-2.5 h-2.5" />
      {t('auto.suspect')}</span>
  );
  if (score >= 1) return (
    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-yellow-900/30 text-yellow-400 border-yellow-700/40">
      <HelpCircle className="w-2.5 h-2.5" />
      {t('auto.partiel')}</span>
  );
  return (
    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border bg-green-900/30 text-green-400 border-green-700/40">
      <CheckCircle className="w-2.5 h-2.5" />
      {t('auto.documente')}</span>
  );
}

export function CorrelationMatrixView({ nodes, allSystems }: CorrelationMatrixViewProps) {
  const { t } = useTranslation();
  const systems = useMemo(() => buildCorrelationMatrix(nodes, allSystems || []), [nodes, allSystems]);

  const criticalCount = systems.filter((s) => s.shadowScore >= 7).length;
  const suspectCount = systems.filter((s) => s.shadowScore >= 4 && s.shadowScore < 7).length;
  const partialCount = systems.filter((s) => s.shadowScore >= 1 && s.shadowScore < 4).length;
  const docCount = systems.filter((s) => s.shadowScore === 0).length;

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Monitor className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_evenement_dans_le_modele')}</p>
      </div>
    );
  }

  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <Monitor className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_systeme_identifie_dans_l')}</p>
      </div>
    );
  }

  const columns = [
    { key: 'adversary', label: 'Adversaire', icon: User, color: '#ef4444', desc: 'Compte compromis' },
    { key: 'infrastructure', label: 'Infrastructure', icon: Server, color: '#f97316', desc: 'IP / Domaine' },
    { key: 'capability', label: 'Capacite', icon: Bug, color: '#eab308', desc: 'Malware / Outil' },
    { key: 'victim', label: 'Victime', icon: Shield, color: '#22c55e', desc: 'Cible confirme' },
    { key: 'source', label: 'Systeme source', icon: Server, color: '#3b82f6', desc: 'Infra → victime documente' },
  ] as const;

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500 leading-relaxed">
        {t('auto.chaque_systeme_est_croise_avec')}{' '}
        <span className="text-blue-400">{t('auto.systeme_source_dans_l_axe_infr')}</span> {t('auto.seul_indicateur_d_un_vecteur_l')}<span className="text-gray-800 dark:text-slate-300">{t('auto.ne_constitue_pas_une_source')}</span> {t('auto.ce_sont_des_indicateurs_d_acti')}{' '}
        <span className="text-red-400">{t('auto.zones_d_ombre_prioritaires')}</span>.
      </p>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-red-400">{criticalCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('auto.critique')}</p>
        </div>
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-orange-400">{suspectCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('auto.suspect')}</p>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-yellow-400">{partialCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('auto.partiel')}</p>
        </div>
        <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-400">{docCount}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{t('auto.documente')}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700/50 bg-gray-100 dark:bg-slate-800/60">
                <th className="px-4 py-3 text-left w-48">
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('auto.systeme_15')}</span>
                  </div>
                </th>
                {columns.map((col) => {
                  const Icon = col.icon;
                  return (
                    <th key={col.key} className="px-3 py-3 text-center" style={{ minWidth: 90 }}>
                      <div className="flex flex-col items-center gap-0.5">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: `${col.color}22` }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: col.color }} />
                        </div>
                        <span className="text-[9px] font-semibold text-gray-700 dark:text-slate-300">{col.label}</span>
                        <span className="text-[8px] text-slate-400 dark:text-slate-600">{col.desc}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-center" style={{ minWidth: 100 }}>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('auto.statut')}</span>
                </th>
                <th className="px-3 py-3 text-center" style={{ minWidth: 80 }}>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('auto.evt')}</span>
                </th>
                <th className="px-4 py-3 text-left" style={{ minWidth: 130 }}>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('auto.periode')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {systems.map((sys, i) => {
                const rowBg = sys.shadowScore >= 7
                  ? 'bg-red-900/10 hover:bg-red-900/20'
                  : sys.shadowScore >= 4
                    ? 'bg-orange-900/10 hover:bg-orange-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/40';

                return (
                  <tr
                    key={sys.systemId}
                    className={`border-b border-gray-200 dark:border-slate-700/30 transition ${rowBg}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-slate-400 dark:text-slate-600 w-4 text-right flex-shrink-0">{i + 1}</span>
                        <Monitor className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                        <span className="text-xs text-gray-800 dark:text-slate-200 font-medium truncate max-w-[140px]">{sys.systemLabel}</span>
                      </div>
                      {sys.shadowReason.length > 0 && (
                        <div className="ml-9 mt-1 space-y-0.5">
                          {sys.shadowReason.slice(0, 2).map((r) => (
                            <p key={r} className="text-[8px] text-slate-400 dark:text-slate-600 italic truncate">{r}</p>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <CellCheck ok={sys.hasAdversary} labels={sys.adversaryLabels} emptyLabel="Non lie" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <CellCheck ok={sys.hasInfrastructure} labels={sys.infrastructureLabels} emptyLabel="Non lie" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <CellCheck ok={sys.hasCapability} labels={sys.capabilityLabels} emptyLabel="Non lie" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {sys.asVictim ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-[8px] text-green-400/70">{t('auto.cible')}</span>
                        </div>
                      ) : sys.hasOutgoingEvent ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <Globe className="w-3.5 h-3.5 text-orange-400" />
                          <span className="text-[8px] text-orange-400/70">{t('auto.pivot')}</span>
                        </div>
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {sys.identifiedSource ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[8px] text-blue-400/70">{t('auto.documente')}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <EyeOff className="w-3.5 h-3.5 text-red-400" />
                          <span className="text-[8px] text-red-400/70">{t('auto.absent')}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <ShadowBadge score={sys.shadowScore} />
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{sys.eventCount}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-[9px] text-slate-500">
                          <span className="text-slate-400 dark:text-slate-600">{t('auto.debut')}</span>{formatDate(sys.firstEvent)}
                        </p>
                        <p className="text-[9px] text-slate-500">
                          <span className="text-slate-400 dark:text-slate-600">{t('auto.fin')}</span>{formatDate(sys.lastEvent)}
                        </p>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/50 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">{t('auto.legende')}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.axe_documente_et_lie')}</p>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.axe_non_renseigne')}</p>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.systeme_source_absent_vecteur_')}</p>
          </div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('auto.score_de_shadow_axes_manquants')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
