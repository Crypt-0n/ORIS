import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { KILL_CHAIN_DEFINITIONS, KillChainType, getKillChainPhases } from '../lib/killChainDefinitions';
import { Plus, Trash2, Edit, X, Save, ChevronDown, ChevronRight, Shield, Search } from 'lucide-react';

interface TTP {
  id: string;
  kill_chain_type: string;
  phase_value: string;
  ttp_id: string;
  name: string;
  description: string;
  order: number;
}

export function TtpManagementPanel() {
  const { t } = useTranslation();
  const [killChainType, setKillChainType] = useState<KillChainType>('mitre_attack');
  const [ttps, setTtps] = useState<TTP[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [editingTtp, setEditingTtp] = useState<TTP | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPhase, setAddPhase] = useState('');
  const [formData, setFormData] = useState({ ttp_id: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchTtps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/ttps?kill_chain_type=${killChainType}`);
      setTtps(data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [killChainType]);

  useEffect(() => {
    fetchTtps();
  }, [fetchTtps]);

  const phases = getKillChainPhases(killChainType);

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  };

  const expandAll = () => setExpandedPhases(new Set(phases.map(p => p.value)));
  const collapseAll = () => setExpandedPhases(new Set());

  const getTtpsForPhase = (phaseValue: string) => {
    let filtered = ttps.filter(t => t.phase_value === phaseValue);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.ttp_id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const handleAdd = async () => {
    if (!formData.ttp_id || !formData.name) return;
    setSaving(true);
    try {
      await api.post('/admin/ttps', {
        kill_chain_type: killChainType,
        phase_value: addPhase,
        ...formData,
      });
      await fetchTtps();
      setShowAddModal(false);
      setFormData({ ttp_id: '', name: '', description: '' });
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!editingTtp || !formData.ttp_id || !formData.name) return;
    setSaving(true);
    try {
      await api.put(`/admin/ttps/${editingTtp.id}`, formData);
      await fetchTtps();
      setEditingTtp(null);
      setFormData({ ttp_id: '', name: '', description: '' });
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/ttps/${id}`);
      setTtps(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const openAdd = (phaseValue: string) => {
    setAddPhase(phaseValue);
    setFormData({ ttp_id: '', name: '', description: '' });
    setShowAddModal(true);
    setEditingTtp(null);
  };

  const openEdit = (ttp: TTP) => {
    setEditingTtp(ttp);
    setFormData({ ttp_id: ttp.ttp_id, name: ttp.name, description: ttp.description });
    setShowAddModal(false);
  };

  const totalTtps = ttps.length;
  const filteredTotal = search ? ttps.filter(t => {
    const q = search.toLowerCase();
    return t.ttp_id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  }).length : totalTtps;

  return (
    <div className="space-y-4">
      {/* Kill chain type selector */}
      <div className="flex flex-wrap items-center gap-3">
        {Object.values(KILL_CHAIN_DEFINITIONS).map(def => (
          <button
            key={def.type}
            onClick={() => { setKillChainType(def.type); setExpandedPhases(new Set()); setSearch(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              killChainType === def.type
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {def.label}
          </button>
        ))}
      </div>

      {/* Stats + search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Shield className="w-4 h-4" />
          <span>{search ? `${filteredTotal} / ` : ''}{totalTtps} TTPs</span>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('admin.ttp_search_placeholder') || 'Rechercher un TTP...'}
            className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-slate-200 placeholder-slate-400 w-64"
          />
        </div>
        <button onClick={expandAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {t('admin.ttp_expand_all') || 'Tout déplier'}
        </button>
        <button onClick={collapseAll} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
          {t('admin.ttp_collapse_all') || 'Tout replier'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
          Chargement...
        </div>
      ) : (
        <div className="space-y-2">
          {phases.map(phase => {
            const phaseTtps = getTtpsForPhase(phase.value);
            const isExpanded = expandedPhases.has(phase.value);
            const allPhaseTtps = ttps.filter(t => t.phase_value === phase.value);

            return (
              <div key={phase.value} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePhase(phase.value)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: phase.hexColor }}
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 flex-1 text-left">
                    {phase.label}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {allPhaseTtps.length} TTP{allPhaseTtps.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30">
                    {phaseTtps.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-600 italic py-4 text-center">
                        {search ? 'Aucun résultat' : 'Aucun TTP pour cette phase'}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-slate-700/30">
                        {phaseTtps.map(ttp => (
                          <div key={ttp.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white dark:hover:bg-slate-800/40 transition group">
                            <span
                              className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                              style={{ backgroundColor: `${phase.hexColor}20`, color: phase.hexColor }}
                            >
                              {ttp.ttp_id}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 dark:text-slate-200 font-medium truncate">{ttp.name}</p>
                              {ttp.description && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{ttp.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEdit(ttp); }}
                                className="p-1 text-slate-400 hover:text-blue-500 transition"
                                title="Modifier"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(ttp.id); }}
                                className="p-1 text-slate-400 hover:text-red-500 transition"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700/30">
                      <button
                        onClick={() => openAdd(phase.value)}
                        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un TTP
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Ajouter un TTP — {phases.find(p => p.value === addPhase)?.label}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">ID du TTP *</label>
                <input
                  type="text"
                  value={formData.ttp_id}
                  onChange={e => setFormData(p => ({ ...p, ttp_id: e.target.value }))}
                  placeholder="Ex: T1566, T1059.001"
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Phishing"
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Description optionnelle..."
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-gray-900 dark:hover:text-white transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !formData.ttp_id || !formData.name}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Enregistrement...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTtp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Modifier le TTP
              </h3>
              <button onClick={() => setEditingTtp(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">ID du TTP *</label>
                <input
                  type="text"
                  value={formData.ttp_id}
                  onChange={e => setFormData(p => ({ ...p, ttp_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setEditingTtp(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-gray-900 dark:hover:text-white transition"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving || !formData.ttp_id || !formData.name}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
