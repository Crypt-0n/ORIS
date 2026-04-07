import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Eye } from 'lucide-react';

interface ActiveUser {
  userId: string;
  fullName: string;
  taskId?: string;
}

interface ActiveUsersProps {
  caseId: string;
  taskId?: string;
}

const POLL_INTERVAL = 10000; // 10s for more responsiveness

export function ActiveUsers({ caseId, taskId }: ActiveUsersProps) {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const caseIdRef = useRef(caseId);
  const taskIdRef = useRef(taskId);

  // Keep refs in sync
  caseIdRef.current = caseId;
  taskIdRef.current = taskId;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const currentCaseId = caseIdRef.current;
      const currentTaskId = taskIdRef.current;

      try {
        // Send heartbeat
        await api.post('/presence/heartbeat', { caseId: currentCaseId, taskId: currentTaskId });
      } catch {}

      try {
        // Fetch who else is here
        const endpoint = currentTaskId
          ? `/presence/task/${currentTaskId}`
          : `/presence/case/${currentCaseId}`;
        const data = await api.get(endpoint);
        if (!cancelled && Array.isArray(data)) {
          setUsers(data);
        }
      } catch {}
    };

    // Immediate first tick
    tick();

    // Then poll
    const id = setInterval(tick, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [caseId, taskId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2 py-1 animate-fadeIn">
      <Eye className="w-4 h-4 text-green-500 animate-pulse flex-shrink-0" />
      <div className="flex items-center">
        {users.slice(0, 5).map((u, i) => (
          <div
            key={u.userId}
            className="relative group"
            style={{ zIndex: 10 - i, marginLeft: i > 0 ? -4 : 0 }}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-white dark:ring-slate-900 shadow-sm">
              {u.fullName.charAt(0)}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-20">
              {u.fullName}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-white dark:ring-slate-900" />
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900" style={{ marginLeft: -4 }}>
            +{users.length - 5}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400">
        {users.length === 1
          ? `${users[0].fullName} consulte`
          : `${users.map(u => u.fullName).join(', ')} consultent`}
      </span>
    </div>
  );
}
