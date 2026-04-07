import { useState, useEffect } from 'react';
import { Bell, Loader2, AtSign, UserPlus, GitBranch, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';

interface Prefs {
  mention: boolean;
  assignment: boolean;
  task_status: boolean;
  task_comment: boolean;
  case_status: boolean;
}

const PREF_ITEMS: { key: keyof Prefs; label: string; desc: string; icon: typeof Bell; color: string }[] = [
  { key: 'mention', label: 'Mentions (@)', desc: 'Quand quelqu\'un vous mentionne dans un commentaire', icon: AtSign, color: 'text-blue-500' },
  { key: 'assignment', label: 'Assignations', desc: 'Quand une tâche vous est assignée', icon: UserPlus, color: 'text-emerald-500' },
  { key: 'task_status', label: 'Statut de tâche', desc: 'Quand une de vos tâches est fermée ou réouverte', icon: GitBranch, color: 'text-amber-500' },
  { key: 'task_comment', label: 'Commentaires', desc: 'Quand quelqu\'un commente une de vos tâches', icon: MessageSquare, color: 'text-purple-500' },
  { key: 'case_status', label: 'Statut de dossier', desc: 'Quand un dossier auquel vous participez change de statut', icon: GitBranch, color: 'text-orange-500' },
];

const DEFAULT_PREFS: Prefs = { mention: true, assignment: true, task_status: true, task_comment: true, case_status: true };

export function NotificationPreferencesCard() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences')
      .then((data) => setPrefs({ ...DEFAULT_PREFS, ...data }))
      .catch(() => setPrefs(DEFAULT_PREFS));
  }, []);

  const toggle = async (key: keyof Prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    try { await api.put('/notifications/preferences', updated); }
    catch (err) { console.error(err); setPrefs(prefs); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-5 overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-4 flex items-center gap-2">
        <Bell className="w-4 h-4 text-blue-500" />
        Préférences de notifications
        {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-500 ml-auto" />}
      </h3>
      <div className="space-y-3">
        {PREF_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 ${item.color} flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  prefs[item.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
                }`}
                role="switch"
                aria-checked={prefs[item.key]}
                aria-label={item.label}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  prefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
