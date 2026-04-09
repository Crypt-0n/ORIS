import React from 'react';

import { useTranslation } from 'react-i18next';
import { Diamond, Plus, Edit, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getKillChainPhases } from '../../lib/killChainDefinitions';

interface TaskDiamondEventsProps {
  taskDiamonds: any[];
  caseKillChainType: string | null;
  canEditDiamond: boolean;
  onAddDiamond: () => void;
  onEditDiamond: (d: any) => void;
  onDeleteDiamond: (id: string) => void;
}

/**
 * Checks diamond completeness. Rules:
 * - Required vertices: capability, infrastructure, victim (adversary is optional)
 * - Required relations: capability↔infrastructure, capability↔victim, infrastructure↔victim
 * - If adversary is present, relations adversary↔capability, adversary↔infrastructure and adversary↔victim are required
 */
export function getDiamondCompleteness(d: any): { complete: boolean; missing: string[] } {
  const axes = d.x_oris_diamond_axes || d._axes || {};
  const missing: string[] = [];

  // Check required vertices
  const requiredAxes: { key: string; label: string }[] = [
    { key: 'capability', label: 'Capacité' },
    { key: 'infrastructure', label: 'Infrastructure' },
    { key: 'victim', label: 'Victime' },
  ];
  for (const { key, label } of requiredAxes) {
    if (!axes[key] || axes[key].length === 0) {
      missing.push(`Sommet "${label}" vide`);
    }
  }

  // Check required relations (only between non-adversary vertices)
  const relations: any[] = d._relations || [];
  const requiredEdges: { from: string; to: string; label: string }[] = [
    { from: 'capability', to: 'infrastructure', label: 'Capacité ↔ Infrastructure' },
    { from: 'capability', to: 'victim', label: 'Capacité ↔ Victime' },
    { from: 'infrastructure', to: 'victim', label: 'Infrastructure ↔ Victime' },
  ];

  // If adversary is filled, require its edges
  const hasAdversary = axes.adversary && axes.adversary.length > 0;
  if (hasAdversary) {
    requiredEdges.push(
      { from: 'adversary', to: 'capability', label: 'Adversaire ↔ Capacité' },
      { from: 'adversary', to: 'infrastructure', label: 'Adversaire ↔ Infrastructure' },
      { from: 'adversary', to: 'victim', label: 'Adversaire ↔ Victime' },
    );
  }

  for (const edge of requiredEdges) {
    const fromIds = new Set((axes[edge.from] || []).map((v: any) => typeof v === 'string' ? v : v.id));
    const toIds = new Set((axes[edge.to] || []).map((v: any) => typeof v === 'string' ? v : v.id));

    const hasRelation = relations.some((r: any) =>
      (fromIds.has(r.source_ref) && toIds.has(r.target_ref)) ||
      (toIds.has(r.source_ref) && fromIds.has(r.target_ref))
    );
    if (!hasRelation) {
      missing.push(`Lien "${edge.label}" manquant`);
    }
  }

  return { complete: missing.length === 0, missing };
}

export function TaskDiamondEvents({
  taskDiamonds, caseKillChainType, canEditDiamond, onAddDiamond, onEditDiamond, onDeleteDiamond
}: TaskDiamondEventsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Diamond className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">Diamants</span>
          {taskDiamonds.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400">{taskDiamonds.length}</span>}
        </div>
        {canEditDiamond && (
          <button onClick={onAddDiamond} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition">
            <Plus className="w-3.5 h-3.5" /> {t('auto.ajouter', 'Ajouter')}
          </button>
        )}
      </div>
      
      {taskDiamonds.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-3">Aucun diamant créé pour cette tâche</p>
      )}
      
      {taskDiamonds.map((d: any) => {
        const phases = getKillChainPhases(caseKillChainType || 'lockheed-martin');
        const phase = phases.find(p => p.value === d.x_oris_kill_chain);
        const { complete, missing } = getDiamondCompleteness(d);
        return (
          <div key={d.id} className="relative overflow-hidden p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border-[0.5px] border-cyan-200/50 dark:border-cyan-800/50 border-l-[4px] border-l-cyan-500 transition group mb-2 shadow-sm">
            {/* Decorative watermark */}
            <Diamond className="absolute -bottom-6 -right-2 w-28 h-28 text-cyan-500/5 dark:text-cyan-400/5 rotate-12 pointer-events-none" />

            <div className="flex items-start justify-between mb-2 relative z-10">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 flex flex-shrink-0 items-center justify-center bg-cyan-100 dark:bg-cyan-900/50 rounded-full text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                   <Diamond className="w-4 h-4" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-sm font-medium text-gray-800 dark:text-white flex items-center gap-2">
                     Diamant d'investigation
                     {complete ? (
                       <span title="Diamant complet" className="flex items-center text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                         <CheckCircle2 className="w-3 h-3 mr-0.5" /> Complet
                       </span>
                     ) : (
                       <span title={missing.join('\n')} className="flex items-center text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold cursor-help">
                         <AlertTriangle className="w-3 h-3 mr-0.5" /> Incomplet ({missing.length})
                       </span>
                     )}
                   </span>
                   <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                     {d.x_oris_description || d.name}
                   </span>
                 </div>
              </div>
              <div className="flex items-center gap-2 relative z-10">
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {d.first_observed || d.created ? new Date(d.first_observed || d.created).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                {canEditDiamond && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 rounded p-0.5 shadow-sm border border-gray-200 dark:border-slate-700">
                    <button onClick={() => onEditDiamond(d)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition" title={t('auto.modifier', 'Modifier')}>
                      <Edit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </button>
                    <button onClick={() => onDeleteDiamond(d.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition" title={t('auto.supprimer', 'Supprimer')}>
                      <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {phase && (
              <div className="flex items-center gap-2 ml-10 relative z-10 mt-1">
                <span className="text-[10px] px-2 py-0.5 rounded border shadow-sm font-medium flex items-center gap-1.5" style={{ backgroundColor: `${phase.hexColor}15`, borderColor: phase.hexColor, color: phase.hexColor }}>
                   <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: phase.hexColor }} />
                   Phase: {phase.label}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
