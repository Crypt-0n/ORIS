import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Plus, AlertCircle, Eye, ChevronLeft, ChevronRight, ArrowRightLeft, UserCheck, UserX, Layers, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Skeleton } from './common/Skeleton';

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
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [activeTab, setActiveTab] = useState<'my' | 'supervision' | 'backlog'>('my');
  const [groupBy, setGroupBy] = useState<'none' | 'beneficiary' | 'severity' | 'status' | 'author'>('none');
  
  const [filterBeneficiary, setFilterBeneficiary] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [availableBeneficiaries, setAvailableBeneficiaries] = useState<Array<{id: string, name: string}>>([]);
  const [availableSeverities, setAvailableSeverities] = useState<Array<{id: string, label: string, color: string}>>([]);
  const [availableAuthors, setAvailableAuthors] = useState<Array<{id: string, full_name: string}>>([]);
  const [tabCounts, setTabCounts] = useState({ my: 0, backlog: 0, supervision: 0 });
  
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    if (user) {
      if (activeTab === 'my') fetchFiltersMetadata();
      // always fetch filters metadata whenever a new render occurs across different tabs or on first load so we have the initial total amounts
      // actually, just running it on first load and then fetchAlerts handles the exact number for activeTab
      fetchFiltersMetadata();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user, currentPage, filter, filterBeneficiary, filterSeverity, filterAuthor, activeTab]);

  const fetchFiltersMetadata = async () => {
    try {
      const data = await api.get('/cases/filters-metadata?type=alert');
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

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'alert',
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        status: filter,
        beneficiary: filterBeneficiary,
        severity: filterSeverity,
        author: filterAuthor,
        supervision: activeTab === 'supervision' ? 'true' : (activeTab === 'backlog' ? 'backlog' : 'false')
      });
      
      const data = await api.get(`/cases?${params.toString()}`);
      if (data && data.data) {
        setAlerts(data.data);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else if (Array.isArray(data)) {
        setAlerts(data);
      }
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

  const resetFilters = () => {
    setFilter('all');
    setFilterBeneficiary('all');
    setFilterSeverity('all');
    setFilterAuthor('all');
    setCurrentPage(1);
  };

  // Grouping Logic
  let groupedAlerts: Record<string, AlertWithDetails[]> | null = null;
  
  if (groupBy !== 'none' && alerts.length > 0) {
    groupedAlerts = alerts.reduce((acc, curr) => {
      let key = 'Inconnu';
      if (groupBy === 'beneficiary') key = curr.beneficiary?.name || 'Aucun bénéficiaire';
      else if (groupBy === 'severity') key = curr.severity.label;
      else if (groupBy === 'status') key = curr.status === 'open' ? 'Ouvertes' : 'Clôturées';
      else if (groupBy === 'author') key = curr.author.full_name;
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    }, {} as Record<string, AlertWithDetails[]>);
    
    // Sort groups alphabetically
    const sortedKeys = Object.keys(groupedAlerts).sort((a, b) => a.localeCompare(b));
    const sortedGroupedAlerts: Record<string, AlertWithDetails[]> = {};
    sortedKeys.forEach(k => sortedGroupedAlerts[k] = groupedAlerts![k]);
    groupedAlerts = sortedGroupedAlerts;
  }

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: prev[group] === undefined ? false : !prev[group] }));
  };

  const isGroupExpanded = (group: string) => {
    if (expandedGroups[group] !== undefined) return expandedGroups[group];
    return true; // Expanded by default
  };

  const dateLocale = i18n.language === 'fr' ? 'fr-FR' : 'en-GB';

  // Le loader est remplacé visuellement par des Skeletons plus bas

  return (
    <div className="space-y-4 sm:space-y-6">
      <Helmet>
        <title>Alertes de sécurité | ORIS</title>
        <meta name="description" content="Gestion des alertes de sécurité entrantes et conversion en dossiers." />
      </Helmet>
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            {activeTab === 'supervision' ? 'Supervision des alertes' : (activeTab === 'backlog' ? 'Backlog des alertes' : 'Mes alertes')}
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtres Tous/Ouvert/Fermé */}
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => { setFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Toutes <span className="ml-1 opacity-70 text-[10px] font-mono">({filter === 'all' ? totalItems : ''})</span>
            </button>
            <button
              onClick={() => { setFilter('open'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${filter === 'open' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
              Ouvertes <span className="ml-1 opacity-70 text-[10px] font-mono">({filter === 'open' ? totalItems : ''})</span>
            </button>
            <button
              onClick={() => { setFilter('closed'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${filter === 'closed' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
            >
               Clôturées <span className="ml-1 opacity-70 text-[10px] font-mono">({filter === 'closed' ? totalItems : ''})</span>
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

          {(isAdmin || profile?.canSeeAlerts) && activeTab !== 'supervision' && (
            <button
              onClick={onCreateAlert}
              className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 text-sm font-medium flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle alerte</span>
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-slate-700/80 mb-6 sticky top-[57px] z-30 bg-[var(--app-bg)] px-2 sm:px-0">
        <div className="flex gap-4">
          <button
            onClick={() => { setActiveTab('my'); resetFilters(); fetchFiltersMetadata(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'my'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Mes alertes <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${activeTab === 'my' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>{activeTab === 'my' ? totalItems : tabCounts.my}</span>
          </button>
          <button
            onClick={() => { setActiveTab('backlog'); resetFilters(); fetchFiltersMetadata(); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'backlog'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}
          >
            <Layers className="w-4 h-4" />
            Backlog <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${activeTab === 'backlog' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>{activeTab === 'backlog' ? totalItems : tabCounts.backlog}</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => { setActiveTab('supervision'); resetFilters(); fetchFiltersMetadata(); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'supervision'
                ? 'border-orange-600 text-orange-600 dark:text-orange-400 dark:border-orange-400'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
            >
              <Eye className="w-4 h-4" />
              Supervision <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${activeTab === 'supervision' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'}`}>{activeTab === 'supervision' ? totalItems : tabCounts.supervision}</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"><Skeleton type="text" className="w-1/3 mb-2" /><Skeleton type="text" className="w-1/4" /></div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"><Skeleton type="text" className="w-1/3 mb-2" /><Skeleton type="text" className="w-1/4" /></div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4"><Skeleton type="text" className="w-1/3 mb-2" /><Skeleton type="text" className="w-1/4" /></div>
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-panel dark:bg-slate-900/50 rounded-xl p-12 text-center animate-fade-in border border-dashed border-gray-300 dark:border-slate-700">
          <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
            <AlertTriangle className="w-10 h-10 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-xl font-heading font-medium text-gray-900 dark:text-white mb-2">Aucune alerte</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
            Les alertes apparaîtront ici lorsqu'elles seront créées.
          </p>
        </div>
      ) : groupedAlerts ? (
        <div className="space-y-4">
          {Object.entries(groupedAlerts).map(([groupName, groupItems]) => (
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
                  {groupItems.map(alertItem => <AlertCard key={alertItem.id} alertItem={alertItem} t={t} onSelectAlert={onSelectAlert} dateLocale={dateLocale} handleTakeOver={handleTakeOver} handleConvertToCase={handleConvertToCase} hasAnyRole={hasAnyRole} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {alerts.map(alertItem => <AlertCard key={alertItem.id} alertItem={alertItem} t={t} onSelectAlert={onSelectAlert} dateLocale={dateLocale} handleTakeOver={handleTakeOver} handleConvertToCase={handleConvertToCase} hasAnyRole={hasAnyRole} />)}
        </div>
      )}

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

function AlertCard({ alertItem, t, onSelectAlert, dateLocale, handleTakeOver, handleConvertToCase, hasAnyRole }: any) {
  const hasAccess = true;
  return (
    <div
      onClick={() => onSelectAlert(alertItem.id)}
      className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 hover:shadow-md hover:border-orange-200 dark:hover:border-slate-700 transition cursor-pointer p-4 sm:p-5"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{alertItem.case_number}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
              ALERTE
            </span>
            {alertItem.beneficiary && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline-block">
                — {alertItem.beneficiary.name}
              </span>
            )}
          </div>
          {hasAccess && (
            <>
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">{alertItem.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0 border"
                  style={{
                    backgroundColor: `${alertItem.severity.color}15`,
                    color: alertItem.severity.color,
                    borderColor: `${alertItem.severity.color}30`,
                  }}
                >
                  <AlertCircle className="w-3 h-3" />
                  {alertItem.severity.label}
                </span>
                <span
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 ${alertItem.status === 'open'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
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
                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Suivie par {alertItem.case_assignments.map((a: any) => a.full_name || 'Inconnu').join(', ')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    <span className="text-xs font-semibold text-red-500 dark:text-red-400">Non prise en charge</span>
                  </div>
                  <button
                    onClick={(e) => handleTakeOver(e, alertItem.id)}
                    className="ml-1 px-2.5 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition ring-1 ring-orange-200 dark:ring-orange-800"
                  >
                    Prendre en charge
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        {hasAccess && alertItem.status === 'open' && hasAnyRole(['admin', 'team_leader', 'case_manager']) && (
          <button
            onClick={(e) => handleConvertToCase(e, alertItem.id)}
            className="flex-shrink-0 ml-4 p-2.5 text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition ring-1 ring-transparent hover:ring-emerald-200 dark:hover:ring-emerald-800 shadow-sm"
            title="Convertir en dossier"
            aria-label="Convertir en dossier"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
