import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderOpen, ClipboardList, X, Database, MessageSquare, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';

const STIX_TYPE_LABELS: Record<string, string> = {
  infrastructure: 'Infrastructure',
  malware: 'Malware',
  'user-account': 'Compte',
  'ipv4-addr': 'IPv4',
  'domain-name': 'Domaine',
  url: 'URL',
  file: 'Fichier',
  indicator: 'Indicateur',
  'observed-data': 'Observation',
  'attack-pattern': 'Technique',
};

interface SearchResults {
  cases: Array<{ id: string; case_number: string; title: string; status: string; type?: 'alert' | 'case'; severity?: { label: string; color: string } }>;
  tasks: Array<{ id: string; case_id: string; title: string; status: string; case_number: string; case_title: string }>;
  stixObjects: Array<{ id: string; case_id: string; stix_type: string; name: string; description: string; case_number: string; case_title: string }>;
  comments: Array<{ id: string; case_id: string; task_id: string; content: string; task_title: string; case_number: string; case_title: string; author_name: string }>;
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const allItems = results ? [
    ...results.cases.map(c => ({ ...c, type: c.type === 'alert' ? 'alert' as const : 'case' as const })),
    ...results.tasks.map(t => ({ ...t, type: 'task' as const })),
    ...(results.stixObjects || []).map(s => ({ ...s, type: 'stix' as const })),
    ...(results.comments || []).map(cm => ({ ...cm, type: 'comment' as const })),
  ] : [];
  const totalResults = allItems.length;

  // Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (window.innerWidth < 1024) {
          setMobileOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === 'Escape') { closeAll(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Click outside (desktop)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults({ cases: [], tasks: [], stixObjects: [], comments: [] }); return; }
    
    // Annuler la requête précédente si elle est toujours en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Créer un nouveau contrôleur pour cette requête
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const data = await api.get(`/search?q=${encodeURIComponent(q.trim())}`, { signal: controller.signal });
      setResults(data);
      setSelectedIndex(-1);
    } catch (error: any) {
      // Ignorer l'erreur si la requête a été volontairement annulée (Race condition bloquée)
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }
      setResults({ cases: [], tasks: [], stixObjects: [], comments: [] });
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => { 
      if (debounceRef.current) clearTimeout(debounceRef.current); 
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [query, doSearch]);

  const closeAll = () => { setIsOpen(false); setMobileOpen(false); setQuery(''); setResults(null); };

  const navigateTo = (item: typeof allItems[0]) => {
    closeAll();
    if (item.type === 'alert') navigate(`/alerts/${item.id}`);
    else if (item.type === 'case') navigate(`/cases/${item.id}`);
    else if (item.type === 'task') navigate(`/cases/${(item as any).case_id}?section=tasks&task=${item.id}`);
    else if (item.type === 'comment') navigate(`/cases/${(item as any).case_id}?section=tasks&task=${(item as any).task_id}`);
    else navigate(`/cases/${(item as any).case_id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { closeAll(); return; }
    if (totalResults === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, totalResults - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && selectedIndex >= 0) { e.preventDefault(); navigateTo(allItems[selectedIndex]); }
  };

  const hasResults = results && totalResults > 0;
  const noResults = results && totalResults === 0 && query.trim().length >= 2;

  const renderResults = (mode: 'desktop' | 'mobile') => {
    if (!hasResults && !noResults && !loading) return null;
    return (
      <div className={mode === 'mobile'
        ? "mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto"
        : "absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[420px] overflow-y-auto"
      }>
        {loading && <div className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 text-center">{t('auto.chargement')}</div>}
        {noResults && !loading && <div className="px-4 py-6 text-sm text-gray-500 dark:text-slate-400 text-center">{t('auto.aucun_resultat')}</div>}
        {hasResults && !loading && (
          <>
            {results.cases.filter(c => c.type !== 'alert').length > 0 && (
              <ResultSection icon={FolderOpen} label={t('nav.cases')} color="text-blue-500">
                {results.cases.filter(c => c.type !== 'alert').map((c) => (
                  <ResultItem key={c.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'case' && a.id === c.id)} onClick={() => navigateTo({ ...c, type: 'case' as const })}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 flex-shrink-0">{c.case_number}</span>
                      <span className="text-sm text-gray-800 dark:text-white truncate font-medium">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.severity && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${c.severity.color}20`, color: c.severity.color }}>{c.severity.label}</span>}
                      <StatusBadge status={c.status} />
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {results.cases.filter(c => c.type === 'alert').length > 0 && (
              <ResultSection icon={AlertTriangle} label={t('nav.alerts') || 'Alertes'} color="text-orange-500">
                {results.cases.filter(c => c.type === 'alert').map((c) => (
                  <ResultItem key={c.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'alert' && a.id === c.id)} onClick={() => navigateTo({ ...c, type: 'alert' as const })}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-gray-500 dark:text-slate-400 flex-shrink-0">{c.case_number}</span>
                      <span className="text-sm text-gray-800 dark:text-white truncate font-medium">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.severity && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${c.severity.color}20`, color: c.severity.color }}>{c.severity.label}</span>}
                      <StatusBadge status={c.status} />
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {results.tasks.length > 0 && (
              <ResultSection icon={ClipboardList} label={t('nav.tasks')} color="text-amber-500">
                {results.tasks.map((task) => (
                  <ResultItem key={task.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'task' && a.id === task.id)} onClick={() => navigateTo({ ...task, type: 'task' })}>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-white truncate font-medium block">{task.title}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">{task.case_number} — {task.case_title}</span>
                    </div>
                    <StatusBadge status={task.status} />
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.stixObjects || []).length > 0 && (
              <ResultSection icon={Database} label="Objets STIX" color="text-purple-500">
                {results.stixObjects.map((obj) => (
                  <ResultItem key={obj.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'stix' && a.id === obj.id)} onClick={() => navigateTo({ ...obj, type: 'stix' })}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold">
                          {STIX_TYPE_LABELS[obj.stix_type] || obj.stix_type}
                        </span>
                        <span className="text-sm text-gray-800 dark:text-white truncate font-medium">{obj.name}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-slate-400">{obj.case_number} — {obj.case_title}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.comments || []).length > 0 && (
              <ResultSection icon={MessageSquare} label="Commentaires" color="text-cyan-500">
                {results.comments.map((cm) => (
                  <ResultItem key={cm.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'comment' && a.id === cm.id)} onClick={() => navigateTo({ ...cm, type: 'comment' })}>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-white truncate block">{cm.content || '...'}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">{cm.case_number} · {cm.task_title} · {cm.author_name}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
          </>
        )}
        <div className="hidden sm:flex px-3 py-2 border-t border-gray-100 dark:border-slate-700 items-center gap-3 text-[10px] text-gray-500 dark:text-slate-400">
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-mono">↑↓</kbd> naviguer</span>
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-mono">↵</kbd> ouvrir</span>
          <span><kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-mono">esc</kbd> fermer</span>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ===== MOBILE: icon only ===== */}
      <button
        onClick={() => { setMobileOpen(true); setTimeout(() => mobileInputRef.current?.focus(), 50); }}
        className="lg:hidden p-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
        title={t('auto.rechercher')}
      >
        <Search className="w-5 h-5" />
      </button>

      {/* MOBILE overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={closeAll}>
          <div className="p-4 pt-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 shadow-xl">
              <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <input ref={mobileInputRef} type="text" value={query}
                onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={`${t('auto.rechercher')}...`}
                aria-label={t('auto.rechercher')}
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 outline-none" autoFocus />
              <button onClick={closeAll} aria-label="Fermer la recherche" className="text-gray-500 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            {renderResults('mobile')}
          </div>
        </div>
      )}

      {/* ===== DESKTOP: inline search bar ===== */}
      <div ref={containerRef} className="relative hidden lg:block">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
          isOpen
            ? 'bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30 w-96'
            : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 w-64'
        }`}>
          <Search className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
          <input ref={inputRef} type="text" value={query}
            onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)} onKeyDown={handleKeyDown}
            placeholder={`${t('auto.rechercher')}... (Ctrl+K)`}
            aria-label={t('auto.rechercher')}
            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 outline-none min-w-0" />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); }} aria-label="Effacer la recherche" className="text-gray-500 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {isOpen && renderResults('desktop')}
      </div>
    </>
  );
}

function ResultSection({ icon: Icon, label, color, children }: { icon: typeof FolderOpen; label: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ResultItem({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
        selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
      }`}>{children}</button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isClosed = status === 'closed';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
      isClosed ? 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    }`}>{isClosed ? 'Fermé' : 'Ouvert'}</span>
  );
}
