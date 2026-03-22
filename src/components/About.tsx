import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Info, Shield, GitBranch, FileText, ChevronRight } from 'lucide-react';
import { Logo } from './Logo';

export function About() {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-8 py-10 flex flex-col items-center text-center">
          <Logo size="lg" showText={false} />
          <h1 className="mt-4 text-2xl font-bold text-white tracking-tight">ORIS</h1>
          <p className="mt-1 text-blue-200 text-sm">{t('about.subtitle')}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <GitBranch className="w-3.5 h-3.5" />
            {t('about.version')} {t('auto.0_9_beta')}
          </div>
        </div>

        <div className="px-8 py-8 space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('about.platform')}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                {t('about.platformDescription')}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('about.information')}</h2>
              <div className="mt-2 space-y-1.5 text-sm text-gray-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>{t('about.version')}</span>
                  <span className="font-medium text-gray-700 dark:text-slate-300">{t('auto.0_9_beta')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('about.status')}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                    {t('about.beta')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('about.apiDocs')}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                <Link to="/api-docs" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  {t('apiDocs.title')}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 border-t border-gray-100 dark:border-slate-800 text-center text-xs text-gray-500 dark:text-slate-400">
          {t('about.copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </div>
  );
}
