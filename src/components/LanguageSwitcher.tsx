import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  const toggle = () => i18n.changeLanguage(current === 'fr' ? 'en' : 'fr');

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 text-xs font-semibold rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
      title={current === 'fr' ? 'Switch to English' : 'Passer en français'}
    >
      {current === 'fr' ? 'EN' : 'FR'}
    </button>
  );
}
