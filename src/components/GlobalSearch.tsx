import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FolderOpen, ClipboardList, Server, Globe, X, Bug, UserX, FileOutput, Skull, MessageSquare, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { KILL_CHAIN_DEFINITIONS } from '../lib/killChainDefinitions';

// Build a flat map: kill chain value → label across all definitions
const killChainLabelMap: Record<string, string> = {};
for (const def of Object.values(KILL_CHAIN_DEFINITIONS)) {
  for (const phase of def.phases) {
    if (!killChainLabelMap[phase.value]) killChainLabelMap[phase.value] = phase.label;
  }
}

const infraTypeLabels: Record<string, string> = {
  c2_server: 'Serveur C2', proxy: 'Proxy', vpn: 'VPN', hosting: 'Hébergement',
  domain: 'Domaine', email: 'Email', cdn: 'CDN', dns: 'DNS', other: 'Autre',
};

interface SearchResults {
  cases: Array<{ id: string; case_number: string; title: string; status: string; severity?: { label: string; color: string } }>;
  tasks: Array<{ id: string; case_id: string; title: string; status: string; case_number: string; case_title: string }>;
  systems: Array<{ id: string; case_id: string; name: string; system_type: string; case_number: string }>;
  indicators: Array<{ id: string; case_id: string; value: string; iocType: string; case_number: string }>;
  malware: Array<{ id: string; case_id: string; file_name: string; file_path: string; is_malicious: boolean; case_number: string; case_title: string }>;
  accounts: Array<{ id: string; case_id: string; label: string; privileges: string; case_number: string; case_title: string }>;
  exfiltrations: Array<{ id: string; case_id: string; file_name: string; file_size: string | null; case_number: string; case_title: string }>;
  attackerInfra: Array<{ id: string; case_id: string; name: string; infra_type: string; case_number: string; case_title: string }>;
  comments: Array<{ id: string; case_id: string; task_id: string; content: string; task_title: string; case_number: string; case_title: string; author_name: string }>;
  events: Array<{ id: string; case_id: string; description: string; event_datetime: string; kill_chain: string; case_number: string; case_title: string }>;
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

