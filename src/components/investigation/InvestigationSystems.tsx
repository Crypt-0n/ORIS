import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Monitor,
  Server,
  Smartphone,
  Tablet,
  Tv,
  Router,
  Cpu,
  HelpCircle,
  Network,
  Save,
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  ClipboardList,
  Bug,
  AlertTriangle,
  KeyRound,
  GitBranch,
} from 'lucide-react';
import { TaskModal } from '../TaskModal';
import { useTranslation } from "react-i18next";

interface IpEntry {
  ip: string;
  mask: string;
  gateway: string;
}

interface InvestigationTask {
  id: string;
  title: string;
  status: string;
  investigation_status: string | null;
}

interface LinkedMalware {
  id: string;
  file_name: string;
  is_malicious: boolean;
}

interface LinkedNetworkIndicator {
  id: string;
  ip: string | null;
  domain_name: string | null;
  port: number | null;
  url: string | null;
}

interface LinkedCompromisedAccount {
  id: string;
  account_name: string;
  domain: string;
  privileges: string;
}

interface SystemEntry {
  id: string;
  case_id: string;
  name: string;
  system_type: string;
  ip_addresses: IpEntry[];
  owner: string;
  network_indicator_id: string | null;
  created_at: string;
  investigation_tasks: InvestigationTask[];
  linked_malware: LinkedMalware[];
  network_indicator?: LinkedNetworkIndicator;
  compromised_accounts: LinkedCompromisedAccount[];
  lateralMovementCount: number;
}

interface InvestigationSystemsProps {
  caseId: string;
  isClosed: boolean;
  onTaskSelect?: (taskId: string) => void;
  onNavigateToIndicators?: () => void;
  filterIds?: string[];
}

const SYSTEM_TYPES = [
  { value: 'ordinateur', label: 'Ordinateur', icon: Monitor },
  { value: 'serveur', label: 'Serveur', icon: Server },
  { value: 'telephone', label: 'Telephone', icon: Smartphone },
  { value: 'tablette', label: 'Tablette', icon: Tablet },
  { value: 'tv', label: 'TV', icon: Tv },
  { value: 'equipement_reseau', label: 'Equipement reseau', icon: Router },
  { value: 'equipement_iot', label: 'Equipement IoT', icon: Cpu },
  { value: 'autre', label: 'Autre', icon: HelpCircle },
] as const;

const INVESTIGATION_STATUS_CONFIG: Record<string, { label: string; icon: typeof ShieldCheck; bgClass: string; textClass: string; borderClass: string }> = {
  clean: {
    label: 'Sain',
    icon: ShieldCheck,
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    textClass: 'text-green-700 dark:text-green-400',
    borderClass: 'border-green-200 dark:border-green-800',
  },
  compromised: {
    label: 'Compromis / Accede',
    icon: ShieldAlert,
    bgClass: 'bg-amber-50 dark:bg-amber-900/20',
    textClass: 'text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-800',
  },
  infected: {
    label: 'Infecte',
    icon: ShieldX,
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    textClass: 'text-red-700 dark:text-red-400',
    borderClass: 'border-red-200 dark:border-red-800',
  },
  unknown: {
    label: 'Inconnu',
    icon: ShieldQuestion,
    bgClass: 'bg-gray-50 dark:bg-slate-800',
    textClass: 'text-gray-500 dark:text-slate-400',
    borderClass: 'border-gray-200 dark:border-slate-700',
  },
};

function getSystemTypeConfig(type: string) {
  return SYSTEM_TYPES.find((t) => t.value === type) || SYSTEM_TYPES[7];
}

function getSystemInvestigationStatus(tasks: InvestigationTask[]): string {
  const closedTasks = tasks.filter(t => t.status === 'closed' && t.investigation_status);
  if (closedTasks.length === 0) return 'unknown';
  if (closedTasks.some(t => t.investigation_status === 'infected')) return 'infected';
  if (closedTasks.some(t => t.investigation_status === 'compromised')) return 'compromised';
  if (closedTasks.some(t => t.investigation_status === 'clean')) return 'clean';
  return 'unknown';
}

