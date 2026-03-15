import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { FolderOpen, Plus, AlertCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface CaseWithDetails {
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
  }>;
}

interface CasesListProps {
  onSelectCase: (caseId: string) => void;
  onCreateCase: () => void;
}

export function CasesList({ onSelectCase, onCreateCase }: CasesListProps) {
  const { user, hasAnyRole, hasRole } = useAuth();
  const { t, i18n } = useTranslation();
  const isAdmin = hasRole('admin');
  const [cases, setCases] = useState<CaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [showSupervision, setShowSupervision] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (user) {
      fetchUserProfiles();
      fetchCases();
    }
  }, [user]);

  const fetchUserProfiles = async () => {
    try {
      const data = await api.get('/auth/users');
      const profilesMap = new Map<string, string>(data.map((p: any) => [p.id, p.full_name]));
      setUserProfiles(profilesMap);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const data = await api.get('/cases?type=case');
      setCases(data || []);
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  const isInvestigator = (caseItem: CaseWithDetails) => {
    if (!user) return false;
    return caseItem.author_id === user.id ||
      caseItem.case_assignments.some(a => a.user_id === user.id);
  };

  const myCases = cases.filter(c => isInvestigator(c));
  const supervisionCases = isAdmin ? cases.filter(c => !isInvestigator(c)) : [];

  const activeCases = showSupervision ? supervisionCases : myCases;

  const filteredCases = activeCases.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredCases.length / ITEMS_PER_PAGE);
  const paginatedCases = filteredCases.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
            {showSupervision ? t('cases.supervision') : t('cases.myFiles')}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-slate-400 mt-1">
            {showSupervision ? t('cases.supervisionDesc') : t('cases.myFilesDesc')}
          </p>
        </div>
        {hasAnyRole(['admin', 'team_leader']) && !showSupervision && (
          <button
            onClick={onCreateCase}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {t('cases.newCase')}
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-0">
          <button
            onClick={() => { setShowSupervision(false); setFilter('all'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${!showSupervision
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <FolderOpen className="w-4 h-4" />
            {t('cases.myFiles')}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${!showSupervision
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
              {myCases.length}
            </span>
          </button>
          <button
            onClick={() => { setShowSupervision(true); setFilter('all'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${showSupervision
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <Eye className="w-4 h-4" />
            {t('cases.supervision')}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${showSupervision
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
              {supervisionCases.length}
            </span>
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => { setFilter('all'); setCurrentPage(1); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${filter === 'all'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
        >
          {t('cases.all')} ({activeCases.length})
        </button>
        <button
          onClick={() => { setFilter('open'); setCurrentPage(1); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${filter === 'open'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
        >
          {t('cases.open')} ({activeCases.filter(c => c.status === 'open').length})
        </button>
        <button
          onClick={() => { setFilter('closed'); setCurrentPage(1); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition whitespace-nowrap flex-shrink-0 text-sm sm:text-base ${filter === 'closed'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
        >
          {t('cases.closed')} ({activeCases.filter(c => c.status === 'closed').length})
        </button>
      </div>

      {filteredCases.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('cases.noCase')}</h3>
          <p className="text-gray-500 dark:text-slate-400">{t('cases.noCaseDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedCases.map((caseItem) => {
            const hasAccess = isInvestigator(caseItem);
            return (
              <div
                key={caseItem.id}
                onClick={() => onSelectCase(caseItem.id)}
                className="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-800/50 hover:shadow-md dark:hover:shadow-slate-700/50 transition cursor-pointer p-4 sm:p-6 border border-transparent dark:border-slate-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{caseItem.case_number}</span>
                      {!hasAccess && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 italic">({t('cases.restrictedAccess')})</span>
                      )}
                    </div>
                    {hasAccess ? (
                      <>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">{caseItem.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span
                            className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0"
                            style={{
                              backgroundColor: `${caseItem.severity.color}20`,
                              color: caseItem.severity.color,
                            }}
                          >
                            <AlertCircle className="w-3 h-3" />
                            {caseItem.severity.label}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${caseItem.tlp.code === 'WHITE' ? 'border border-gray-400 dark:border-slate-500' : ''}`}
                            style={{
                              backgroundColor: caseItem.tlp.code === 'WHITE' ? 'transparent' : '#000000',
                              color: caseItem.tlp.code === 'WHITE' ? undefined : caseItem.tlp.color,
                            }}
                          >
                            <span className={caseItem.tlp.code === 'WHITE' ? 'text-gray-700 dark:text-slate-300' : ''}>
                              {caseItem.tlp.label}
                            </span>
                          </span>
                          {caseItem.pap && (
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${caseItem.pap.code === 'WHITE' ? 'border border-gray-400 dark:border-slate-500' : ''}`}
                              style={{
                                backgroundColor: caseItem.pap.code === 'WHITE' ? 'transparent' : '#000000',
                                color: caseItem.pap.code === 'WHITE' ? undefined : caseItem.pap.color,
                              }}
                            >
                              <span className={caseItem.pap.code === 'WHITE' ? 'text-gray-700 dark:text-slate-300' : ''}>
                                {caseItem.pap.label}
                              </span>
                            </span>
                          )}
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${caseItem.status === 'open'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300'
                              }`}
                          >
                            {caseItem.status === 'open' ? t('cases.openStatus') : t('cases.closedStatus')}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 dark:text-slate-400">
                          <span>{t('cases.author')}: {caseItem.author.full_name}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{t('cases.createdOn')} {new Date(caseItem.created_at).toLocaleDateString(dateLocale)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-400 dark:text-slate-500 mb-2">{t('cases.confidential')}</h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${caseItem.status === 'open'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300'
                              }`}
                          >
                            {caseItem.status === 'open' ? t('cases.openStatus') : t('cases.closedStatus')}
                          </span>
                        </div>
                        <div className="text-gray-400 dark:text-slate-500 text-sm mb-3">
                          <p className="mb-1">
                            {caseItem.case_assignments.length} {caseItem.case_assignments.length > 1 ? t('cases.teamMembersPlural') : t('cases.teamMembers')}:
                          </p>
                          <p className="text-xs">
                            {caseItem.case_assignments.map(a => userProfiles.get(a.user_id) || t('cases.unknown')).join(', ')}
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-400 dark:text-slate-500">
                          <span>{t('cases.author')}: {caseItem.author.full_name}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredCases.length)} sur {filteredCases.length}
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
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-400 dark:text-slate-500 px-1">…</span>}
                  <button
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[2rem] h-8 rounded-lg text-sm font-medium transition ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
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
