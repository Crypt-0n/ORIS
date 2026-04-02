import { useMemo } from 'react';
import { AlertTriangle, Monitor, Server, Globe, KeyRound, Bug, EyeOff, ArrowRight, HelpCircle, Upload } from 'lucide-react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import { useTranslation } from "react-i18next";

interface PropagationGraphViewProps {
  nodes: DiamondNode[];
  availableSystems?: { id: string; label: string, type?: 'system' | 'network' }[];
}

interface SystemNode {
  id: string;
  label: string;
  type: 'system' | 'network' | 'account' | 'malware' | 'exfiltration';
  isOrphan: boolean;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  hasExfiltration: boolean;
  linkedMalware: string[];
  linkedAccounts: string[];
  linkedNetwork: string[];
  linkedExfiltrations: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  eventCount: number;
}

interface PropagationEdge {
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  eventLabel: string;
  datetime: string | null;
  killChainPhase: string;
  killChainColor: string;
}

interface GraphData {
  systemNodes: Map<string, SystemNode>;
  edges: PropagationEdge[];
  orphans: SystemNode[];
  shadowZones: SystemNode[];
  exfiltrationNodeIds: Set<string>;
}

function buildPropagationGraph(nodes: DiamondNode[], availableSystems: { id: string; label: string, type?: 'system' | 'network' }[] = []): GraphData {
  const systemNodes = new Map<string, SystemNode>();
  const edges: PropagationEdge[] = [];
  const exfiltrationNodeIds = new Set<string>();

  const ensureSystem = (id: string, label: string, type: SystemNode['type'] = 'system') => {
    if (!systemNodes.has(id)) {
      systemNodes.set(id, {
        id,
        label,
        type,
        isOrphan: false,
        hasIncoming: false,
        hasOutgoing: false,
        hasExfiltration: false,
        linkedMalware: [],
        linkedAccounts: [],
        linkedNetwork: [],
        linkedExfiltrations: [],
        firstSeen: null,
        lastSeen: null,
        eventCount: 0,
      });
    }
    return systemNodes.get(id)!;
  };

  // Pre-seed the system mapping with ALL provided systems
  availableSystems.forEach(sys => {
    ensureSystem(sys.id, sys.label, sys.type || 'system');
  });

  const C2_PHASES = new Set(['c2', 'ukc_c2', 'att_c2']);

  for (const node of nodes) {
    if (node.killChainPhase && C2_PHASES.has(node.killChainPhase)) continue;

    const dt = node.eventDatetime;

    const victimSystems = node.axes.victim.filter((o) => o.type === 'system');
    const infraSystems = node.axes.infrastructure.filter((o) => o.type === 'system' || o.type === 'attacker_infra');
    const malwares = node.axes.capability.filter((o) => o.type === 'malware');
    const accounts = node.axes.adversary.filter((o) => o.type === 'account');
    const networks = node.axes.infrastructure.filter((o) => o.type === 'network');

    const hasExfiltration = node.axes.capability.some((o) => o.type === 'exfiltration');
    if (!hasExfiltration) {
      victimSystems.forEach((v) => {
        const s = ensureSystem(v.id, v.label, 'system');
        s.eventCount++;
        if (!s.firstSeen || (dt && dt < s.firstSeen)) s.firstSeen = dt;
        if (!s.lastSeen || (dt && dt > s.lastSeen)) s.lastSeen = dt;
        malwares.forEach((m) => { if (!s.linkedMalware.includes(m.label)) s.linkedMalware.push(m.label); });
        accounts.forEach((a) => { if (!s.linkedAccounts.includes(a.label)) s.linkedAccounts.push(a.label); });
        networks.forEach((n) => { if (!s.linkedNetwork.includes(n.label)) s.linkedNetwork.push(n.label); });
      });
    }

    infraSystems.forEach((inf) => {
      const s = ensureSystem(inf.id, inf.label, 'system');
      s.hasOutgoing = true;
      s.eventCount++;
      if (!s.firstSeen || (dt && dt < s.firstSeen)) s.firstSeen = dt;
      if (!s.lastSeen || (dt && dt > s.lastSeen)) s.lastSeen = dt;

      victimSystems.forEach((v) => {
        ensureSystem(v.id, v.label, 'system');
        const alreadyExists = edges.some(
          (e) => e.fromId === inf.id && e.toId === v.id && e.eventLabel === node.label
        );
        if (!alreadyExists) {
          edges.push({
            fromId: inf.id,
            fromLabel: inf.label,
            toId: v.id,
            toLabel: v.label,
            eventLabel: node.label,
            datetime: dt,
            killChainPhase: node.killChainPhaseLabel,
            killChainColor: node.killChainHexColor,
          });
        }
      });
    });

    const exfiltrationObjects = node.axes.capability.filter((o) => o.type === 'exfiltration');

    if (exfiltrationObjects.length > 0) {
      victimSystems.forEach((v) => {
        const s = ensureSystem(v.id, v.label, 'system');
        s.hasExfiltration = true;
        s.hasOutgoing = true;
        s.eventCount++;
        if (!s.firstSeen || (dt && dt < s.firstSeen)) s.firstSeen = dt;
        if (!s.lastSeen || (dt && dt > s.lastSeen)) s.lastSeen = dt;
        exfiltrationObjects.forEach((ex) => {
          if (!s.linkedExfiltrations.includes(ex.label)) s.linkedExfiltrations.push(ex.label);
        });
        accounts.forEach((a) => { if (!s.linkedAccounts.includes(a.label)) s.linkedAccounts.push(a.label); });

        exfiltrationObjects.forEach((ex) => {
          exfiltrationNodeIds.add(ex.id);
          const alreadyExists = edges.some(
            (e) => e.fromId === v.id && e.toId === ex.id && e.eventLabel === node.label
          );
          if (!alreadyExists) {
            edges.push({
              fromId: v.id,
              fromLabel: v.label,
              toId: ex.id,
              toLabel: ex.label,
              eventLabel: node.label,
              datetime: dt,
              killChainPhase: node.killChainPhaseLabel,
              killChainColor: node.killChainHexColor,
            });
          }
        });
      });
    }

  }

  const systemsWithIncomingEdge = new Set(edges.map((e) => e.toId));

  systemNodes.forEach((s) => {
    if (systemsWithIncomingEdge.has(s.id)) {
      s.hasIncoming = true;
    }
    if (!s.hasIncoming && s.hasOutgoing && !s.hasExfiltration) s.isOrphan = true;
    if (!s.hasIncoming && !s.hasOutgoing && s.eventCount === 0) s.isOrphan = true;
  });

  const allSystems = Array.from(systemNodes.values());
  const orphans = allSystems.filter((s) => s.isOrphan && s.eventCount === 0);
  const shadowZones = allSystems.filter((s) =>
    !s.hasIncoming &&
    s.eventCount > 0
  ).sort((a, b) => b.eventCount - a.eventCount);

  return { systemNodes, edges, orphans, shadowZones, exfiltrationNodeIds };
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

function SystemCard({ sys, variant }: { sys: SystemNode; variant: 'orphan' | 'shadow' | 'known' }) {
  const { t } = useTranslation();
  const colors = {
    orphan: { border: '#ef4444', bg: '#ef444410', icon: '#ef4444', badge: 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700/50' },
    shadow: { border: '#f97316', bg: '#f9731610', icon: '#f97316', badge: 'bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700/50' },
    known: { border: '#22c55e', bg: '#22c55e10', icon: '#22c55e', badge: 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700/50' },
  }[variant];

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-200 dark:border-slate-700/40">
        <Monitor className="w-4 h-4 flex-shrink-0" style={{ color: colors.icon }} />
        <span className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">{sys.label}</span>
        {variant === 'orphan' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${colors.badge}`}>
            {t('auto.source_inconnue')}</span>
        )}
        {variant === 'shadow' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${colors.badge}`}>
            {t('auto.zone_d_ombre')}</span>
        )}
        <span className="text-[10px] text-gray-500 dark:text-slate-400 flex-shrink-0">{sys.eventCount} {t('auto.evt_25')}</span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <span className="text-[9px] text-gray-500 dark:text-slate-600 uppercase tracking-wide">{t('auto.premiere_activite')}</span>
            <p className="text-[10px] text-gray-600 dark:text-slate-300">{sys.firstSeen ? formatDate(sys.firstSeen) : '—'}</p>
          </div>
          <div>
            <span className="text-[9px] text-gray-500 dark:text-slate-600 uppercase tracking-wide">{t('auto.derniere_activite')}</span>
            <p className="text-[10px] text-gray-600 dark:text-slate-300">{sys.lastSeen ? formatDate(sys.lastSeen) : '—'}</p>
          </div>
        </div>
        {sys.linkedMalware.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Bug className="w-3 h-3 text-yellow-500 flex-shrink-0" />
            {sys.linkedMalware.slice(0, 3).map((m) => (
              <span key={m} className="text-[9px] bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">{m}</span>
            ))}
          </div>
        )}
        {sys.linkedAccounts.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <KeyRound className="w-3 h-3 text-red-400 flex-shrink-0" />
            {sys.linkedAccounts.slice(0, 3).map((a) => (
              <span key={a} className="text-[9px] bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">{a}</span>
            ))}
          </div>
        )}
        {sys.linkedNetwork.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
            {sys.linkedNetwork.slice(0, 3).map((n) => (
              <span key={n} className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">{n}</span>
            ))}
          </div>
        )}
        {sys.linkedExfiltrations.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Upload className="w-3 h-3 text-purple-400 flex-shrink-0" />
            {sys.linkedExfiltrations.slice(0, 3).map((ex) => (
              <span key={ex} className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/30 px-1.5 py-0.5 rounded-full truncate max-w-[150px]">{ex}</span>
            ))}
          </div>
        )}
        {sys.linkedMalware.length === 0 && sys.linkedAccounts.length === 0 && sys.linkedNetwork.length === 0 && sys.linkedExfiltrations.length === 0 && (
          <p className="text-[10px] text-gray-500 dark:text-slate-600 italic flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            {t('auto.aucun_indicateur_d_activite_as')}</p>
        )}
      </div>
    </div>
  );
}

