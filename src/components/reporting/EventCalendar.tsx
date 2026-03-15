import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface Props {
  eventDates: Map<string, number>;
  utcOffset: number;
}

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];
const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EventCalendar({ eventDates, utcOffset }: Props) {
    const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const sortedKeys = useMemo(() => {
    const keys = Array.from(eventDates.keys()).sort();
    return keys;
  }, [eventDates]);

  const initialDate = useMemo(() => {
    if (sortedKeys.length > 0) {
      const [y, m] = sortedKeys[0].split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [sortedKeys]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  const maxCount = useMemo(() => {
    let m = 0;
    eventDates.forEach(v => { if (v > m) m = v; });
    return m || 1;
  }, [eventDates]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days: Array<{ date: Date | null; count: number }> = [];

    for (let i = 0; i < startDow; i++) {
      days.push({ date: null, count: 0 });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const key = dateKey(date);
      days.push({ date, count: eventDates.get(key) || 0 });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 0; i < remaining; i++) {
        days.push({ date: null, count: 0 });
      }
    }

    return days;
  }, [viewYear, viewMonth, eventDates]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const totalDays = useMemo(() => {
    let count = 0;
    eventDates.forEach(v => { if (v > 0) count++; });
    return count;
  }, [eventDates]);

  const offsetLabel = utcOffset >= 0 ? `UTC+${utcOffset}` : `UTC${utcOffset}`;

  function intensityClass(count: number): string {
    if (count === 0) return '';
    const ratio = count / maxCount;
    if (ratio <= 0.25) return isDark ? 'bg-sky-900/50 text-sky-300' : 'bg-sky-100 text-sky-700';
    if (ratio <= 0.5) return isDark ? 'bg-sky-800/60 text-sky-200' : 'bg-sky-200 text-sky-800';
    if (ratio <= 0.75) return isDark ? 'bg-sky-700/70 text-sky-100' : 'bg-sky-300 text-sky-900';
    return isDark ? 'bg-sky-600 text-white' : 'bg-sky-500 text-white';
  }

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800">
          <CalendarDays className="w-4 h-4 text-gray-500 dark:text-slate-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-slate-200">{t('auto.calendrier_d_activite')}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {t('auto.jours_avec_des_evenements_en_s')}{offsetLabel})
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map(dh => (
          <div key={dh} className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 pb-1">
            {dh}
          </div>
        ))}

        {calendarDays.map((cell, idx) => {
          if (!cell.date) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const today = new Date();
          const isToday =
            cell.date.getDate() === today.getDate() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getFullYear() === today.getFullYear();

          return (
            <div
              key={idx}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center relative
                text-xs transition-all duration-150
                ${cell.count > 0
                  ? intensityClass(cell.count)
                  : 'text-gray-400 dark:text-slate-500'
                }
                ${isToday ? 'ring-1 ring-sky-400 dark:ring-sky-500' : ''}
              `}
              title={cell.count > 0 ? `${cell.count} evenement${cell.count > 1 ? 's' : ''}` : ''}
            >
              <span className={`text-[11px] leading-none ${cell.count > 0 ? 'font-bold' : 'font-medium'}`}>
                {cell.date.getDate()}
              </span>
              {cell.count > 0 && (
                <span className="text-[8px] font-bold leading-none mt-0.5 opacity-80">
                  {cell.count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500">
          <span>{t('auto.moins')}</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.6, 1].map((ratio, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-sm ${intensityClass(Math.ceil(ratio * maxCount))}`}
              />
            ))}
          </div>
          <span>{t('auto.plus')}</span>
        </div>
        <span className="text-xs text-gray-500 dark:text-slate-400">
          <strong className="text-gray-800 dark:text-slate-200">{totalDays}</strong> {t('auto.jours_actifs')}</span>
      </div>
    </div>
  );
}
