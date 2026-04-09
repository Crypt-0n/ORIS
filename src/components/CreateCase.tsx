import React from 'react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import { OffCanvas } from './common/OffCanvas';
import { RichTextEditor } from './RichTextEditor';

interface Severity {
  id: string;
  label: string;
  color: string;
}

interface TlpLevel {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
}

interface PapLevel {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
}

interface CreateCaseProps {
  onClose: () => void;
  onSuccess: (caseId?: string) => void;
  type?: 'alert' | 'case';
}

interface Beneficiary {
  id: string;
  name: string;
}

export function CreateCase({ onClose, onSuccess, type = 'case' }: CreateCaseProps) {
  const isAlert = type === 'alert';
  const { user } = useAuth();
  const { t } = useTranslation();
  const [severities, setSeverities] = useState<Severity[]>([]);
  const [tlpLevels, setTlpLevels] = useState<TlpLevel[]>([]);
  const [papLevels, setPapLevels] = useState<PapLevel[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiaryMembers, setBeneficiaryMembers] = useState<{id: string, full_name: string}[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity_id: '',
    tlp_id: '',
    pap_id: '',
    beneficiary_id: '',
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [defaultKillChainType, setDefaultKillChainType] = useState('cyber_kill_chain');

  useEffect(() => {
    fetchSeverities();
    fetchTlpLevels();
    fetchPapLevels();
    fetchDefaultKillChainType();
    fetchBeneficiaries();
  }, []);

  const fetchBeneficiaries = async () => {
    try {
      const data = await api.get('/cases/my-beneficiaries');
      setBeneficiaries(data || []);

      // Default behavior: if only one beneficiary, select it automatically
      if (data && data.length === 1) {
        const defaultBid = data[0].id;
        setFormData(prev => ({ ...prev, beneficiary_id: defaultBid }));
        if (isAlert) {
          try {
            const members = await api.get(`/cases/beneficiary-members/${defaultBid}`);
            setBeneficiaryMembers(members || []);
          } catch { setBeneficiaryMembers([]); }
        }
      }
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const fetchDefaultKillChainType = async () => {
    try {
      const data = await api.get('/admin/config');
      const killChainType = data.find((c: any) => c.key === 'default_kill_chain_type')?.value;
      if (killChainType) setDefaultKillChainType(killChainType);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSeverities = async () => {
    try {
      const data = await api.get('/investigation/severities');
      setSeverities(data || []);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const fetchTlpLevels = async () => {
    try {
      const data = await api.get('/investigation/tlp');
      setTlpLevels(data || []);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const fetchPapLevels = async () => {
    try {
      const data = await api.get('/investigation/pap');
      setPapLevels(data || []);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.beneficiary_id) {
      setError(t('createCase.selectBeneficiaryError'));
      return;
    }

    setError('');
    setCreating(true);

    try {
      const insertData: Record<string, any> = {
        title: formData.title,
        description: formData.description,
        author_id: user.id,
        severity_id: formData.severity_id,
        tlp_id: formData.tlp_id,
        kill_chain_type: defaultKillChainType,
        beneficiary_id: formData.beneficiary_id,
        type,
      };
      if (formData.pap_id) {
        insertData.pap_id = formData.pap_id;
      }
      if (isAlert && assignedTo) {
        insertData.assigned_to = assignedTo;
      }

      const created = await api.post('/cases', insertData);

      onSuccess(created?.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createCase.error'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <OffCanvas 
      isOpen={true} 
      onClose={onClose} 
      title={isAlert ? t('alerts.newAlert') : t('createCase.title')}
      width="lg"
    >
      <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('createCase.beneficiary')}
            </label>
            <select
              required
              value={formData.beneficiary_id}
              onChange={async (e) => {
                const bid = e.target.value;
                setFormData({ ...formData, beneficiary_id: bid });
                setAssignedTo('');
                if (isAlert && bid) {
                  try {
                    const members = await api.get(`/cases/beneficiary-members/${bid}`);
                    setBeneficiaryMembers(members || []);
                  } catch { setBeneficiaryMembers([]); }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t('createCase.selectBeneficiary')}</option>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {isAlert && formData.beneficiary_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Assigné à <span className="text-gray-500 font-normal">(optionnel)</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">Non assigné</option>
                {beneficiaryMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('createCase.caseTitle')}
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              placeholder={t('createCase.caseTitlePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('createCase.description')}
            </label>
            <RichTextEditor
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder={t('createCase.descriptionPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('createCase.severity')}
            </label>
            <select
              required
              value={formData.severity_id}
              onChange={(e) => setFormData({ ...formData, severity_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t('createCase.selectSeverity')}</option>
              {severities.map((severity) => (
                <option key={severity.id} value={severity.id}>
                  {severity.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('createCase.tlp')}
              </label>
              <select
                required
                value={formData.tlp_id}
                onChange={(e) => setFormData({ ...formData, tlp_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('createCase.tlpLevel')}</option>
                {tlpLevels.map((tlp) => (
                  <option key={tlp.id} value={tlp.id} title={tlp.description}>
                    {tlp.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('createCase.pap')}
              </label>
              <select
                required
                value={formData.pap_id}
                onChange={(e) => setFormData({ ...formData, pap_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('createCase.papLevel')}</option>
                {papLevels.map((pap) => (
                  <option key={pap.id} value={pap.id} title={pap.description}>
                    {pap.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
            >
              {t('createCase.cancel')}
            </button>
            <button
              type="submit"
              disabled={creating}
              className={`flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50 shadow-sm`}
            >
              {creating ? t('createCase.creating') : (isAlert ? 'Créer l\'alerte' : t('createCase.create'))}
            </button>
          </div>
        </form>
      </div>
    </OffCanvas>
  );
}
