import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { OffCanvas } from './common/OffCanvas';
import { RichTextEditor } from './RichTextEditor';
import { useTranslation } from "react-i18next";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

interface TaskModalProps {
  caseId: string;
  task?: {
    id: string;
    title: string;
    description: string;
    assigned_to: string | null;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskModal({ caseId, task, onClose, onSuccess }: TaskModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assigned_to: task?.assigned_to || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [taskType, setTaskType] = useState<'standard' | 'investigation'>('standard');
  const [stixElements, setStixElements] = useState<any[]>([]);
  const [selectedStixId, setSelectedStixId] = useState('');
  const [newStixType, setNewStixType] = useState('ipv4-addr');
  const [newStixValue, setNewStixValue] = useState('');
  const [stixSearch, setStixSearch] = useState('');

  useEffect(() => {
    fetchTeamMembers();
    if (!task) {
      fetchStixElements();
    }
  }, []);

  const fetchStixElements = async () => {
    try {
      const bundle = await api.get(`/stix/bundle/${caseId}`);
      if (bundle && bundle.objects) {
        const excludedTypes = ['report', 'observed-data', 'relationship', 'grouping', 'note', 'opinion', 'identity', 'course-of-action', 'attack-pattern', 'threat-actor', 'campaign', 'intrusion-set'];
        const investigable = bundle.objects.filter((obj: any) => !excludedTypes.includes(obj.type));
        setStixElements(investigable);
      }
    } catch (err) {
      console.error('Erreur fetchStixElements:', err);
    }
  };

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
  const handleStixSelection = (id: string) => {
    setSelectedStixId(id);
    if (id === 'NEW') {
      const titleType = newStixType === 'infrastructure' ? 'Système' : newStixType === 'ipv4-addr' ? 'IP' : newStixType === 'domain-name' ? 'Domaine' : newStixType === 'url' ? 'URL' : newStixType === 'user-account' ? 'Compte' : 'Malware';
      setFormData(prev => ({ ...prev, title: `Analyse de ${titleType} : ${newStixValue || 'Nouveau'}` }));
      return;
    }

    const obj = stixElements.find(o => o.id === id);
    if (obj) {
      const label = obj.name || obj.value || obj.user_id || 'Inconnu';
      const titleType = obj.type === 'infrastructure' ? 'Système' 
                      : obj.type === 'ipv4-addr' ? 'IP' 
                      : obj.type === 'domain-name' ? 'Domaine' 
                      : obj.type === 'url' ? 'URL' 
                      : obj.type === 'user-account' ? 'Compte' 
                      : obj.type === 'malware' ? 'Malware' : obj.type;
      
      const title = `Analyse de ${titleType} : ${label}`;
      setFormData(prev => ({ ...prev, title }));
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
        const res = await api.post('/tasks', {
          case_id: caseId,
          title: formData.title,
          description: formData.description,
          assigned_to: formData.assigned_to || null,
          created_by: user.id,
          is_osint: false,
        });

        if (res && res.id && taskType === 'investigation' && selectedStixId) {
          if (selectedStixId === 'NEW') {
            const data: any = {};
            if (['infrastructure', 'malware'].includes(newStixType)) {
               data.name = newStixValue;
            } else if (newStixType === 'user-account') {
               data.account_name = newStixValue;
               data.display_name = newStixValue;
            } else {
               data.value = newStixValue;
            }
            if (newStixType === 'infrastructure') data.infrastructure_types = ['unknown'];
            
            await api.post('/investigation/stix', {
              case_id: caseId,
              task_id: res.id,
              stix_type: newStixType,
              data
            });
          } else {
            const existingObj = stixElements.find(o => o.id === selectedStixId);
            if (existingObj) {
              const updatedObj = { ...existingObj, x_oris_task_id: res.id, modified: new Date().toISOString() };
              await api.post('/stix/objects', { case_id: caseId, ...updatedObj });
            }
          }
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OffCanvas 
      isOpen={true} 
      onClose={onClose} 
      title={task ? 'Modifier la tâche' : 'Nouvelle tâche'}
      width="md"
    >
      <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          {!task && (
            <div className="space-y-4">
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800/80 mb-3 rounded-lg border border-gray-200 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => setTaskType('standard')}
                  className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition ${taskType === 'standard' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  Tâche standard
                </button>
                <button
                  type="button"
                  onClick={() => setTaskType('investigation')}
                  className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition ${taskType === 'investigation' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                  Investigation élément STIX
                </button>
              </div>

              {taskType === 'investigation' && (
                <div className="mb-3 space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Élément technique STIX à investiguer
                    </label>
                    
                    <div className="relative mb-2">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Rechercher par type, nom, IP, hachage..."
                        value={stixSearch}
                        onChange={(e) => setStixSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <select
                      required={taskType === 'investigation'}
                      value={selectedStixId}
                      onChange={(e) => handleStixSelection(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700/50 bg-blue-50/50 dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                    >
                      <option value="" disabled className="dark:bg-slate-800">Sélectionner un élément...</option>
                      <option value="NEW" className="font-bold text-blue-600 dark:text-blue-400 dark:bg-slate-800">
                        ✨ Créer un nouvel élément STIX
                      </option>
                      {stixElements.length > 0 && (
                        <optgroup label="Éléments existants" className="dark:bg-slate-800">
                          {stixElements.filter(obj => {
                            if (!stixSearch) return true;
                            const searchStr = `${obj.type} ${obj.name || ''} ${obj.value || ''} ${obj.user_id || ''} ${obj.id}`.toLowerCase();
                            return searchStr.includes(stixSearch.toLowerCase());
                          }).map(obj => (
                            <option key={obj.id} value={obj.id} className="dark:bg-slate-800 text-gray-900 dark:text-white">
                              [{obj.type.toUpperCase()}] {obj.name || obj.value || obj.user_id || obj.id}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {selectedStixId === 'NEW' && (
                    <div className="grid grid-cols-3 gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg shadow-inner">
                       <div className="col-span-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-400 mb-1">Type d'élément</label>
                          <select 
                            value={newStixType} 
                            onChange={(e) => {
                                setNewStixType(e.target.value);
                                const titleType = e.target.value === 'infrastructure' ? 'Système' : e.target.value === 'ipv4-addr' ? 'IP' : e.target.value === 'domain-name' ? 'Domaine' : e.target.value === 'url' ? 'URL' : e.target.value === 'user-account' ? 'Compte' : 'Malware';
                                setFormData(prev => ({ ...prev, title: `Analyse de ${titleType} : ${newStixValue || 'Nouveau'}` }));
                            }}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white"
                          >
                             <option value="ipv4-addr" className="dark:bg-slate-800">Adresse IP</option>
                             <option value="domain-name" className="dark:bg-slate-800">Nom de domaine</option>
                             <option value="url" className="dark:bg-slate-800">URL</option>
                             <option value="infrastructure" className="dark:bg-slate-800">Système/Machine</option>
                             <option value="malware" className="dark:bg-slate-800">Malware</option>
                             <option value="user-account" className="dark:bg-slate-800">Compte Utils.</option>
                          </select>
                       </div>
                       <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-400 mb-1">
                             {['infrastructure', 'malware'].includes(newStixType) ? 'Nom' : newStixType === 'user-account' ? "Nom d'utilisateur" : 'Valeur technique'}
                          </label>
                          <input 
                             type="text" 
                             required={selectedStixId === 'NEW'}
                             value={newStixValue}
                             onChange={(e) => {
                                 setNewStixValue(e.target.value);
                                 const titleType = newStixType === 'infrastructure' ? 'Système' : newStixType === 'ipv4-addr' ? 'IP' : newStixType === 'domain-name' ? 'Domaine' : newStixType === 'url' ? 'URL' : newStixType === 'user-account' ? 'Compte' : 'Malware';
                                 setFormData(prev => ({ ...prev, title: `Analyse de ${titleType} : ${e.target.value || 'Nouveau'}` }));
                             }}
                             placeholder={['infrastructure', 'malware'].includes(newStixType) ? 'Ex: Serveur WEB 01' : newStixType === 'user-account' ? "j.doe" : '8.8.8.8'}
                             className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white"
                          />
                       </div>
                    </div>
                  )}
                </div>
              )}
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
              className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Enregistrement...' : task ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </OffCanvas>
  );
}
