/**
 * CaseOnboarding.tsx
 *
 * Onboarding guide displayed on the case summary when a case is new/empty.
 * Directs users through a clear workflow: Tasks → Investigation → Analysis → Report.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ListTodo,
  Search,
  Diamond,
  BarChart3,
  FileText,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { CaseSection } from '../CaseSidebar';

interface CaseOnboardingProps {
  caseId: string;
  onNavigate: (section: CaseSection) => void;
}

interface OnboardingStep {
  id: string;
  icon: typeof ListTodo;
  title: string;
  description: string;
  section: CaseSection;
  actionLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  darkBgColor: string;
  darkBorderColor: string;
}

export function CaseOnboarding({ caseId, onNavigate }: CaseOnboardingProps) {
  const { t } = useTranslation();
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [objectCount, setObjectCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tasksRes, bundleRes, eventsRes] = await Promise.all([
          api.get(`/tasks/by-case/${caseId}`).catch(() => []),
          api.get(`/stix/bundle/${caseId}`).catch(() => ({ objects: [] })),
          api.get(`/investigation/timeline/${caseId}`).catch(() => []),
        ]);
        setTaskCount(Array.isArray(tasksRes) ? tasksRes.length : 0);
        
        const objects = bundleRes?.objects || [];
        // Count non-relationship, non-marking-definition objects roughly
        const investigationObjects = objects.filter((o: any) => o && o.type && o.type !== 'relationship' && !o.type.includes('marking'));
        setObjectCount(investigationObjects.length);
        
        setEventCount(Array.isArray(eventsRes) ? eventsRes.length : 0);
      } catch (err) {
        console.error('Failed to load onboarding stats:', err);
        setTaskCount(0);
        setObjectCount(0);
        setEventCount(0);
      }
      setLoading(false);
    })();
  }, [caseId]);

  if (loading) return null;

  // Don't show onboarding if case is already well-populated
  if (taskCount !== null && taskCount >= 3 && objectCount !== null && objectCount >= 5) {
    return null;
  }

  const steps: OnboardingStep[] = [
    {
      id: 'tasks',
      icon: ListTodo,
      title: t('onboarding.step1Title', 'Créez vos tâches d\'investigation'),
      description: t('onboarding.step1Desc', 'Les tâches sont le point d\'entrée central. Chaque analyse de système, recherche de malware ou vérification IOC commence par une tâche.'),
      section: 'tasks',
      actionLabel: t('onboarding.step1Action', 'Créer une tâche'),
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      darkBgColor: 'dark:bg-blue-950/30',
      darkBorderColor: 'dark:border-blue-800',
    },
    {
      id: 'objects',
      icon: Search,
      title: t('onboarding.step2Title', 'Documentez vos découvertes'),
      description: t('onboarding.step2Desc', 'Depuis chaque tâche, enregistrez les systèmes compromis, malwares détectés, indicateurs de compromission et événements observés.'),
      section: 'stix_workspace',
      actionLabel: t('onboarding.step2Action', 'Voir les objets'),
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      darkBgColor: 'dark:bg-emerald-950/30',
      darkBorderColor: 'dark:border-emerald-800',
    },
    {
      id: 'analysis',
      icon: Diamond,
      title: t('onboarding.step3Title', 'Analysez avec le Modèle Diamond'),
      description: t('onboarding.step3Desc', 'Cartographiez les relations entre adversaires, infrastructures, capacités et victimes pour comprendre l\'attaque.'),
      section: 'diamond_model',
      actionLabel: t('onboarding.step3Action', 'Ouvrir le modèle'),
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      darkBgColor: 'dark:bg-purple-950/30',
      darkBorderColor: 'dark:border-purple-800',
    },
    {
      id: 'visualize',
      icon: BarChart3,
      title: t('onboarding.step4Title', 'Visualisez et analysez'),
      description: t('onboarding.step4Desc', 'Explorez la chronologie des événements, la propagation latérale et les patterns temporels de l\'attaquant.'),
      section: 'visualizations',
      actionLabel: t('onboarding.step4Action', 'Explorer'),
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      darkBgColor: 'dark:bg-amber-950/30',
      darkBorderColor: 'dark:border-amber-800',
    },
    {
      id: 'report',
      icon: FileText,
      title: t('onboarding.step5Title', 'Générez votre rapport'),
      description: t('onboarding.step5Desc', 'Compilez automatiquement vos découvertes en un rapport d\'incident structuré et exportable.'),
      section: 'reports',
      actionLabel: t('onboarding.step5Action', 'Voir les rapports'),
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      darkBgColor: 'dark:bg-rose-950/30',
      darkBorderColor: 'dark:border-rose-800',
    },
  ];

  // Determine completion state
  const getStepState = (step: OnboardingStep) => {
    switch (step.id) {
      case 'tasks': return (taskCount ?? 0) > 0 ? 'done' : 'active';
      case 'objects': return (objectCount ?? 0) > 0 ? 'done' : (taskCount ?? 0) > 0 ? 'active' : 'pending';
      case 'analysis': return (objectCount ?? 0) >= 3 ? 'active' : (objectCount ?? 0) > 0 ? 'active' : 'pending';
      case 'visualize': return (eventCount ?? 0) > 0 ? 'done' : 'pending';
      case 'report': return 'pending';
      default: return 'pending';
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gradient-to-br from-gray-50 to-white dark:from-slate-800/50 dark:to-slate-900 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {t('onboarding.title', 'Guide de démarrage')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t('onboarding.subtitle', 'Suivez ces étapes pour mener votre investigation')}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const state = getStepState(step);
          const Icon = step.icon;
          const isDone = state === 'done';
          const isActive = state === 'active';

          return (
            <div key={step.id} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className={`absolute left-5 top-[44px] w-px h-[calc(100%-8px)] ${
                  isDone ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-200 dark:bg-slate-700'
                }`} />
              )}

              <button
                onClick={() => onNavigate(step.section)}
                className={`relative w-full text-left flex items-start gap-3 p-3 rounded-lg transition-all group ${
                  isActive
                    ? `${step.bgColor} ${step.darkBgColor} border ${step.borderColor} ${step.darkBorderColor} shadow-sm`
                    : isDone
                      ? 'bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                {/* Step indicator */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                  isDone
                    ? 'bg-green-100 dark:bg-green-900/40'
                    : isActive
                      ? `${step.bgColor} ${step.darkBgColor}`
                      : 'bg-gray-100 dark:bg-slate-800'
                }`}>
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className={`w-5 h-5 ${isActive ? step.color : 'text-gray-500 dark:text-slate-500'}`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isDone ? 'text-green-600 dark:text-green-400' : isActive ? step.color : 'text-gray-500 dark:text-slate-500'
                    }`}>
                      {t('onboarding.stepLabel', 'Étape')} {index + 1}
                    </span>
                    {isDone && (
                      <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                        ✓
                      </span>
                    )}
                  </div>
                  <h4 className={`text-sm font-semibold mt-0.5 ${
                    isDone
                      ? 'text-green-800 dark:text-green-300'
                      : isActive
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-slate-400'
                  }`}>
                    {step.title}
                  </h4>
                  {(isActive || isDone) && (
                    <p className={`text-xs mt-1 leading-relaxed ${
                      isDone ? 'text-green-700/70 dark:text-green-400/60' : 'text-gray-600 dark:text-slate-300'
                    }`}>
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Action arrow */}
                <div className={`flex-shrink-0 self-center transition-transform group-hover:translate-x-0.5 ${
                  isActive ? step.color : 'text-gray-300 dark:text-slate-600'
                }`}>
                  {isActive ? (
                    <ArrowRight className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
