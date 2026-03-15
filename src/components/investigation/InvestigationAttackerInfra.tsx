import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus, Trash2, Edit3, X, Save, Skull, Globe, ChevronDown, ChevronUp, Network, Server, Wifi, Cloud, Radio, HardDrive, HelpCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface IpEntry { ip: string; mask: string; gateway: string; }

interface AttackerInfraEntry {
  id: string;
  case_id: string;
  name: string;
  infra_type: string;
  ip_addresses: IpEntry[];
  network_indicator_id: string | null;
  description: string;
  network_indicator?: { id: string; ip: string | null; domain_name: string | null; port: number | null; url: string | null; };
  created_at: string;
}

interface Props {
  caseId: string;
  isClosed: boolean;
}

const INFRA_TYPES = [
  { value: 'c2_server', label: 'Serveur C2', icon: Server },
  { value: 'vpn', label: 'VPN', icon: Wifi },
  { value: 'relay', label: 'Relais / Proxy', icon: Radio },
  { value: 'phishing_server', label: 'Serveur de phishing', icon: Globe },
  { value: 'exfil_server', label: "Serveur d'exfiltration", icon: HardDrive },
  { value: 'hosting', label: 'Hébergement', icon: Cloud },
  { value: 'domain_registrar', label: 'Registrar / DNS', icon: Globe },
  { value: 'autre', label: 'Autre', icon: HelpCircle },
] as const;

function getInfraTypeConfig(type: string) {
  return INFRA_TYPES.find(t => t.value === type) || INFRA_TYPES[INFRA_TYPES.length - 1];
}

function getIndicatorLabel(ind: { ip: string | null; domain_name: string | null; url: string | null }): string {
  if (ind.domain_name) return ind.domain_name;
  if (ind.ip) return ind.ip;
  if (ind.url) return ind.url.length > 50 ? ind.url.slice(0, 50) + '...' : ind.url;
  return 'Indicateur';
}

const EMPTY_IP: IpEntry = { ip: '', mask: '', gateway: '' };

