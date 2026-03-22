import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  AlertTriangle,
  TrendingUp,
  Monitor,
  Server,
  Smartphone,
  Tablet,
  Tv,
  Router,
  Cpu,
  HelpCircle,
  Skull,
  Bug,
  KeyRound,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from "react-i18next";

interface RecommendationSystem {
  id: string;
  name: string;
  system_type: string;
  hasMalware: boolean;
  hasCompromisedAccounts: boolean;
  hasTimelineEvents: boolean;
  malwareCount: number;
  accountCount: number;
  eventCount: number;
}

interface RecommendationMalware {
  id: string;
  file_name: string;
  file_path: string | null;
  system_name: string | null;
  eventCount: number;
  is_malicious: boolean | null;
}

interface InvestigationRecommendationsProps {
  caseId: string;
  onNavigateToSystems?: () => void;
  onNavigateToMalware?: () => void;
}

const SYSTEM_TYPE_ICONS: Record<string, typeof Monitor> = {
  ordinateur: Monitor,
  serveur: Server,
  telephone: Smartphone,
  tablette: Tablet,
  tv: Tv,
  equipement_reseau: Router,
  equipement_iot: Cpu,
  autre: HelpCircle,
  infrastructure_attaquant: Skull,
};

function getSystemIcon(type: string) {
  return SYSTEM_TYPE_ICONS[type] || HelpCircle;
}

