import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Settings, Lock, Clock, Shield } from 'lucide-react';
import { KILL_CHAIN_DEFINITIONS, KillChainType } from '../../lib/killChainDefinitions';
import { BackupPanel } from '../BackupPanel';
import { WebhooksPanel } from '../WebhooksPanel';

export function SystemOperationsPanel() {
  const { t } = useTranslation();

  const [savingConfig, setSavingConfig] = useState(false);
  const [sessionLockEnabled, setSessionLockEnabled] = useState(false);
  const [sessionLockTimeout, setSessionLockTimeout] = useState(5);
  const [allowApiTokens, setAllowApiTokens] = useState(true);
  const [allowDiamondDeletion, setAllowDiamondDeletion] = useState(false);
  const [allowCommentEditing, setAllowCommentEditing] = useState(true);
  const [allowCommentDeletion, setAllowCommentDeletion] = useState(true);
  const [defaultKillChainType, setDefaultKillChainType] = useState<KillChainType>('cyber_kill_chain');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const data = await api.get('/admin/config');
      if (data) {
        for (const row of data) {
          if (row.key === 'default_kill_chain_type') setDefaultKillChainType((row.value as KillChainType) || 'cyber_kill_chain');
          if (row.key === 'allow_api_tokens') setAllowApiTokens(row.value === 'true');
          if (row.key === 'allow_diamond_deletion') setAllowDiamondDeletion(row.value === 'true');
          if (row.key === 'allow_comment_editing') setAllowCommentEditing(row.value !== 'false'); // true by default
          if (row.key === 'allow_comment_deletion') setAllowCommentDeletion(row.value !== 'false'); // true by default
          if (row.key === 'session_lock_enabled') setSessionLockEnabled(row.value === 'true');
          if (row.key === 'session_lock_timeout') setSessionLockTimeout(parseInt(row.value, 10) || 5);
        }
      }
    } catch (err) { console.error(err); }
  };

  const toggleAllowApiTokens = async () => {
    const newValue = !allowApiTokens;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'allow_api_tokens', value: String(newValue) });
      setAllowApiTokens(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const toggleAllowDiamondDeletion = async () => {
    const newValue = !allowDiamondDeletion;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'allow_diamond_deletion', value: String(newValue) });
      setAllowDiamondDeletion(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const toggleAllowCommentEditing = async () => {
    const newValue = !allowCommentEditing;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'allow_comment_editing', value: String(newValue) });
      setAllowCommentEditing(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const toggleAllowCommentDeletion = async () => {
    const newValue = !allowCommentDeletion;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'allow_comment_deletion', value: String(newValue) });
      setAllowCommentDeletion(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const saveKillChainType = async (type: KillChainType) => {
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'default_kill_chain_type', value: type });
      setDefaultKillChainType(type);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const toggleSessionLock = async () => {
    const newValue = !sessionLockEnabled;
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'session_lock_enabled', value: String(newValue) });
      setSessionLockEnabled(newValue);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  const saveSessionLockTimeout = async (minutes: number) => {
    setSavingConfig(true);
    try {
      await api.put('/admin/config', { key: 'session_lock_timeout', value: String(minutes) });
      setSessionLockTimeout(minutes);
    } catch (err) { console.error(err); }
    setSavingConfig(false);
  };

  return (
    <div className="animate-in fade-in space-y-8 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-500" />
          Système & Opérations
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">Configurez le comportement de la plateforme, les sauvegardes locales, et les webhooks intégrés.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm dark:shadow-slate-800/50 border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2 bg-gray-50/50 dark:bg-slate-800/30">
          <Settings className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-white flex-1">{t('admin.config', 'Configuration Générale')}</h3>
          {savingConfig && <span className="text-xs font-medium text-blue-500 animate-pulse bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded">Sauvegarde...</span>}
        </div>
        <div className="px-6 py-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                {t('admin.allowApiTokensTitle', 'Autoriser les jetons d\'API (Tokens)')}
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">{t('admin.allowApiTokensDesc', 'Si désactivé, aucun utilissateur ne pourra générer des jetons d\'accès pour interagir avec l\'API sans session.')}</p>
            </div>
            <button
              type="button"
              disabled={savingConfig}
              onClick={toggleAllowApiTokens}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${allowApiTokens ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
              aria-label={t('admin.allowApiTokensTitle', 'Jets d\'API')}
              role="switch"
              aria-checked={allowApiTokens}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowApiTokens ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  Autoriser la suppression du modèle diamant (manuel)
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">Si désactivé, la suppression d'un diamant directement depuis l'onglet Modèle Diamant sera bloquée. Il faudra supprimer la tâche associée.</p>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={toggleAllowDiamondDeletion}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${allowDiamondDeletion ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                aria-label="Autoriser suppression Modèle Diamant"
                role="switch"
                aria-checked={allowDiamondDeletion}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowDiamondDeletion ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  Autoriser la modification des commentaires
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">Si désactivé, les utilisateurs (y compris les auteurs) ne pourront plus éditer leurs commentaires sur les tâches.</p>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={toggleAllowCommentEditing}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${allowCommentEditing ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                aria-label="Autoriser modification commentaires"
                role="switch"
                aria-checked={allowCommentEditing}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowCommentEditing ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  Autoriser la suppression des commentaires
                </p>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">Si désactivé, il sera impossible de masquer/supprimer les commentaires existants.</p>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={toggleAllowCommentDeletion}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${allowCommentDeletion ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                aria-label="Autoriser suppression commentaires"
                role="switch"
                aria-checked={allowCommentDeletion}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${allowCommentDeletion ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('admin.sessionLockTitle', 'Verrouillage automatique de session')}</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xl">{t('admin.sessionLockDesc', 'Verrouille l\'écran après inactivité. Necessitera le mot de passe pour revenir.')}</p>
                  
                  {sessionLockEnabled && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-lg border border-gray-100 dark:border-slate-700/50 w-fit">
                      <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                      <label className="text-sm font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">{t('admin.sessionLockTimeout', 'Délai d\'inactivité max')}</label>
                      <select
                        value={sessionLockTimeout}
                        onChange={(e) => saveSessionLockTimeout(Number(e.target.value))}
                        disabled={savingConfig}
                        className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-slate-200 disabled:opacity-50 cursor-pointer shadow-sm ml-2"
                      >
                        {[1, 2, 5, 10, 15, 30, 60].map(m => (
                          <option key={m} value={m}>{m} {t('admin.minutes', 'minutes')}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={toggleSessionLock}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ${sessionLockEnabled ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                aria-label={t('admin.sessionLockTitle', 'Session Lock')}
                role="switch"
                aria-checked={sessionLockEnabled}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${sessionLockEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" />
                {t('admin.defaultKillChain', 'Kill Chain par défaut (Investigation)')}
              </p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-2xl">{t('admin.defaultKillChainDesc', 'Détermine le modèle technique mis en avant en premier lors des cartographies et TTPs.')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(KILL_CHAIN_DEFINITIONS) as KillChainType[]).map((type) => {
                const def = KILL_CHAIN_DEFINITIONS[type];
                const isSelected = defaultKillChainType === type;
                const label = t(`killChain.${type}_label`, type.toUpperCase());
                const description = t(`killChain.${type}_desc`, 'Description non définie.');
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={savingConfig}
                    onClick={() => saveKillChainType(type)}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group ${isSelected
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-500 hover:shadow-md'
                      }`}
                  >
                    {isSelected && (
                       <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500 opacity-10 rotate-45 transform translate-x-8 -translate-y-8" />
                    )}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-base font-bold tracking-tight ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                        {label}
                      </span>
                      {isSelected && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-slate-400 min-h-[40px] leading-snug">{description}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-slate-500"></span>
                      {def.phases.length} {t('auto.phases', 'phases')}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute -left-3 top-6 w-1 h-12 bg-gray-200 dark:bg-slate-700 rounded-r-lg" />
        <BackupPanel />
      </div>

      <div className="relative">
        <div className="absolute -left-3 top-6 w-1 h-12 bg-gray-200 dark:bg-slate-700 rounded-r-lg" />
        <WebhooksPanel />
      </div>

    </div>
  );
}
