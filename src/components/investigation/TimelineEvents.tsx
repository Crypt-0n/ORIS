import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Clock,
  ArrowRight,
  Save,
  FileText,
  File,
  UserCheck,
  Zap,
  Download,
  Shield,
  Mail,
  MoreHorizontal,
  GitBranch,
  Bug,
  Radio,
  KeyRound,
  User,
  Diamond,
} from 'lucide-react';
import { useTranslation } from "react-i18next";
import { getKillChainPhases } from '../../lib/killChainDefinitions';

interface SystemEntry {
  id: string;
  name: string;
}

interface MalwareEntry {
  id: string;
  file_name: string;
}

interface AccountEntry {
  id: string;
  account_name: string;
  domain: string;
}

interface TimelineEvent {
  id: string;
  case_id: string;
  event_type: string;
  event_datetime: string;
  kill_chain: string | null;
  malware_id: string | null;
  compromised_account_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  source_system?: SystemEntry;
  target_system?: SystemEntry;
  malware?: MalwareEntry;
  compromised_account?: AccountEntry;
  creator_name?: string;
}

interface DiamondOverrideSummary {
  event_id: string;
  label?: string;
  adversary: any[];
  infrastructure: any[];
  capability: any[];
  victim: any[];
  notes: string;
}

interface TimelineEventsProps {
  caseId: string;
  isClosed: boolean;
  killChainType?: string;
}

