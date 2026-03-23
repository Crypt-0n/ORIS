import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Trash2, Shield, Server, User, Bug, Globe, AlertTriangle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  taskId: string;
  caseId: string;
  isClosed: boolean;
  onAdd: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Server; color: string; bgColor: string; borderColor: string }> = {
  'infrastructure': { label: 'Système', icon: Server, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/20', borderColor: 'border-teal-200 dark:border-teal-800' },
  'malware': { label: 'Malware', icon: Bug, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800' },
  'user-account': { label: 'Compte', icon: User, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  'indicator': { label: 'Indicateur', icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-200 dark:border-orange-800' },
  'ipv4-addr': { label: 'IPv4', icon: Globe, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-800' },
  'domain-name': { label: 'Domaine', icon: Globe, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-50 dark:bg-indigo-900/20', borderColor: 'border-indigo-200 dark:border-indigo-800' },
  'url': { label: 'URL', icon: Globe, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-50 dark:bg-violet-900/20', borderColor: 'border-violet-200 dark:border-violet-800' },
  'file': { label: 'Fichier', icon: Shield, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-900/20', borderColor: 'border-gray-200 dark:border-gray-800' },
};

// Types to display (skip observed-data and relationship)
const DISPLAY_TYPES = ['infrastructure', 'malware', 'user-account', 'indicator', 'ipv4-addr', 'domain-name', 'url', 'file'];

function getObjectLabel(obj: StixObject): string {
  return obj.name || obj.value || obj.display_name || obj.user_id || obj.id;
}

export function StixObjectsList({ taskId, caseId: _caseId, isClosed, onAdd }: StixObjectsListProps) {
  const { t } = useTranslation();
  const [objects, setObjects] = useState<StixObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchObjects();
  }, [taskId]);

  const fetchObjects = async () => {
    try {
      const data = await api.get(`/investigation/stix/by-task/${taskId}`);
      setObjects((data || []).filter((o: StixObject) => DISPLAY_TYPES.includes(o.type)));
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
        {!isClosed && (
          <button
            onClick={onAdd}
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
          {!isClosed && (
            <button
              onClick={onAdd}
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
                  <button
                    onClick={() => handleDelete(obj.id)}
                    disabled={deleting === obj.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex-shrink-0"
                    title={t('auto.supprimer')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