export function InvestigationAttackerInfra({ caseId, isClosed }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<AttackerInfraEntry[]>([]);
  const [networkIndicators, setNetworkIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formIps, setFormIps] = useState<IpEntry[]>([{ ...EMPTY_IP }]);
  const [formNetworkIndicatorId, setFormNetworkIndicatorId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, [caseId]);

  const fetchAll = async () => {
    try {
      const [infraData, indData] = await Promise.all([
        api.get(`/investigation/attacker-infra/by-case/${caseId}`),
        api.get(`/investigation/indicators/by-case/${caseId}`),
      ]);
      const indicatorMap = new Map<string, any>();
      (indData || []).forEach((ind: any) => indicatorMap.set(ind.id, ind));

      const enriched = (infraData || []).map((item: any) => ({
        ...item,
        ip_addresses: typeof item.ip_addresses === 'string' ? JSON.parse(item.ip_addresses) : (item.ip_addresses || []),
        network_indicator: item.network_indicator_id ? indicatorMap.get(item.network_indicator_id) : undefined,
      }));
      setItems(enriched);
      setNetworkIndicators(indData || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const resetForm = () => {
    setFormName(''); setFormType(''); setFormIps([{ ...EMPTY_IP }]);
    setFormNetworkIndicatorId(''); setFormDescription('');
    setFormError(''); setEditingId(null); setShowForm(false);
  };

  const openEdit = (item: AttackerInfraEntry) => {
    setFormName(item.name);
    setFormType(item.infra_type);
    setFormIps(item.ip_addresses?.length > 0 ? item.ip_addresses : [{ ...EMPTY_IP }]);
    setFormNetworkIndicatorId(item.network_indicator_id || '');
    setFormDescription(item.description || '');
    setEditingId(item.id);
    setShowForm(true);
    setFormError('');
  };

  const handleSubmit = async () => {
    if (!formName.trim()) { setFormError(t('auto.nom') + ' obligatoire'); return; }
    if (!formType) { setFormError(t('auto.type') + ' obligatoire'); return; }
    setSaving(true); setFormError('');

    const cleanedIps = formIps.filter(ip => ip.ip.trim() !== '');
    const payload = {
      case_id: caseId,
      name: formName.trim(),
      infra_type: formType,
      ip_addresses: cleanedIps,
      network_indicator_id: formNetworkIndicatorId || null,
      description: formDescription.trim(),
      created_by: user!.id,
    };

    try {
      if (editingId) {
        const { created_by: _, case_id: __, ...updatePayload } = payload;
        await api.put(`/investigation/attacker-infra/${editingId}`, updatePayload);
      } else {
        await api.post('/investigation/attacker-infra', payload);
      }
      resetForm(); fetchAll();
    } catch (error) { setFormError('Erreur lors de la sauvegarde'); console.error(error); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/investigation/attacker-infra/${id}`);
      if (expandedId === id) setExpandedId(null);
      fetchAll();
    } catch (error) { console.error(error); }
  };

  const handleIpChange = (index: number, field: keyof IpEntry, value: string) => {
    const updated = [...formIps];
    updated[index] = { ...updated[index], [field]: value };
    setFormIps(updated);
  };

  if (loading) return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {items.length} {t('auto.infra_attaquant_count') || "infrastructure(s)"}
        </span>
        {!isClosed && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t('auto.ajouter')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-5 bg-gray-50 dark:bg-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
              {editingId ? (t('auto.modifier_infra') || "Modifier l'infrastructure") : (t('auto.nouvelle_infra') || "Nouvelle infrastructure")}
            </h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-transparent dark:border-red-800">{formError}</p>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                  {t('auto.nom')}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: C2 CobaltStrike"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                  {t('auto.type')}<span className="text-red-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.s_lectionner_un_type')}</option>
                  {INFRA_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                {t('auto.description') || 'Description'}
              </label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Notes, observations..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {t('auto.indicateur_reseau') || 'Indicateur réseau'}
              </label>
              {networkIndicators.length > 0 ? (
                <select
                  value={formNetworkIndicatorId}
                  onChange={e => setFormNetworkIndicatorId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {networkIndicators.map(ind => (
                    <option key={ind.id} value={ind.id}>
                      {getIndicatorLabel(ind)}{ind.port != null ? ` :${ind.port}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
                  {t('auto.aucun_indicateur_reseau_dispon')}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400">{t('auto.adresses_ip')}</label>
                <button
                  type="button"
                  onClick={() => setFormIps([...formIps, { ...EMPTY_IP }])}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {t('auto.ajouter_une_ip')}
                </button>
              </div>
              <div className="space-y-2">
                {formIps.map((ipEntry, index) => (
                  <div key={index} className="relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                    {formIps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormIps(formIps.filter((_, i) => i !== index))}
                        className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.adresse_ip')}</label>
                      <input
                        type="text" value={ipEntry.ip} onChange={e => handleIpChange(index, 'ip', e.target.value)}
                        placeholder="185.100.25.3"
                        className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.masque')}</label>
                        <input
                          type="text" value={ipEntry.mask} onChange={e => handleIpChange(index, 'mask', e.target.value)}
                          placeholder="/32"
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">{t('auto.passerelle')}</label>
                        <input
                          type="text" value={ipEntry.gateway} onChange={e => handleIpChange(index, 'gateway', e.target.value)}
                          placeholder="—"
                          className="w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={resetForm} className="flex-1 sm:flex-none px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300">
              {t('auto.annuler')}
            </button>
            <button
              onClick={handleSubmit} disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? t('auto.sauvegarde') : editingId ? (t('auto.modifier') || 'Modifier') : (t('auto.enregistrer') || 'Enregistrer')}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-400">
          <Skull className="w-10 h-10 mb-3" />
          <p className="text-sm">{t('auto.aucune_infra_attaquant') || "Aucune infrastructure attaquant enregistrée"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const config = getInfraTypeConfig(item.infra_type);
            const Icon = config.icon;
            const isExpanded = expandedId === item.id;
            const hasIps = item.ip_addresses?.length > 0 && item.ip_addresses.some(ip => ip.ip.trim() !== '');

            return (
              <div key={item.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 w-full text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-white text-sm truncate">{item.name}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full flex-shrink-0 border border-red-200 dark:border-red-800">
                        {config.label}
                      </span>
                      {item.network_indicator && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800 flex-shrink-0">
                          <Globe className="w-3 h-3" />
                          {getIndicatorLabel(item.network_indicator)}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasIps && (
                      <span className="text-xs text-gray-400 dark:text-slate-400 mr-1 hidden sm:flex items-center gap-1">
                        <Network className="w-3 h-3" />
                        {item.ip_addresses.filter(ip => ip.ip.trim() !== '').length}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 px-3 sm:px-4 py-3 bg-gray-50/50 dark:bg-slate-800/50 space-y-3">
                    {hasIps && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">{t('auto.adresses_ip')}</p>
                        <div className="space-y-1.5">
                          {item.ip_addresses
                            .filter(ip => ip.ip.trim() !== '')
                            .map((ip, i) => (
                              <div key={i} className="text-sm font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700">
                                <span className="text-gray-800 dark:text-white">{ip.ip}</span>
                                {ip.mask && <span className="text-gray-500 dark:text-slate-400 ml-1">{ip.mask}</span>}
                                {ip.gateway && <span className="block sm:inline sm:ml-3 text-gray-400 dark:text-slate-400 text-xs mt-0.5 sm:mt-0">GW: {ip.gateway}</span>}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {item.description && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.description')}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{item.description}</p>
                      </div>
                    )}

                    {item.network_indicator && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {t('auto.indicateur_reseau_lie')}
                        </p>
                        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 rounded border border-teal-200 dark:border-teal-800 text-sm">
                          <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                          <span className="flex-1 truncate font-mono text-gray-700 dark:text-slate-300">
                            {getIndicatorLabel(item.network_indicator)}
                          </span>
                          {item.network_indicator.port != null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 flex-shrink-0 font-mono">
                              :{item.network_indicator.port}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {!isClosed && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition text-gray-700 dark:text-slate-300"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {t('auto.modifier')}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette infrastructure ?')) handleDelete(item.id); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('auto.supprimer')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
