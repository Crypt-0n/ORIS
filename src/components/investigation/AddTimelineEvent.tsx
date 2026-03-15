import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { X, Save, Clock, Plus, Diamond, Monitor, Bug, KeyRound, Globe, DatabaseZap, User, Server as ServerIcon, Shield, Skull } from 'lucide-react';
import { InlineSystemForm } from '../InlineSystemForm';
import { getKillChainPhases } from '../../lib/killChainDefinitions';
import { LinkedObjectTag, LinkedObject } from './LinkedObjectTag';
import { useTranslation } from "react-i18next";

interface SystemEntry { id: string; name: string; system_type?: string; }
interface MalwareEntry { id: string; file_name: string; }
interface AccountEntry { id: string; account_name: string; domain: string; }
interface NetworkIndicatorEntry { id: string; ip: string | null; domain_name: string | null; url: string | null; }
interface ExfiltrationEntry { id: string; file_name: string; exfiltration_date: string | null; }
interface TtpEntry { id: string; ttp_id: string; name: string; description: string; phase_value: string; }
interface AttackerInfraEntry { id: string; name: string; infra_type: string; }

export interface TimelineEventData {
  id: string;
  event_datetime: string;
  kill_chain: string | null;
  malware_id: string | null;
  compromised_account_id: string | null;
  exfiltration_id: string | null;
}

interface AddTimelineEventProps {
  caseId: string;
  killChainType?: string;
  preselectedSystemId?: string;
  taskId?: string;
  editEvent?: TimelineEventData;
  onClose: () => void;
  onSuccess: () => void;
}

const FILE_SIZE_UNITS = ['Octets', 'Ko', 'Mo', 'Go', 'To', 'Po'];

function buildDiamondFromObjects(
  linkedObjects: LinkedObject[],
  _eventType: string,
  systems: SystemEntry[],
  malwareEntries: MalwareEntry[],
  accounts: AccountEntry[],
  networkIndicators: NetworkIndicatorEntry[],
  exfiltrations: ExfiltrationEntry[],
  preselectedSystemId?: string,
  formKillChain?: string,
  availableTtps?: TtpEntry[],
  attackerInfra?: AttackerInfraEntry[]
): { adversary: LinkedObject[]; infrastructure: LinkedObject[]; capability: LinkedObject[]; victim: LinkedObject[] } {
  const adversary: LinkedObject[] = [];
  const infrastructure: LinkedObject[] = [];
  const capability: LinkedObject[] = [];
  const victim: LinkedObject[] = [];

  const addUnique = (arr: LinkedObject[], obj: LinkedObject) => {
    if (!arr.some(x => x.id === obj.id)) arr.push(obj);
  };

  linkedObjects.forEach(obj => {
    const { id } = obj;

    const sys = systems.find(s => s.id === id);
    if (sys) {
      if (sys.system_type === 'infrastructure_attaquant' || sys.system_type === 'attacker_infrastructure') {
        addUnique(infrastructure, { id: sys.id, label: sys.name, type: 'system' });
      } else {
        addUnique(victim, { id: sys.id, label: sys.name, type: 'system' });
      }
    }

    const infra = attackerInfra?.find(ai => ai.id === id);
    if (infra) {
      addUnique(infrastructure, { id: infra.id, label: infra.name, type: 'attacker_infra' });
    }

    const mal = malwareEntries.find(m => m.id === id);
    if (mal) addUnique(capability, { id: mal.id, label: mal.file_name, type: 'malware' });

    const acc = accounts.find(a => a.id === id);
    if (acc) {
      const label = acc.domain ? `${acc.domain}\\${acc.account_name}` : acc.account_name;
      addUnique(adversary, { id: acc.id, label, type: 'account' });
    }

    const ni = networkIndicators.find(n => n.id === id);
    if (ni) {
      const val = ni.ip || ni.domain_name || ni.url || '';
      if (val) addUnique(infrastructure, { id: ni.id, label: val, type: 'network' });
    }

    const exfil = exfiltrations.find(e => e.id === id);
    if (exfil) addUnique(capability, { id: exfil.id, label: exfil.file_name || 'Exfiltration', type: 'exfiltration' });
  });

  if (preselectedSystemId) {
    const src = systems.find(s => s.id === preselectedSystemId);
    if (src) {
      if (!infrastructure.some(x => x.id === src.id)) {
        infrastructure.push({ id: src.id, label: src.name, type: 'system' });
      }
    }
  }

  // No event_type fallback — capabilities come from linked objects only

  if (formKillChain && availableTtps) {
    const phaseTtps = availableTtps.filter(t => t.phase_value === formKillChain);
    phaseTtps.forEach(t => {
      addUnique(capability, { id: `ttp_${t.id}`, label: `${t.ttp_id} — ${t.name}`, type: 'ttp' });
    });
  }

  return { adversary, infrastructure, capability, victim };
}

