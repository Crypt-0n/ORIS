import React from 'react';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Trash2, Shield, Server, User, Bug, Globe, AlertTriangle, Plus, Pencil, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StixDynamicForm } from './StixDynamicForm';

interface StixObject {
  type: string;
  id: string;
  name?: string;
  value?: string;
  display_name?: string;
  user_id?: string;
  description?: string;
  x_oris_task_id?: string;
  [key: string]: any;
}

interface StixObjectsListProps {
  caseId: string;
  taskId?: string;
  isClosed: boolean;
  onAdd?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Server; color: string; bgColor: string; borderColor: string }> = {
  'infrastructure': { label: 'Système', icon: Server, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/20', borderColor: 'border-teal-200 dark:border-teal-800' },
  'malware': { label: 'Malware', icon: Bug, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800' },
  'user-account': { label: 'Compte', icon: User, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  'indicator': { label: 'Indicateur', icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-200 dark:border-orange-800' },
  'ipv4-addr': { label: 'IPv4', icon: Globe, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800' },
  'domain-name': { label: 'Domaine', icon: Globe, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', borderColor: 'border-indigo-200 dark:border-indigo-800' },
  'url': { label: 'URL', icon: Globe, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-900/20', borderColor: 'border-violet-200 dark:border-violet-800' },
  'file': { label: 'Fichier', icon: Shield, color: 'text-gray-600 dark:text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-900/20', borderColor: 'border-gray-200 dark:border-gray-800' },
};

// Types to display (skip observed-data and relationship)
const DISPLAY_TYPES = ['infrastructure', 'malware', 'user-account', 'indicator', 'ipv4-addr', 'domain-name', 'url', 'file'];

function getObjectLabel(obj: StixObject): string {
  return obj.name || obj.value || obj.display_name || obj.user_id || obj.id;
}

export function StixObjectsList({ taskId, caseId, isClosed, onAdd }: StixObjectsListProps) {
  const { t } = useTranslation();
  const [objects, setObjects] = useState<StixObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingObject, setEditingObject] = useState<StixObject | null>(null);
  const [isCreatingInternal, setIsCreatingInternal] = useState(false);

  useEffect(() => {
    fetchObjects();
  }, [taskId, caseId]);

  const fetchObjects = async () => {
    try {
      setLoading(true);
      let fetchedObjects: StixObject[] = [];
      if (taskId) {
        const data = await api.get(`/investigation/stix/by-task/${taskId}`);
        fetchedObjects = (data || []).filter((o: StixObject) => DISPLAY_TYPES.includes(o.type));
      } else {
        const bundle: any = await api.get(`/stix/bundle/${caseId}`);
        const allObjects = bundle?.objects || [];
        fetchedObjects = allObjects.filter((o: StixObject) => DISPLAY_TYPES.includes(o.type));
      }

      // Sort by type (custom order based on DISPLAY_TYPES to group identical types together)
      fetchedObjects.sort((a, b) => {
        const indexA = DISPLAY_TYPES.indexOf(a.type);
        const indexB = DISPLAY_TYPES.indexOf(b.type);
        if (indexA === indexB) {
          // If same type, sort alphabetically by label
          const labelA = getObjectLabel(a).toLowerCase();
          const labelB = getObjectLabel(b).toLowerCase();
          return labelA.localeCompare(labelB);
        }
        return indexA - indexB;
      });

      setObjects(fetchedObjects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('auto.etes_vous_sur', 'Êtes-vous sûr ?'))) return;
    setDeleting(id);
    try {
      await api.delete(`/investigation/stix/${id}`);
      setObjects(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      console.error(err);
    }
    setDeleting(null);
  };

  const handleLaunchAnalysis = async (obj: StixObject) => {
    try {
      setLoading(true);
      const label = getObjectLabel(obj);
      const titleType = obj.type === 'infrastructure' ? 'Système' 
                      : obj.type === 'ipv4-addr' ? 'IP' 
                      : obj.type === 'domain-name' ? 'Domaine' 
                      : obj.type === 'url' ? 'URL' 
                      : obj.type === 'user-account' ? 'Compte' 
                      : obj.type === 'malware' ? 'Malware' : obj.type;
      
      const title = `Analyse de ${titleType} : ${label}`;
      const res = await api.post('/tasks', {
        case_id: caseId,
        title,
        description: `Tâche d'investigation générée automatiquement pour l'objet STIX: ${obj.id}`,
        is_osint: false
      });
      
      if (res && res.id) {
        // Link object to task
        await api.put(`/stix/objects/${obj.id}`, { x_oris_task_id: res.id });
        // Redirect
        window.location.hash = `#/cases/${caseId}?task=${res.id}`;
      }
    } catch (err) {
      console.error("Erreur lors du lancement de l'analyse", err);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="py-4 text-center text-sm text-gray-500 dark:text-slate-400">{t('auto.chargement')}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            {t('auto.elements_techniques', 'Éléments techniques (STIX)')}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            {objects.length}
          </span>
        </div>
        {(!isClosed && !!taskId) && (
          <button
            onClick={onAdd || (() => setIsCreatingInternal(true))}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('auto.ajouter_element', 'Ajouter')}
          </button>
        )}
      </div>

      {objects.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-slate-400">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('auto.aucun_element_technique', 'Aucun élément technique')}</p>
          {(!isClosed && !!taskId) && (
            <button
              onClick={onAdd || (() => setIsCreatingInternal(true))}
              className="mt-3 text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              + {t('auto.ajouter_premier_element', 'Ajouter un premier élément')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {objects.map(obj => {
            const config = TYPE_CONFIG[obj.type] || TYPE_CONFIG['file'];
            const Icon = config.icon;
            return (
              <div
                key={obj.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${config.borderColor} ${config.bgColor} transition hover:shadow-sm`}
              >
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {getObjectLabel(obj)}
                  </p>
                  {obj.description && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                      {obj.description}
                    </p>
                  )}
                </div>
                {!isClosed && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingObject(obj)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                      title={t('auto.modifier', 'Modifier')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!taskId && !obj.x_oris_task_id && (
                      <button
                        onClick={() => handleLaunchAnalysis(obj)}
                        className="p-1.5 text-blue-600 hover:text-white dark:text-blue-400 dark:hover:text-white transition rounded-lg hover:bg-blue-600 border border-blue-200 dark:border-blue-800 ml-1 flex items-center gap-1"
                        title={t('auto.creer_tache', "Créer une tâche d'analyse pour cet élément")}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">{t('auto.analyser', 'Analyser')}</span>
                      </button>
                    )}
                    {!taskId && obj.x_oris_task_id && (
                      <a
                        href={`/cases/${caseId}?section=tasks&task=${obj.x_oris_task_id}`}
                        className="p-1.5 text-emerald-600 hover:text-white dark:text-emerald-400 dark:hover:text-white transition rounded-lg hover:bg-emerald-600 border border-emerald-200 dark:border-emerald-800 ml-1 flex items-center gap-1"
                        title={t('auto.voir_tache', "Voir l'investigation associée")}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider">{t('auto.voir_tache', 'Voir la tâche')}</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(obj.id)}
                      disabled={deleting === obj.id}
                      className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      title={t('auto.supprimer')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingObject && (
        <StixDynamicForm
          caseId={caseId}
          taskId={taskId}
          initialData={editingObject}
          onClose={() => setEditingObject(null)}
          onCreated={() => {
            setEditingObject(null);
            fetchObjects();
          }}
        />
      )}

      {isCreatingInternal && (
        <StixDynamicForm
          caseId={caseId}
          taskId={taskId}
          onClose={() => setIsCreatingInternal(false)}
          onCreated={() => {
            setIsCreatingInternal(false);
            fetchObjects();
          }}
        />
      )}
    </div>
  );
}