function EdgeRow({ edge, isExfiltration }: { edge: PropagationEdge; isExfiltration?: boolean }) {

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-gray-100 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/30">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Server className="w-3 h-3 text-orange-400 flex-shrink-0" />
        <span className="text-[10px] text-orange-600 dark:text-orange-300 truncate max-w-[100px]">{edge.fromLabel}</span>
      </div>
      <ArrowRight className="w-3 h-3 text-gray-500 dark:text-slate-400 flex-shrink-0" />
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {isExfiltration
          ? <Upload className="w-3 h-3 text-purple-400 flex-shrink-0" />
          : <Monitor className="w-3 h-3 text-green-400 flex-shrink-0" />
        }
        <span className={`text-[10px] truncate max-w-[100px] ${isExfiltration ? 'text-purple-700 dark:text-purple-300' : 'text-green-700 dark:text-green-300'}`}>
          {edge.toLabel}
        </span>
      </div>
      <span
        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{ backgroundColor: `${edge.killChainColor}22`, color: edge.killChainColor, border: `1px solid ${edge.killChainColor}44` }}
      >
        {edge.killChainPhase}
      </span>
      {edge.datetime && (
        <span className="text-[9px] text-gray-500 dark:text-slate-600 flex-shrink-0 hidden sm:block">{formatDate(edge.datetime)}</span>
      )}
    </div>
  );
}