export function AddTimelineEvent({ caseId, killChainType, preselectedSystemId, taskId, editEvent, onClose, onSuccess }: AddTimelineEventProps) {
  const { t } = useTranslation();
  const isEditing = !!editEvent;
  const killChainPhases = getKillChainPhases(killChainType ?? null);

  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [malwareEntries, setMalwareEntries] = useState<MalwareEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [networkIndicators, setNetworkIndicators] = useState<NetworkIndicatorEntry[]>([]);
  const [exfiltrations, setExfiltrations] = useState<ExfiltrationEntry[]>([]);
  const [attackerInfra, setAttackerInfra] = useState<AttackerInfraEntry[]>([]);

  const [formDateTime, setFormDateTime] = useState(editEvent ? new Date(editEvent.event_datetime).toISOString().slice(0, 19) : '');
  const [formKillChain, setFormKillChain] = useState(editEvent?.kill_chain || '');

  const [linkedObjects, setLinkedObjects] = useState<LinkedObject[]>([]);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkCategory, setLinkCategory] = useState<'system' | 'malware' | 'account' | 'network' | 'exfiltration' | 'attacker_infra' | ''>('');
  const [linkSearch, setLinkSearch] = useState('');

  const [showNewSystem, setShowNewSystem] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountDomain, setNewAccountDomain] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [showNewMalware, setShowNewMalware] = useState(false);
  const [newMalwareFileName, setNewMalwareFileName] = useState('');
  const [creatingMalware, setCreatingMalware] = useState(false);

  const [showNewExfiltration, setShowNewExfiltration] = useState(false);
  const [newExfilDate, setNewExfilDate] = useState('');
  const [newExfilExfilSystemId, setNewExfilExfilSystemId] = useState('');
  const [newExfilSourceSystemId, setNewExfilSourceSystemId] = useState('');
  const [newExfilDestSystemId, setNewExfilDestSystemId] = useState('');
  const [newExfilFileName, setNewExfilFileName] = useState('');
  const [newExfilFileSize, setNewExfilFileSize] = useState('');
  const [newExfilFileSizeUnit, setNewExfilFileSizeUnit] = useState('Octets');
  const [newExfilContentDesc, setNewExfilContentDesc] = useState('');
  const [creatingExfiltration, setCreatingExfiltration] = useState(false);

  const [showNewNetwork, setShowNewNetwork] = useState(false);
  const [newNetIp, setNewNetIp] = useState('');
  const [newNetDomain, setNewNetDomain] = useState('');
  const [newNetUrl, setNewNetUrl] = useState('');
  const [creatingNetwork, setCreatingNetwork] = useState(false);

  const [showNewAttackerInfra, setShowNewAttackerInfra] = useState(false);
  const [newAttackerInfraName, setNewAttackerInfraName] = useState('');
  const [newAttackerInfraType, setNewAttackerInfraType] = useState('c2_server');
  const [creatingAttackerInfra, setCreatingAttackerInfra] = useState(false);

  const [diamondAdversary, setDiamondAdversary] = useState<LinkedObject[]>([]);
  const [diamondInfrastructure, setDiamondInfrastructure] = useState<LinkedObject[]>([]);
  const [diamondCapability, setDiamondCapability] = useState<LinkedObject[]>([]);
  const [diamondVictim, setDiamondVictim] = useState<LinkedObject[]>([]);
  const [diamondNotes, setDiamondNotes] = useState('');
  const [diamondOverridden, setDiamondOverridden] = useState(false);
  const [axisPickerOpen, setAxisPickerOpen] = useState<'adversary' | 'infrastructure' | 'capability' | 'victim' | null>(null);
  const [axisPickerSearch, setAxisPickerSearch] = useState('');

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [availableTtps, setAvailableTtps] = useState<TtpEntry[]>([]);

  useEffect(() => {
    const init = async () => {
      const [, malRes, accRes, exfilRes] = await fetchAll();

      if (isEditing && editEvent) {
        loadExistingDiamondOverride(editEvent.id);
        const objs: LinkedObject[] = [];
        if (editEvent.malware_id) {
          const data = malRes.find((m: any) => m.id === editEvent.malware_id);
          if (data) objs.push({ id: data.id, label: data.file_name, type: 'malware' });
        }
        if (editEvent.compromised_account_id) {
          const data = accRes.find((a: any) => a.id === editEvent.compromised_account_id);
          if (data) objs.push({ id: data.id, label: data.domain ? `${data.domain}\\${data.account_name}` : data.account_name, type: 'account' });
        }
        if (editEvent.exfiltration_id) {
          const data = exfilRes.find((e: any) => e.id === editEvent.exfiltration_id);
          if (data) objs.push({ id: data.id, label: data.file_name || 'Exfiltration', type: 'exfiltration' });
        }
        setLinkedObjects(objs);
      }
    };
    init();
  }, [caseId]);

  // Fetch TTPs whenever kill chain type or phase changes
  useEffect(() => {
    if (!killChainType) return;
    api.get(`/config/ttps?kill_chain_type=${killChainType}`)
      .then(data => setAvailableTtps(data || []))
      .catch(() => setAvailableTtps([]));
  }, [killChainType]);

  useEffect(() => {
    if (!diamondOverridden) {
      autoFillDiamond();
    }
  }, [linkedObjects, systems, malwareEntries, accounts, networkIndicators, exfiltrations, attackerInfra, diamondOverridden, preselectedSystemId, formKillChain, availableTtps]);

  const autoFillDiamond = () => {
    const auto = buildDiamondFromObjects(linkedObjects, '', systems, malwareEntries, accounts, networkIndicators, exfiltrations, preselectedSystemId, formKillChain, availableTtps, attackerInfra);
    setDiamondAdversary(auto.adversary);
    setDiamondInfrastructure(auto.infrastructure);
    setDiamondCapability(auto.capability);
    setDiamondVictim(auto.victim);
  };

  const fetchAll = async () => {
    try {
      const [sysRes, malRes, accRes, niRes, exfilRes, aiRes] = await Promise.all([
        api.get(`/investigation/systems/by-case/${caseId}`),
        api.get(`/investigation/malware/by-case/${caseId}`),
        api.get(`/investigation/accounts/by-case/${caseId}`),
        api.get(`/investigation/indicators/by-case/${caseId}`),
        api.get(`/investigation/exfiltrations/by-case/${caseId}`),
        api.get(`/investigation/attacker-infra/by-case/${caseId}`),
      ]);
      const sortedSys = (sysRes || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
      const sortedMal = (malRes || []).sort((a: any, b: any) => a.file_name.localeCompare(b.file_name));
      const sortedAcc = (accRes || []).sort((a: any, b: any) => a.account_name.localeCompare(b.account_name));
      const sortedExfil = (exfilRes || []).sort((a: any, b: any) => {
        if (!a.exfiltration_date) return 1;
        if (!b.exfiltration_date) return -1;
        return new Date(b.exfiltration_date).getTime() - new Date(a.exfiltration_date).getTime();
      });

      setSystems(sortedSys);
      setMalwareEntries(sortedMal);
      setAccounts(sortedAcc);
      setNetworkIndicators(niRes || []);
      setExfiltrations(sortedExfil);
      setAttackerInfra((aiRes || []).sort((a: any, b: any) => a.name.localeCompare(b.name)));

      return [sortedSys, sortedMal, sortedAcc, sortedExfil];
    } catch (err) {
      console.error(err);
      return [[], [], [], []];
    }
  };

  const loadExistingDiamondOverride = async (eventId: string) => {
    try {
      const data = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
      const override = (data || []).find((d: any) => d.event_id === eventId);
      if (override) {
        const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : (val || []);
        setDiamondAdversary(parseJson(override.adversary));
        setDiamondInfrastructure(parseJson(override.infrastructure));
        setDiamondCapability(parseJson(override.capability));
        setDiamondVictim(parseJson(override.victim));
        setDiamondNotes(override.notes || '');
        setDiamondOverridden(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) { setFormError('Le nom du compte est obligatoire'); return; }
    setCreatingAccount(true);
    setFormError('');
    try {
      const data = await api.post('/investigation/accounts', { case_id: caseId, account_name: newAccountName.trim(), domain: newAccountDomain.trim(), sid: '', privileges: '', context: '' });
      const newAcc = { id: data.id, account_name: newAccountName.trim(), domain: newAccountDomain.trim() };
      setAccounts(prev => [...prev, newAcc].sort((a, b) => a.account_name.localeCompare(b.account_name)));
      const label = newAcc.domain ? `${newAcc.domain}\\${newAcc.account_name}` : newAcc.account_name;
      addLinkedObject({ id: data.id, label, type: 'account' });
      setShowNewAccount(false);
      setNewAccountName('');
      setNewAccountDomain('');
    } catch (error) {
      setFormError('Erreur lors de la creation du compte');
    }
    setCreatingAccount(false);
  };

  const handleCreateMalware = async () => {
    if (!newMalwareFileName.trim()) { setFormError('Le nom du fichier est obligatoire'); return; }
    setCreatingMalware(true);
    setFormError('');
    try {
      const data = await api.post('/investigation/malware', { case_id: caseId, file_name: newMalwareFileName.trim(), file_path: '', hashes: JSON.stringify([]), is_malicious: false });
      const newMal = { id: data.id, file_name: newMalwareFileName.trim() };
      setMalwareEntries(prev => [...prev, newMal].sort((a, b) => a.file_name.localeCompare(b.file_name)));
      addLinkedObject({ id: data.id, label: newMal.file_name, type: 'malware' });
      setShowNewMalware(false);
      setNewMalwareFileName('');
    } catch (error) {
      setFormError('Erreur lors de la creation du malware');
    }
    setCreatingMalware(false);
  };

  const handleCreateExfiltration = async () => {
    if (!newExfilDate.trim()) { setFormError("La date de l'exfiltration est obligatoire"); return; }
    if (!newExfilExfilSystemId) { setFormError("Le systeme utilise pour l'exfiltration est obligatoire"); return; }
    if (!newExfilSourceSystemId) { setFormError("Le systeme a l'origine des donnees est obligatoire"); return; }
    if (!newExfilDestSystemId) { setFormError("La destination est obligatoire"); return; }
    if (!newExfilFileName.trim()) { setFormError('Le nom du fichier est obligatoire'); return; }
    if (!newExfilFileSize.trim()) { setFormError('La taille du fichier est obligatoire'); return; }
    if (!newExfilContentDesc.trim()) { setFormError('La description du contenu est obligatoire'); return; }
    setCreatingExfiltration(true);
    setFormError('');
    try {
      const payload = {
        case_id: caseId,
        exfiltration_date: newExfilDate + 'Z',
        exfil_system_id: newExfilExfilSystemId,
        source_system_id: newExfilSourceSystemId,
        destination_system_id: newExfilDestSystemId,
        file_name: newExfilFileName.trim(),
        file_size: parseFloat(newExfilFileSize.trim()),
        file_size_unit: newExfilFileSizeUnit,
        content_description: newExfilContentDesc,
        other_info: '',
      };
      const data = await api.post('/investigation/exfiltrations', payload);
      const newExfil = { id: data.id, file_name: payload.file_name, exfiltration_date: payload.exfiltration_date };

      setExfiltrations(prev => [newExfil, ...prev]);
      addLinkedObject({ id: data.id, label: newExfil.file_name || 'Exfiltration', type: 'exfiltration' });
      setShowNewExfiltration(false);
      setNewExfilDate(''); setNewExfilExfilSystemId(''); setNewExfilSourceSystemId('');
      setNewExfilDestSystemId(''); setNewExfilFileName(''); setNewExfilFileSize('');
      setNewExfilFileSizeUnit('Octets'); setNewExfilContentDesc('');
    } catch (error) {
      setFormError("Erreur lors de la creation de l'exfiltration");
    }
    setCreatingExfiltration(false);
  };

  const handleCreateNetworkIndicator = async () => {
    if (!newNetIp.trim() && !newNetDomain.trim() && !newNetUrl.trim()) {
      setFormError("Au moins un indicateur (IP, domaine ou URL) est requis");
      return;
    }
    setCreatingNetwork(true);
    setFormError('');
    try {
      const payload = {
        case_id: caseId,
        ip: newNetIp.trim() || null,
        domain_name: newNetDomain.trim() || null,
        port: null,
        url: newNetUrl.trim() || null,
        context: '',
      };
      const data = await api.post('/investigation/indicators', payload);
      const val = payload.ip || payload.domain_name || payload.url || 'Indicateur';
      const newNi = {
        id: data.id,
        ip: payload.ip,
        domain_name: payload.domain_name,
        url: payload.url,
      };

      setNetworkIndicators(prev => [...prev, newNi]);
      addLinkedObject({ id: data.id, label: val, type: 'network' });
      setShowNewNetwork(false);
      setNewNetIp('');
      setNewNetDomain('');
      setNewNetUrl('');
    } catch (error) {
      setFormError("Erreur lors de la creation de l'indicateur reseau");
    }
    setCreatingNetwork(false);
  };

  const handleCreateAttackerInfra = async () => {
    if (!newAttackerInfraName.trim()) {
      setFormError('Le nom est requis');
      return;
    }
    setCreatingAttackerInfra(true);
    setFormError('');
    try {
      const payload = {
        case_id: caseId,
        name: newAttackerInfraName.trim(),
        infra_type: newAttackerInfraType,
        description: '',
        ip_addresses: '[]',
      };
      const data = await api.post('/investigation/attacker-infra', payload);
      const newEntry = { id: data.id, name: payload.name, infra_type: payload.infra_type };
      setAttackerInfra(prev => [...prev, newEntry]);
      addLinkedObject({ id: data.id, label: payload.name, type: 'attacker_infra' });
      setShowNewAttackerInfra(false);
      setNewAttackerInfraName('');
      setNewAttackerInfraType('c2_server');
    } catch (error) {
      setFormError('Erreur creation infra. attaquant');
    }
    setCreatingAttackerInfra(false);
  };

  const addLinkedObject = (obj: LinkedObject) => {
    setLinkedObjects(prev => prev.some(o => o.id === obj.id) ? prev : [...prev, obj]);
    setLinkPickerOpen(false);
    setLinkCategory('');
    setLinkSearch('');
  };

  const removeLinkedObject = (id: string) => {
    setLinkedObjects(prev => prev.filter(o => o.id !== id));
  };

  const getLinkableOptions = (): { id: string; label: string; type: 'system' | 'malware' | 'account' | 'network' | 'exfiltration' | 'attacker_infra' }[] => {
    const existing = new Set(linkedObjects.map(o => o.id));
    const options: { id: string; label: string; type: 'system' | 'malware' | 'account' | 'network' | 'exfiltration' | 'attacker_infra' }[] = [];
    if (!linkCategory || linkCategory === 'system') {
      systems.forEach(s => { if (!existing.has(s.id)) options.push({ id: s.id, label: s.name, type: 'system' }); });
    }
    if (!linkCategory || linkCategory === 'malware') {
      malwareEntries.forEach(m => { if (!existing.has(m.id)) options.push({ id: m.id, label: m.file_name, type: 'malware' }); });
    }
    if (!linkCategory || linkCategory === 'account') {
      accounts.forEach(a => {
        if (!existing.has(a.id)) {
          const label = a.domain ? `${a.domain}\\${a.account_name}` : a.account_name;
          options.push({ id: a.id, label, type: 'account' });
        }
      });
    }
    if (!linkCategory || linkCategory === 'network') {
      networkIndicators.forEach(n => {
        if (!existing.has(n.id)) {
          const val = n.ip || n.domain_name || n.url || 'Indicateur';
          options.push({ id: n.id, label: val, type: 'network' });
        }
      });
    }
    if (!linkCategory || linkCategory === 'exfiltration') {
      exfiltrations.forEach(e => {
        if (!existing.has(e.id)) {
          options.push({ id: e.id, label: e.file_name || 'Exfiltration', type: 'exfiltration' });
        }
      });
    }
    if (!linkCategory || linkCategory === 'attacker_infra') {
      attackerInfra.forEach(ai => {
        if (!existing.has(ai.id)) {
          options.push({ id: ai.id, label: ai.name, type: 'attacker_infra' });
        }
      });
    }
    const q = linkSearch.toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  };

  const totalDiamondValues = diamondAdversary.length + diamondInfrastructure.length + diamondCapability.length + diamondVictim.length;

  const handleSubmit = async () => {
    if (!formKillChain) { setFormError('La phase de la Kill Chain est obligatoire'); return; }
    if (!formDateTime) { setFormError('La date et heure sont obligatoires'); return; }
    setSaving(true);
    setFormError('');

    const malwareLinked = linkedObjects.find(o => o.type === 'malware');
    const accountLinked = linkedObjects.find(o => o.type === 'account');
    const exfilLinked = linkedObjects.find(o => o.type === 'exfiltration');

    const fields = {
      event_datetime: formDateTime + 'Z',
      kill_chain: formKillChain || null,
      malware_id: malwareLinked?.id || null,
      compromised_account_id: accountLinked?.id || null,
      exfiltration_id: exfilLinked?.id || null,
    };

    let savedEventId: string | null = null;

    try {
      if (isEditing) {
        await api.put(`/investigation/events/${editEvent!.id}`, fields);
        savedEventId = editEvent!.id;
      } else {
        const data = await api.post('/investigation/events', { ...fields, case_id: caseId, task_id: taskId || null });
        savedEventId = data.id;
      }

      if (savedEventId) {
        const prevOverrides = await api.get(`/investigation/diamond-overrides/by-case/${caseId}`);
        const existing = (prevOverrides || []).find((o: any) => o.event_id === savedEventId);

        const overridePayload = {
          case_id: caseId, event_id: savedEventId, label: '', notes: diamondNotes,
          adversary: JSON.stringify(diamondAdversary),
          infrastructure: JSON.stringify(diamondInfrastructure),
          capability: JSON.stringify(diamondCapability),
          victim: JSON.stringify(diamondVictim)
        };

        if (existing) {
          await api.put(`/investigation/diamond-overrides/${existing.id}`, overridePayload);
        } else {
          await api.post('/investigation/diamond-overrides', overridePayload);
        }
      }
      onSuccess();
    } catch (err) {
      setFormError(isEditing ? 'Erreur lors de la mise a jour' : "Erreur lors de l'ajout");
      console.error(err);
    }
    setSaving(false);
  };

  const linkOptions = getLinkableOptions();

  const LINK_CATEGORIES = [
    { id: 'system' as const, label: 'Systeme', icon: Monitor },
    { id: 'malware' as const, label: 'Malware', icon: Bug },
    { id: 'account' as const, label: 'Compte', icon: KeyRound },
    { id: 'network' as const, label: 'Indicateur', icon: Globe },
    { id: 'exfiltration' as const, label: 'Exfiltration', icon: DatabaseZap },
    { id: 'attacker_infra' as const, label: 'Infra. attaq.', icon: Skull },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-lg max-w-lg w-full p-4 sm:p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto shadow dark:shadow-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
              {isEditing ? "Modifier l'evenement" : 'Nouvel evenement'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-transparent dark:border-red-800 mb-4">{formError}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              {t('diamond.phase')}<span className="text-red-500">*</span>
            </label>
            <select
              value={formKillChain}
              onChange={(e) => setFormKillChain(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t('auto.selectionner')}</option>
              {killChainPhases.map((p) => (
                <option key={p.value} value={p.value}>{t(`killChain.${p.value}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
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


          <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{t('auto.objets_lies')}</p>
              <button
                type="button"
                onClick={() => { setLinkPickerOpen(!linkPickerOpen); setLinkCategory(''); setLinkSearch(''); }}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('auto.lier_un_objet')}</button>
            </div>

            {linkedObjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {linkedObjects.map(obj => (
                  <LinkedObjectTag key={obj.id} object={obj} onRemove={removeLinkedObject} />
                ))}
              </div>
            )}

            {linkPickerOpen && (
              <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="flex border-b border-gray-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setLinkCategory('')}
                    className={`flex-1 py-1.5 text-[10px] font-medium transition ${!linkCategory ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                  >
                    {t('auto.tout')}</button>
                  {LINK_CATEGORIES.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLinkCategory(id)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition ${linkCategory === id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                    >
                      <Icon className="w-3 h-3" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-2">
                  <input
                    type="text"
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder={t('auto.rechercher')}
                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {linkOptions.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-3">{t('auto.aucun_objet_disponible')}</p>
                  ) : (
                    linkOptions.slice(0, 20).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => addLinkedObject(opt)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                      >
                        <LinkedObjectTag object={opt} readonly />
                      </button>
                    ))
                  )}
                </div>

                {(linkCategory === '' || linkCategory === 'system') && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                    {!showNewSystem ? (
                      <button
                        type="button"
                        onClick={() => setShowNewSystem(true)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-300 dark:border-emerald-700 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
                      >
                        <Plus className="w-3 h-3" /> {t('auto.nouveau_systeme')}</button>
                    ) : (
                      <InlineSystemForm
                        caseId={caseId}
                        onCreated={(newId, newName) => {
                          const newSys = { id: newId, name: newName, system_type: '' };
                          setSystems(prev => [...prev, newSys].sort((a, b) => a.name.localeCompare(b.name)));
                          addLinkedObject({ id: newId, label: newName, type: 'system' });
                          setShowNewSystem(false);
                        }}
                        onCancel={() => setShowNewSystem(false)}
                      />
                    )}
                  </div>
                )}

                {(linkCategory === '' || linkCategory === 'account') && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                    {!showNewAccount ? (
                      <button
                        type="button"
                        onClick={() => setShowNewAccount(true)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400 border border-dashed border-amber-300 dark:border-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                      >
                        <Plus className="w-3 h-3" /> {t('auto.nouveau_compte_compromis')}</button>
                    ) : (
                      <div className="space-y-2">
                        <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} placeholder={t('auto.nom_du_compte')} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <input type="text" value={newAccountDomain} onChange={(e) => setNewAccountDomain(e.target.value)} placeholder={t('auto.domaine_optionnel')} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(''); setNewAccountDomain(''); }} className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">{t('auto.annuler')}</button>
                          <button type="button" onClick={handleCreateAccount} disabled={creatingAccount} className="flex-1 px-2 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 transition disabled:opacity-50">{creatingAccount ? '...' : 'Creer'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(linkCategory === '' || linkCategory === 'malware') && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                    {!showNewMalware ? (
                      <button
                        type="button"
                        onClick={() => setShowNewMalware(true)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 border border-dashed border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <Plus className="w-3 h-3" /> {t('auto.nouveau_malware_outil')}</button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-red-700 dark:text-red-300">{t('auto.nouveau_malware_outil')}</span>
                          <button type="button" onClick={() => { setShowNewMalware(false); setNewMalwareFileName(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <input type="text" value={newMalwareFileName} onChange={(e) => setNewMalwareFileName(e.target.value)} placeholder={t('auto.nom_du_fichier_8')} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setShowNewMalware(false); setNewMalwareFileName(''); }} className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">{t('auto.annuler')}</button>
                          <button type="button" onClick={handleCreateMalware} disabled={creatingMalware} className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50">{creatingMalware ? '...' : 'Creer'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(linkCategory === '' || linkCategory === 'exfiltration') && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                    {!showNewExfiltration ? (
                      <button
                        type="button"
                        onClick={() => setShowNewExfiltration(true)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-orange-600 dark:text-orange-400 border border-dashed border-orange-300 dark:border-orange-700 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 transition"
                      >
                        <Plus className="w-3 h-3" /> {t('auto.nouvelle_exfiltration')}</button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">{t('auto.nouvelle_exfiltration')}</span>
                          <button type="button" onClick={() => setShowNewExfiltration(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <input type="datetime-local" step="1" value={newExfilDate} onChange={(e) => setNewExfilDate(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <select value={newExfilExfilSystemId} onChange={(e) => setNewExfilExfilSystemId(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white">
                          <option value="">{t('auto.systeme_d_exfiltration')}</option>
                          {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={newExfilSourceSystemId} onChange={(e) => setNewExfilSourceSystemId(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white">
                          <option value="">{t('auto.systeme_source_des_donnees')}</option>
                          {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={newExfilDestSystemId} onChange={(e) => setNewExfilDestSystemId(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white">
                          <option value="">{t('auto.destination')}</option>
                          {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="text" value={newExfilFileName} onChange={(e) => setNewExfilFileName(e.target.value)} placeholder={t('auto.nom_du_fichier_9')} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <div className="flex gap-1">
                          <input type="number" min="0" step="any" value={newExfilFileSize} onChange={(e) => setNewExfilFileSize(e.target.value)} placeholder={t('auto.taille_10')} className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                          <select value={newExfilFileSizeUnit} onChange={(e) => setNewExfilFileSizeUnit(e.target.value)} className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white">
                            {FILE_SIZE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <textarea value={newExfilContentDesc} onChange={(e) => setNewExfilContentDesc(e.target.value)} placeholder={t('auto.description_du_contenu_11')} rows={2} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white resize-none" />
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setShowNewExfiltration(false)} className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">{t('auto.annuler')}</button>
                          <button type="button" onClick={handleCreateExfiltration} disabled={creatingExfiltration} className="flex-1 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition disabled:opacity-50">{creatingExfiltration ? '...' : 'Creer'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(linkCategory === '' || linkCategory === 'network') && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                    {!showNewNetwork ? (
                      <button
                        type="button"
                        onClick={() => setShowNewNetwork(true)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-sky-600 dark:text-sky-400 border border-dashed border-sky-300 dark:border-sky-700 rounded hover:bg-sky-50 dark:hover:bg-sky-900/20 transition"
                      >
                        <Plus className="w-3 h-3" /> {t('auto.nouvel_indicateur_reseau')}</button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">{t('auto.nouvel_indicateur_reseau')}</span>
                          <button type="button" onClick={() => { setShowNewNetwork(false); setNewNetIp(''); setNewNetDomain(''); setNewNetUrl(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <input type="text" value={newNetIp} onChange={(e) => setNewNetIp(e.target.value)} placeholder="IP" className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <input type="text" value={newNetDomain} onChange={(e) => setNewNetDomain(e.target.value)} placeholder="Domaine" className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <input type="text" value={newNetUrl} onChange={(e) => setNewNetUrl(e.target.value)} placeholder="URL" className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />

                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setShowNewNetwork(false); setNewNetIp(''); setNewNetDomain(''); setNewNetUrl(''); }} className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">{t('auto.annuler')}</button>
                          <button type="button" onClick={handleCreateNetworkIndicator} disabled={creatingNetwork} className="flex-1 px-2 py-1 text-xs bg-sky-600 text-white rounded hover:bg-sky-700 transition disabled:opacity-50">{creatingNetwork ? '...' : 'Creer'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(linkCategory === '' || linkCategory === 'attacker_infra') && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-2">
                    {!showNewAttackerInfra ? (
                      <button
                        type="button"
                        onClick={() => setShowNewAttackerInfra(true)}
                        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-rose-600 dark:text-rose-400 border border-dashed border-rose-300 dark:border-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                      >
                        <Plus className="w-3 h-3" /> {t('auto.nouvelle_infra_attaquant', { defaultValue: 'Nouvelle infra. attaquant' })}</button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('auto.nouvelle_infra_attaquant', { defaultValue: 'Nouvelle infra. attaquant' })}</span>
                          <button type="button" onClick={() => { setShowNewAttackerInfra(false); setNewAttackerInfraName(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <input type="text" value={newAttackerInfraName} onChange={(e) => setNewAttackerInfraName(e.target.value)} placeholder={t('auto.nom_de_l_infrastructure', { defaultValue: "Nom de l'infrastructure" })} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white" />
                        <select value={newAttackerInfraType} onChange={(e) => setNewAttackerInfraType(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white">
                          <option value="c2_server">Serveur C2</option>
                          <option value="vpn">VPN</option>
                          <option value="relay">Relais / Proxy</option>
                          <option value="phishing_server">Serveur de phishing</option>
                          <option value="exfil_server">Serveur d'exfiltration</option>
                          <option value="hosting">Hébergement</option>
                          <option value="domain_registrar">Registrar / DNS</option>
                          <option value="autre">Autre</option>
                        </select>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setShowNewAttackerInfra(false); setNewAttackerInfraName(''); }} className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">{t('auto.annuler')}</button>
                          <button type="button" onClick={handleCreateAttackerInfra} disabled={creatingAttackerInfra} className="flex-1 px-2 py-1 text-xs bg-rose-600 text-white rounded hover:bg-rose-700 transition disabled:opacity-50">{creatingAttackerInfra ? '...' : 'Créer'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {linkedObjects.length === 0 && !linkPickerOpen && (
              <p className="text-xs text-gray-400 dark:text-slate-500 italic">
                {t('auto.liez_des_systemes_malwares_com')}</p>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Diamond className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('auto.modele_diamant')}</span>
                {totalDiamondValues > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                    {totalDiamondValues} {t('auto.valeur_7')}{totalDiamondValues > 1 ? 's' : ''}
                    {!diamondOverridden && ' (auto)'}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 space-y-3 bg-white dark:bg-slate-900/40">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  {diamondOverridden ? 'Axes personnalises — ' : 'Axes auto-remplis depuis les objets lies — '}
                  <button
                    type="button"
                    onClick={() => {
                      if (diamondOverridden) {
                        setDiamondOverridden(false);
                        autoFillDiamond();
                      } else {
                        setDiamondOverridden(true);
                      }
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {diamondOverridden ? 'Reinitialiser (auto)' : 'Modifier manuellement'}
                  </button>
                </p>
              </div>
              {([
                { key: 'adversary' as const, label: 'Adversaire', icon: User, color: '#ef4444', values: diamondAdversary, setValues: setDiamondAdversary },
                { key: 'infrastructure' as const, label: 'Infrastructure', icon: ServerIcon, color: '#f97316', values: diamondInfrastructure, setValues: setDiamondInfrastructure },
                { key: 'capability' as const, label: 'Capacite', icon: Bug, color: '#eab308', values: diamondCapability, setValues: setDiamondCapability },
                { key: 'victim' as const, label: 'Victime', icon: Shield, color: '#22c55e', values: diamondVictim, setValues: setDiamondVictim },
              ] as const).map(({ key, label, icon: Icon, color, values, setValues }) => {
                const AXIS_ALLOWED_TYPES: Record<string, string[]> = {
                  adversary: ['account'],
                  infrastructure: ['network', 'system', 'attacker_infra'],
                  capability: ['malware', 'exfiltration', 'ttp'],
                  victim: ['system', 'account'],
                };
                const allowedTypes = AXIS_ALLOWED_TYPES[key] || [];
                // Build object options including TTPs for capability
                const phaseTtpObjects: LinkedObject[] = key === 'capability' && formKillChain
                  ? availableTtps
                      .filter(t => t.phase_value === formKillChain)
                      .map(t => ({ id: `ttp_${t.id}`, label: `${t.ttp_id} — ${t.name}`, type: 'ttp' as const }))
                  : [];
                const allObjects: LinkedObject[] = [
                  ...systems.map(s => ({ id: s.id, label: s.name, type: 'system' as const })),
                  ...malwareEntries.map(m => ({ id: m.id, label: m.file_name, type: 'malware' as const })),
                  ...accounts.map(a => ({ id: a.id, label: a.domain ? `${a.domain}\\${a.account_name}` : a.account_name, type: 'account' as const })),
                  ...networkIndicators.map(n => ({ id: n.id, label: n.ip || n.domain_name || n.url || 'Indicateur', type: 'network' as const })),
                  ...exfiltrations.map(e => ({ id: e.id, label: e.file_name || 'Exfiltration', type: 'exfiltration' as const })),
                  ...attackerInfra.map(ai => ({ id: ai.id, label: ai.name, type: 'attacker_infra' as const })),
                  ...phaseTtpObjects,
                ].filter(o => allowedTypes.includes(o.type));
                const pickerOptions = allObjects.filter(o => !values.some(v => v.id === o.id) && (!axisPickerSearch || o.label.toLowerCase().includes(axisPickerSearch.toLowerCase())));

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                          <Icon className="w-2.5 h-2.5" style={{ color }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</span>
                      </div>
                      {diamondOverridden && (
                        <button
                          type="button"
                          onClick={() => { setAxisPickerOpen(axisPickerOpen === key ? null : key); setAxisPickerSearch(''); }}
                          className="flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          {t('auto.ajouter')}</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 min-h-[20px]">
                      {values.map((v) => (
                        <LinkedObjectTag
                          key={v.id}
                          object={v}
                          onRemove={diamondOverridden ? (id) => setValues(values.filter(x => x.id !== id)) : undefined}
                          readonly={!diamondOverridden}
                        />
                      ))}
                      {values.length === 0 && (
                        <span className="text-[10px] text-gray-400 dark:text-slate-600 italic">{t('auto.aucun_objet')}</span>
                      )}
                    </div>
                    {diamondOverridden && axisPickerOpen === key && (
                      <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                        <input
                          type="text"
                          value={axisPickerSearch}
                          onChange={(e) => setAxisPickerSearch(e.target.value)}
                          placeholder={t('auto.rechercher_un_objet')}
                          className="w-full px-2 py-1 text-[10px] border-b border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-white focus:outline-none"
                        />
                        <div className="max-h-28 overflow-y-auto">
                          {pickerOptions.length === 0 ? (
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center py-2 italic">{t('auto.aucun_objet_disponible')}</p>
                          ) : (
                            pickerOptions.slice(0, 15).map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => { setValues([...values, opt]); setAxisPickerOpen(null); setAxisPickerSearch(''); }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                              >
                                <LinkedObjectTag object={opt} readonly />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('auto.notes_d_analyse')}</label>
                <textarea
                  value={diamondNotes}
                  onChange={(e) => setDiamondNotes(e.target.value)}
                  placeholder={t('auto.observations_hypotheses_ttp_mi')}
                  rows={2}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">
            {t('auto.annuler')}</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : isEditing ? 'Mettre a jour' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
