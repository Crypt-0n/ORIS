import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Plus, AlertCircle, Eye, ChevronLeft, ChevronRight, ArrowRightLeft, UserCheck, UserX } from 'lucide-react';

interface AlertWithDetails {
  id: string;
  case_number: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  created_at: string;
  author_id: string;
  author: {
    full_name: string;
  };
  severity: {
    label: string;
    color: string;
  };
  tlp: {
    code: string;
    label: string;
    color: string;
  };
  pap: {
    code: string;
    label: string;
    color: string;
  } | null;
  beneficiary?: {
    id: string;
    name: string;
  };
  case_assignments: Array<{
    user_id: string;
    full_name?: string;
  }>;
}

interface AlertsListProps {
  onSelectAlert: (alertId: string) => void;
  onCreateAlert: () => void;
}

export function AlertsList({ onSelectAlert, onCreateAlert }: AlertsListProps) {
  const { user, hasAnyRole, hasRole, profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isAdmin = hasRole('admin');
  const [alerts, setAlerts] = useState<AlertWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [showSupervision, setShowSupervision] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.get('/cases?type=alert');
      setAlerts(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };



  const handleConvertToCase = async (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    try {
      await api.post(`/cases/${alertId}/convert`, {});
      fetchAlerts();
    } catch (error) {
      console.error(error);
    }
  };

  const handleTakeOver = async (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await api.post('/case_assignments', { case_id: alertId, user_id: user.id });
      fetchAlerts();
    } catch (error) {
      console.error(error);
    }
  };

  const myAlerts = alerts;
  const supervisionAlerts: AlertWithDetails[] = [];

  const activeAlerts = showSupervision ? supervisionAlerts : myAlerts;

  const filteredAlerts = activeAlerts.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const totalPages = Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE);
  const paginatedAlerts = filteredAlerts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const dateLocale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-slate-400">{t('cases.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {showSupervision ? 'Supervision des alertes' : 'Mes alertes'}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">
            {showSupervision ? 'Alertes des autres équipes' : 'Gérez vos alertes de sécurité'}
          </p>
        </div>
        {(isAdmin || profile?.canSeeAlerts) && !showSupervision && (
          <button
            onClick={onCreateAlert}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Nouvelle alerte
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-0">
          <button
            onClick={() => { setShowSupervision(false); setFilter('all'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${!showSupervision
              ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Mes alertes
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${!showSupervision
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
              : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
              {myAlerts.length}
            </span>
          </button>
          <button
            onClick={() => { setShowSupervision(true); setFilter('all'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${showSupervision
              ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <Eye className="w-4 h-4" />
            Supervision
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${showSupervision
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
              : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
              {supervisionAlerts.length}
            </span>
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${filter === 'all'
            ? 'bg-orange-600 text-white'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
        >
          Toutes ({activeAlerts.length})
        </button>
        <button
          onClick={() => { setFilter('open'); setCurrentPage(1); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${filter === 'open'
            ? 'bg-orange-600 text-white'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
        >
          Ouvertes ({activeAlerts.filter(c => c.status === 'open').length})
        </button>
        <button
          onClick={() => { setFilter('closed'); setCurrentPage(1); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${filter === 'closed'
            ? 'bg-orange-600 text-white'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
        >
          Clôturées ({activeAlerts.filter(c => c.status === 'closed').length})
        </button>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Aucune alerte</h3>
          <p className="text-gray-500 dark:text-slate-400">Les alertes apparaîtront ici lorsqu'elles seront créées.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedAlerts.map((alertItem) => {
            const hasAccess = true; // Backend already filters alerts by beneficiary membership
            return (
              <div
                key={alertItem.id}
                onClick={() => onSelectAlert(alertItem.id)}
                className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 hover:shadow-md dark:hover:shadow-slate-700/50 transition cursor-pointer p-4 sm:p-6 border border-transparent dark:border-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{alertItem.case_number}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                        ALERTE
                      </span>
                      {!hasAccess && (
                        <span className="text-xs text-gray-500 dark:text-slate-400 italic">({t('cases.restrictedAccess')})</span>
                      )}
                    </div>
                    {hasAccess ? (
                      <>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">{alertItem.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span
                            className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0"
                            style={{
                              backgroundColor: `${alertItem.severity.color}20`,
                              color: alertItem.severity.color,
                            }}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {alertItem.severity.label}
                          </span>
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${alertItem.status === 'open'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300'
                              }`}
                          >
                            {alertItem.status === 'open' ? t('cases.openStatus') : t('cases.closedStatus')}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 dark:text-slate-400">
                          <span>{t('cases.author')}: {alertItem.author.full_name}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{t('cases.createdOn')} {new Date(alertItem.created_at).toLocaleDateString(dateLocale)}</span>
                        </div>
                        {alertItem.case_assignments.length > 0 ? (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Suivie par {alertItem.case_assignments.map(a => a.full_name || 'Inconnu').join(', ')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1.5">
                              <UserX className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                              <span className="text-xs font-medium text-red-500 dark:text-red-400 animate-pulse">Non prise en charge</span>
                            </div>
                            <button
                              onClick={(e) => handleTakeOver(e, alertItem.id)}
                              className="ml-1 px-2.5 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition"
                            >
                              Prendre en charge
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-500 dark:text-slate-400 mb-2">{t('cases.confidential')}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 dark:text-slate-400">
                          <span>{t('cases.author')}: {alertItem.author.full_name}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {hasAccess && alertItem.status === 'open' && hasAnyRole(['admin', 'team_leader', 'case_manager']) && (
                    <button
                      onClick={(e) => handleConvertToCase(e, alertItem.id)}
                      className="flex-shrink-0 ml-4 p-2 text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition"
                      title="Convertir en dossier"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAlerts.length)} sur {filteredAlerts.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-500 dark:text-slate-400 px-1">…</span>}
                  <button
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[2rem] h-8 rounded-lg text-sm font-medium transition ${
                      p === currentPage
                        ? 'bg-orange-600 text-white'
                        : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