export function PropagationGraphView({ nodes, availableSystems = [] }: PropagationGraphViewProps) {
  const { t } = useTranslation();
  const { systemNodes, edges, orphans, shadowZones, exfiltrationNodeIds } = useMemo(() => buildPropagationGraph(nodes, availableSystems), [nodes, availableSystems]);

  const allSystems = Array.from(systemNodes.values());
  const knownSystems = allSystems.filter((s) => s.hasIncoming);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-slate-400">
        <EyeOff className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_evenement_dans_le_modele')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500 dark:text-slate-500 leading-relaxed">
        {t('auto.cette_vue_analyse_les')} <span className="text-gray-900 dark:text-white">{t('auto.chemins_de_propagation')}</span> {t('auto.entre_systemes_pour_identifier')}{' '}
        <span className="text-red-400">{t('auto.systemes_sans_systeme_source')}</span> {t('auto.dans_l_axe_infrastructure_et_l')}{' '}
        <span className="text-orange-400">{t('auto.zones_d_ombre')}</span> {t('auto.systemes_victimes_dont_aucun_e')}</p>

      {orphans.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <EyeOff className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-semibold text-red-600 dark:text-red-300">{t('auto.systemes_sans_source_identifie')}</h4>
            <span className="text-[10px] bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/50 px-1.5 py-0.5 rounded-full">{orphans.length}</span>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-slate-500 mb-3">
            {t('auto.ces_systemes_figurent_dans_l_a')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {orphans.map((s) => <SystemCard key={s.id} sys={s} variant="orphan" />)}
          </div>
        </section>
      )}

      {shadowZones.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-300">{t('auto.zones_d_ombre_visibilite_incom')}</h4>
            <span className="text-[10px] bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-700/50 px-1.5 py-0.5 rounded-full">{shadowZones.length}</span>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-slate-500 mb-3">
            {t('auto.ces_systemes_sont_victimes_d_e')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {shadowZones.map((s) => <SystemCard key={s.id} sys={s} variant="shadow" />)}
          </div>
        </section>
      )}

      {edges.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-300">{t('auto.chemins_de_propagation_identif')}</h4>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 px-1.5 py-0.5 rounded-full">{edges.length}</span>
          </div>
          <div className="space-y-1.5">
            {edges.map((e, i) => <EdgeRow key={i} edge={e} isExfiltration={exfiltrationNodeIds.has(e.toId)} />)}
          </div>
        </section>
      )}

      {knownSystems.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-green-400" />
            <h4 className="text-sm font-semibold text-green-600 dark:text-green-300">{t('auto.systemes_avec_sources_identifi')}</h4>
            <span className="text-[10px] bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700/50 px-1.5 py-0.5 rounded-full">{knownSystems.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {knownSystems.map((s) => <SystemCard key={s.id} sys={s} variant="known" />)}
          </div>
        </section>
      )}

      {orphans.length === 0 && shadowZones.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/30 rounded-xl p-4 text-center">
          <Monitor className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">{t('auto.aucune_zone_d_ombre_detectee')}</p>
          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">{t('auto.tous_les_systemes_victimes_ont')}</p>
        </div>
      )}

      <div className="bg-gray-100 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/50 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-3">{t('auto.legende')}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{t('auto.source_inconnue_aucun_evenemen')}</p>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{t('auto.zone_d_ombre_methode_indetermi')}</p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{t('auto.propagation_chemin_attaquant_i')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <p className="text-[10px] text-gray-500 dark:text-slate-400">{t('auto.systeme_source_documente_infra')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