  const allItems = results ? [
    ...results.cases.map(c => ({ ...c, type: 'case' as const })),
    ...results.tasks.map(t => ({ ...t, type: 'task' as const })),
    ...results.systems.map(s => ({ ...s, type: 'system' as const })),
    ...results.indicators.map(i => ({ ...i, type: 'indicator' as const })),
    ...(results.malware || []).map(m => ({ ...m, type: 'malware' as const })),
    ...(results.accounts || []).map(a => ({ ...a, type: 'account' as const })),
    ...(results.exfiltrations || []).map(e => ({ ...e, type: 'exfiltration' as const })),
    ...(results.attackerInfra || []).map(ai => ({ ...ai, type: 'attackerInfra' as const })),
    ...(results.comments || []).map(cm => ({ ...cm, type: 'comment' as const })),
    ...(results.events || []).map(ev => ({ ...ev, type: 'event' as const })),
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
    if (q.trim().length < 2) { setResults({ cases: [], tasks: [], systems: [], indicators: [], malware: [], accounts: [], exfiltrations: [], attackerInfra: [], comments: [], events: [] }); return; }
    setLoading(true);
    try {
      const data = await api.get(`/search?q=${encodeURIComponent(q.trim())}`);
      setResults(data);
      setSelectedIndex(-1);
    } catch { setResults({ cases: [], tasks: [], systems: [], indicators: [], malware: [], accounts: [], exfiltrations: [], attackerInfra: [], comments: [], events: [] }); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const closeAll = () => { setIsOpen(false); setMobileOpen(false); setQuery(''); setResults(null); };

  const navigateTo = (item: typeof allItems[0]) => {
    closeAll();
    if (item.type === 'case') navigate(`/cases/${item.id}`);
    else if (item.type === 'task') navigate(`/cases/${(item as any).case_id}?section=tasks&task=${item.id}`);
    else if (item.type === 'comment') navigate(`/cases/${(item as any).case_id}?section=tasks&task=${(item as any).task_id}`);
    else if (item.type === 'event') navigate(`/cases/${(item as any).case_id}?section=diamond_model`);
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
        {loading && <div className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500 text-center">{t('auto.chargement')}</div>}
        {noResults && !loading && <div className="px-4 py-6 text-sm text-gray-400 dark:text-slate-500 text-center">{t('auto.aucun_resultat')}</div>}
        {hasResults && !loading && (
          <>
            {results.cases.length > 0 && (
              <ResultSection icon={FolderOpen} label={t('nav.cases')} color="text-blue-500">
                {results.cases.map((c) => (
                  <ResultItem key={c.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'case' && a.id === c.id)} onClick={() => navigateTo({ ...c, type: 'case' })}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-gray-400 dark:text-slate-500 flex-shrink-0">{c.case_number}</span>
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
                      <span className="text-xs text-gray-400 dark:text-slate-500">{task.case_number} — {task.case_title}</span>
                    </div>
                    <StatusBadge status={task.status} />
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {results.systems.length > 0 && (
              <ResultSection icon={Server} label="Systèmes" color="text-teal-500">
                {results.systems.map((sys) => (
                  <ResultItem key={sys.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'system' && a.id === sys.id)} onClick={() => navigateTo({ ...sys, type: 'system' })}>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-white truncate font-medium block">{sys.name}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{sys.case_number} · {sys.system_type}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {results.indicators.length > 0 && (
              <ResultSection icon={Globe} label="IOCs" color="text-red-500">
                {results.indicators.map((ioc) => (
                  <ResultItem key={ioc.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'indicator' && a.id === ioc.id)} onClick={() => navigateTo({ ...ioc, type: 'indicator' })}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-mono font-bold">{ioc.iocType}</span>
                        <span className="text-sm text-gray-800 dark:text-white truncate font-mono">{ioc.value}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{ioc.case_number}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.malware || []).length > 0 && (
              <ResultSection icon={Bug} label="Malware / Outils" color="text-orange-500">
                {results.malware.map((mal) => (
                  <ResultItem key={mal.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'malware' && a.id === mal.id)} onClick={() => navigateTo({ ...mal, type: 'malware' })}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {mal.is_malicious && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">Malveillant</span>}
                        <span className="text-sm text-gray-800 dark:text-white truncate font-medium">{mal.file_name}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{mal.case_number}{mal.file_path ? ` · ${mal.file_path}` : ''}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.accounts || []).length > 0 && (
              <ResultSection icon={UserX} label="Comptes compromis" color="text-purple-500">
                {results.accounts.map((acc) => (
                  <ResultItem key={acc.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'account' && a.id === acc.id)} onClick={() => navigateTo({ ...acc, type: 'account' })}>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-white truncate font-medium font-mono block">{acc.label}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{acc.case_number}{acc.privileges ? ` · ${acc.privileges}` : ''}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.exfiltrations || []).length > 0 && (
              <ResultSection icon={FileOutput} label="Exfiltrations" color="text-yellow-500">
                {results.exfiltrations.map((exf) => (
                  <ResultItem key={exf.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'exfiltration' && a.id === exf.id)} onClick={() => navigateTo({ ...exf, type: 'exfiltration' })}>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-white truncate font-medium block">{exf.file_name || 'Exfiltration'}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{exf.case_number}{exf.file_size ? ` · ${exf.file_size}` : ''}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.attackerInfra || []).length > 0 && (
              <ResultSection icon={Skull} label="Infra. attaquant" color="text-rose-500">
                {results.attackerInfra.map((ai) => (
                  <ResultItem key={ai.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'attackerInfra' && a.id === ai.id)} onClick={() => navigateTo({ ...ai, type: 'attackerInfra' })}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-bold">{infraTypeLabels[ai.infra_type] || ai.infra_type}</span>
                        <span className="text-sm text-gray-800 dark:text-white truncate font-medium">{ai.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{ai.case_number}</span>
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
                      <span className="text-xs text-gray-400 dark:text-slate-500">{cm.case_number} · {cm.task_title} · {cm.author_name}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
            {(results.events || []).length > 0 && (
              <ResultSection icon={Calendar} label="Événements" color="text-indigo-500">
                {results.events.map((ev) => (
                  <ResultItem key={ev.id} selected={selectedIndex === allItems.findIndex(a => a.type === 'event' && a.id === ev.id)} onClick={() => navigateTo({ ...ev, type: 'event' })}>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 dark:text-white truncate block">{ev.description || killChainLabelMap[ev.kill_chain] || ev.kill_chain || '...'}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">{ev.case_number} · {ev.event_datetime}</span>
                    </div>
                  </ResultItem>
                ))}
              </ResultSection>
            )}
          </>
        )}
        <div className="hidden sm:flex px-3 py-2 border-t border-gray-100 dark:border-slate-700 items-center gap-3 text-[10px] text-gray-400 dark:text-slate-500">
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
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input ref={mobileInputRef} type="text" value={query}
                onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={`${t('auto.rechercher')}...`}
                className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 outline-none" autoFocus />
              <button onClick={closeAll} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
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
          <Search className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input ref={inputRef} type="text" value={query}
            onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)} onKeyDown={handleKeyDown}
            placeholder={`${t('auto.rechercher')}... (Ctrl+K)`}
            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-300 placeholder-gray-400 outline-none min-w-0" />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); }} className="text-gray-400 hover:text-gray-600">
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
