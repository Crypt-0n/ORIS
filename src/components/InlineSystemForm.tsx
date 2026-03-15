import { useState } from 'react';
import { api } from '../lib/api';
import { Plus, X, Save } from 'lucide-react';
import { useTranslation } from "react-i18next";

interface IpEntry {
  ip: string;
  mask: string;
  gateway: string;
}

const SYSTEM_TYPES = [
  { value: 'ordinateur', label: 'Ordinateur' },
  { value: 'serveur', label: 'Serveur' },
  { value: 'telephone', label: 'Telephone' },
  { value: 'tablette', label: 'Tablette' },
  { value: 'tv', label: 'TV' },
  { value: 'equipement_reseau', label: 'Equipement reseau' },
  { value: 'equipement_iot', label: 'Equipement IoT' },
  { value: 'autre', label: 'Autre' },
] as const;

const EMPTY_IP: IpEntry = { ip: '', mask: '', gateway: '' };

interface InlineSystemFormProps {
  caseId: string;
  onCreated: (id: string, name: string) => void;
  onCancel: () => void;
}

export function InlineSystemForm({ caseId, onCreated, onCancel }: InlineSystemFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [systemType, setSystemType] = useState('');
  const [owner, setOwner] = useState('');
  const [ips, setIps] = useState<IpEntry[]>([{ ...EMPTY_IP }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddIp = () => setIps([...ips, { ...EMPTY_IP }]);

  const handleRemoveIp = (index: number) => {
    if (ips.length <= 1) return;
    setIps(ips.filter((_, i) => i !== index));
  };

  const handleIpChange = (index: number, field: keyof IpEntry, value: string) => {
    const updated = [...ips];
    updated[index] = { ...updated[index], [field]: value };
    setIps(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    if (!systemType) {
      setError('Le type est obligatoire');
      return;
    }

    setSaving(true);
    setError('');

    const cleanedIps = ips.filter(ip => ip.ip.trim() !== '');

    try {
      const data = await api.post('/investigation/systems', {
        case_id: caseId,
        name: name.trim(),
        system_type: systemType,
        ip_addresses: cleanedIps,
        owner: owner.trim()
      });

      onCreated(data.id, name.trim());
    } catch (err) {
      setError("Erreur lors de la creation du systeme");
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div className="border border-teal-200 dark:border-teal-800 rounded-lg p-3 bg-teal-50/50 dark:bg-teal-900/10 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{t('auto.nouveau_systeme')}</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
            {t('auto.nom')}<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auto.ex_pc_finance_01')}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
            {t('auto.type')}<span className="text-red-500">*</span>
          </label>
          <select
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
          >
            <option value="">{t('auto.selectionner')}</option>
            {SYSTEM_TYPES.map((t: { value: string, label: string }) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">{t('auto.proprietaire')}</label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder={t('auto.ex_service_comptabilite')}
          className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300">{t('auto.adresses_ip')}</label>
          <button
            type="button"
            onClick={handleAddIp}
            className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            {t('auto.ajouter')}</button>
        </div>
        <div className="space-y-2">
          {ips.map((ipEntry, index) => (
            <div key={index} className="relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 space-y-1.5">
              {ips.length > 1 && (
                <button type="button" onClick={() => handleRemoveIp(index)} className="absolute top-1.5 right-1.5 text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.adresse_ip')}</label>
                <input
                  type="text"
                  value={ipEntry.ip}
                  onChange={(e) => handleIpChange(index, 'ip', e.target.value)}
                  placeholder="192.168.1.10"
                  className="w-full px-2.5 py-1 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.masque')}</label>
                  <input
                    type="text"
                    value={ipEntry.mask}
                    onChange={(e) => handleIpChange(index, 'mask', e.target.value)}
                    placeholder="/24"
                    className="w-full px-2.5 py-1 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.passerelle')}</label>
                  <input
                    type="text"
                    value={ipEntry.gateway}
                    onChange={(e) => handleIpChange(index, 'gateway', e.target.value)}
                    placeholder="192.168.1.1"
                    className="w-full px-2.5 py-1 border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300"
        >
          {t('auto.annuler')}</button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {saving ? 'Creation...' : 'Creer le systeme'}
        </button>
      </div>
    </div>
  );
}
