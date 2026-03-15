import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Server,
  Bug,
  KeyRound,
  Globe,
  Upload,
  Monitor,
  Smartphone,
  Tablet,
  Tv,
  Router,
  Cpu,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  AlertTriangle,
  CheckCircle,
  Hash,
  ChevronDown,
  ChevronUp,
  Network,
  Clock,
  Link2,
  Calendar,
  FileText,
  Edit3,
  X,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from "react-i18next";

interface TaskObjectsPanelProps {
  caseId: string;
  taskId: string;
  isClosed: boolean;
  onTaskSelect?: (taskId: string) => void;
  onCountChange?: (count: number) => void;
  isReadOnly?: boolean;
}

interface SystemEntry {
  id: string;
  name: string;
  system_type: string;
  ip_addresses: { ip: string; mask: string; gateway: string }[];
  owner: string | null;
  investigation_status: string | null;
}

interface MalwareEntry {
  id: string;
  file_name: string;
  file_path: string;
  is_malicious: boolean;
  hashes: { type: string; value: string }[];
  system_name: string | null;
  system_id: string | null;
}

interface AccountEntry {
  id: string;
  account_name: string;
  domain: string;
  sid: string;
  privileges: string;
  linked_systems: { name: string }[];
}

interface NetworkEntry {
  id: string;
  ip: string | null;
  domain_name: string | null;
  port: number | null;
  url: string | null;
  context: string;
  malware_name: string | null;
  malware_id: string | null;
}

interface ExfiltrationEntry {
  id: string;
  file_name: string;
  exfiltration_date: string | null;
  file_size: number | null;
  file_size_unit: string;
  content_description: string;
  source_system_name: string | null;
  source_system_id: string | null;
}

interface AllObjects {
  systems: SystemEntry[];
  malware: MalwareEntry[];
  accounts: AccountEntry[];
  network: NetworkEntry[];
  exfiltrations: ExfiltrationEntry[];
}

const SYSTEM_TYPE_ICONS: Record<string, typeof Server> = {
  ordinateur: Monitor,
  serveur: Server,
  mobile: Smartphone,
  telephone: Smartphone,
  tablette: Tablet,
  tv: Tv,
  routeur: Router,
  equipement_reseau: Router,
  automate: Cpu,
  equipement_iot: Cpu,
};

const SYSTEM_TYPES = [
  { value: 'ordinateur', label: 'Ordinateur' },
  { value: 'serveur', label: 'Serveur' },
  { value: 'telephone', label: 'Telephone' },
  { value: 'tablette', label: 'Tablette' },
  { value: 'tv', label: 'TV' },
  { value: 'equipement_reseau', label: 'Equipement reseau' },
  { value: 'equipement_iot', label: 'Equipement IoT' },
  { value: 'autre', label: 'Autre' },
];

const INVESTIGATION_STATUS_MAP: Record<string, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  clean: { label: 'Sain', icon: ShieldCheck, cls: 'text-green-600 dark:text-green-400' },
  compromised: { label: 'Compromis', icon: ShieldAlert, cls: 'text-amber-600 dark:text-amber-400' },
  infected: { label: 'Infecte', icon: ShieldX, cls: 'text-red-600 dark:text-red-400' },
};

const HASH_LABELS: Record<string, string> = {
  md5: 'MD5', sha1: 'SHA-1', sha256: 'SHA-256', sha512: 'SHA-512', ssdeep: 'SSDeep', imphash: 'Imphash',
};

const HASH_TYPES = [
  { value: 'md5', label: 'MD5' },
  { value: 'sha1', label: 'SHA-1' },
  { value: 'sha256', label: 'SHA-256' },
  { value: 'sha512', label: 'SHA-512' },
  { value: 'ssdeep', label: 'SSDeep' },
  { value: 'imphash', label: 'Imphash' },
];

const FILE_SIZE_UNITS = ['Octets', 'Ko', 'Mo', 'Go', 'To', 'Po'];

const PRIVILEGES_OPTIONS = ['Utilisateur', 'Administrateur local', 'Administrateur du domaine', 'Service', 'Autre'];

