
import { useTranslation } from 'react-i18next';
import { Diamond, Plus, Pencil, Trash2 } from 'lucide-react';
import { getKillChainPhases } from '../../lib/killChainDefinitions';

interface TaskDiamondEventsProps {
  taskDiamonds: any[];
  caseKillChainType: string | null;
  canEditDiamond: boolean;
  onAddDiamond: () => void;
  onEditDiamond: (d: any) => void;
  onDeleteDiamond: (id: string) => void;
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
        return (
          <div key={d.id} className="p-3 rounded-lg mb-2 transition bg-gray-50 dark:bg-slate-800/50 group">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phase?.hexColor || '#64748b' }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-white truncate">{d.x_oris_description || d.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {d.first_observed ? new Date(d.first_observed).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  {phase && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: phase.hexColor }}>{phase.label}</span>}
                </div>
              </div>
              {canEditDiamond && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => onEditDiamond(d)} className="text-cyan-400 hover:text-cyan-600" title={t('auto.modifier', 'Modifier')}><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDeleteDiamond(d.id)} className="text-red-400 hover:text-red-600" title={t('auto.supprimer', 'Supprimer')}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
