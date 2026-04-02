import { CalendarDays, CalendarRange, FileStack } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ReportType } from '../types';

const REPORT_TYPE_OPTIONS = (t: any) => [
  { value: 'full' as ReportType, label: t('report.full', { defaultValue: 'Complet' }), icon: FileStack },
  { value: 'daily' as ReportType, label: t('report.daily', { defaultValue: 'Quotidien' }), icon: CalendarDays },
  { value: 'weekly' as ReportType, label: t('report.weekly', { defaultValue: 'Hebdomadaire' }), icon: CalendarRange },
];

export function ReportOptionsBar({
  reportType,
  onReportTypeChange,
  selectedDate,
  onDateChange,
  weekCount,
  onWeekCountChange,
}: {
  reportType: ReportType;
  onReportTypeChange: (t: ReportType) => void;
  selectedDate: string;
  onDateChange: (d: string) => void;
  weekCount: 1 | 2;
  onWeekCountChange: (c: 1 | 2) => void;
}) {
  const { t } = useTranslation();
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-3">
      <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
        {REPORT_TYPE_OPTIONS(t).map(opt => {
          const Icon = opt.icon;
          const isActive = reportType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onReportTypeChange(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isActive
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
      {reportType !== 'full' && (
        <>
          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              {reportType === 'daily' ? 'Date :' : 'Du :'}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      )}
      {reportType === 'weekly' && (
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
          <button onClick={() => onWeekCountChange(1)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${weekCount === 1 ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>
            {t('auto.1_semaine')}
          </button>
          <button onClick={() => onWeekCountChange(2)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${weekCount === 2 ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>
            {t('auto.2_semaines')}
          </button>
        </div>
      )}
    </div>
  );
}