function SectionHeader({ icon: Icon, label, count }: { icon: typeof Server; label: string; count: number }) {

  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
      <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{label}</h4>
      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
        {count}
      </span>
    </div>
  );
}

function EmptySection({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <p className="text-xs text-gray-400 dark:text-slate-500 italic py-2">
      {t('auto.aucun')}{label} {t('auto.lie_a_cette_tache')}</p>
  );
}

function EditModal({ title, onClose, onSave, saving, error, children }: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {children}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            {t('auto.annuler')}</button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function inputCls() {
  return 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500';
}

function labelCls() {
  return 'block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1';
}

async function updateCaseObject(table: string, id: string, data: Record<string, unknown>): Promise<string | null> {
  try {
    const routeMap: Record<string, string> = {
      'case_systems': 'systems',
      'case_malware_tools': 'malware',
      'case_compromised_accounts': 'accounts',
      'case_network_indicators': 'indicators',
      'case_exfiltrations': 'exfiltrations'
    };

    const route = routeMap[table];
    if (!route) return 'Route inconnue';

    await api.put(`/investigation/${route}/${id}`, data);
    return null;
  } catch (err: any) {
    return err.message || 'Erreur inconnue';
  }
}

export function TaskObjectsPanel({ caseId: _caseId, taskId, isClosed, onTaskSelect: _onTaskSelect, onCountChange, isReadOnly }: TaskObjectsPanelProps) {
  const { t } = useTranslation();
  const [objects, setObjects] = useState<AllObjects | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [expandedMalware, setExpandedMalware] = useState<Set<string>>(new Set());

  const [editingSystem, setEditingSystem] = useState<SystemEntry | null>(null);
  const [editingMalware, setEditingMalware] = useState<MalwareEntry | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountEntry | null>(null);
  const [editingNetwork, setEditingNetwork] = useState<NetworkEntry | null>(null);
  const [editingExfil, setEditingExfil] = useState<ExfiltrationEntry | null>(null);

  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [sysName, setSysName] = useState('');
  const [sysType, setSysType] = useState('');
  const [sysOwner, setSysOwner] = useState('');
  const [sysIps, setSysIps] = useState<{ ip: string; mask: string; gateway: string }[]>([]);

  const [malName, setMalName] = useState('');
  const [malPath, setMalPath] = useState('');
  const [malMalicious, setMalMalicious] = useState(false);
  const [malHashes, setMalHashes] = useState<{ type: string; value: string }[]>([]);

  const [accName, setAccName] = useState('');
  const [accDomain, setAccDomain] = useState('');
  const [accSid, setAccSid] = useState('');
  const [accPrivileges, setAccPrivileges] = useState('');

  const [netIp, setNetIp] = useState('');
  const [netDomain, setNetDomain] = useState('');
  const [netPort, setNetPort] = useState('');
  const [netUrl, setNetUrl] = useState('');
  const [netContext, setNetContext] = useState('');

  const [exfilFileName, setExfilFileName] = useState('');
  const [exfilDate, setExfilDate] = useState('');
  const [exfilSize, setExfilSize] = useState('');
  const [exfilSizeUnit, setExfilSizeUnit] = useState('Octets');
  const [exfilDesc, setExfilDesc] = useState('');

  useEffect(() => {
    fetchObjects();
  }, [taskId]);

  const toggleSystem = (id: string) => {
    setExpandedSystems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMalware = (id: string) => {
    setExpandedMalware(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fetchObjects = async () => {
    setLoading(true);

    try {
      const taskData = await api.get(`/tasks/${taskId}`);

      const allEventsData = await api.get(`/investigation/events/by-case/${_caseId}`);
      const eventsData = (allEventsData || []).filter((e: any) => e.task_id === taskId);

      const systemIds = new Set<string>();
      const malwareIds = new Set<string>();
      const accountIds = new Set<string>();
      const exfiltrationIds = new Set<string>();

      if (taskData?.system_id) systemIds.add(taskData.system_id);
      if (taskData?.malware_id) malwareIds.add(taskData.malware_id);

      eventsData.forEach((ev: any) => {
        if (ev.malware_id) malwareIds.add(ev.malware_id);
        if (ev.compromised_account_id) accountIds.add(ev.compromised_account_id);
        if (ev.exfiltration_id) exfiltrationIds.add(ev.exfiltration_id);
      });

      // Instead of independent parallel fetches over a list of generic IDs,
      // We will perform API calls for each collection, passing caseId from the props (assuming props.caseId is reliable for events)
      // For simplicity, we filter the whole case objects locally since we fetch them anyway for other panels.

      const [systemsRes, malwareRes, accountsRes, indicatorsRes, exfilsRes, overridesRes] = await Promise.all([
        api.get(`/investigation/systems/by-case/${_caseId}`),
        api.get(`/investigation/malware/by-case/${_caseId}`),
        api.get(`/investigation/accounts/by-case/${_caseId}`),
        api.get(`/investigation/indicators/by-case/${_caseId}`),
        api.get(`/investigation/exfiltrations/by-case/${_caseId}`),
        api.get(`/investigation/diamond-overrides/by-case/${_caseId}`)
      ]);

      const eventIdSet = new Set(eventsData.map((e: any) => e.id));
      (overridesRes || []).forEach((ov: any) => {
        if (eventIdSet.has(ov.event_id)) {
          try {
            const infra = JSON.parse(ov.infrastructure || '[]');
            if (infra[0]?.type === 'system') systemIds.add(infra[0].id);
            const vic = JSON.parse(ov.victim || '[]');
            if (vic[0]?.type === 'system') systemIds.add(vic[0].id);
          } catch (e) { }
        }
      });

      const caseSystems = (systemsRes || []).filter((s: any) => systemIds.has(s.id));
      const caseMalware = (malwareRes || []).filter((m: any) => malwareIds.has(m.id));
      const caseAccounts = (accountsRes || []).filter((a: any) => accountIds.has(a.id));
      const caseExfils = (exfilsRes || []).filter((e: any) => exfiltrationIds.has(e.id));

      const systemMap = new Map<string, any>((systemsRes || []).map((s: any) => [s.id, s]));

      const systems: SystemEntry[] = caseSystems.map((s: any) => ({
        id: s.id,
        name: s.name,
        system_type: s.system_type,
        ip_addresses: typeof s.ip_addresses === 'string' ? JSON.parse(s.ip_addresses) : (s.ip_addresses || []),
        owner: s.owner || null,
        investigation_status: taskData?.system_id === s.id ? (taskData?.investigation_status || null) : null,
      }));

      const malware: MalwareEntry[] = caseMalware.map((m: any) => ({
        id: m.id,
        file_name: m.file_name,
        file_path: m.file_path || '',
        is_malicious: m.is_malicious,
        hashes: typeof m.hashes === 'string' ? JSON.parse(m.hashes) : (m.hashes || []),
        system_name: m.system_id ? (systemMap.get(m.system_id)?.name as string || null) : null,
        system_id: m.system_id || null,
      }));

      // Find network indicators linked to these systems
      const sysWithIndicators = caseSystems.filter((s: any) => !!s.network_indicator_id);
      const networkIndicatorIds = sysWithIndicators.map((s: any) => s.network_indicator_id);

      let network: NetworkEntry[] = [];
      if (networkIndicatorIds.length > 0) {
        const netData = (indicatorsRes || []).filter((n: any) => networkIndicatorIds.includes(n.id));

        const malwareNameMap = new Map((malwareRes || []).map((m: any) => [m.id, m.file_name]));

        network = netData.map((n: any) => ({
          id: n.id,
          ip: n.ip || null,
          domain_name: n.domain_name || null,
          port: n.port ?? null,
          url: n.url || null,
          context: n.context || '',
          malware_name: n.malware_id ? (malwareNameMap.get(n.malware_id) || null) : null,
          malware_id: n.malware_id || null,
        }));
      }

      const accounts: AccountEntry[] = caseAccounts.map((a: any) => ({
        id: a.id,
        account_name: a.account_name,
        domain: a.domain || '',
        sid: a.sid || '',
        privileges: a.privileges || '',
        linked_systems: (a.systems || []).map((s: any) => ({ name: s.name }))
      }));

      const exfiltrations: ExfiltrationEntry[] = caseExfils.map((e: any) => ({
        id: e.id,
        file_name: e.file_name || '',
        exfiltration_date: e.exfiltration_date || null,
        file_size: e.file_size ?? null,
        file_size_unit: e.file_size_unit || 'Octets',
        content_description: e.content_description || '',
        source_system_name: e.source_system_id ? (systemMap.get(e.source_system_id)?.name as string || null) : null,
        source_system_id: e.source_system_id || null,
      }));

      setObjects({ systems, malware, accounts, network, exfiltrations });

      if (onCountChange) {
        onCountChange(systems.length + malware.length + accounts.length + network.length + exfiltrations.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openEditSystem = (sys: SystemEntry) => {
    setSysName(sys.name);
    setSysType(sys.system_type);
    setSysOwner(sys.owner || '');
    setSysIps(sys.ip_addresses.length > 0 ? [...sys.ip_addresses] : [{ ip: '', mask: '', gateway: '' }]);
    setEditError('');
    setEditingSystem(sys);
  };

  const saveSystem = async () => {
    if (!editingSystem) return;
    if (!sysName.trim()) { setEditError('Le nom est requis'); return; }
    setSaving(true);
    setEditError('');
    const cleanIps = sysIps.filter(ip => ip.ip?.trim());
    const err = await updateCaseObject('case_systems', editingSystem.id, {
      name: sysName.trim(),
      system_type: sysType,
      owner: sysOwner.trim() || null,
      ip_addresses: cleanIps,
    });
    setSaving(false);
    if (err) { setEditError(err); return; }
    setEditingSystem(null);
    fetchObjects();
  };

  const openEditMalware = (m: MalwareEntry) => {
    setMalName(m.file_name);
    setMalPath(m.file_path || '');
    setMalMalicious(m.is_malicious);
    setMalHashes(m.hashes.length > 0 ? [...m.hashes] : [{ type: 'sha256', value: '' }]);
    setEditError('');
    setEditingMalware(m);
  };

  const saveMalware = async () => {
    if (!editingMalware) return;
    if (!malName.trim()) { setEditError('Le nom de fichier est requis'); return; }
    setSaving(true);
    setEditError('');
    const cleanHashes = malHashes.filter(h => h.value?.trim());
    const err = await updateCaseObject('case_malware_tools', editingMalware.id, {
      file_name: malName.trim(),
      file_path: malPath.trim() || null,
      is_malicious: malMalicious,
      hashes: cleanHashes,
    });
    setSaving(false);
    if (err) { setEditError(err); return; }
    setEditingMalware(null);
    fetchObjects();
  };

  const openEditAccount = (acc: AccountEntry) => {
    setAccName(acc.account_name);
    setAccDomain(acc.domain);
    setAccSid(acc.sid);
    setAccPrivileges(acc.privileges);
    setEditError('');
    setEditingAccount(acc);
  };

  const saveAccount = async () => {
    if (!editingAccount) return;
    if (!accName?.trim()) { setEditError('Le nom du compte est requis'); return; }
    setSaving(true);
    setEditError('');
    const err = await updateCaseObject('case_compromised_accounts', editingAccount.id, {
      account_name: accName?.trim(),
      domain: accDomain?.trim(),
      sid: accSid?.trim(),
      privileges: accPrivileges?.trim(),
    });
    setSaving(false);
    if (err) { setEditError(err); return; }
    setEditingAccount(null);
    fetchObjects();
  };

  const openEditNetwork = (n: NetworkEntry) => {
    setNetIp(n.ip || '');
    setNetDomain(n.domain_name || '');
    setNetPort(n.port != null ? String(n.port) : '');
    setNetUrl(n.url || '');
    setNetContext(n.context || '');
    setEditError('');
    setEditingNetwork(n);
  };

  const saveNetwork = async () => {
    if (!editingNetwork) return;
    if (!netIp?.trim() && !netDomain?.trim() && !netUrl?.trim()) {
      setEditError("Au moins un indicateur (IP, domaine ou URL) est requis");
      return;
    }
    setSaving(true);
    setEditError('');
    const err = await updateCaseObject('case_network_indicators', editingNetwork.id, {
      ip: netIp?.trim() || null,
      domain_name: netDomain?.trim() || null,
      port: netPort ? parseInt(netPort) : null,
      url: netUrl?.trim() || null,
      context: netContext?.trim() || '',
    });
    setSaving(false);
    if (err) { setEditError(err); return; }
    setEditingNetwork(null);
    fetchObjects();
  };

  const openEditExfil = (ex: ExfiltrationEntry) => {
    setExfilFileName(ex.file_name || '');
    setExfilDate(ex.exfiltration_date ? ex.exfiltration_date.slice(0, 16) : '');
    setExfilSize(ex.file_size != null ? String(ex.file_size) : '');
    setExfilSizeUnit(ex.file_size_unit || 'Octets');
    setExfilDesc(ex.content_description || '');
    setEditError('');
    setEditingExfil(ex);
  };

  const saveExfil = async () => {
    if (!editingExfil) return;
    const normalizedSize = exfilSize.replace(',', '.');
    const parsedSize = normalizedSize ? parseFloat(normalizedSize) : null;
    if (normalizedSize && (isNaN(parsedSize!) || parsedSize! < 0)) {
      setEditError('La taille doit etre un nombre valide');
      return;
    }
    setSaving(true);
    setEditError('');
    const err = await updateCaseObject('case_exfiltrations', editingExfil.id, {
      file_name: exfilFileName?.trim() || null,
      exfiltration_date: exfilDate ? new Date(exfilDate).toISOString() : null,
      file_size: parsedSize,
      file_size_unit: exfilSizeUnit,
      content_description: exfilDesc?.trim() || '',
    });
    setSaving(false);
    if (err) { setEditError(err); return; }
    setEditingExfil(null);
    fetchObjects();
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  if (!objects) return null;

  const hasAny = objects.systems.length > 0 || objects.malware.length > 0 || objects.accounts.length > 0 || objects.network.length > 0 || objects.exfiltrations.length > 0;

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-500">
        <Server className="w-8 h-8 mb-2" />
        <p className="text-sm">{t('auto.aucun_objet_lie_a_cette_tache')}</p>
        <p className="text-xs mt-1">{t('auto.ajoutez_des_faits_marquants_po')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {editingSystem && (
        <EditModal title={t('auto.modifier_le_systeme')} onClose={() => setEditingSystem(null)} onSave={saveSystem} saving={saving} error={editError}>
          <div>
            <label className={labelCls()}>{t('auto.nom_5')}</label>
            <input className={inputCls()} value={sysName} onChange={e => setSysName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.type')}</label>
            <select className={inputCls()} value={sysType} onChange={e => setSysType(e.target.value)}>
              {SYSTEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls()}>{t('auto.proprietaire')}</label>
            <input className={inputCls()} value={sysOwner} onChange={e => setSysOwner(e.target.value)} placeholder={t('auto.nom_du_proprietaire')} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls()}>{t('auto.adresses_ip')}</label>
              <button type="button" onClick={() => setSysIps(prev => [...prev, { ip: '', mask: '', gateway: '' }])} className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline">
                <Plus className="w-3 h-3" />
                {t('auto.ajouter')}</button>
            </div>
            <div className="space-y-2">
              {sysIps.map((ip, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={inputCls()} placeholder="IP" value={ip.ip} onChange={e => { const n = [...sysIps]; n[i] = { ...n[i], ip: e.target.value }; setSysIps(n); }} />
                  <input className="w-24 px-2 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40" placeholder={t('auto.masque')} value={ip.mask} onChange={e => { const n = [...sysIps]; n[i] = { ...n[i], mask: e.target.value }; setSysIps(n); }} />
                  <button type="button" onClick={() => setSysIps(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </EditModal>
      )}

      {editingMalware && (
        <EditModal title={t('auto.modifier_le_malware_outil')} onClose={() => setEditingMalware(null)} onSave={saveMalware} saving={saving} error={editError}>
          <div>
            <label className={labelCls()}>{t('auto.nom_du_fichier_6')}</label>
            <input className={inputCls()} value={malName} onChange={e => setMalName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.chemin')}</label>
            <input className={inputCls()} value={malPath} onChange={e => setMalPath(e.target.value)} placeholder={t('auto.chemin_vers_fichier')} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="malicious-chk" checked={malMalicious} onChange={e => setMalMalicious(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
            <label htmlFor="malicious-chk" className="text-sm text-gray-700 dark:text-slate-300">{t('auto.malveillant')}</label>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls()}>{t('auto.empreintes')}</label>
              <button type="button" onClick={() => setMalHashes(prev => [...prev, { type: 'sha256', value: '' }])} className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:underline">
                <Plus className="w-3 h-3" />
                {t('auto.ajouter')}</button>
            </div>
            <div className="space-y-2">
              {malHashes.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={h.type} onChange={e => { const n = [...malHashes]; n[i] = { ...n[i], type: e.target.value }; setMalHashes(n); }} className="text-xs px-2 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/40">
                    {HASH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input className={inputCls()} placeholder={t('auto.valeur')} value={h.value} onChange={e => { const n = [...malHashes]; n[i] = { ...n[i], value: e.target.value }; setMalHashes(n); }} />
                  <button type="button" onClick={() => setMalHashes(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </EditModal>
      )}

      {editingAccount && (
        <EditModal title={t('auto.modifier_le_compte_compromis')} onClose={() => setEditingAccount(null)} onSave={saveAccount} saving={saving} error={editError}>
          <div>
            <label className={labelCls()}>{t('auto.nom_du_compte')}</label>
            <input className={inputCls()} value={accName} onChange={e => setAccName(e.target.value)} />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.domaine')}</label>
            <input className={inputCls()} value={accDomain} onChange={e => setAccDomain(e.target.value)} placeholder="DOMAIN" />
          </div>
          <div>
            <label className={labelCls()}>SID</label>
            <input className={inputCls()} value={accSid} onChange={e => setAccSid(e.target.value)} placeholder="S-1-5-..." />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.privileges')}</label>
            <select className={inputCls()} value={accPrivileges} onChange={e => setAccPrivileges(e.target.value)}>
              <option value="">{t('auto.selectionnez')}</option>
              {PRIVILEGES_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </EditModal>
      )}

      {editingNetwork && (
        <EditModal title={t('auto.modifier_l_indicateur_reseau')} onClose={() => setEditingNetwork(null)} onSave={saveNetwork} saving={saving} error={editError}>
          <div>
            <label className={labelCls()}>{t('auto.adresse_ip')}</label>
            <input className={inputCls()} value={netIp} onChange={e => setNetIp(e.target.value)} placeholder="192.168.1.1" />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.nom_de_domaine')}</label>
            <input className={inputCls()} value={netDomain} onChange={e => setNetDomain(e.target.value)} placeholder={t('auto.example_com')} />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.port')}</label>
            <input type="number" className={inputCls()} value={netPort} onChange={e => setNetPort(e.target.value)} placeholder="443" />
          </div>
          <div>
            <label className={labelCls()}>URL</label>
            <input className={inputCls()} value={netUrl} onChange={e => setNetUrl(e.target.value)} placeholder={t('auto.https')} />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.contexte')}</label>
            <textarea className={inputCls()} rows={3} value={netContext} onChange={e => setNetContext(e.target.value)} placeholder={t('auto.contexte_de_l_indicateur')} />
          </div>
        </EditModal>
      )}

      {editingExfil && (
        <EditModal title={t('auto.modifier_l_exfiltration')} onClose={() => setEditingExfil(null)} onSave={saveExfil} saving={saving} error={editError}>
          <div>
            <label className={labelCls()}>{t('auto.nom_du_fichier_donnees')}</label>
            <input className={inputCls()} value={exfilFileName} onChange={e => setExfilFileName(e.target.value)} placeholder={t('auto.fichier_zip')} />
          </div>
          <div>
            <label className={labelCls()}>{t('auto.date_d_exfiltration')}</label>
            <input type="datetime-local" className={inputCls()} value={exfilDate} onChange={e => setExfilDate(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls()}>{t('auto.taille')}</label>
              <input type="text" inputMode="decimal" className={inputCls()} value={exfilSize} onChange={e => setExfilSize(e.target.value)} placeholder="100" />
            </div>
            <div className="w-28">
              <label className={labelCls()}>{t('auto.unite')}</label>
              <select className={inputCls()} value={exfilSizeUnit} onChange={e => setExfilSizeUnit(e.target.value)}>
                {FILE_SIZE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls()}>{t('auto.description_du_contenu')}</label>
            <textarea className={inputCls()} rows={3} value={exfilDesc} onChange={e => setExfilDesc(e.target.value)} placeholder={t('auto.description_des_donnees_exfilt')} />
          </div>
        </EditModal>
      )}

      <div>
        <SectionHeader icon={Server} label="Systemes" count={objects.systems.length} />
        {objects.systems.length === 0 ? (
          <EmptySection label="systeme" />
        ) : (
          <div className="space-y-1.5">
            {objects.systems.map((sys) => {
              const Icon = SYSTEM_TYPE_ICONS[sys.system_type] || HelpCircle;
              const statusCfg = sys.investigation_status ? INVESTIGATION_STATUS_MAP[sys.investigation_status] : null;
              const StatusIcon = statusCfg?.icon || ShieldQuestion;
              const isExpanded = expandedSystems.has(sys.id);
              const hasDetails = sys.ip_addresses.length > 0 || sys.owner;
              return (
                <div key={sys.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      className="flex items-center gap-3 px-3 py-2.5 flex-1 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition min-w-0"
                      onClick={() => hasDetails && toggleSystem(sys.id)}
                    >
                      <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{sys.name}</span>
                          {statusCfg && (
                            <span className={`flex items-center gap-0.5 text-[10px] ${statusCfg.cls}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusCfg.label}
                            </span>
                          )}
                        </div>
                        {sys.owner && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{sys.owner}</p>}
                      </div>
                      {hasDetails && (
                        isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {!isClosed && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => openEditSystem(sys)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex-shrink-0"
                        title={t('auto.modifier')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {isExpanded && sys.ip_addresses.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-slate-700 px-3 py-2 bg-gray-50/50 dark:bg-slate-800/50">
                      <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                        <Network className="w-3 h-3" />
                        {t('auto.adresses_ip')}</p>
                      <div className="space-y-1">
                        {sys.ip_addresses.map((ip, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-mono text-gray-700 dark:text-slate-300">
                            <span>{ip.ip}</span>
                            {ip.mask && <span className="text-gray-400">/{ip.mask}</span>}
                            {ip.gateway && <span className="text-gray-400">GW: {ip.gateway}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
        <SectionHeader icon={Bug} label="Malware / Outils" count={objects.malware.length} />
        {objects.malware.length === 0 ? (
          <EmptySection label="malware/outil" />
        ) : (
          <div className="space-y-1.5">
            {objects.malware.map((m) => {
              const isExpanded = expandedMalware.has(m.id);
              const hasDetails = m.file_path || m.hashes.length > 0;
              return (
                <div key={m.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      className="flex items-center gap-3 px-3 py-2.5 flex-1 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition min-w-0"
                      onClick={() => hasDetails && toggleMalware(m.id)}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${m.is_malicious ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                        <Bug className={`w-3.5 h-3.5 ${m.is_malicious ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{m.file_name}</span>
                          {m.is_malicious ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-0.5 flex-shrink-0">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {t('auto.malveillant')}</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 flex items-center gap-0.5 flex-shrink-0">
                              <CheckCircle className="w-2.5 h-2.5" />
                              {t('auto.non_malveillant')}</span>
                          )}
                        </div>
                        {m.system_name && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Server className="w-3 h-3" />
                            {m.system_name}
                          </p>
                        )}
                      </div>
                      {hasDetails && (
                        isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {!isClosed && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => openEditMalware(m)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex-shrink-0"
                        title={t('auto.modifier')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-slate-700 px-3 py-2 bg-gray-50/50 dark:bg-slate-800/50 space-y-2">
                      {m.file_path && (
                        <p className="text-xs font-mono text-gray-600 dark:text-slate-400 break-all">{m.file_path}</p>
                      )}
                      {m.hashes.length > 0 && (
                        <div className="space-y-1">
                          {m.hashes.map((h, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs font-mono bg-white dark:bg-slate-800 px-2 py-1.5 rounded border border-gray-100 dark:border-slate-700">
                              <span className="font-sans font-semibold text-gray-500 dark:text-slate-400 uppercase text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5">
                                <Hash className="w-2.5 h-2.5" />
                                {HASH_LABELS[h.type] || h.type}
                              </span>
                              <span className="text-gray-800 dark:text-white break-all text-[11px]">{h.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
        <SectionHeader icon={KeyRound} label="Comptes compromis" count={objects.accounts.length} />
        {objects.accounts.length === 0 ? (
          <EmptySection label="compte compromis" />
        ) : (
          <div className="space-y-1.5">
            {objects.accounts.map((acc) => (
              <div key={acc.id} className="border border-gray-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 pr-2">
                  <div className="flex items-start gap-3 px-3 py-2.5 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800 dark:text-white">
                          {acc.domain ? `${acc.domain}\\${acc.account_name}` : acc.account_name}
                        </span>
                        {acc.privileges && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400">
                            {acc.privileges}
                          </span>
                        )}
                      </div>
                      {acc.linked_systems.length > 0 && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                          <Server className="w-3 h-3" />
                          {acc.linked_systems.map(s => s.name).join(', ')}
                        </p>
                      )}
                      {acc.sid && (
                        <p className="text-xs font-mono text-gray-400 dark:text-slate-500 mt-0.5">{acc.sid}</p>
                      )}
                    </div>
                  </div>
                  {!isClosed && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => openEditAccount(acc)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex-shrink-0"
                      title={t('auto.modifier')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
        <SectionHeader icon={Globe} label="Indicateurs reseau" count={objects.network.length} />
        {objects.network.length === 0 ? (
          <EmptySection label="indicateur reseau" />
        ) : (
          <div className="space-y-1.5">
            {objects.network.map((n) => (
              <div key={n.id} className="border border-gray-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 pr-2">
                  <div className="flex items-start gap-3 px-3 py-2.5 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {n.ip && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Network className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-gray-800 dark:text-white text-xs">{n.ip}</span>
                          {n.port && <span className="text-gray-400 text-xs">:{n.port}</span>}
                        </div>
                      )}
                      {n.domain_name && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Link2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-gray-800 dark:text-white text-xs">{n.domain_name}</span>
                        </div>
                      )}
                      {n.url && (
                        <p className="text-xs font-mono text-gray-600 dark:text-slate-400 break-all">{n.url}</p>
                      )}
                      {n.malware_name && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Bug className="w-3 h-3" />
                          {n.malware_name}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isClosed && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => openEditNetwork(n)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex-shrink-0"
                      title={t('auto.modifier')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
        <SectionHeader icon={Upload} label="Exfiltrations" count={objects.exfiltrations.length} />
        {objects.exfiltrations.length === 0 ? (
          <EmptySection label="exfiltration" />
        ) : (
          <div className="space-y-1.5">
            {objects.exfiltrations.map((ex) => (
              <div key={ex.id} className="border border-gray-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 pr-2">
                  <div className="flex items-start gap-3 px-3 py-2.5 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Upload className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {ex.file_name && (
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800 dark:text-white">{ex.file_name}</span>
                          {ex.file_size != null && (
                            <span className="text-xs text-gray-400">{ex.file_size} {ex.file_size_unit}</span>
                          )}
                        </div>
                      )}
                      {ex.exfiltration_date && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(ex.exfiltration_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {ex.source_system_name && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Server className="w-3 h-3" />
                          {ex.source_system_name}
                        </p>
                      )}
                      {ex.content_description && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ex.content_description}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isClosed && !isReadOnly && (
                    <button
                      type="button"
                      onClick={() => openEditExfil(ex)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex-shrink-0"
                      title={t('auto.modifier')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