export function InvestigationRecommendations({ caseId, onNavigateToSystems, onNavigateToMalware }: InvestigationRecommendationsProps) {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<RecommendationSystem[]>([]);
  const [malwareRecommendations, setMalwareRecommendations] = useState<RecommendationMalware[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [caseId]);

  const fetchRecommendations = async () => {
    try {
      const [systems, tasksData, allMalware, allAccounts, overridesData] = await Promise.all([
        api.get(`/investigation/systems/by-case/${caseId}`),
        api.get(`/tasks/by-case/${caseId}`),
        api.get(`/investigation/malware/by-case/${caseId}`),
        api.get(`/investigation/accounts/by-case/${caseId}`),
        api.get(`/investigation/diamond-overrides/by-case/${caseId}`),
      ]);

      // --- System recommendations ---
      const systemsWithTask = new Set<string>();
      (tasksData || []).forEach((t: any) => {
        if (t.system_id) systemsWithTask.add(t.system_id);
      });

      if (systems && systems.length > 0) {
        const unknownSystems = systems.filter((s: any) => !systemsWithTask.has(s.id));

        if (unknownSystems.length > 0) {
          const unknownIds = unknownSystems.map((s: any) => s.id);

          const malwareData = (allMalware || []).filter((m: any) => m.is_malicious && unknownIds.includes(m.system_id));
          const malwareSystems = new Set<string>();
          const malwareCountMap = new Map<string, number>();
          malwareData.forEach((m: any) => {
            malwareSystems.add(m.system_id);
            malwareCountMap.set(m.system_id, (malwareCountMap.get(m.system_id) || 0) + 1);
          });

          const accountsData = (allAccounts || []).filter((acc: any) => unknownIds.includes(acc.system_id));
          const accountSystems = new Set<string>();
          const accountCountMap = new Map<string, number>();
          accountsData.forEach((acc: any) => {
            accountSystems.add(acc.system_id);
            accountCountMap.set(acc.system_id, (accountCountMap.get(acc.system_id) || 0) + 1);
          });

          const eventSystems = new Set<string>();
          const eventCountMap = new Map<string, number>();
          (overridesData || []).forEach((ov: any) => {
            let sids: string[] = [];
            try {
              const infra = JSON.parse(ov.infrastructure || '[]');
              if (infra[0]?.type === 'system' || infra[0]?.type === 'attacker_infra') sids.push(infra[0].id);
              const vic = JSON.parse(ov.victim || '[]');
              if (vic[0]?.type === 'system') sids.push(vic[0].id);
            } catch (e) { }

            sids.forEach((sid: string) => {
              if (sid && unknownIds.includes(sid)) {
                eventSystems.add(sid);
                eventCountMap.set(sid, (eventCountMap.get(sid) || 0) + 1);
              }
            });
          });

          const results: RecommendationSystem[] = unknownSystems
            .filter((s: any) => malwareSystems.has(s.id) || accountSystems.has(s.id) || eventSystems.has(s.id))
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              system_type: s.system_type,
              hasMalware: malwareSystems.has(s.id),
              hasCompromisedAccounts: accountSystems.has(s.id),
              hasTimelineEvents: eventSystems.has(s.id),
              malwareCount: malwareCountMap.get(s.id) || 0,
              accountCount: accountCountMap.get(s.id) || 0,
              eventCount: eventCountMap.get(s.id) || 0,
            }));

          setRecommendations(results);
        }
      }

      // --- Malware recommendations: malware referenced in events but without a dedicated analysis task ---
      const allMalwareEntries = allMalware || [];
      if (allMalwareEntries.length > 0) {
        // Find malware that already have a dedicated analysis task (any status)
        const malwareWithTask = new Set<string>();
        (tasksData || []).forEach((t: any) => {
          if (t.malware_id) malwareWithTask.add(t.malware_id);
        });

        // Build a system name map for display
        const systemNameMap = new Map<string, string>();
        (systems || []).forEach((s: any) => systemNameMap.set(s.id, s.name));

        // Count events referencing each malware (via linked objects / diamond overrides capability axis)
        const malwareEventCount = new Map<string, number>();
        (overridesData || []).forEach((ov: any) => {
          try {
            const cap = JSON.parse(ov.capability || '[]');
            cap.forEach((c: any) => {
              if (c.type === 'malware' && c.id) {
                malwareEventCount.set(c.id, (malwareEventCount.get(c.id) || 0) + 1);
              }
            });
          } catch (e) { }
        });

        // Show recommendations for malware that are used in events but have no task
        const malwareResults: RecommendationMalware[] = allMalwareEntries
          .filter((m: any) => !malwareWithTask.has(m.id))
          .map((m: any) => ({
            id: m.id,
            file_name: m.file_name,
            file_path: m.file_path || null,
            system_name: m.system_id ? systemNameMap.get(m.system_id) || null : null,
            eventCount: malwareEventCount.get(m.id) || 0,
            is_malicious: m.is_malicious,
          }));

        setMalwareRecommendations(malwareResults);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const totalCount = recommendations.length + malwareRecommendations.length;
  if (loading || totalCount === 0) return null;

  const subtitleParts: string[] = [];
  if (recommendations.length > 0) subtitleParts.push(t('auto.recommendations_systems_count', { count: recommendations.length }));
  if (malwareRecommendations.length > 0) subtitleParts.push(t('auto.recommendations_malware_count', { count: malwareRecommendations.length }));
  const subtitle = subtitleParts.join(` ${t('auto.et')} `);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 border border-transparent dark:border-slate-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">{t('auto.axes_de_progression')}</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {subtitle}</p>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {recommendations.map(rec => {
          const Icon = getSystemIcon(rec.system_type);
          return (
            <div
              key={rec.id}
              className="flex items-start gap-3 px-4 py-3 bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{rec.name}</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {(() => {
                    const parts: string[] = [];
                    if (rec.hasTimelineEvents) parts.push(t('auto.recommendations_events', { count: rec.eventCount }));
                    if (rec.hasMalware) parts.push(t('auto.recommendations_malware', { count: rec.malwareCount }));
                    if (rec.hasCompromisedAccounts) parts.push(t('auto.recommendations_accounts', { count: rec.accountCount }));
                    return parts.join(` ${t('auto.et')} `);
                  })()}
                  {' — '}{t('auto.statut_investigation_inconnu')}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                {rec.hasTimelineEvents && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-800" title={t('auto.recommendations_events', { count: rec.eventCount })}>
                    <Activity className="w-3 h-3" />
                    {rec.eventCount}
                  </span>
                )}
                {rec.hasMalware && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" title={t('auto.recommendations_malware', { count: rec.malwareCount })}>
                    <Bug className="w-3 h-3" />
                    {rec.malwareCount}
                  </span>
                )}
                {rec.hasCompromisedAccounts && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800" title={t('auto.recommendations_accounts', { count: rec.accountCount })}>
                    <KeyRound className="w-3 h-3" />
                    {rec.accountCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {malwareRecommendations.map(rec => (
          <div
            key={`malware-${rec.id}`}
            className="flex items-start gap-3 px-4 py-3 bg-amber-50/70 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg"
          >
            <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Bug className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{rec.file_name}</span>
                {rec.is_malicious === true ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex-shrink-0">
                    {t('auto.malveillant')}
                  </span>
                ) : rec.is_malicious === false ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 flex-shrink-0">
                    {t('auto.non_malveillant')}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                    {t('auto.inconnu', 'Inconnu')}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                {t('auto.malware_analyse_recommandee', { defaultValue: 'Aucune tâche d\'analyse dédiée' })}
                {rec.system_name && ` — ${t('auto.sur_systeme', { system: rec.system_name, defaultValue: `sur ${rec.system_name}` })}`}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {rec.eventCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-800" title={t('auto.recommendations_events', { count: rec.eventCount })}>
                  <Activity className="w-3 h-3" />
                  {rec.eventCount}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 flex flex-wrap gap-4">
        {onNavigateToSystems && recommendations.length > 0 && (
          <button
            onClick={onNavigateToSystems}
            className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition font-medium"
          >
            {t('auto.voir_les_systemes')}<ArrowRight className="w-4 h-4" />
          </button>
        )}
        {onNavigateToMalware && malwareRecommendations.length > 0 && (
          <button
            onClick={onNavigateToMalware}
            className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition font-medium"
          >
            {t('auto.voir_les_malwares', { defaultValue: 'Voir les malwares / outils' })}<ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
