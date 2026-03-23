import { useState } from 'react';
import { api } from '../../lib/api';
import { X, Server, User, Bug, Globe, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface StixDynamicFormProps {
  caseId: string;
  taskId: string;
  onClose: () => void;
  onCreated: () => void;
}

type StixCategory = 'infrastructure' | 'user-account' | 'malware' | 'indicator';
type IndicatorSubType = 'ipv4-addr' | 'domain-name' | 'url';

const CATEGORIES: { key: StixCategory; label: string; icon: typeof Server; color: string }[] = [
  { key: 'infrastructure', label: 'Système / Infrastructure', icon: Server, color: 'text-teal-600 dark:text-teal-400' },
  { key: 'user-account', label: 'Compte Utilisateur compromis', icon: User, color: 'text-amber-600 dark:text-amber-400' },
  { key: 'malware', label: 'Malware / Outil', icon: Bug, color: 'text-red-600 dark:text-red-400' },
  { key: 'indicator', label: 'Indicateur Réseau (IP, Domaine, URL)', icon: Globe, color: 'text-blue-600 dark:text-blue-400' },
];

export function StixDynamicForm({ caseId, taskId, onClose, onCreated }: StixDynamicFormProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<StixCategory | null>(null);
  const [indicatorSubType, setIndicatorSubType] = useState<IndicatorSubType>('ipv4-addr');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [infraType, setInfraType] = useState('server');
  const [accountName, setAccountName] = useState('');
  const [domain, setDomain] = useState('');
  const [malwareFamily, setMalwareFamily] = useState('');
  const [sha256, setSha256] = useState('');
  const [md5, setMd5] = useState('');
  const [indicatorValue, setIndicatorValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    setSaving(true);
    setError(null);

    try {
      let stix_type = category as string;
      let data: any = {};

      if (category === 'infrastructure') {
        if (!name.trim()) { setError('Le nom est requis'); setSaving(false); return; }
        data = { name: name.trim(), description: description.trim(), infrastructure_type: infraType };
      }

      if (category === 'user-account') {
        if (!accountName.trim()) { setError("Le nom de compte est requis"); setSaving(false); return; }
        data = { account_name: accountName.trim(), domain: domain.trim(), display_name: `${accountName.trim()}${domain.trim() ? '@' + domain.trim() : ''}` };
      }

      if (category === 'malware') {
        if (!name.trim()) { setError('Le nom est requis'); setSaving(false); return; }
        data = {
          name: name.trim(),
          description: description.trim(),
          file_name: name.trim(),
          malware_types: malwareFamily.trim() ? [malwareFamily.trim()] : ['unknown'],
          sha256: sha256.trim() || undefined,
          md5: md5.trim() || undefined,
        };
      }

      if (category === 'indicator') {
        if (!indicatorValue.trim()) { setError('La valeur est requise'); setSaving(false); return; }
        stix_type = indicatorSubType;
        data = { value: indicatorValue.trim() };
      }

      await api.post('/investigation/stix', {
        case_id: caseId,
        task_id: taskId,
        stix_type,
        data,
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {t('auto.ajouter_element_technique', 'Ajouter un élément technique')}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category selector */}
          {!category ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-slate-300 mb-4">
                {t('auto.choisir_type_element', 'Quel type d\'élément souhaitez-vous ajouter ?')}
              </p>
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition text-left group"
                  >
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition">
                      <Icon className={`w-5 h-5 ${cat.color}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              {/* Back to category selection */}
              <button
                type="button"
                onClick={() => { setCategory(null); setError(null); }}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                ← {t('auto.changer_type', 'Changer de type')}
              </button>

              {/* Dynamic fields per category */}
              {category === 'infrastructure' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.nom_hostname', 'Nom (Hostname)')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="SRV-DC01"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.type_systeme', 'Type de système')}
                    </label>
                    <select
                      value={infraType}
                      onChange={e => setInfraType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                    >
                      <option value="server">Serveur</option>
                      <option value="workstation">Poste de travail</option>
                      <option value="network">Équipement réseau</option>
                      <option value="cloud">Cloud</option>
                      <option value="unknown">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.description')}
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                      placeholder="Description optionnelle..."
                    />
                  </div>
                </div>
              )}

              {category === 'user-account' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.nom_utilisateur', 'Nom d\'utilisateur')} *
                    </label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="admin.user"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.domaine', 'Domaine')}
                    </label>
                    <input
                      type="text"
                      value={domain}
                      onChange={e => setDomain(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                      placeholder="CORP.LOCAL"
                    />
                  </div>
                </div>
              )}

              {category === 'malware' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.nom', 'Nom')} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="cobalt_strike.exe"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.famille', 'Famille')}
                    </label>
                    <input
                      type="text"
                      value={malwareFamily}
                      onChange={e => setMalwareFamily(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                      placeholder="CobaltStrike"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">SHA-256</label>
                      <input
                        type="text"
                        value={sha256}
                        onChange={e => setSha256(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-xs font-mono"
                        placeholder="e3b0c4..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">MD5</label>
                      <input
                        type="text"
                        value={md5}
                        onChange={e => setMd5(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white text-xs font-mono"
                        placeholder="d41d8c..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.description')}
                    </label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {category === 'indicator' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.type_indicateur', 'Type d\'indicateur')}
                    </label>
                    <div className="flex gap-2">
                      {([
                        { key: 'ipv4-addr' as IndicatorSubType, label: 'Adresse IP' },
                        { key: 'domain-name' as IndicatorSubType, label: 'Domaine' },
                        { key: 'url' as IndicatorSubType, label: 'URL' },
                      ]).map(sub => (
                        <button
                          key={sub.key}
                          type="button"
                          onClick={() => setIndicatorSubType(sub.key)}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition ${indicatorSubType === sub.key
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                            : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-gray-400'
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.valeur', 'Valeur')} *
                    </label>
                    <input
                      type="text"
                      value={indicatorValue}
                      onChange={e => setIndicatorValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                      placeholder={indicatorSubType === 'ipv4-addr' ? '8.8.8.8' : indicatorSubType === 'domain-name' ? 'malicious.example.com' : 'https://evil.com/payload'}
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-sm"
                >
                  {t('auto.annuler')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? t('auto.creation_en_cours', 'Création...') : t('auto.creer', 'Créer')}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
