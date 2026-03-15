import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { BarChart3, Clock, Globe, Save, RotateCcw, Check } from 'lucide-react';
import { EventCalendar } from './EventCalendar';
import { useTranslation } from "react-i18next";

interface Props {
  caseId: string;
  isReportView?: boolean;
  forceTheme?: 'light' | 'dark';
}

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function jsDayToIso(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function applyOffset(date: Date, offsetHours: number): Date {
  const ms = date.getTime() + offsetHours * 3600_000;
  return new Date(ms);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ActivityPlot({ caseId, isReportView, forceTheme }: Props) {
  const { t } = useTranslation();
  const { theme: globalTheme } = useTheme();
  const theme = forceTheme || globalTheme;
  const isDark = theme === 'dark';
  const [rawDates, setRawDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [utcOffset, setUtcOffset] = useState(0);
  const [savedOffset, setSavedOffset] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [eventsRes, caseRes] = await Promise.all([
          api.get(`/investigation/events/by-case/${caseId}`),
          api.get(`/cases/${caseId}`),
        ]);

        if (eventsRes && eventsRes.length > 0) {
          setRawDates(eventsRes.map((e: any) => new Date(e.event_datetime)));
        }

        if (caseRes && caseRes.attacker_utc_offset !== null && caseRes.attacker_utc_offset !== undefined) {
          const saved = caseRes.attacker_utc_offset;
          setSavedOffset(saved);
          setUtcOffset(saved);
        }
      } catch (err) { console.error(err); }
      setLoading(false);
    })();
  }, [caseId]);

  const handleSaveOffset = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // First get current case data to not overwrite other fields
      const currentCase = await api.get(`/cases/${caseId}`);
      if (currentCase) {
        await api.put(`/cases/${caseId}`, {
          title: currentCase.title,
          description: currentCase.description,
          severity_id: currentCase.severity_id,
          status: currentCase.status,
          tlp: currentCase.tlp?.code,
          pap: currentCase.pap?.code,
          attacker_utc_offset: utcOffset
        });
        setSavedOffset(utcOffset);
      } else {
        throw new Error("Case not found");
      }
    } catch (error: any) {
      setSaveError(error.message);
    }
    setSaving(false);
  };

  const handleResetOffset = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const currentCase = await api.get(`/cases/${caseId}`);
      if (currentCase) {
        await api.put(`/cases/${caseId}`, {
          title: currentCase.title,
          description: currentCase.description,
          severity_id: currentCase.severity_id,
          status: currentCase.status,
          tlp: currentCase.tlp?.code,
          pap: currentCase.pap?.code,
          attacker_utc_offset: 0
        });
        setSavedOffset(null);
        setUtcOffset(0);
      } else {
        throw new Error("Case not found");
      }
    } catch (error: any) {
      setSaveError(error.message);
    }
    setSaving(false);
  };

  const { hourly, daily, calendarMap } = useMemo(() => {
    const h = new Array(24).fill(0);
    const d = new Array(7).fill(0);
    const cal = new Map<string, number>();

    rawDates.forEach(raw => {
      const dt = applyOffset(raw, utcOffset);
      h[dt.getUTCHours()]++;
      d[jsDayToIso(dt.getUTCDay())]++;
      const key = dateKey(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
      cal.set(key, (cal.get(key) || 0) + 1);
    });

    return { hourly: h, daily: d, calendarMap: cal };
  }, [rawDates, utcOffset]);

  const total = rawDates.length;
  const hourLabels = useMemo(
    () => Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`),
    [],
  );

  const offsetLabel = utcOffset >= 0 ? `UTC+${utcOffset}` : `UTC${utcOffset}`;

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-slate-400">
        <BarChart3 className="w-10 h-10 mb-3" />
        <p className="text-sm font-medium mb-1">{t('auto.aucun_evenement')}</p>
        <p className="text-xs">{t('auto.ajoutez_des_evenements_dans_la')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {!isReportView && (
        <UtcOffsetSlider
          value={utcOffset}
          onChange={setUtcOffset}
          isDark={isDark}
          savedOffset={savedOffset}
          saving={saving}
          saveError={saveError}
          onSave={handleSaveOffset}
          onReset={handleResetOffset}
        />
      )}

      <BarChartSection
        title={`${t('auto.activite_par_heure')} (${offsetLabel})`}
        subtitle={t('auto.distribution_24h')}
        labels={hourLabels}
        values={hourly}
        isDark={isDark}
        accentFrom="#0ea5e9"
        accentTo="#0284c7"
        total={total}
      />

      <BarChartSection
        title={`${t('auto.activite_par_jour')} (${offsetLabel})`}
        subtitle={t('auto.distribution_par_jour')}
        labels={DAY_SHORT}
        fullLabels={DAY_LABELS}
        values={daily}
        isDark={isDark}
        accentFrom="#f59e0b"
        accentTo="#d97706"
        total={total}
      />

      <EventCalendar eventDates={calendarMap} utcOffset={utcOffset} />
    </div>
  );
}

function UtcOffsetSlider({
  value,
  onChange,
  isDark,
  savedOffset,
  saving,
  saveError,
  onSave,
  onReset,
}: {
  value: number;
  onChange: (v: number) => void;
  isDark: boolean;
  savedOffset: number | null;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const label = value >= 0 ? `UTC+${value}` : `UTC${value}`;
  const ticks = Array.from({ length: 25 }, (_, i) => i - 12);
  const isSaved = savedOffset === value;
  const hasChanged = savedOffset !== value;

  return (
    <div className={`
      rounded-xl p-5 border
      ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-gray-50 border-gray-200'}
    `}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-white shadow-sm'}`}>
          <Globe className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">
            {t('auto.decalage_horaire_de_l_attaquan')}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {t('auto.ajustez_pour_identifier_le_fus')}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedOffset !== null && (
            <div className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
              ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'}
            `}>
              <Check className="w-3 h-3" />
              {t('auto.enregistre')}{savedOffset >= 0 ? `UTC+${savedOffset}` : `UTC${savedOffset}`}
            </div>
          )}
          <div className={`
            px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums
            ${isDark ? 'bg-sky-900/50 text-sky-300' : 'bg-sky-100 text-sky-700'}
          `}>
            {label}
          </div>
        </div>
      </div>

      <div className="px-1">
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-500
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white dark:[&::-webkit-slider-thumb]:border-slate-900
            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sky-500
            [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white dark:[&::-moz-range-thumb]:border-slate-900"
          style={{
            background: isDark
              ? `linear-gradient(to right, #334155, #0ea5e9 ${((value + 12) / 24) * 100}%, #334155 ${((value + 12) / 24) * 100}%)`
              : `linear-gradient(to right, #e2e8f0, #0ea5e9 ${((value + 12) / 24) * 100}%, #e2e8f0 ${((value + 12) / 24) * 100}%)`,
          }}
        />

        <div className="flex justify-between mt-1.5">
          {ticks.filter((_, i) => i % 4 === 0 || i === 24).map(t => (
            <span
              key={t}
              className={`text-[9px] tabular-nums ${t === value
                ? 'text-sky-500 font-bold'
                : t === 0
                  ? 'text-gray-500 dark:text-slate-400 font-medium'
                  : 'text-gray-300 dark:text-slate-600'
                }`}
            >
              {t >= 0 ? `+${t}` : t}
            </span>
          ))}
        </div>
      </div>

      {saveError && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
          {t('auto.erreur')}{saveError}
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
        <div>
          {value !== 0 && (
            <p className="text-[11px] text-gray-400 dark:text-slate-500">
              {t('auto.les_heures_affichees_correspon')}{label} {t('auto.point_de_vue_attaquant')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedOffset !== null && (
            <button
              onClick={onReset}
              disabled={saving}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${isDark
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50'
                }
              `}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('auto.reinitialiser')}</button>
          )}
          <button
            onClick={onSave}
            disabled={saving || isSaved}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${isSaved
                ? isDark
                  ? 'bg-green-900/30 text-green-400 cursor-default'
                  : 'bg-green-50 text-green-700 cursor-default'
                : hasChanged
                  ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm disabled:opacity-50'
                  : isDark
                    ? 'bg-slate-700 text-slate-400 disabled:opacity-50'
                    : 'bg-gray-200 text-gray-500 disabled:opacity-50'
              }
            `}
          >
            {isSaved ? (
              <><Check className="w-3.5 h-3.5" /> {t('auto.enregistre_32')}</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> {t('auto.enregistrer')}{label}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BarChartProps {
  title: string;
  subtitle: string;
  labels: string[];
  fullLabels?: string[];
  values: number[];
  isDark: boolean;
  accentFrom: string;
  accentTo: string;
  total: number;
}

function BarChartSection({
  title,
  subtitle,
  labels,
  fullLabels,
  values,
  isDark,
  accentFrom,
  accentTo,
  total,
}: BarChartProps) {
  const { t } = useTranslation();
  const max = Math.max(...values, 1);
  const peakIdx = values.indexOf(max);
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const textBright = isDark ? '#e2e8f0' : '#1e293b';

  const chartW = 800;
  const chartH = 260;
  const padL = 44;
  const padR = 16;
  const padT = 12;
  const padB = 40;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const barCount = values.length;
  const gap = Math.max(2, innerW * 0.02);
  const barW = (innerW - gap * (barCount - 1)) / barCount;

  const gridLines = 4;
  const step = Math.ceil(max / gridLines) || 1;
  const yMax = step * gridLines;
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => i * step);

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="w-full min-w-[600px]"
          style={{ aspectRatio: `${chartW}/${chartH}` }}
        >
          {yTicks.map(tick => {
            const y = padT + innerH - (tick / yMax) * innerH;
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  x2={chartW - padR}
                  y1={y}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth={tick === 0 ? 1 : 0.5}
                  strokeDasharray={tick === 0 ? '' : '4 3'}
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill={textColor}
                  style={{ fontSize: 10 }}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {values.map((val, i) => {
            const x = padL + i * (barW + gap);
            const barH = (val / yMax) * innerH;
            const y = padT + innerH - barH;
            const isPeak = i === peakIdx && val > 0;
            const isH = hovered === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={x}
                  y={padT}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                />

                {val > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(barH, 2)}
                    rx={Math.min(barW / 4, 4)}
                    fill={isPeak ? accentFrom : isH ? accentFrom : accentTo}
                    opacity={isH || isPeak ? 1 : 0.7}
                    style={{ transition: 'opacity 150ms, y 200ms, height 200ms' }}
                  />
                )}

                {isH && val > 0 && (
                  <g>
                    <rect
                      x={x + barW / 2 - 24}
                      y={y - 26}
                      width={48}
                      height={22}
                      rx={6}
                      fill={isDark ? '#1e293b' : '#0f172a'}
                      fillOpacity={0.92}
                    />
                    <text
                      x={x + barW / 2}
                      y={y - 12}
                      textAnchor="middle"
                      fill="#f8fafc"
                      style={{ fontSize: 11, fontWeight: 600 }}
                    >
                      {val}
                    </text>
                  </g>
                )}

                <text
                  x={x + barW / 2}
                  y={padT + innerH + 16}
                  textAnchor="middle"
                  fill={isPeak ? textBright : textColor}
                  style={{ fontSize: barCount > 10 ? 9 : 11, fontWeight: isPeak ? 700 : 400 }}
                >
                  {labels[i]}
                </text>

                {isPeak && (
                  <text
                    x={x + barW / 2}
                    y={padT + innerH + 28}
                    textAnchor="middle"
                    fill={accentFrom}
                    style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}
                  >
                    {t('auto.pic')}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-slate-400">
        <span>
          {t('auto.total')}<strong className="text-gray-800 dark:text-slate-200">{total}</strong> {t('auto.evenements')}</span>
        <span>
          {t('auto.pic_33')}<strong className="text-gray-800 dark:text-slate-200">
            {fullLabels ? fullLabels[peakIdx] : labels[peakIdx]}
          </strong> ({max} {t('auto.evenements_34')}</span>
      </div>
    </div>
  );
}