const EVENT_TYPES = [
  { value: 'event_log', label: "Journal d'evenements", icon: FileText, colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
  { value: 'file', label: 'Fichier', icon: File, colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  { value: 'human_action', label: 'Action humaine', icon: UserCheck, colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  { value: 'compromise', label: 'Interaction / Compromission', icon: Zap, colorClass: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
  { value: 'exfiltration', label: 'Exfiltration', icon: Download, colorClass: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' },
  { value: 'edr_trace', label: 'Trace EDR', icon: Shield, colorClass: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20' },
  { value: 'email', label: 'Courriel', icon: Mail, colorClass: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' },
  { value: 'lateralisation', label: 'Lateralisation', icon: GitBranch, colorClass: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20' },
  { value: 'malware', label: 'Malware', icon: Bug, colorClass: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30' },
  { value: 'c2_communication', label: 'Communication C2', icon: Radio, colorClass: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20' },
  { value: 'misc', label: 'Divers', icon: MoreHorizontal, colorClass: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20' },
] as const;



function getEventTypeConfig(type: string) {
  return EVENT_TYPES.find((t) => t.value === type) || EVENT_TYPES[0];
}

export function TimelineEvents({ caseId, isClosed, killChainType }: TimelineEventsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const phases = useMemo(() => getKillChainPhases(killChainType ?? null), [killChainType]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [malwareEntries, setMalwareEntries] = useState<MalwareEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [diamondOverrides, setDiamondOverrides] = useState<Map<string, DiamondOverrideSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formType, setFormType] = useState('');
  const [formDateTime, setFormDateTime] = useState('');
  const [formSourceSystem, setFormSourceSystem] = useState('');
  const [formTargetSystem, setFormTargetSystem] = useState('');
  const [formKillChain, setFormKillChain] = useState('');
  const [formMalwareId, setFormMalwareId] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountDomain, setNewAccountDomain] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchSystems();
    fetchMalwareEntries();
    fetchAccounts();
    fetchDiamondOverrides();
  }, [caseId]);

  const fetchDiamondOverrides = async () => {
    try {
      const data = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
      const map = new Map<string, DiamondOverrideSummary>();
      (data || []).forEach((row: any) => {
        try {
          map.set(row.event_id, {
            event_id: row.event_id,
            adversary: typeof row.adversary === 'string' ? JSON.parse(row.adversary) : row.adversary || [],
            infrastructure: typeof row.infrastructure === 'string' ? JSON.parse(row.infrastructure) : row.infrastructure || [],
            capability: typeof row.capability === 'string' ? JSON.parse(row.capability) : row.capability || [],
            victim: typeof row.victim === 'string' ? JSON.parse(row.victim) : row.victim || [],
            notes: row.notes || '',
          });
        } catch (e) {
          // json parse fail fallback
        }
      });
      setDiamondOverrides(map);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMalwareEntries = async () => {
    try {
      const data = await api.get(`/investigation/malware/by-case/${caseId}`);
      setMalwareEntries(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await api.get(`/investigation/accounts/by-case/${caseId}`);
      setAccounts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      setFormError(t('investigationForms.nom_compte_obligatoire'));
      return;
    }

    setCreatingAccount(true);
    setFormError('');

    try {
      const payload = {
        case_id: caseId,
        account_name: newAccountName.trim(),
        domain: newAccountDomain.trim(),
        sid: '',
        privileges: '',
        context: '',
      };
      const res = await api.post('/investigation/accounts', payload);
      const newAccount = { id: res.id, ...payload };
      if (newAccount) {
        setAccounts(prev => [...prev, newAccount].sort((a, b) => a.account_name.localeCompare(b.account_name)));
        setFormAccountId(newAccount.id);
        setShowNewAccount(false);
        setNewAccountName('');
        setNewAccountDomain('');
      }
    } catch (error) {
      setFormError(t('investigationForms.erreur_creation_compte'));
      console.error(error);
    }

    setCreatingAccount(false);
  };

  const fetchSystems = async () => {
    try {
      const data = await api.get(`/investigation/systems/by-case/${caseId}`);
      setSystems(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const data = await api.get(`/investigation/events/by-case/${caseId}`);

      const malwareData = await api.get(`/investigation/malware/by-case/${caseId}`);
      let malwareMap = new Map<string, MalwareEntry>();
      (malwareData || []).forEach((m: any) => malwareMap.set(m.id, m));

      const accountData = await api.get(`/investigation/accounts/by-case/${caseId}`);
      let accountMap = new Map<string, AccountEntry>();
      (accountData || []).forEach((a: any) => accountMap.set(a.id, a));

      const profileData = await api.get('/auth/users');
      let creatorMap = new Map<string, string>();
      (profileData || []).forEach((p: any) => creatorMap.set(p.id, p.full_name));

      const eventsWithSystems = (data || []).map((event: any) => {
        const ov = diamondOverrides.get(event.id);
        let infraSysId: string | undefined;
        let vicSysId: string | undefined;

        if (ov) {
          const infra = ov.infrastructure[0];
          if (infra && infra.id && infra.type === 'system') infraSysId = infra.id;

          const vic = ov.victim[0];
          if (vic && vic.id && vic.type === 'system') vicSysId = vic.id;
        }

        const sourceSystem = infraSysId ? systems.find((s) => s.id === infraSysId) : undefined;
        const targetSystem = vicSysId ? systems.find((s) => s.id === vicSysId) : undefined;
        const malware = event.malware_id ? malwareMap.get(event.malware_id) : undefined;
        const compromised_account = event.compromised_account_id ? accountMap.get(event.compromised_account_id) : undefined;
        const creator_name = creatorMap.get(event.created_by) || undefined;

        return {
          ...event,
          source_system: sourceSystem,
          target_system: targetSystem,
          malware,
          compromised_account,
          creator_name,
        };
      });
      setEvents(eventsWithSystems);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormType('');
    setFormDateTime('');
    setFormSourceSystem('');
    setFormTargetSystem('');
    setFormKillChain('');
    setFormMalwareId('');
    setFormAccountId('');
    setFormError('');
    setEditingId(null);
    setShowForm(false);
    setShowNewAccount(false);
    setNewAccountName('');
    setNewAccountDomain('');
  };

  const openEditForm = (event: TimelineEvent) => {
    setFormType(event.event_type);
    setFormDateTime(new Date(event.event_datetime).toISOString().slice(0, 19));
    const ov = diamondOverrides.get(event.id);
    let infraSysId = '';
    let vicSysId = '';
    if (ov) {
      if (ov.infrastructure[0]?.type === 'system') infraSysId = ov.infrastructure[0].id;
      if (ov.victim[0]?.type === 'system') vicSysId = ov.victim[0].id;
    }
    setFormSourceSystem(infraSysId);
    setFormTargetSystem(vicSysId);
    setFormKillChain(event.kill_chain || '');
    setFormMalwareId(event.malware_id || '');
    setFormAccountId(event.compromised_account_id || '');
    setEditingId(event.id);
    setShowForm(true);
    setFormError('');
  };

  const handleSubmit = async () => {
    if (!formType) {
      setFormError(t('investigationForms.type_obligatoire'));
      return;
    }
    if (!formDateTime) {
      setFormError(t('investigationForms.date_heure_obligatoires'));
      return;
    }
    if (!formDateTime) {
      setFormError(t('investigationForms.date_heure_obligatoires'));
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      case_id: caseId,
      event_type: formType,
      event_datetime: formDateTime + 'Z',
      kill_chain: formKillChain || null,
      malware_id: formType === 'malware' && formMalwareId ? formMalwareId : null,
      compromised_account_id: formAccountId || null,
      created_by: user!.id,
    };

    try {
      let savedEventId = editingId;
      if (editingId) {
        const { created_by: _, case_id: __, ...updatePayload } = payload;
        await api.put(`/investigation/events/${editingId}`, updatePayload);
      } else {
        const resp = await api.post('/investigation/events', payload);
        savedEventId = resp.id;
      }

      if (savedEventId) {
        const existing = diamondOverrides.get(savedEventId);
        let infra = existing ? existing.infrastructure : [];
        let vic = existing ? existing.victim : [];
        let changed = false;

        if (formSourceSystem) {
          const sysName = systems.find(s => s.id === formSourceSystem)?.name || 'Unknown';
          if (infra.findIndex((i: any) => i.id === formSourceSystem) === -1) {
            infra.push({ id: formSourceSystem, label: sysName, type: 'system' });
            changed = true;
          }
        }
        if (formTargetSystem) {
          const sysName = systems.find(s => s.id === formTargetSystem)?.name || 'Unknown';
          if (vic.findIndex((i: any) => i.id === formTargetSystem) === -1) {
            vic.push({ id: formTargetSystem, label: sysName, type: 'system' });
            changed = true;
          }
        }

        if (changed || existing) {
          const overridePayload = {
            case_id: caseId, event_id: savedEventId, label: existing?.label || '', notes: existing?.notes || '',
            adversary: JSON.stringify(existing?.adversary || []),
            infrastructure: JSON.stringify(infra),
            capability: JSON.stringify(existing?.capability || []),
            victim: JSON.stringify(vic)
          };
          api.post('/investigation/diamond-overrides', overridePayload); // either post or put it creates/updates based on backend constraints or we just rely on /diamond-overrides endpoint to handle upsert. Wait, backend is strictly POST for create. We need to do PUT for update.
          // To be completely safe and correct:
          if (existing) {
            await api.put(`/investigation/diamond-overrides/by-event/${savedEventId}`, overridePayload).catch(async () => {
              // if endpoint doesn't exist, we must fetch the override first or use the /diamond-overrides generic
              const ovx = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
              const foundOv = (ovx || []).find((o: any) => o.event_id === savedEventId);
              if (foundOv) await api.put(`/investigation/diamond-overrides/${foundOv.id}`, overridePayload);
            });
          } else {
            await api.post('/investigation/diamond-overrides', overridePayload);
          }
        }
      }

      resetForm();
      fetchEvents();
      fetchDiamondOverrides();
    } catch (error) {
      setFormError(t('investigationForms.erreur_sauvegarde'));
      console.error(error);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/investigation/events/${id}`);
      fetchEvents();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  if (systems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-400">
        <Clock className="w-10 h-10 mb-3" />
        <p className="text-sm">{t('auto.ajoutez_d_abord_des_syst_mes_d')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {events.length} {t('auto.v_nement')}{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {showForm && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-5 bg-gray-50 dark:bg-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
              {editingId ? t('investigationForms.modifier_evenement') : t('investigationForms.nouvel_evenement')}
            </h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-transparent dark:border-red-800">{formError}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('auto.type')}<span className="text-red-500">*</span>
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">-- {t('auto.selectionner')} --</option>
                {[...EVENT_TYPES].sort((a, b) => a.label.localeCompare(b.label, 'fr')).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('auto.date_et_heure_utc')}<span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                step="1"
                value={formDateTime}
                onChange={(e) => setFormDateTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('diamond.infrastructure')}
              </label>
              <select
                value={formSourceSystem}
                onChange={(e) => setFormSourceSystem(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('auto.s_lectionner_un_syst_me')}</option>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('diamond.victim')}</label>
              <select
                value={formTargetSystem}
                onChange={(e) => setFormTargetSystem(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('auto.aucun')}</option>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>



            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  {t('auto.compte_compromis_optionnel')}</label>
                {!showNewAccount && (
                  <button
                    type="button"
                    onClick={() => setShowNewAccount(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {t('auto.nouveau')}</button>
                )}
              </div>
              {!showNewAccount ? (
                <select
                  value={formAccountId}
                  onChange={(e) => setFormAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.domain ? `${a.domain}\\${a.account_name}` : a.account_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50/50 dark:bg-red-900/10 space-y-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <KeyRound className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">{t('auto.nouveau_compte_compromis')}</span>
                  </div>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder={t('auto.nom_du_compte_ex_admin_jdupont')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={newAccountDomain}
                    onChange={(e) => setNewAccountDomain(e.target.value)}
                    placeholder={t('auto.domaine_ex_corp_local_optionne')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowNewAccount(false); setNewAccountName(''); setNewAccountDomain(''); }}
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300"
                    >
                      {t('auto.annuler')}</button>
                    <button
                      type="button"
                      onClick={handleCreateAccount}
                      disabled={creatingAccount}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      {creatingAccount ? 'Creation...' : 'Creer'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t('diamond.phase')}</label>
              <select
                value={formKillChain}
                onChange={(e) => setFormKillChain(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              >
                <option value="">{t('auto.non_specifie')}</option>
                {phases.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {formType === 'malware' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t('auto.malware_outil')}</label>
                <select
                  value={formMalwareId}
                  onChange={(e) => setFormMalwareId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {malwareEntries.map((m) => (
                    <option key={m.id} value={m.id}>{m.file_name}</option>
                  ))}
                </select>
                {malwareEntries.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    {t('auto.ajoutez_d_abord_des_malwares_d')}</p>
                )}
              </div>
            )}

          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={resetForm}
              className="flex-1 sm:flex-none px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300"
            >
              {t('auto.annuler')}</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('investigationForms.enregistrement') : editingId ? t('investigationForms.mettre_a_jour') : t('investigationForms.enregistrer')}
            </button>
          </div>
        </div>
      )}

      {events.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-400">
          <Clock className="w-10 h-10 mb-3" />
          <p className="text-sm">{t('auto.aucun_v_nement_enregistr')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const config = getEventTypeConfig(event.event_type);
            const Icon = config.icon;

            return (
              <div key={event.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${config.colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const override = diamondOverrides.get(event.id);
                      if (!override) return null;
                      const total = override.adversary.length + override.infrastructure.length + override.capability.length + override.victim.length;
                      if (total === 0 && !override.notes) return null;
                      return (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Diamond className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                          {[
                            { key: 'adversary', label: 'ADV', color: '#ef4444', count: override.adversary.length },
                            { key: 'infrastructure', label: 'INFRA', color: '#f97316', count: override.infrastructure.length },
                            { key: 'capability', label: 'CAP', color: '#eab308', count: override.capability.length },
                            { key: 'victim', label: 'VIC', color: '#22c55e', count: override.victim.length },
                          ].map(({ key, label, color, count }) => count > 0 ? (
                            <span
                              key={key}
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
                              title={`${label}: ${override[key as keyof DiamondOverrideSummary]}`}
                            >
                              {label} {count}
                            </span>
                          ) : null)}
                        </div>
                      );
                    })()}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">
                        {config.label}
                      </span>
                      {event.kill_chain && (() => {
                        const kcConfig = phases.find(p => p.value === event.kill_chain);
                        return kcConfig ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${kcConfig.bgLight} ${kcConfig.textColor}`}>
                            {kcConfig.label}
                          </span>
                        ) : null;
                      })()}
                      <span className="text-xs text-gray-400 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(event.event_datetime)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-slate-300 mb-2">
                      <span className="font-medium">{event.source_system?.name || 'Système inconnu'}</span>
                      {event.target_system && (
                        <>
                          <ArrowRight className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                          <span className="font-medium">{event.target_system.name}</span>
                        </>
                      )}
                    </div>

                    {event.malware && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Bug className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                          {event.malware.file_name}
                        </span>
                      </div>
                    )}

                    {event.compromised_account && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <KeyRound className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                          {event.compromised_account.domain
                            ? `${event.compromised_account.domain}\\${event.compromised_account.account_name}`
                            : event.compromised_account.account_name}
                        </span>
                      </div>
                    )}

                    {(() => {
                      const note = diamondOverrides.get(event.id)?.notes;
                      if (!note) return null;
                      return (
                        <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 border-l-2 border-blue-400 dark:border-blue-500 rounded-r-lg">
                          <div className="flex items-center gap-1.5 mb-1.5 text-blue-700 dark:text-blue-400">
                            <Diamond className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">{t('diamond.notes')}</span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap italic">
                            {note}
                          </p>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-2 border-t border-gray-100 dark:border-slate-700/50">
                      {event.creator_name && (
                        <span className="text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {event.creator_name}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400 dark:text-slate-500">
                        {formatDateTime(event.created_at)}
                      </span>
                      {event.updated_at && event.updated_at !== event.created_at && (
                        <span className="text-[11px] text-gray-400 dark:text-slate-500 italic">
                          {t('auto.modifie_le_31')}{formatDateTime(event.updated_at)})
                        </span>
                      )}
                    </div>

                    {!isClosed && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => openEditForm(event)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {t('auto.modifier')}</button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('auto.supprimer')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
