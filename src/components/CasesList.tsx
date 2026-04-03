import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, FolderOpen, AlertCircle, ChevronRight, ChevronLeft, Eye, Layers, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Skeleton } from './common/Skeleton';

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
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [showSupervision, setShowSupervision] = useState(false);
  
  const [userProfiles, setUserProfiles] = useState<Map<string, string>>(new Map());
  const [groupBy, setGroupBy] = useState<'none' | 'beneficiary' | 'severity' | 'status' | 'author'>('none');
  
  const [filterBeneficiary, setFilterBeneficiary] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [availableBeneficiaries, setAvailableBeneficiaries] = useState<Array<{id: string, name: string}>>([]);
  const [availableSeverities, setAvailableSeverities] = useState<Array<{id: string, label: string, color: string}>>([]);
  const [availableAuthors, setAvailableAuthors] = useState<Array<{id: string, full_name: string}>>([]);
  const [tabCounts, setTabCounts] = useState({ my: 0, backlog: 0, supervision: 0 });
  const [statusCounts, setStatusCounts] = useState({ all: 0, open: 0, closed: 0 });
  
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (user) {
      if (!showSupervision) fetchFiltersMetadata();
      // always fetch filters metadata whenever a new render occurs across different tabs or on first load so we have the initial total amounts
      // actually, just running it on first load and then fetchCases handles the exact number for activeTab
      fetchUserProfiles();
      fetchFiltersMetadata();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchCases();
    }
  }, [user, currentPage, filter, filterBeneficiary, filterSeverity, filterAuthor, showSupervision]);

  const fetchUserProfiles = async () => {
    try {
      const data = await api.get('/auth/users');
      const profilesMap = new Map<string, string>(data.map((p: any) => [p.id, p.full_name]));
      setUserProfiles(profilesMap);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFiltersMetadata = async () => {
    try {
      const data = await api.get('/cases/filters-metadata?type=case');
      if (data) {
        setAvailableBeneficiaries(data.beneficiaries || []);
        setAvailableSeverities(data.severities || []);
        setAvailableAuthors(data.authors || []);
        if (data.tabCounts) setTabCounts(data.tabCounts);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'case',
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        status: filter,
        beneficiary: filterBeneficiary,
        severity: filterSeverity,
        author: filterAuthor,
        supervision: showSupervision.toString()
      });
      
      const data = await api.get(`/cases?${params.toString()}`);
      if (data && data.data) {
        setCases(data.data);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
        if (data.statusCounts) setStatusCounts(data.statusCounts);
      } else if (Array.isArray(data)) {
        setCases(data);
      }
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

  const resetFilters = () => {
    setFilter('all');
    setFilterBeneficiary('all');
    setFilterSeverity('all');
    setFilterAuthor('all');
    setCurrentPage(1);
  };

  // Grouping Logic (Appliqué uniquement sur la page courante pour la fluidité)
  let groupedCases: Record<string, CaseWithDetails[]> | null = null;
  
  if (groupBy !== 'none' && cases.length > 0) {
    groupedCases = cases.reduce((acc, curr) => {
      let key = 'Inconnu';
      if (groupBy === 'beneficiary') key = curr.beneficiary?.name || 'Aucun bénéficiaire';
      else if (groupBy === 'severity') key = curr.severity.label;
      else if (groupBy === 'status') key = curr.status === 'open' ? 'Ouverts' : 'Clôturés';
      else if (groupBy === 'author') key = curr.author.full_name;
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    }, {} as Record<string, CaseWithDetails[]>);
    
    // Sort groups alphabetically
    const sortedKeys = Object.keys(groupedCases).sort((a, b) => a.localeCompare(b));
    const sortedGroupedCases: Record<string, CaseWithDetails[]> = {};
    sortedKeys.forEach(k => sortedGroupedCases[k] = groupedCases![k]);
    groupedCases = sortedGroupedCases;
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: prev[group] === undefined ? false : !prev[group] }));
  };

  const isGroupExpanded = (group: string) => {
    if (expandedGroups[group] !== undefined) return expandedGroups[group];
    return true; // Expanded by default
  };

  const dateLocale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB';

  // Le loading est géré plus bas par des animations Skeletons

  return (
    <div className="space-y-4 sm:space-y-6">
      <Helmet>
        <title>Dossiers d'investigation | ORIS</title>
        <meta name="description" content="Liste des dossiers d'incidents de sécurité en cours et clôturés." />
      </Helmet>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {showSupervision ? t('cases.supervision') : t('cases.myFiles')}
          </h2>
          {/* Omitted the paragraph description to save more vertical space as requested */}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtres Tous/Ouvert/Fermé */}
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => { setFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              {t('cases.all')} <span className="ml-1 opacity-70 text-[10px] font-mono">({statusCounts.all})</span>
            </button>
            <button
              onClick={() => { setFilter('open'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${filter === 'open' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              {t('cases.open')} <span className="ml-1 opacity-70 text-[10px] font-mono">({statusCounts.open})</span>
            </button>
            <button
              onClick={() => { setFilter('closed'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${filter === 'closed' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              {t('cases.closed')} <span className="ml-1 opacity-70 text-[10px] font-mono">({statusCounts.closed})</span>
            </button>
          </div>

          {/* Sélecteur Groupage */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-1.5 rounded-lg w-full sm:w-auto">
            <Layers className="w-4 h-4 text-gray-400 ml-1" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer [&>option]:dark:bg-slate-900"
            >
              <option value="none">Ne pas grouper</option>
              <option value="beneficiary">Par Bénéficiaire</option>
              <option value="severity">Par Sévérité</option>
              <option value="status">Par Statut</option>
              <option value="author">Par Auteur</option>
            </select>
          </div>

          {/* Filtres croisés */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-1.5 rounded-lg w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400 ml-1" />
            <select
              value={filterBeneficiary}
              onChange={(e) => { setFilterBeneficiary(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer max-w-[140px] truncate [&>option]:dark:bg-slate-900"
            >
              <option value="all">Bénéficiaire (Tous)</option>
              {availableBeneficiaries.map(({id, name}) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-700 mx-1"></div>
            <select
              value={filterSeverity}
              onChange={(e) => { setFilterSeverity(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer [&>option]:dark:bg-slate-900"
            >
              <option value="all">Sévérité (Toutes)</option>
              {availableSeverities.map(({id, label}) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>

            <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-slate-700 mx-1"></div>
            <select
              value={filterAuthor}
              onChange={(e) => { setFilterAuthor(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm font-medium text-gray-900 dark:text-white border-0 py-0 pl-1 pr-6 focus:ring-0 cursor-pointer max-w-[140px] truncate [&>option]:dark:bg-slate-900"
            >
              <option value="all">Auteur (Tous)</option>
              {availableAuthors.map(({id, full_name}) => (
                <option key={id} value={id}>{full_name}</option>
              ))}
            </select>
          </div>

          {hasAnyRole(['admin', 'team_leader']) && !showSupervision && (
            <button
              onClick={onCreateCase}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm font-medium flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('cases.newCase')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Legacy supervision tabs below the new header to keep it intact */}
      {isAdmin && (
        <div className="flex gap-2 border-b border-gray-200 dark:border-slate-700 pb-0">
          <button
            onClick={() => { setShowSupervision(false); resetFilters(); fetchFiltersMetadata(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${!showSupervision
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <FolderOpen className="w-4 h-4" />
            {t('cases.myFiles')} <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${!showSupervision ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>{!showSupervision ? totalItems : tabCounts.my}</span>
          </button>
          <button
            onClick={() => { setShowSupervision(true); resetFilters(); fetchFiltersMetadata(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${showSupervision
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <Eye className="w-4 h-4" />
            {t('cases.supervision')} <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${showSupervision ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>{showSupervision ? totalItems : tabCounts.supervision}</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"><Skeleton type="text" className="w-1/3 mb-2" /><Skeleton type="text" className="w-1/4" /></div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"><Skeleton type="text" className="w-1/3 mb-2" /><Skeleton type="text" className="w-1/4" /></div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"><Skeleton type="text" className="w-1/3 mb-2" /><Skeleton type="text" className="w-1/4" /></div>
        </div>
      ) : cases.length === 0 ? (
        <div className="glass-panel dark:bg-slate-900/50 rounded-xl p-12 text-center animate-fade-in border border-dashed border-gray-300 dark:border-slate-700">
          <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
            <FolderOpen className="w-10 h-10 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-xl font-heading font-medium text-gray-900 dark:text-white mb-2">{t('cases.noCase')}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto mb-6">{t('cases.noCaseDesc')}</p>
        </div>
      ) : groupedCases ? (
        <div className="space-y-4">
          {Object.entries(groupedCases).map(([groupName, groupItems]) => (
            <div key={groupName} className="border border-gray-200 dark:border-slate-800 rounded-xl bg-gray-50 dark:bg-slate-900/30 overflow-hidden shadow-sm">
              <button 
                onClick={() => toggleGroup(groupName)}
                className="w-full flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition -mb-px"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{groupName}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200/50 dark:border-slate-700">
                    {groupItems.length}
                  </span>
                </div>
                {isGroupExpanded(groupName) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              
              {isGroupExpanded(groupName) && (
                <div className="p-3.5 pt-4 grid gap-3 border-t border-gray-100 dark:border-slate-800">
                  {groupItems.map(caseItem => <CaseCard key={caseItem.id} caseItem={caseItem} hasAccess={isInvestigator(caseItem)} t={t} onSelectCase={onSelectCase} dateLocale={dateLocale} userProfiles={userProfiles} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {cases.map((caseItem) => (
             <CaseCard key={caseItem.id} caseItem={caseItem} hasAccess={isInvestigator(caseItem)} t={t} onSelectCase={onSelectCase} dateLocale={dateLocale} userProfiles={userProfiles} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} sur {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Page précédente"
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
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent extracted for cleaner grouping map
function CaseCard({ caseItem, hasAccess, t, onSelectCase, dateLocale, userProfiles }: any) {
  return (
    <div
      onClick={() => onSelectCase(caseItem.id)}
      className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 hover:shadow-md hover:border-blue-200 dark:hover:border-slate-700 transition cursor-pointer p-4 sm:p-5"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{caseItem.case_number}</span>
            {!hasAccess && (
              <span className="text-xs text-gray-500 dark:text-slate-400 italic">({t('cases.restrictedAccess')})</span>
            )}
            {caseItem.beneficiary && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                — {caseItem.beneficiary.name}
              </span>
            )}
          </div>
          {hasAccess ? (
            <>
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">{caseItem.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0 border"
                  style={{
                    backgroundColor: `${caseItem.severity.color}15`,
                    color: caseItem.severity.color,
                    borderColor: `${caseItem.severity.color}30`,
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
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
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
              <h3 className="text-base sm:text-lg font-semibold text-gray-500 dark:text-slate-400 mb-2">{t('cases.confidential')}</h3>
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
              <div className="text-gray-500 dark:text-slate-400 text-sm mb-3">
                <p className="mb-1">
                  {caseItem.case_assignments.length} {caseItem.case_assignments.length > 1 ? t('cases.teamMembersPlural') : t('cases.teamMembers')}:
                </p>
                <p className="text-xs">
                  {caseItem.case_assignments.map((a: any) => userProfiles.get(a.user_id) || t('cases.unknown')).join(', ')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 dark:text-slate-400">
                <span>{t('cases.author')}: {caseItem.author.full_name}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
