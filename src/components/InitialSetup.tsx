import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { AlertCircle, Shield, Target, Crosshair, Upload, Loader2 } from 'lucide-react';
import { Logo } from './Logo';
import { useTranslation } from "react-i18next";
import { KillChainType } from '../lib/killChainDefinitions';

interface InitialSetupProps {
  onComplete: () => void;
}

export function InitialSetup({ onComplete }: InitialSetupProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    language: i18n.language || 'fr',
    beneficiaryName: '',
    beneficiaryDescription: '',
  });
  const [selectedKillChain, setSelectedKillChain] = useState<KillChainType>('cyber_kill_chain');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    checkExistingAdmin();
  }, []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setFormData({ ...formData, language: newLang });
    i18n.changeLanguage(newLang);
  };

  const checkExistingAdmin = async () => {
    try {
      const { hasAdmin } = await api.get('/admin/setup-status');
      if (hasAdmin) {
        setAdminExists(true);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('auto.les_mots_de_passe_ne_correspondent_p'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('auto.le_mot_de_passe_doit_contenir_au_moi'));
      return;
    }

    setLoading(true);

    try {
      const { hasAdmin } = await api.get('/admin/setup-status');

      if (hasAdmin) {
        setError(t('auto.un_administrateur_existe_d_j_dans_le'));
        setLoading(false);
        setAdminExists(true);
        return;
      }

      // Register the admin user directly
      const response = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        roles: ['admin']
      });

      api.setToken(response.session.access_token);
      setStep(2);

    } catch (err) {
      setError(err instanceof Error ? err.message : t('auto.une_erreur_est_survenue'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.put('/admin/config', {
        key: 'default_kill_chain_type',
        value: selectedKillChain
      });

      await api.put('/admin/config', {
        key: 'default_language',
        value: formData.language
      });

      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auto.une_erreur_est_survenue'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create beneficiary
      const { id: beneId } = await api.post('/admin/beneficiaries', {
        name: formData.beneficiaryName,
        description: formData.beneficiaryDescription
      });

      // 2. Add current admin as member
      const profile = await api.get('/auth/me');
      if (profile?.user?.id) {
        await api.post(`/admin/beneficiaries/${beneId}/members`, {
          user_id: profile.user.id
        });
      }

      // 3. Update initialization complete flag
      await api.put('/admin/config', {
        key: 'initialization_complete',
        value: 'true'
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auto.une_erreur_est_survenue'));
    } finally {
      setLoading(false);
    }
  };

  const killChainOptions = [
    {
      id: 'cyber_kill_chain' as const,
      icon: Target,
      label: t('killChain.cyber_kill_chain_label'),
      description: t('killChain.cyber_kill_chain_desc'),
      phases: 7,
      pros: t('auto.simple_classique_et_historique_id_al'),
      cons: t('auto.marge_de_man_uvre_limit_e_pour_les_m'),
    },
    {
      id: 'unified_kill_chain' as const,
      icon: Crosshair,
      label: t('killChain.unified_kill_chain_label'),
      description: t('killChain.unified_kill_chain_desc'),
      phases: 18,
      pros: t('auto.extr_mement_exhaustif_fusionne_les_m'),
      cons: t('auto.peut_devenir_lourd_et_complexe_pour_'),
    },
    {
      id: 'mitre_attack' as const,
      icon: Shield,
      label: t('killChain.mitre_attack_label'),
      description: t('killChain.mitre_attack_desc'),
      phases: 14,
      pros: t('auto.le_standard_absolu_des_soc_et_edr_ac'),
      cons: t('auto.tr_s_vaste_sa_granularit_asym_trique'),
    },
  ] as const;

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="text-gray-600 dark:text-slate-400">{t('auto.v_rification_en_cours')}</div>
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-yellow-500 p-3 rounded-full">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">
            {t('auto.syst_me_d_j_configur')}</h1>
          <p className="text-center text-gray-600 dark:text-slate-400 mb-6">
            {t('auto.un_compte_administrateur_exist')}</p>

          <button
            onClick={() => onComplete()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            {t('auto.aller_la_page_de_connexion')}</button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-4xl w-full p-6 sm:p-8">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">
            {t('auto.choix_de_la_kill_chain')}
          </h1>
          <p className="text-center text-gray-600 dark:text-slate-400 mb-8 max-w-xl mx-auto">
            {t('auto.s_lectionnez_le_mod_le_de_mod_lisati')}
          </p>

          <form onSubmit={handleSubmitStep2} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {killChainOptions.map((opt) => (
                <label
                  key={opt.id}
                  className={`relative flex flex-col p-4 sm:p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${selectedKillChain === opt.id
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 shadow-md shadow-blue-500/10'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                >
                  <input
                    type="radio"
                    name="killchain"
                    value={opt.id}
                    checked={selectedKillChain === opt.id}
                    onChange={(e) => setSelectedKillChain(e.target.value as KillChainType)}
                    className="sr-only"
                  />

                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg ${selectedKillChain === opt.id
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                      <opt.icon className="w-6 h-6" />
                    </div>
                    {selectedKillChain === opt.id && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <p className="text-lg font-bold text-gray-800 dark:text-white mb-1">{opt.label}</p>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4">{opt.description}</p>

                  <div className="space-y-4 flex-1">
                    <div>
                      <h4 className="text-xs font-semibold text-green-600 dark:text-green-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        {t('auto.avantages')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                        {opt.pros}
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                        {t('auto.inconv_nients')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                        {opt.cons}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto min-w-[300px] bg-blue-600 text-white py-3 px-8 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
              >
                {loading ? t('auto.finalisation_en_cours') : t('auto.terminer_la_configuration')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-8 border border-transparent dark:border-slate-800">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">
            {t('auto.creation_du_beneficiaire')}
          </h1>
          <p className="text-center text-gray-600 dark:text-slate-400 mb-6 font-medium">
            {t('auto.beneficiaire_obligatoire')}
          </p>

          <form onSubmit={handleSubmitStep3} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('auto.nom_du_beneficiaire_label')}
              </label>
              <input
                type="text"
                required
                value={formData.beneficiaryName}
                onChange={(e) => setFormData({ ...formData, beneficiaryName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                placeholder={t('auto.nom_du_beneficiaire_label')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('auto.description_facultative_label')}
              </label>
              <textarea
                value={formData.beneficiaryDescription}
                onChange={(e) => setFormData({ ...formData, beneficiaryDescription: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-8 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? t('auto.finalisation_en_cours') : t('auto.creer_et_terminer')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full p-8 border border-transparent dark:border-slate-800">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">
          {t('auto.configuration_initiale')}</h1>
        <p className="text-center text-gray-600 dark:text-slate-400 mb-6">
          {t('auto.cr_ation_du_compte_administrat')}</p>

        <form onSubmit={handleSubmitStep1} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('settings.language.title')}
            </label>
            <select
              value={formData.language}
              onChange={handleLanguageChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.nom_complet')}</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.email')}</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.mot_de_passe')}</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.confirmer_le_mot_de_passe')}</label>
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auto.cr_ation_en_cours') : t('auto.cr_er_le_compte_administrateur')}
          </button>
        </form>

        {/* Restore from backup section */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-3">
            Ou restaurer depuis une sauvegarde complète
          </p>
          {restoreError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm mb-3">
              {restoreError}
            </div>
          )}
          <label
            className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg font-medium transition cursor-pointer
              ${restoring
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600'
              }`}
          >
            {restoring ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Restauration en cours…</>
            ) : (
              <><Upload className="w-4 h-4" /> Importer une sauvegarde (.zip)</>
            )}
            <input
              type="file"
              accept=".zip"
              className="hidden"
              disabled={restoring}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setRestoring(true);
                setRestoreError('');
                try {
                  const formData = new FormData();
                  formData.append('backup', file);
                  const resp = await fetch('/api/backup/restore', { method: 'POST', body: formData });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Restore failed');
                  // Restore succeeded — go to login
                  onComplete();
                } catch (err) {
                  setRestoreError(err instanceof Error ? err.message : 'Erreur lors de la restauration');
                } finally {
                  setRestoring(false);
                  e.target.value = ''; // reset file input
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
