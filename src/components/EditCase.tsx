import React from 'react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
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

export interface EditCaseProps {
  caseId: string;
  isAlert?: boolean;
  initialData: {
    title: string;
    description: string;
    severity_id: string;
    tlp_id: string;
    pap_id: string;
    author_id: string;
    beneficiary_id: string;
    adversary?: string | null;
    assigned_to?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function EditCase({ caseId, isAlert, initialData, onClose, onSuccess }: EditCaseProps) {
  const { t } = useTranslation();
  const [severities, setSeverities] = useState<Severity[]>([]);
  const [tlpLevels, setTlpLevels] = useState<TlpLevel[]>([]);
  const [papLevels, setPapLevels] = useState<PapLevel[]>([]);
  const [formData, setFormData] = useState({
    title: initialData.title,
    description: initialData.description,
    severity_id: initialData.severity_id,
    tlp_id: initialData.tlp_id,
    pap_id: initialData.pap_id,
    author_id: initialData.author_id,
    beneficiary_id: initialData.beneficiary_id,
    adversary: initialData.adversary || '',
    assigned_to: initialData.assigned_to || '',
  });
  const [beneficiaries, setBeneficiaries] = useState<{ id: string; name: string }[]>([]);
  const [beneficiaryMembers, setBeneficiaryMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchSeverities();
    fetchTlpLevels();
    fetchPapLevels();
    fetchUsers();
    fetchBeneficiaries();
    checkAdmin();
  }, []);

  useEffect(() => {
    if (isAlert && formData.beneficiary_id) {
       api.get(`/cases/beneficiary-members/${formData.beneficiary_id}`)
         .then(res => setBeneficiaryMembers(res || []))
         .catch(() => setBeneficiaryMembers([]));
    }
  }, [formData.beneficiary_id, isAlert]);

  const fetchBeneficiaries = async () => {
    try {
      const data = await api.get('/cases/my-beneficiaries');
      setBeneficiaries(data || []);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const checkAdmin = async () => {
    try {
      const profile = await api.get('/auth/profile');
      setIsAdmin(profile?.role === 'admin');
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await api.get('/admin/users');
      setUsers(data || []);
    } catch (err) {
      console.error('Erreur:', err);
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

    setError('');
    setUpdating(true);

    try {
      await api.put(`/cases/${caseId}`, {
        title: formData.title,
        description: formData.description,
        severity_id: formData.severity_id,
        tlp: formData.tlp_id,
        pap: formData.pap_id,
        author_id: formData.author_id,
        beneficiary_id: formData.beneficiary_id,
        adversary: formData.adversary,
        assigned_to: formData.assigned_to,
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('editCase.error'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <OffCanvas 
      isOpen={true} 
      onClose={onClose} 
      title={t('editCase.title')}
      width="lg"
    >
      <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('editCase.caseTitle')}
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              placeholder={t('editCase.caseTitlePlaceholder')}
            />
          </div>

          {!isAlert && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Adversaire (Optionnel)
              </label>
              <input
                type="text"
                value={formData.adversary}
                onChange={(e) => setFormData({ ...formData, adversary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
                placeholder="Ex: APT29, LockBit, Inconnu..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('createCase.beneficiary')}
            </label>
            <select
              required
              value={formData.beneficiary_id}
              onChange={(e) => setFormData({ ...formData, beneficiary_id: e.target.value })}
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
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
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

          {isAdmin && !isAlert && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('cases.author')} (Responsable)
              </label>
              <select
                required
                value={formData.author_id}
                onChange={(e) => setFormData({ ...formData, author_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('admin.chooseUser')}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('editCase.description')}
            </label>
            <RichTextEditor
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder={t('editCase.descriptionPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('editCase.severity')}
            </label>
            <select
              required
              value={formData.severity_id}
              onChange={(e) => setFormData({ ...formData, severity_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t('editCase.selectSeverity')}</option>
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
                {t('editCase.tlp')}
              </label>
              <select
                required
                value={formData.tlp_id}
                onChange={(e) => setFormData({ ...formData, tlp_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('editCase.tlpLevel')}</option>
                {tlpLevels.map((tlp) => (
                  <option key={tlp.id} value={tlp.id} title={tlp.description}>
                    {tlp.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('editCase.pap')}
              </label>
              <select
                required
                value={formData.pap_id}
                onChange={(e) => setFormData({ ...formData, pap_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('editCase.papLevel')}</option>
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
              {t('editCase.cancel')}
            </button>
            <button
              type="submit"
              disabled={updating}
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 shadow-sm"
            >
              {updating ? t('editCase.saving') : t('editCase.save')}
            </button>
          </div>
        </form>
      </div>
    </OffCanvas>
  );
}
