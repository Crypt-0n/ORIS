
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { getUserTrigram } from '../../lib/userUtils';

interface Participant {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface TaskParticipantsProps {
  participants: Participant[];
}

export function TaskParticipants({ participants }: TaskParticipantsProps) {
  const { t } = useTranslation();

  if (!participants || participants.length === 0) return null;

  return (
    <div className="mb-4 pb-4 border-b border-gray-100 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
          {t('taskDetails.tabParticipants', 'Participants')} ({participants.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {participants.map(p => {
          const cm: Record<string, { bg: string; avatar: string }> = { 
            'Créateur': { bg: 'bg-blue-50 dark:bg-blue-900/20', avatar: 'bg-blue-600' }, 
            'Assigné': { bg: 'bg-green-50 dark:bg-green-900/20', avatar: 'bg-green-600' }, 
            'Commentateur': { bg: 'bg-amber-50 dark:bg-amber-900/20', avatar: 'bg-amber-600' } 
          };
          const c = cm[p.role] || cm['Commentateur'];
          return (
            <div key={p.id} className={`flex items-center gap-2 px-2.5 py-1.5 ${c.bg} rounded-full`}>
              <div className={`w-6 h-6 ${c.avatar} rounded-full flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0`}>
                {getUserTrigram(p.full_name)}
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate max-w-[120px]">
                {p.full_name}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-slate-400">
                {p.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
