import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import {
  Clock,
  ArrowRight,
  Bug,
  GitBranch,
  Radio,
  Calendar,
  FileText,
  File,
  UserCheck,
  Zap,
  Download,
  Shield,
  Mail,
  MoreHorizontal,
  Crosshair,
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import { getKillChainPhases, KILL_CHAIN_DEFINITIONS, type KillChainPhase } from '../../lib/killChainDefinitions';

interface SystemEntry {
  id: string;
  name: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  event_datetime: string;
  kill_chain: string | null;
  malware_id: string | null;
  description: string | null;
}

interface Props {
  caseId: string;
  killChainType?: string | null;
  isReportView?: boolean;
  forceTheme?: 'light' | 'dark';
  endDate?: string;
}


const EVENT_CONFIG: Record<string, {
  label: string;
  icon: typeof Bug;
  dotColor: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}> = {
  event_log: {
    label: "Journal d'evenements",
    icon: FileText,
    dotColor: 'bg-blue-500',
    borderColor: 'border-blue-400 dark:border-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  file: {
    label: 'Fichier',
    icon: File,
    dotColor: 'bg-emerald-500',
    borderColor: 'border-emerald-400 dark:border-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  human_action: {
    label: 'Action humaine',
    icon: UserCheck,
    dotColor: 'bg-amber-500',
    borderColor: 'border-amber-400 dark:border-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  compromise: {
    label: 'Compromission',
    icon: Zap,
    dotColor: 'bg-red-500',
    borderColor: 'border-red-400 dark:border-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-400',
  },
  exfiltration: {
    label: 'Exfiltration',
    icon: Download,
    dotColor: 'bg-orange-500',
    borderColor: 'border-orange-400 dark:border-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-400',
  },
  edr_trace: {
    label: 'Trace EDR',
    icon: Shield,
    dotColor: 'bg-cyan-500',
    borderColor: 'border-cyan-400 dark:border-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    textColor: 'text-cyan-700 dark:text-cyan-400',
  },
  email: {
    label: 'Courriel',
    icon: Mail,
    dotColor: 'bg-teal-500',
    borderColor: 'border-teal-400 dark:border-teal-500',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
    textColor: 'text-teal-700 dark:text-teal-400',
  },
  lateralisation: {
    label: 'Lateralisation',
    icon: GitBranch,
    dotColor: 'bg-pink-500',
    borderColor: 'border-pink-400 dark:border-pink-500',
    bgColor: 'bg-pink-50 dark:bg-pink-950/30',
    textColor: 'text-pink-700 dark:text-pink-400',
  },
  malware: {
    label: 'Malware',
    icon: Bug,
    dotColor: 'bg-red-600',
    borderColor: 'border-red-500 dark:border-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-400',
  },
  c2_communication: {
    label: 'Communication C2',
    icon: Radio,
    dotColor: 'bg-rose-500',
    borderColor: 'border-rose-400 dark:border-rose-500',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    textColor: 'text-rose-700 dark:text-rose-400',
  },
  misc: {
    label: 'Divers',
    icon: MoreHorizontal,
    dotColor: 'bg-gray-500',
    borderColor: 'border-gray-400 dark:border-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950/30',
    textColor: 'text-gray-700 dark:text-gray-400',
  },
};

const DEFAULT_CONFIG = {
  label: 'Evenement',
  icon: Clock,
  dotColor: 'bg-gray-500',
  borderColor: 'border-gray-400 dark:border-gray-500',
  bgColor: 'bg-gray-50 dark:bg-gray-950/30',
  textColor: 'text-gray-700 dark:text-gray-400',
};

function getConfig(type: string) {
  return EVENT_CONFIG[type] || DEFAULT_CONFIG;
}

function findPhase(phases: KillChainPhase[], value: string): KillChainPhase | undefined {
  return phases.find(p => p.value === value);
}

// Fallback: search across ALL kill chain definitions if the primary one didn't match
function findPhaseAcrossAll(value: string): KillChainPhase | undefined {
  for (const def of Object.values(KILL_CHAIN_DEFINITIONS)) {
    const found = def.phases.find(p => p.value === value);
    if (found) return found;
  }
  // Also try adding common prefixes: bare 'initial_access' -> 'att_initial_access', 'ukc_initial_access'
  for (const prefix of ['att_', 'ukc_']) {
    for (const def of Object.values(KILL_CHAIN_DEFINITIONS)) {
      const found = def.phases.find(p => p.value === prefix + value);
      if (found) return found;
    }
  }
  return undefined;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function dateKey(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

type EnrichedEvent = TimelineEvent & { sourceName: string | null; targetName: string | null; malwareName: string | null; diamondNotes: string | null };

interface DateGroup {
  date: string;
  label: string;
  events: EnrichedEvent[];
}

export function VisualTimeline({ caseId, killChainType, isReportView, endDate }: Props) {
  const { t } = useTranslation();
  // Theme is handled via onclone in CaseReport.tsx
  const [groups, setGroups] = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [killChainFilter, setKillChainFilter] = useState<string>('all');

  const phases = useMemo(() => getKillChainPhases(killChainType ?? null), [killChainType]);

  useEffect(() => {
    fetchData();
  }, [caseId]);

  const fetchData = async () => {
    try {
      const [eventsRes, systemsRes, overridesRes] = await Promise.all([
        api.get(`/investigation/events/by-case/${caseId}`),
        api.get(`/investigation/systems/by-case/${caseId}`),
        api.get(`/investigation/diamond-overrides/by-case/${caseId}`),
      ]);

      const allEventsRaw = (eventsRes || []);
      const eventsFiltered = endDate
        ? allEventsRaw.filter((e: any) => {
            const createdAt = (e.created_at || '').replace(' ', 'T') + (e.created_at?.includes('Z') ? '' : 'Z');
            return createdAt <= endDate;
          })
        : allEventsRaw;
      const events = eventsFiltered.sort((a: any, b: any) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());

      const sysMap = new Map<string, string>();
      (systemsRes || []).forEach((s: SystemEntry) => sysMap.set(s.id, s.name));

      const malwareIds = [...new Set(events.map((e: any) => e.malware_id).filter(Boolean))] as string[];
      const malwareMap = new Map<string, string>();
      if (malwareIds.length > 0) {
        const malwareData = await api.get(`/investigation/malware/by-case/${caseId}`);
        const relevantMalware = (malwareData || []).filter((m: any) => malwareIds.includes(m.id));
        relevantMalware.forEach((m: any) => malwareMap.set(m.id, m.file_name));
      }

      const overridesList = overridesRes || [];
      const overridesMap = new Map<string, any>();
      overridesList.forEach((ov: any) => overridesMap.set(ov.event_id, ov));

      const enriched = events.map((e: any) => {
        const ov = overridesMap.get(e.id);
        let srcName: string | null = null;
        let tgtName: string | null = null;
        if (ov) {
          try {
            const infra = JSON.parse(ov.infrastructure || '[]');
            const vic = JSON.parse(ov.victim || '[]');
            if (infra[0]?.type === 'system') srcName = sysMap.get(infra[0].id) || null;
            if (vic[0]?.type === 'system') tgtName = sysMap.get(vic[0].id) || null;
          } catch (err) { }
        }

        return {
          ...e,
          sourceName: srcName,
          targetName: tgtName,
          malwareName: e.malware_id ? (malwareMap.get(e.malware_id) || null) : null,
          diamondNotes: ov?.notes || null,
        };
      });

      const grouped = new Map<string, DateGroup>();
      enriched.forEach((e: any) => {
        const dk = dateKey(e.event_datetime);
        if (!grouped.has(dk)) {
          grouped.set(dk, {
            date: dk,
            label: formatDateLabel(e.event_datetime),
            events: [],
          });
        }
        grouped.get(dk)!.events.push(e);
      });

      const sortedGroups = Array.from(grouped.values());
      sortedGroups.sort((a, b) => {
        const dateA = new Date(a.events[0].event_datetime).getTime();
        const dateB = new Date(b.events[0].event_datetime).getTime();
        return dateA - dateB;
      });
      sortedGroups.forEach(g => {
        g.events.sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());
      });

      setGroups(sortedGroups);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  const allEvents = groups.flatMap(g => g.events);
  if (allEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-slate-400">
        <Clock className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium mb-1">{t('auto.aucun_evenement')}</p>
        <p className="text-xs">{t('auto.ajoutez_des_evenements_dans_la')}</p>
      </div>
    );
  }

  const eventTypes = Array.from(new Set(allEvents.map(e => e.event_type)));

  const filtered = groups
    .map(g => ({
      ...g,
      events: g.events.filter(e => {
        const matchType = filter === 'all' || e.event_type === filter;
        const matchKc = killChainFilter === 'all' || e.kill_chain === killChainFilter;
        return matchType && matchKc;
      }),
    }))
    .filter(g => g.events.length > 0);

  const kcCounts = new Map<string, number>();
  allEvents.forEach(e => {
    if (e.kill_chain) {
      kcCounts.set(e.kill_chain, (kcCounts.get(e.kill_chain) || 0) + 1);
    }
  });

  const hasAnyKillChain = kcCounts.size > 0;

  return (
    <div className="space-y-6">
      {hasAnyKillChain && !isReportView && (
        <KillChainBar
          events={allEvents}
          kcCounts={kcCounts}
          activePhase={killChainFilter}
          onPhaseClick={setKillChainFilter}
          phases={phases}
        />
      )}

      {!isReportView && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setFilter('all'); setKillChainFilter('all'); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${filter === 'all' && killChainFilter === 'all'
              ? 'bg-gray-800 dark:bg-slate-200 text-white dark:text-slate-900'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
          >
            {t('auto.tous')}{allEvents.length})
          </button>
          {hasAnyKillChain ? (
            phases
              .filter(phase => kcCounts.has(phase.value))
              .map(phase => {
                const count = kcCounts.get(phase.value) || 0;
                return (
                  <button
                    key={phase.value}
                    onClick={() => { setKillChainFilter(phase.value); setFilter('all'); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${killChainFilter === phase.value
                      ? 'bg-gray-800 dark:bg-slate-200 text-white dark:text-slate-900'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                      }`}
                  >
                    {phase.shortLabel} ({count})
                  </button>
                );
              })
          ) : (
            eventTypes.map(type => {
              const cfg = getConfig(type);
              const count = allEvents.filter(e => e.event_type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${filter === type
                    ? 'bg-gray-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                >
                  {cfg.label} ({count})
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="relative">
        <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />

        {filtered.map((group, gi) => (
          <div key={group.date} className={gi > 0 ? 'mt-10' : ''}>
            <div className="relative flex items-center mb-6">
              <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-full px-4 py-1.5 shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-300 capitalize whitespace-nowrap">
                    {group.label}
                  </span>
                </div>
              </div>
              <div className="h-px w-full" />
            </div>

            <div className="space-y-6">
              {group.events.map((event, ei) => {
                const cfg = getConfig(event.event_type);
                const Icon = cfg.icon;
                const isRight = ei % 2 === 0;
                // Try current kill chain type first, then search across all definitions
                const kcPhase = event.kill_chain
                  ? (findPhase(phases, event.kill_chain) || findPhaseAcrossAll(event.kill_chain))
                  : null;

                return (
                  <div key={event.id} className="relative flex items-start">
                    <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10 mt-2">
                      <div className={`w-3 h-3 rounded-full ${cfg.dotColor} ring-4 ring-white dark:ring-slate-900`} />
                    </div>

                    <div className={`hidden md:block w-1/2 ${isRight ? 'text-right' : 'pl-10'}`}>
                      {isRight && (
                        <TimelineCard event={event} cfg={cfg} Icon={Icon} align="right" kcPhase={kcPhase} />
                      )}
                    </div>
                    <div className={`hidden md:block w-1/2 ${isRight ? 'pl-10' : 'text-right'}`}>
                      {!isRight && (
                        <TimelineCard event={event} cfg={cfg} Icon={Icon} align="left" kcPhase={kcPhase} />
                      )}
                    </div>

                    <div className="md:hidden ml-12 flex-1">
                      <TimelineCard event={event} cfg={cfg} Icon={Icon} align="left" kcPhase={kcPhase} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-slate-400">
            {t('auto.aucun_evenement_ne_correspond_')}</div>
        )}
      </div>
    </div>
  );
}

interface KillChainBarProps {
  events: EnrichedEvent[];
  kcCounts: Map<string, number>;
  activePhase: string;
  onPhaseClick: (phase: string) => void;
  phases: KillChainPhase[];
}

function KillChainBar({ events, kcCounts, activePhase, onPhaseClick, phases }: KillChainBarProps) {
  const { t } = useTranslation();
  const totalWithKc = events.filter(e => e.kill_chain).length;

  return (
    <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Crosshair className="w-4 h-4 text-gray-600 dark:text-slate-400" />
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white">{t('auto.cyber_kill_chain')}</h4>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          ({totalWithKc} {t('auto.evenement')}{totalWithKc !== 1 ? 's' : ''} {t('auto.categorise')}{totalWithKc !== 1 ? 's' : ''})
        </span>
        {activePhase !== 'all' && (
          <button
            onClick={() => onPhaseClick('all')}
            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('auto.reinitialiser')}</button>
        )}
      </div>

      <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
        {phases.map((phase, i) => {
          const count = kcCounts.get(phase.value) || 0;
          const isActive = activePhase === phase.value;
          const hasEvents = count > 0;

          return (
            <button
              key={phase.value}
              onClick={() => onPhaseClick(isActive ? 'all' : phase.value)}
              className={`
                flex-1 relative py-3 px-1 sm:px-2 transition-all text-center min-w-0 group
                ${i > 0 ? 'border-l border-gray-200 dark:border-slate-600' : ''}
                ${isActive
                  ? `${phase.bgLight} ring-2 ring-inset ring-current ${phase.textColor}`
                  : hasEvents
                    ? 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-750'
                    : 'bg-gray-50 dark:bg-slate-900/50'
                }
              `}
            >
              <div className={`w-2 h-2 rounded-full mx-auto mb-1.5 ${hasEvents ? phase.color : 'bg-gray-200 dark:bg-slate-700'}`} />
              <div className={`text-[10px] sm:text-xs font-semibold leading-tight truncate ${isActive
                ? phase.textColor
                : hasEvents
                  ? 'text-gray-700 dark:text-slate-300'
                  : 'text-gray-400 dark:text-slate-600'
                }`}>
                <span className="hidden sm:inline">{phase.label}</span>
                <span className="sm:hidden">{phase.shortLabel}</span>
              </div>
              {hasEvents && (
                <div className={`mt-1 text-[10px] font-bold ${isActive ? phase.textColor : 'text-gray-500 dark:text-slate-400'
                  }`}>
                  {count}
                </div>
              )}
              {hasEvents && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${phase.color} ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'} transition-opacity`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TimelineCardProps {
  event: EnrichedEvent;
  cfg: typeof DEFAULT_CONFIG;
  Icon: typeof Bug;
  align: 'left' | 'right';
  kcPhase: KillChainPhase | null | undefined;
}

function TimelineCard({ event, cfg, Icon, align, kcPhase }: TimelineCardProps) {



  return (
    <div
      className={`group relative border-l-4 ${cfg.borderColor} rounded-lg bg-white dark:bg-slate-800/60 shadow-sm hover:shadow-md transition-shadow p-4`}
    >
      <div className={`flex items-start gap-3 ${align === 'right' ? 'flex-row-reverse text-left' : ''}`}>
        <div className={`flex-shrink-0 p-2 rounded-lg ${cfg.bgColor}`}>
          <Icon className={`w-4 h-4 ${cfg.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${kcPhase ? kcPhase.border : 'border-gray-200 dark:border-slate-700'}`}>
            <span className={`text-sm font-bold ${kcPhase ? kcPhase.textColor : 'text-gray-500 dark:text-slate-400'}`}>
              {kcPhase ? kcPhase.label : (event.kill_chain ? event.kill_chain.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : 'Phase inconnue')}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 ml-auto">
              <Clock className="w-3 h-3" />
              {formatTime(event.event_datetime)}
            </span>
          </div>

          {/* Show source → target system mapping if available from Diamond overrides */}
          {event.sourceName && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm mb-1">
              <span className="font-semibold text-gray-800 dark:text-slate-200">
                {event.sourceName}
              </span>
              {event.targetName && (
                <>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  <span className="font-semibold text-gray-800 dark:text-slate-200">
                    {event.targetName}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Always show event description */}
          {event.description && (
            <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed line-clamp-3">
              {event.description}
            </p>
          )}

          {event.malwareName && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Bug className="w-3 h-3 text-red-500 dark:text-red-400" />
              <span className="text-[11px] font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                {event.malwareName}
              </span>
            </div>
          )}

          {event.diamondNotes && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium italic mt-1.5 line-clamp-3">
              {event.diamondNotes}
            </p>
          )}
        </div>
      </div>

      <div
        className={`absolute top-3 ${align === 'right' ? '-right-[9px]' : '-left-[13px]'
          } hidden md:block`}
      >
        <div
          className={`w-2 h-2 rotate-45 ${align === 'right'
            ? 'bg-white dark:bg-slate-800/60 border-r border-t border-gray-200 dark:border-slate-700'
            : ''
            }`}
        />
      </div>
    </div>
  );
}
