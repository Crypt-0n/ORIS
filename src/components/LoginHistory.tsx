import { useState, useEffect } from 'react';
import { Monitor, Clock, CheckCircle, XCircle, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface LoginEntry {
  id: string;
  user_id?: string;
  ip_address: string;
  user_agent: string;
  success: number;
  created_at: string;
  full_name?: string;
  email?: string;
}

function parseUserAgent(ua: string): string {
  if (!ua || ua === 'unknown') return 'Inconnu';
  // Extract browser
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('curl')) return 'cURL / API';
  return ua.length > 40 ? ua.substring(0, 40) + '…' : ua;
}

function parseOS(ua: string): string {
  if (!ua || ua === 'unknown') return '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return '';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;

  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function LoginHistory({ adminMode = false }: { adminMode?: boolean }) {
  const { hasRole } = useAuth();
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const isAdmin = hasRole('admin');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const endpoint = adminMode && isAdmin ? '/auth/login-history/all?limit=100' : '/auth/login-history?limit=50';
        const data = await api.get(endpoint);
        setEntries(data);
      } catch (err) {
        console.error('Failed to fetch login history:', err);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [adminMode, isAdmin]);

  const displayEntries = expanded ? entries : entries.slice(0, 5);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
        Aucune connexion enregistrée
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {displayEntries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 overflow-hidden"
        >
          {/* Status icon */}
          {entry.success ? (
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {adminMode && entry.full_name && (
                <span className="text-sm font-medium text-gray-800 dark:text-white">{entry.full_name}</span>
              )}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                <Globe className="w-3 h-3 flex-shrink-0" />
                <span className="font-mono truncate">{entry.ip_address}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                <Monitor className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{parseUserAgent(entry.user_agent)}</span>
                {parseOS(entry.user_agent) && (
                  <span className="text-gray-500 dark:text-slate-400 flex-shrink-0">· {parseOS(entry.user_agent)}</span>
                )}
              </div>
            </div>
            {adminMode && entry.email && (
              <span className="text-xs text-gray-500 dark:text-slate-400 truncate block">{entry.email}</span>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 mt-0.5 sm:hidden">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{formatDate(entry.created_at)}</span>
            </div>
          </div>

          {/* Time — hidden on mobile, shown inline on sm+ */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{formatDate(entry.created_at)}</span>
          </div>
        </div>
      ))}

      {entries.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition"
        >
          {expanded ? (
            <>Voir moins <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Voir les {entries.length - 5} autres <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </div>
  );
}
