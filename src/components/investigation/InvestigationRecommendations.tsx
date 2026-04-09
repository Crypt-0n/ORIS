import React from 'react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { AlertTriangle, Server, Bug, ArrowRight } from 'lucide-react';

interface StixObject {
  id: string;
  type: string;
  name?: string;
  value?: string;
  user_id?: string;
  x_oris_diamond_axes?: any;
  x_oris_task_id?: string;
  labels?: string[];
}

interface InvestigationRecommendationsProps {
  caseId: string;
  onNavigateToStixWorkspace?: () => void;
}

export function InvestigationRecommendations({ caseId, onNavigateToStixWorkspace }: InvestigationRecommendationsProps) {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<StixObject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [caseId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const bundle = await api.get(`/stix/bundle/${caseId}`);
      if (!bundle || !bundle.objects) return;

      const objects: StixObject[] = bundle.objects;

      const excludedTypes = [
        'report', 'observed-data', 'relationship', 'grouping', 'note', 'opinion', 
        'identity', 'course-of-action', 'attack-pattern', 'threat-actor', 'campaign', 'intrusion-set',
        'indicator'
      ];

      const uninvestigated = objects.filter(obj => {
         // Only look at specific types (exclude SDOs and enrichments)
         if (excludedTypes.includes(obj.type)) return false;
         
         // If the object already has a task attached (open or closed), hide it from recommendations
         if (obj.x_oris_task_id) return false;

         return true;
      });

      setRecommendations(uninvestigated);
    } catch (err) {
      console.error('Failed to fetch STIX for recommendations', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (recommendations.length === 0) {
    return null;
  }

  const total = recommendations.length;

  const handleLaunchAnalysis = async (obj: StixObject) => {
    try {
      const label = obj.name || obj.value || obj.user_id || 'Inconnu';
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
        // Link object to task using standard STIX object upsert
        const updatedObj = { ...obj, x_oris_task_id: res.id, modified: new Date().toISOString() };
        await api.post(`/stix/objects`, { case_id: caseId, ...updatedObj });
        // Redirect
        window.location.href = `/cases/${caseId}?section=tasks&task=${res.id}`;
      }
    } catch (err) {
      console.error("Erreur lors du lancement de l'analyse", err);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-amber-100 dark:border-amber-900/30">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-500 font-medium">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {t('auto.investigation_recommandee')}
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
          {t('auto.recommendations_subtitle', { count: total, defaultValue: `${total} élément(s) nécessite(nt) une investigation` })}
        </p>
      </div>
      
      <div className="divide-y divide-amber-100/50 dark:divide-amber-900/30">
        <div className="p-4">
          <div className="space-y-4">
            {recommendations.map(obj => {
              const Icon = obj.type === 'infrastructure' ? Server : obj.type === 'malware' ? Bug : AlertTriangle;
              const label = obj.name || obj.value || obj.user_id || 'Inconnu';
              
              return (
                <div key={obj.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-amber-100 dark:border-amber-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-700 dark:text-amber-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">{obj.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLaunchAnalysis(obj)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    Lancer l'analyse <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 mt-2 flex flex-wrap gap-4 border-t border-amber-100/50 dark:border-amber-900/30 pt-3">
        {onNavigateToStixWorkspace && (
          <button
            onClick={onNavigateToStixWorkspace}
            className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition font-medium"
          >
            Voir tous les éléments techniques <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