const EMPTY_IP: IpEntry = { ip: '', mask: '', gateway: '' };

export function InvestigationSystems({ caseId, isClosed, onTaskSelect, filterIds }: InvestigationSystemsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTaskModalForSystem, setShowTaskModalForSystem] = useState<SystemEntry | null>(null);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formIps, setFormIps] = useState<IpEntry[]>([{ ...EMPTY_IP }]);
  const [formOwner, setFormOwner] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSystems();
  }, [caseId]);

  const fetchSystems = async () => {
    try {
      const data = await api.get(`/investigation/systems/by-case/${caseId}`);
      const systemsList = data || [];

      if (systemsList.length === 0) {
        setSystems([]);
        setLoading(false);
        return;
      }

      const tasksData = await api.get(`/tasks/by-case/${caseId}`);
      const malwareData = await api.get(`/investigation/malware/by-case/${caseId}`);
      const indData = await api.get(`/investigation/indicators/by-case/${caseId}`);
      const accountLinksData = await api.get(`/investigation/account_systems/${caseId}`);
      const accountsData = await api.get(`/investigation/accounts/by-case/${caseId}`);
      const lateralEventsData = await api.get(`/investigation/events/by-case/${caseId}`);
      const overridesData = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);

      const tasksBySystem = new Map<string, InvestigationTask[]>();
      (tasksData || []).forEach((t: any) => {
        if (!t.system?.id) return;
        const list = tasksBySystem.get(t.system.id) || [];
        list.push({ id: t.id, title: t.title, status: t.status, investigation_status: t.investigation_status });
        tasksBySystem.set(t.system.id, list);
      });

      const malwareBySystem = new Map<string, LinkedMalware[]>();
      (malwareData || []).forEach((m: any) => {
        if (!m.system_id) return;
        const list = malwareBySystem.get(m.system_id) || [];
        list.push({ id: m.id, file_name: m.file_name, is_malicious: m.is_malicious });
        malwareBySystem.set(m.system_id, list);
      });

      let indicatorMap = new Map<string, LinkedNetworkIndicator>();
      (indData || []).forEach((ind: any) => indicatorMap.set(ind.id, ind));

      const accountIdsBySystem = new Map<string, string[]>();
      (accountLinksData || []).forEach((link: any) => {
        const list = accountIdsBySystem.get(link.system_id) || [];
        list.push(link.account_id);
        accountIdsBySystem.set(link.system_id, list);
      });

      let accountMap = new Map<string, LinkedCompromisedAccount>();
      (accountsData || []).forEach((a: any) => accountMap.set(a.id, a));

      const accountsBySystem = new Map<string, LinkedCompromisedAccount[]>();
      accountIdsBySystem.forEach((accIds, sysId) => {
        const accounts = accIds.map(id => accountMap.get(id)).filter(Boolean) as LinkedCompromisedAccount[];
        if (accounts.length > 0) accountsBySystem.set(sysId, accounts);
      });

      const lateralCountBySystem = new Map<string, number>();
      (lateralEventsData || []).forEach((ev: any) => {
        if (ev.event_type === 'lateralisation') {
          const ov = (overridesData || []).find((o: any) => o.event_id === ev.id);
          if (ov) {
            let sids: string[] = [];
            try {
              const infra = JSON.parse(ov.infrastructure || '[]');
              if (infra[0]?.type === 'system' || infra[0]?.type === 'attacker_infra') sids.push(infra[0].id);
              const vic = JSON.parse(ov.victim || '[]');
              if (vic[0]?.type === 'system') sids.push(vic[0].id);
            } catch (e) { }
            sids.forEach((sid: string) => {
              if (sid && systemsList.some((s: any) => s.id === sid)) {
                lateralCountBySystem.set(sid, (lateralCountBySystem.get(sid) || 0) + 1);
              }
            });
          }
        }
      });

      const enriched: SystemEntry[] = systemsList.map((s: any) => ({
        ...s,
        ip_addresses: typeof s.ip_addresses === 'string' ? JSON.parse(s.ip_addresses) : (s.ip_addresses || []),
        investigation_tasks: tasksBySystem.get(s.id) || [],
        linked_malware: malwareBySystem.get(s.id) || [],
        network_indicator: s.network_indicator_id ? indicatorMap.get(s.network_indicator_id) : undefined,
        compromised_accounts: accountsBySystem.get(s.id) || [],
        lateralMovementCount: lateralCountBySystem.get(s.id) || 0,
      }));

      const filtered = filterIds ? enriched.filter((s: any) => filterIds.includes(s.id)) : enriched;
      setSystems(filtered);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormName('');
    setFormType('');
    setFormIps([{ ...EMPTY_IP }]);
    setFormOwner('');
    setFormError('');
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (system: SystemEntry) => {
    setFormName(system.name);
    setFormType(system.system_type);
    setFormIps(
      system.ip_addresses && system.ip_addresses.length > 0
        ? system.ip_addresses
        : [{ ...EMPTY_IP }]
    );
    setFormOwner(system.owner || '');
    setEditingId(system.id);
    setShowForm(true);
    setFormError('');
  };

  const handleAddIp = () => {
    setFormIps([...formIps, { ...EMPTY_IP }]);
  };

  const handleRemoveIp = (index: number) => {
    if (formIps.length <= 1) return;
    setFormIps(formIps.filter((_, i) => i !== index));
  };

  const handleIpChange = (index: number, field: keyof IpEntry, value: string) => {
    const updated = [...formIps];
    updated[index] = { ...updated[index], [field]: value };
    setFormIps(updated);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      setFormError(t('investigationForms.nom_obligatoire'));
      return;
    }
    if (!formType) {
      setFormError(t('investigationForms.type_obligatoire'));
      return;
    }

    setSaving(true);
    setFormError('');

    const cleanedIps = formIps.filter((ip) => ip.ip.trim() !== '');

    const payload = {
      case_id: caseId,
      name: formName.trim(),
      system_type: formType,
      ip_addresses: cleanedIps,
      owner: formOwner.trim(),
      network_indicator_id: null,
      created_by: user!.id,
    };

    try {
      if (editingId) {
        const { created_by: _, case_id: __, ...updatePayload } = payload;
        await api.put(`/investigation/systems/${editingId}`, updatePayload);
        resetForm();
        fetchSystems();
      } else {
        await api.post('/investigation/systems', payload);
        resetForm();
        fetchSystems();
      }
    } catch (error) {
      setFormError(t('investigationForms.erreur_sauvegarde'));
      console.error(error);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/investigation/systems/${id}`);
      if (expandedId === id) setExpandedId(null);
      fetchSystems();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {systems.length} {t('auto.systeme')}{systems.length !== 1 ? 's' : ''}
        </span>
        {!isClosed && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t('auto.ajouter')}</button>
        )}
      </div>

      {showForm && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-5 bg-gray-50 dark:bg-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
              {editingId ? t('investigationForms.modifier_le_systeme') : t('investigationForms.nouveau_systeme')}
            </h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-transparent dark:border-red-800">{formError}</p>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                  {t('auto.nom')}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('auto.ex_pc_finance_01')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                  {t('auto.type')}<span className="text-red-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.type_22')}</option>
                  {SYSTEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.proprietaire')}</label>
              <input
                type="text"
                value={formOwner}
                onChange={(e) => setFormOwner(e.target.value)}
                placeholder={t('auto.ex_service_comptabilite')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">{t('auto.adresses_ip')}</label>
              <button
                type="button"
                onClick={handleAddIp}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {t('auto.ajouter_une_ip')}</button>
            </div>
            <div className="space-y-3">
              {formIps.map((ipEntry, index) => (
                <div key={index} className="relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                  {formIps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveIp(index)}
                      className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.adresse_ip')}</label>
                    <input
                      type="text"
                      value={ipEntry.ip}
                      onChange={(e) => handleIpChange(index, 'ip', e.target.value)}
                      placeholder="192.168.1.10"
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.masque')}</label>
                      <input
                        type="text"
                        value={ipEntry.mask}
                        onChange={(e) => handleIpChange(index, 'mask', e.target.value)}
                        placeholder="/24"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.passerelle')}</label>
                      <input
                        type="text"
                        value={ipEntry.gateway}
                        onChange={(e) => handleIpChange(index, 'gateway', e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

      {systems.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-400">
          <Server className="w-10 h-10 mb-3" />
          <p className="text-sm">{t('auto.aucun_systeme_enregistre')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {systems.map((system) => {
            const config = getSystemTypeConfig(system.system_type);
            const Icon = config.icon;
            const isExpanded = expandedId === system.id;
            const hasIps = system.ip_addresses && system.ip_addresses.length > 0 &&
              system.ip_addresses.some((ip: IpEntry) => ip.ip.trim() !== '');

            const investigationStatus = getSystemInvestigationStatus(system.investigation_tasks);
            const statusConfig = INVESTIGATION_STATUS_CONFIG[investigationStatus];
            const StatusIcon = statusConfig.icon;
            const openTasks = system.investigation_tasks.filter(t => t.status === 'open');
            const hasMaliciousMalware = system.linked_malware.some(m => m.is_malicious);
            const hasCompromisedAccounts = system.compromised_accounts.length > 0;
            const hasLateralMovement = system.lateralMovementCount > 0;
            const hasAnyTask = system.investigation_tasks.length > 0;
            const showWarning = !hasAnyTask && (hasMaliciousMalware || hasCompromisedAccounts || hasLateralMovement) && !isClosed;

            return (
              <div key={system.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 w-full text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  onClick={() => setExpandedId(isExpanded ? null : system.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-white text-sm truncate">{system.name}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-full flex-shrink-0">
                        {config.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass} flex-shrink-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                      {system.linked_malware.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border flex-shrink-0 ${hasMaliciousMalware
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                          : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700'
                          }`}>
                          <Bug className="w-3 h-3" />
                          {system.linked_malware.length} {t('auto.malware')}{system.linked_malware.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {hasCompromisedAccounts && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border flex-shrink-0 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                          <KeyRound className="w-3 h-3" />
                          {system.compromised_accounts.length} {t('auto.compte')}{system.compromised_accounts.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {hasLateralMovement && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border flex-shrink-0 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800">
                          <GitBranch className="w-3 h-3" />
                          {system.lateralMovementCount} {t('auto.lateral')}</span>
                      )}
                      {showWarning && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 flex-shrink-0 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    {system.owner && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{system.owner}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasIps && (
                      <span className="text-xs text-gray-400 dark:text-slate-400 mr-1 hidden sm:flex items-center gap-1">
                        <Network className="w-3 h-3" />
                        {system.ip_addresses.filter((ip: IpEntry) => ip.ip.trim() !== '').length}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 px-3 sm:px-4 py-3 bg-gray-50/50 dark:bg-slate-800/50 space-y-3">
                    {hasIps && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">{t('auto.adresses_ip')}</p>
                        <div className="space-y-1.5">
                          {system.ip_addresses
                            .filter((ip: IpEntry) => ip.ip.trim() !== '')
                            .map((ip: IpEntry, i: number) => (
                              <div key={i} className="text-sm font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700">
                                <span className="text-gray-800 dark:text-white">{ip.ip}</span>
                                {ip.mask && <span className="text-gray-500 dark:text-slate-400 ml-1">{ip.mask}</span>}
                                {ip.gateway && (
                                  <span className="block sm:inline sm:ml-3 text-gray-400 dark:text-slate-400 text-xs mt-0.5 sm:mt-0">
                                    GW: {ip.gateway}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {system.owner && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.proprietaire')}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{system.owner}</p>
                      </div>
                    )}

                    {system.investigation_tasks.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                          {t('auto.taches_d_investigation')}{system.investigation_tasks.length})
                        </p>
                        <div className="space-y-1">
                          {system.investigation_tasks.map(task => {
                            const isCl = task.status === 'closed';
                            const invStatus = task.investigation_status ? INVESTIGATION_STATUS_CONFIG[task.investigation_status] : null;
                            return (
                              <button
                                key={task.id}
                                onClick={(e) => { e.stopPropagation(); onTaskSelect?.(task.id); }}
                                className="flex items-center gap-2 w-full text-left px-3 py-2 bg-white dark:bg-slate-800 rounded border border-gray-100 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition text-sm"
                              >
                                <ClipboardList className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 flex-shrink-0" />
                                <span className="flex-1 truncate text-gray-700 dark:text-slate-300">{task.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${isCl ? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                  }`}>
                                  {isCl ? t('auto.status_closed') : t('auto.status_open')}
                                </span>
                                {isCl && invStatus && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 border ${invStatus.bgClass} ${invStatus.textClass} ${invStatus.borderClass}`}>
                                    {invStatus.label}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {system.linked_malware.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                          {t('auto.malware_outils_lies')}{system.linked_malware.length})
                        </p>
                        <div className="space-y-1">
                          {system.linked_malware.map(m => (
                            <div
                              key={m.id}
                              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded border border-gray-100 dark:border-slate-700 text-sm"
                            >
                              <Bug className={`w-3.5 h-3.5 flex-shrink-0 ${m.is_malicious ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-slate-400'
                                }`} />
                              <span className="flex-1 truncate text-gray-700 dark:text-slate-300">{m.file_name}</span>
                              {m.is_malicious ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex-shrink-0">
                                  {t('auto.malveillant')}</span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 flex-shrink-0">
                                  {t('auto.non_malveillant')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasCompromisedAccounts && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                          {t('auto.comptes_compromis_utilises')}{system.compromised_accounts.length})
                        </p>
                        <div className="space-y-1">
                          {system.compromised_accounts.map(acc => (
                            <div
                              key={acc.id}
                              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded border border-gray-100 dark:border-slate-700 text-sm"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" />
                              <span className="flex-1 truncate text-gray-700 dark:text-slate-300">
                                {acc.domain ? `${acc.domain}\\${acc.account_name}` : acc.account_name}
                              </span>
                              {acc.privileges && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                                  {acc.privileges}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {showWarning && (
                      <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                            {t('auto.investigation_recommandee')}</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            {(() => {
                              const reasons: string[] = [];
                              if (hasLateralMovement) reasons.push('un evenement de lateralisation');
                              if (hasMaliciousMalware) reasons.push('un malware malveillant');
                              if (hasCompromisedAccounts) reasons.push('des comptes compromis');
                              return `Ce systeme est concerne par ${reasons.join(' et ')}. Son statut d'investigation est encore inconnu. Il est fortement recommande d'ouvrir une investigation.`;
                            })()}
                          </p>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      {t('auto.ajoute_le')}{new Date(system.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {!isClosed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowTaskModalForSystem(system); }}
                          className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 px-2 py-1.5 rounded hover:bg-teal-50 dark:hover:bg-teal-900/20 transition"
                        >
                          <Search className="w-3.5 h-3.5" />
                          {t('auto.ouvrir_une_investigation')}</button>
                      )}
                      {!isClosed && openTasks.length > 0 && onTaskSelect && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onTaskSelect(openTasks[0].id); }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          {t('auto.voir_la_tache_en_cours')}</button>
                      )}
                      {!isClosed && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditForm(system); }}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {t('auto.modifier')}</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(system.id); }}
                            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('auto.supprimer')}</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showTaskModalForSystem && (
        <TaskModal
          caseId={caseId}
          task={null}
          systemId={showTaskModalForSystem.id}
          systemName={showTaskModalForSystem.name}
          onClose={() => setShowTaskModalForSystem(null)}
          onSuccess={() => {
            setShowTaskModalForSystem(null);
            fetchSystems();
          }}
        />
      )}
    </div>
  );
}
