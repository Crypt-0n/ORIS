import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { X, Server, Search, Bug, Plus, Radar, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { InlineSystemForm } from './InlineSystemForm';
import { InlineMalwareForm } from './InlineMalwareForm';
import { useTranslation } from "react-i18next";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

interface SystemOption {
  id: string;
  name: string;
  system_type: string;
}

interface MalwareOption {
  id: string;
  file_name: string;
  is_malicious: boolean;
}

interface TaskModalProps {
  caseId: string;
  task?: {
    id: string;
    title: string;
    description: string;
    assigned_to: string | null;
  } | null;
  systemId?: string;
  systemName?: string;
  malwareId?: string;
  malwareName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskModal({ caseId, task, systemId, systemName, malwareId, malwareName, onClose, onSuccess }: TaskModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [malwareEntries, setMalwareEntries] = useState<MalwareOption[]>([]);
  const [isInvestigation, setIsInvestigation] = useState(false);
  const [isMalwareAnalysis, setIsMalwareAnalysis] = useState(false);
  const [isOsint, setIsOsint] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [selectedMalwareId, setSelectedMalwareId] = useState('');
  const [showNewSystemForm, setShowNewSystemForm] = useState(false);
  const [showNewMalwareForm, setShowNewMalwareForm] = useState(false);
  const [formData, setFormData] = useState({
    title: task?.title || (systemName ? `Investigation - ${systemName}` : (malwareName ? `Analyse malware - ${malwareName}` : '')),
    description: task?.description || '',
    assigned_to: task?.assigned_to || '',
  });
  const [initialInvestigationStatus, setInitialInvestigationStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const showSystemPicker = !task && !systemId && !malwareId;
  const isSystemInvestigationTask = !task && (!!systemId || (isInvestigation && !!selectedSystemId));

  useEffect(() => {
    fetchTeamMembers();
    if (showSystemPicker) {
      fetchSystems();
      fetchMalwareEntries();
    }
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const caseData = await api.get(`/cases/${caseId}`);
      if (!caseData) return;

      const members: TeamMember[] = [];
      const seenIds = new Set<string>();

      const author = caseData.author;
      if (author && author.id) {
        members.push({ id: author.id, full_name: author.full_name, email: author.email });
        seenIds.add(author.id);
      }

      (caseData.case_assignments || []).forEach((assignment: any) => {
        if (assignment.user && !seenIds.has(assignment.user.id)) {
          members.push({ id: assignment.user.id, full_name: assignment.user.full_name, email: assignment.user.email });
          seenIds.add(assignment.user.id);
        }
      });

      setTeamMembers(members);
    } catch (err) {
      console.error('Erreur fetchTeamMembers:', err);
    }
  };

  const fetchSystems = async () => {
    try {
      const data = await api.get(`/investigation/systems/by-case/${caseId}`);
      setSystems(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchMalwareEntries = async () => {
    try {
      const data = await api.get(`/investigation/malware/by-case/${caseId}`);
      setMalwareEntries(data || []);
    } catch (err) { console.error(err); }
  };

  const handleToggleInvestigation = (enabled: boolean) => {
    setIsInvestigation(enabled);
    if (enabled) {
      setIsMalwareAnalysis(false);
      setIsOsint(false);
      setSelectedMalwareId('');
      setShowNewMalwareForm(false);
      if (formData.title.startsWith('Analyse malware - ') || formData.title.startsWith('OSINT - ')) {
        setFormData({ ...formData, title: '' });
      }
    }
    if (!enabled) {
      setSelectedSystemId('');
      setShowNewSystemForm(false);
      if (formData.title.startsWith('Investigation - ')) {
        setFormData({ ...formData, title: '' });
      }
    }
  };

  const handleToggleMalwareAnalysis = (enabled: boolean) => {
    setIsMalwareAnalysis(enabled);
    if (enabled) {
      setIsInvestigation(false);
      setIsOsint(false);
      setSelectedSystemId('');
      setShowNewSystemForm(false);
      if (formData.title.startsWith('Investigation - ') || formData.title.startsWith('OSINT - ')) {
        setFormData({ ...formData, title: '' });
      }
    }
    if (!enabled) {
      setSelectedMalwareId('');
      setShowNewMalwareForm(false);
      if (formData.title.startsWith('Analyse malware - ')) {
        setFormData({ ...formData, title: '' });
      }
    }
  };

  const handleToggleOsint = (enabled: boolean) => {
    setIsOsint(enabled);
    if (enabled) {
      setIsInvestigation(false);
      setIsMalwareAnalysis(false);
      setSelectedSystemId('');
      setSelectedMalwareId('');
      setShowNewSystemForm(false);
      setShowNewMalwareForm(false);
      if (formData.title.startsWith('Investigation - ') || formData.title.startsWith('Analyse malware - ')) {
        setFormData({ ...formData, title: 'OSINT - ' });
      }
    }
    if (!enabled) {
      if (formData.title.startsWith('OSINT - ')) {
        setFormData({ ...formData, title: '' });
      }
    }
  };

  const handleSystemSelect = (sysId: string) => {
    setSelectedSystemId(sysId);
    setShowNewSystemForm(false);
    const sys = systems.find(s => s.id === sysId);
    if (sys && (!formData.title || formData.title.startsWith('Investigation - '))) {
      setFormData({ ...formData, title: `Investigation - ${sys.name}` });
    }
  };

  const handleMalwareSelect = (malId: string) => {
    setSelectedMalwareId(malId);
    setShowNewMalwareForm(false);
    const mal = malwareEntries.find(m => m.id === malId);
    if (mal && (!formData.title || formData.title.startsWith('Analyse malware - '))) {
      setFormData({ ...formData, title: `Analyse malware - ${mal.file_name}` });
    }
  };

  const handleSystemCreated = (newId: string, newName: string) => {
    setSystems(prev => [...prev, { id: newId, name: newName, system_type: '' }]);
    setSelectedSystemId(newId);
    setShowNewSystemForm(false);
    if (!formData.title || formData.title.startsWith('Investigation - ')) {
      setFormData({ ...formData, title: `Investigation - ${newName}` });
    }
  };

  const handleMalwareCreated = (newId: string, newFileName: string) => {
    setMalwareEntries(prev => [...prev, { id: newId, file_name: newFileName, is_malicious: false }]);
    setSelectedMalwareId(newId);
    setShowNewMalwareForm(false);
    if (!formData.title || formData.title.startsWith('Analyse malware - ')) {
      setFormData({ ...formData, title: `Analyse malware - ${newFileName}` });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSaving(true);

    try {
      if (task) {
        await api.put(`/tasks/${task.id}`, {
          title: formData.title,
          description: formData.description,
          assigned_to: formData.assigned_to || null,
        });
      } else {
        const taskSystemId = systemId || (isInvestigation && selectedSystemId ? selectedSystemId : null);
        await api.post('/tasks', {
          case_id: caseId,
          title: formData.title,
          description: formData.description,
          assigned_to: formData.assigned_to || null,
          created_by: user.id,
          system_id: taskSystemId,
          malware_id: malwareId || (isMalwareAnalysis && selectedMalwareId ? selectedMalwareId : null),
          is_osint: isOsint,
          initial_investigation_status: taskSystemId && initialInvestigationStatus ? initialInvestigationStatus : null,
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const INITIAL_STATUSES = [
    { value: 'unknown', label: 'Inconnu', description: 'Statut du systeme non encore determine', icon: ShieldQuestion, color: 'text-slate-500 dark:text-slate-400', border: 'border-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/60' },
    { value: 'clean', label: 'Sain', description: 'Le systeme semble sain avant investigation', icon: ShieldCheck, color: 'text-green-700 dark:text-green-400', border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { value: 'compromised', label: 'Compromis / Accede', description: 'Suspicion de compromission', icon: ShieldAlert, color: 'text-amber-700 dark:text-amber-400', border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { value: 'infected', label: 'Infecte', description: 'Le systeme semble infecte', icon: ShieldX, color: 'text-red-700 dark:text-red-400', border: 'border-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  ] as const;

  const checkboxIcon = (
    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full p-4 sm:p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto border border-transparent dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {task ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {systemName && (
            <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg px-4 py-3">
              <Server className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <p className="text-sm text-teal-700 dark:text-teal-300">
                {t('auto.tache_d_investigation_liee_au_')}<strong>{systemName}</strong>
              </p>
            </div>
          )}

          {malwareName && !systemName && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <Bug className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">
                {t('auto.tache_d_analyse_liee_au_malwar')}<strong>{malwareName}</strong>
              </p>
            </div>
          )}

          {showSystemPicker && (
            <div className="space-y-2">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleToggleInvestigation(!isInvestigation)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition text-left ${isInvestigation
                      ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700'
                      : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700'
                    }`}
                >
                  <Search className={`w-4 h-4 flex-shrink-0 ${isInvestigation ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-slate-400'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isInvestigation ? 'text-teal-700 dark:text-teal-300' : 'text-gray-600 dark:text-slate-400'}`}>
                      {t('auto.tache_d_investigation_de_syste')}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                      {t('auto.lier_cette_tache_a_un_systeme_')}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${isInvestigation ? 'bg-teal-600 border-teal-600' : 'border-gray-300 dark:border-slate-600'
                    }`}>
                    {isInvestigation && checkboxIcon}
                  </div>
                </button>

                {isInvestigation && !showNewSystemForm && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.systeme_a_investiguer')}<span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedSystemId}
                        onChange={(e) => handleSystemSelect(e.target.value)}
                        required
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">{t('auto.selectionner_un_systeme')}</option>
                        {systems.map((sys) => (
                          <option key={sys.id} value={sys.id}>{sys.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setShowNewSystemForm(true); setSelectedSystemId(''); }}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('auto.nouveau')}</button>
                    </div>
                  </div>
                )}

                {isInvestigation && showNewSystemForm && (
                  <InlineSystemForm
                    caseId={caseId}
                    onCreated={handleSystemCreated}
                    onCancel={() => setShowNewSystemForm(false)}
                  />
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleToggleMalwareAnalysis(!isMalwareAnalysis)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition text-left ${isMalwareAnalysis
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-700'
                    }`}
                >
                  <Bug className={`w-4 h-4 flex-shrink-0 ${isMalwareAnalysis ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isMalwareAnalysis ? 'text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-slate-400'}`}>
                      {t('auto.analyse_de_malware_outil')}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                      {t('auto.lier_cette_tache_a_un_malware_')}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${isMalwareAnalysis ? 'bg-red-600 border-red-600' : 'border-gray-300 dark:border-slate-600'
                    }`}>
                    {isMalwareAnalysis && checkboxIcon}
                  </div>
                </button>

                {isMalwareAnalysis && !showNewMalwareForm && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      {t('auto.malware_outil_a_analyser')}<span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedMalwareId}
                        onChange={(e) => handleMalwareSelect(e.target.value)}
                        required
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                      >
                        <option value="">{t('auto.selectionner_un_malware_outil')}</option>
                        {malwareEntries.map((mal) => (
                          <option key={mal.id} value={mal.id}>
                            {mal.file_name} {mal.is_malicious ? '(malveillant)' : '(non malveillant)'}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setShowNewMalwareForm(true); setSelectedMalwareId(''); }}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('auto.nouveau')}</button>
                    </div>
                  </div>
                )}

                {isMalwareAnalysis && showNewMalwareForm && (
                  <InlineMalwareForm
                    caseId={caseId}
                    onCreated={handleMalwareCreated}
                    onCancel={() => setShowNewMalwareForm(false)}
                  />
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleToggleOsint(!isOsint)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition text-left ${isOsint
                      ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700'
                      : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700'
                    }`}
                >
                  <Radar className={`w-4 h-4 flex-shrink-0 ${isOsint ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-slate-400'}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isOsint ? 'text-sky-700 dark:text-sky-300' : 'text-gray-600 dark:text-slate-400'}`}>
                      {t('auto.tache_osint')}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                      {t('auto.recherche_en_sources_ouvertes_')}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${isOsint ? 'bg-sky-600 border-sky-600' : 'border-gray-300 dark:border-slate-600'
                    }`}>
                    {isOsint && checkboxIcon}
                  </div>
                </button>
              </div>
            </div>
          )}

          {isSystemInvestigationTask && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t('auto.statut_initial_du_systeme')}<span className="ml-1 text-xs font-normal text-gray-500 dark:text-slate-400">{t('auto.optionnel_etat_connu_avant_inv')}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {INITIAL_STATUSES.map((s) => {
                  const Icon = s.icon;
                  const selected = initialInvestigationStatus === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setInitialInvestigationStatus(selected ? '' : s.value)}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border-2 transition text-left ${selected ? `${s.border} ${s.bg}` : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                        }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selected ? s.color : 'text-gray-500 dark:text-slate-400'}`} />
                      <div>
                        <p className={`text-xs font-semibold ${selected ? s.color : 'text-gray-700 dark:text-slate-300'}`}>{s.label}</p>
                        <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">{s.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.titre')}</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              placeholder={t('auto.ex_analyser_les_logs_syst_me')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.description')}</label>
            <RichTextEditor
              value={formData.description}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder={t('auto.d_tails_de_la_t_che')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {t('auto.assigner')}</label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t('auto.non_assign')}</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} ({member.email})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition dark:text-slate-300"
            >
              {t('auto.annuler')}</button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : task ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
