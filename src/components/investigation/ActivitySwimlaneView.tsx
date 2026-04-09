import React from 'react';
import { useMemo } from 'react';
import { Monitor, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import type { DiamondNode } from '../../lib/diamondModelUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from "react-i18next";

interface ActivitySwimlaneViewProps {
  nodes: DiamondNode[];
  allSystems?: { id: string; label: string; type: string }[];
}

interface SystemActivity {
  systemId: string;
  systemLabel: string;
  events: { datetime: string; label: string; killChainColor: string; killChainPhase: string }[];
  segments: { start: number; end: number; label: string }[];
  gaps: { start: number; end: number; durationMs: number }[];
  coveragePercent: number;
  firstSeen: string;
  lastSeen: string;
  hasUnknownSource: boolean;
}

const GAP_THRESHOLD_MS = 4 * 60 * 60 * 1000;

function buildSwimlaneSystems(nodes: DiamondNode[], allSystems: { id: string; label: string; type: string }[] = []): { systems: SystemActivity[]; globalStart: number; globalEnd: number } {
  const systemMap = new Map<string, { label: string; events: { datetime: string; label: string; killChainColor: string; killChainPhase: string }[]; hasUnknownSource: boolean }>();

  allSystems.forEach(sys => {
    systemMap.set(sys.id, { label: sys.label, events: [], hasUnknownSource: false });
  });

  for (const node of nodes) {
    if (!node.eventDatetime) continue;

    const victimSystems = node.axes.victim.filter((o) => o.type === 'system');
    const infraSystems = node.axes.infrastructure.filter((o) => o.type === 'system' || o.type === 'attacker_infra');
    const hasSources = node.axes.infrastructure.filter(o => o.type === 'system' || o.type === 'attacker_infra').length > 0;

    const involvedSystems = [...new Map([...victimSystems, ...infraSystems].map(s => [s.id, s])).values()];

    for (const sys of involvedSystems) {
      if (!systemMap.has(sys.id)) {
        systemMap.set(sys.id, { label: sys.label, events: [], hasUnknownSource: false });
      }
      const entry = systemMap.get(sys.id)!;
      entry.events.push({
        datetime: node.eventDatetime,
        label: node.label,
        killChainColor: node.killChainHexColor,
        killChainPhase: node.killChainPhaseLabel,
      });
      if (!hasSources) {
        entry.hasUnknownSource = true;
      }
    }
  }

  if (systemMap.size === 0) return { systems: [], globalStart: 0, globalEnd: 0 };

  let globalStart = Infinity;
  let globalEnd = -Infinity;

  systemMap.forEach((entry) => {
    const timestamps = entry.events.map((e) => new Date(e.datetime).getTime());
    globalStart = Math.min(globalStart, ...timestamps);
    globalEnd = Math.max(globalEnd, ...timestamps);
  });

  if (globalStart === globalEnd) {
    globalStart -= 3600000;
    globalEnd += 3600000;
  }

  const totalDuration = globalEnd - globalStart;

  const systems: SystemActivity[] = [];

  systemMap.forEach((entry, systemId) => {
    const sorted = [...entry.events].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    
    if (sorted.length === 0) {
      systems.push({
        systemId,
        systemLabel: entry.label,
        events: [],
        segments: [],
        gaps: [],
        coveragePercent: 0,
        firstSeen: '',
        lastSeen: '',
        hasUnknownSource: false,
      });
      return;
    }

    const timestamps = sorted.map((e) => new Date(e.datetime).getTime());

    const firstSeen = sorted[0].datetime;
    const lastSeen = sorted[sorted.length - 1].datetime;

    const segments: { start: number; end: number; label: string }[] = [];
    const gaps: { start: number; end: number; durationMs: number }[] = [];

    const EVENT_WINDOW_MS = Math.max(totalDuration * 0.02, 3600000);
    let segStart = timestamps[0];
    let segEnd = timestamps[0];
    let segLabel = sorted[0].label;

    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - segEnd;
      if (gap > GAP_THRESHOLD_MS) {
        segments.push({
          start: (segStart - globalStart) / totalDuration,
          end: Math.min((segEnd + EVENT_WINDOW_MS - globalStart) / totalDuration, 1),
          label: segLabel,
        });
        gaps.push({
          start: (segEnd + EVENT_WINDOW_MS - globalStart) / totalDuration,
          end: (timestamps[i] - globalStart) / totalDuration,
          durationMs: gap,
        });
        segStart = timestamps[i];
        segEnd = timestamps[i];
        segLabel = sorted[i].label;
      } else {
        segEnd = timestamps[i];
      }
    }

    segments.push({
      start: (segStart - globalStart) / totalDuration,
      end: Math.min((segEnd + EVENT_WINDOW_MS - globalStart) / totalDuration, 1),
      label: segLabel,
    });

    const activeDuration = segments.reduce((acc, s) => acc + (s.end - s.start) * totalDuration, 0);
    const coveragePercent = Math.min(100, Math.round((activeDuration / totalDuration) * 100));

    systems.push({
      systemId,
      systemLabel: entry.label,
      events: sorted,
      segments,
      gaps,
      coveragePercent,
      firstSeen,
      lastSeen,
      hasUnknownSource: entry.hasUnknownSource,
    });
  });

  systems.sort((a, b) => {
    if (a.hasUnknownSource !== b.hasUnknownSource) return a.hasUnknownSource ? -1 : 1;
    return a.gaps.length > b.gaps.length ? -1 : 1;
  });

  return { systems, globalStart, globalEnd };
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d}j`;
  if (h >= 1) return `${h}h`;
  const m = Math.floor(ms / 60000);
  return `${m}min`;
}

function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAxisDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SwimlaneRow({ sys, globalStart, globalEnd }: { sys: SystemActivity; globalStart: number; globalEnd: number }) {
    const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const totalDuration = globalEnd - globalStart;
  const eventPositions = sys.events.map((e) => ({
    pos: (new Date(e.datetime).getTime() - globalStart) / totalDuration,
    ...e,
  }));

  const hasSignificantGap = sys.gaps.some((g) => g.durationMs > 24 * 3600000);

  return (
    <div className="group">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex items-center gap-1.5 w-40 flex-shrink-0">
          {sys.hasUnknownSource ? (
            <EyeOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          ) : hasSignificantGap ? (
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          ) : (
            <Monitor className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          )}
          <span className="text-[10px] text-gray-700 dark:text-slate-300 truncate font-medium">{sys.systemLabel}</span>
        </div>

        <div className="flex-1 relative h-6 bg-gray-100 dark:bg-slate-800/60 rounded-full overflow-hidden border border-gray-200 dark:border-slate-700/40">
          {sys.gaps.map((gap, i) => (
            <div
              key={i}
              className="absolute top-0 h-full opacity-30"
              style={{
                left: `${gap.start * 100}%`,
                width: `${(gap.end - gap.start) * 100}%`,
                backgroundColor: gap.durationMs > 24 * 3600000 ? '#f97316' : (isDark ? '#64748b' : '#94a3b8'),
              }}
            />
          ))}

          {sys.segments.map((seg, i) => (
            <div
              key={i}
              className="absolute top-1 h-4 rounded-full opacity-90"
              style={{
                left: `${seg.start * 100}%`,
                width: `${Math.max((seg.end - seg.start) * 100, 0.8)}%`,
                backgroundColor: sys.hasUnknownSource ? '#ef4444' : '#3b82f6',
              }}
              title={seg.label}
            />
          ))}

          {eventPositions.map((ep, i) => (
            <div
              key={i}
              className="absolute top-0 w-0.5 h-full opacity-60"
              style={{
                left: `${ep.pos * 100}%`,
                backgroundColor: ep.killChainColor,
              }}
              title={`${ep.label} — ${ep.killChainPhase}`}
            />
          ))}
        </div>

        <div className="w-16 flex-shrink-0 text-right">
          <span className={`text-[10px] font-medium ${sys.coveragePercent < 30 ? 'text-orange-400' : sys.coveragePercent < 60 ? 'text-yellow-400' : 'text-green-400'}`}>
            {sys.coveragePercent}%
          </span>
        </div>
      </div>

      <div className="ml-40 flex items-center gap-3 mb-3">
        {sys.events.length === 0 ? (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Aucune activité (0 evt)</span>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {sys.gaps.filter(g => g.durationMs > GAP_THRESHOLD_MS).map((gap, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: gap.durationMs > 24 * 3600000 ? '#f9731620' : (isDark ? '#64748b20' : '#94a3b820'),
                    borderColor: gap.durationMs > 24 * 3600000 ? '#f9731650' : (isDark ? '#64748b50' : '#94a3b850'),
                    color: gap.durationMs > 24 * 3600000 ? '#fb923c' : (isDark ? '#94a3b8' : '#64748b'),
                  }}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {t('auto.silence_de')}{formatDuration(gap.durationMs)}
                </span>
              ))}
              {sys.hasUnknownSource && (
                <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border bg-red-900/20 border-red-700/40 text-red-400">
                  <EyeOff className="w-2.5 h-2.5" />
                  {t('auto.systeme_source_infrastructure_')}</span>
              )}
            </div>
            <span className="text-[9px] text-slate-400 dark:text-slate-600 flex-shrink-0">
              {formatDate(sys.firstSeen)} → {formatDate(sys.lastSeen)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function ActivitySwimlaneView({ nodes, allSystems }: ActivitySwimlaneViewProps) {
    const { t } = useTranslation();
  const { systems, globalStart, globalEnd } = useMemo(() => buildSwimlaneSystems(nodes, allSystems || []), [nodes, allSystems]);

  const unknownSourceCount = systems.filter((s) => s.hasUnknownSource).length;
  const significantGapCount = systems.filter((s) => s.gaps.some((g) => g.durationMs > 24 * 3600000)).length;

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Clock className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_evenement_dans_le_modele')}</p>
      </div>
    );
  }

  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
        <Monitor className="w-8 h-8 mb-3 opacity-30" />
        <p className="text-sm">{t('auto.aucun_systeme_identifie_dans_l')}</p>
      </div>
    );
  }

  const totalDuration = globalEnd - globalStart;
  const axisPoints = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    pos: p,
    label: formatAxisDate(globalStart + p * totalDuration),
  }));

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
        {t('auto.chaque_ligne_represente_un')}<span className="text-gray-900 dark:text-white">{t('auto.systeme')}</span> {t('auto.et_ses')}<span className="text-blue-400">{t('auto.segments_d_activite')}</span> {t('auto.sur_la_duree_de_l_incident_les')}<span className="text-orange-400">{t('auto.zones_grises')}</span> {t('auto.revelent_des_silences_suspects')}{' '}
        <span className="text-red-400">{t('auto.en_rouge')}</span> {t('auto.n_ont_aucun_systeme_source_dan')}</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-100 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/40 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">{systems.length}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t('auto.systemes_analyses')}</p>
        </div>
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-red-400">{unknownSourceCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t('auto.source_inconnue')}</p>
        </div>
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-orange-400">{significantGapCount}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t('auto.silence_gt_24h_detecte')}</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-slate-400" />
          <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">{t('auto.segments_d_activite_par_system')}</h4>
        </div>

        <div className="ml-40 mb-2 relative h-4">
          {axisPoints.map((p, i) => (
            <div
              key={i}
              className="absolute text-[8px] text-slate-400 dark:text-slate-600 transform -translate-x-1/2"
              style={{ left: `${p.pos * 100}%` }}
            >
              {p.label}
            </div>
          ))}
        </div>
        <div className="ml-40 mb-4 relative h-px bg-gray-200 dark:bg-slate-700/50">
          {axisPoints.map((p, i) => (
            <div
              key={i}
              className="absolute top-0 w-px h-2 bg-gray-200 dark:bg-slate-700/40"
              style={{ left: `${p.pos * 100}%`, transform: 'translateY(-50%)' }}
            />
          ))}
        </div>

        <div>
          {systems.map((sys) => (
            <SwimlaneRow
              key={sys.systemId}
              sys={sys}
              globalStart={globalStart}
              globalEnd={globalEnd}
            />
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-700/40 flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-wide mr-2">{t('auto.couverture')}</span>
          <span className="text-[9px] text-green-400">{t('auto.x25a0_ge_60_couverte')}</span>
          <span className="text-[9px] text-yellow-400 ml-2">&#x25A0; 30-60%</span>
          <span className="text-[9px] text-orange-400 ml-2">{t('auto.x25a0_lt_30_evasion_probable')}</span>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/50 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-400 mb-3">{t('auto.legende')}</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <p className="text-[10px] text-slate-400">{t('auto.activite_documentee')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <p className="text-[10px] text-slate-400">{t('auto.activite_systeme_source_infra_')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-orange-500 opacity-40 flex-shrink-0" />
            <p className="text-[10px] text-slate-400">{t('auto.zone_de_silence_gt_24h')}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-0.5 h-4 bg-yellow-400 flex-shrink-0" />
            <p className="text-[10px] text-slate-400">{t('auto.evenement_couleur_kill_chain')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
