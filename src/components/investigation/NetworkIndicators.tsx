import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Globe,
  Save,
  ChevronDown,
  ChevronUp,
  Bug,
  Network,
  Link2,
  Clock,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { useTranslation } from "react-i18next";

interface MalwareEntry {
  id: string;
  file_name: string;
}

interface NetworkIndicator {
  id: string;
  case_id: string;
  ip: string | null;
  domain_name: string | null;
  port: number | null;
  url: string | null;
  context: string;
  first_activity: string | null;
  last_activity: string | null;
  malware_id: string | null;
  created_at: string;
  malware?: MalwareEntry;
}

interface NetworkIndicatorsProps {
  caseId: string;
  isClosed: boolean;
  filterIds?: string[];
}

export function NetworkIndicators({ caseId, isClosed, filterIds }: NetworkIndicatorsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [entries, setEntries] = useState<NetworkIndicator[]>([]);
  const [malwareEntries, setMalwareEntries] = useState<MalwareEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formIp, setFormIp] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formPort, setFormPort] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formFirstActivity, setFormFirstActivity] = useState('');
  const [formLastActivity, setFormLastActivity] = useState('');
  const [formMalwareId, setFormMalwareId] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchMalware();
  }, [caseId]);

  const fetchMalware = async () => {
    try {
      const data = await api.get(`/investigation/malware/by-case/${caseId}`);
      setMalwareEntries(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchEntries = async () => {
    try {
      const data = await api.get(`/investigation/indicators/by-case/${caseId}`);
      const list = data || [];
      if (list.length > 0) {
        const malwareIds = [...new Set(list.map((e: any) => e.malware_id).filter(Boolean))];
        if (malwareIds.length > 0) {
          const malwareData = await api.get(`/investigation/malware/by-case/${caseId}`);
          const malwareMap = new Map((malwareData || []).map((m: any) => [m.id, m]));
          const enriched = list.map((e: any) => ({
            ...e,
            malware: e.malware_id ? malwareMap.get(e.malware_id) : undefined,
          }));
          setEntries(filterIds ? enriched.filter((e: any) => filterIds.includes(e.id)) : enriched);
        } else {
          setEntries(filterIds ? list.filter((e: any) => filterIds.includes(e.id)) : list);
        }
      } else {
        setEntries([]);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const resetForm = () => {
    setFormIp('');
    setFormDomain('');
    setFormPort('');
    setFormUrl('');
    setFormContext('');
    setFormFirstActivity('');
    setFormLastActivity('');
    setFormMalwareId('');
    setFormError('');
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (entry: NetworkIndicator) => {
    setFormIp(entry.ip || '');
    setFormDomain(entry.domain_name || '');
    setFormPort(entry.port != null ? String(entry.port) : '');
    setFormUrl(entry.url || '');
    setFormContext(entry.context || '');
    setFormFirstActivity(entry.first_activity ? new Date(entry.first_activity).toISOString().slice(0, 19) : '');
    setFormLastActivity(entry.last_activity ? new Date(entry.last_activity).toISOString().slice(0, 19) : '');
    setFormMalwareId(entry.malware_id || '');
    setEditingId(entry.id);
    setShowForm(true);
    setFormError('');
  };

  const handleSubmit = async () => {
    const hasIp = formIp.trim() !== '';
    const hasDomain = formDomain.trim() !== '';
    const hasUrl = formUrl.trim() !== '';

    if (!hasIp && !hasDomain && !hasUrl) {
      setFormError('Au moins un des champs IP, Nom de domaine ou URL est obligatoire');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      case_id: caseId,
      ip: formIp.trim() || null,
      domain_name: formDomain.trim() || null,
      port: formPort.trim() ? parseInt(formPort.trim(), 10) : null,
      url: formUrl.trim() || null,
      context: formContext,
      first_activity: formFirstActivity ? formFirstActivity + 'Z' : null,
      last_activity: formLastActivity ? formLastActivity + 'Z' : null,
      malware_id: formMalwareId || null,
      created_by: user!.id,
    };

    try {
      if (editingId) {
        const { created_by: _, case_id: __, ...updatePayload } = payload;
        await api.put(`/investigation/indicators/${editingId}`, updatePayload);
        resetForm();
        fetchEntries();
      } else {
        await api.post('/investigation/indicators', payload);
        resetForm();
        fetchEntries();
      }
    } catch (error) {
      setFormError('Erreur lors de la sauvegarde');
      console.error(error);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/investigation/indicators/${id}`);
      if (expandedId === id) setExpandedId(null);
      fetchEntries();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLabel = (entry: NetworkIndicator): string => {
    if (entry.domain_name) return entry.domain_name;
    if (entry.ip) return entry.ip;
    if (entry.url) return entry.url.length > 60 ? entry.url.slice(0, 60) + '...' : entry.url;
    return 'Indicateur';
  };

  const getSubInfo = (entry: NetworkIndicator): string[] => {
    const parts: string[] = [];
    if (entry.domain_name && entry.ip) parts.push(entry.ip);
    if (entry.port != null) parts.push(`Port ${entry.port}`);
    return parts;
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {entries.length} {t('auto.indicateur')}{entries.length !== 1 ? 's' : ''}
        </span>
        {!isClosed && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            {t('auto.ajouter')}</button>
        )}
      </div>

      {showForm && (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-5 bg-gray-50 dark:bg-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
              {editingId ? "Modifier l'indicateur reseau" : 'Nouvel indicateur reseau'}
            </h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-transparent dark:border-red-800">{formError}</p>
          )}

          <div className="space-y-3">
            <p className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
              {t('auto.au_moins_un_des_champs_ip_doma')}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">IP</label>
                <input
                  type="text"
                  value={formIp}
                  onChange={(e) => setFormIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.domaine')}</label>
                <input
                  type="text"
                  value={formDomain}
                  onChange={(e) => setFormDomain(e.target.value)}
                  placeholder={t('auto.malicious_domain_com')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.port')}</label>
                <input
                  type="number"
                  value={formPort}
                  onChange={(e) => setFormPort(e.target.value)}
                  placeholder="443"
                  min="0"
                  max="65535"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.malware_outil')}</label>
                <select
                  value={formMalwareId}
                  onChange={(e) => setFormMalwareId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {malwareEntries.map((m) => (
                    <option key={m.id} value={m.id}>{m.file_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">URL</label>
              <input
                type="text"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder={t('auto.https_malicious_domain_com_pay')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.premiere_activite_utc')}</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={formFirstActivity}
                  onChange={(e) => setFormFirstActivity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.derniere_activite_utc')}</label>
                <input
                  type="datetime-local"
                  step="1"
                  value={formLastActivity}
                  onChange={(e) => setFormLastActivity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.contexte')}</label>
              <RichTextEditor
                value={formContext}
                onChange={setFormContext}
                placeholder={t('auto.contexte_et_details_de_l_indic')}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={resetForm}
              className="flex-1 sm:flex-none px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300"
            >
              {t('auto.annuler')}</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-400">
          <Globe className="w-10 h-10 mb-3" />
          <p className="text-sm">{t('auto.aucun_indicateur_reseau_enregi')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const label = getLabel(entry);
            const subInfo = getSubInfo(entry);

            return (
              <div key={entry.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 w-full text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-white text-sm truncate font-mono">
                        {label}
                      </span>
                      {entry.port != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 flex-shrink-0 font-mono">
                          :{entry.port}
                        </span>
                      )}
                      {entry.malware && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-0.5 flex-shrink-0">
                          <Bug className="w-3 h-3" />
                          {entry.malware.file_name}
                        </span>
                      )}
                    </div>
                    {subInfo.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                        {subInfo.map((info, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i === 0 && <Network className="w-3 h-3" />}
                            {info}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(entry.first_activity || entry.last_activity) && (
                      <Clock className="w-3 h-3 text-gray-400 dark:text-slate-400 mr-1 hidden sm:block" />
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 px-3 sm:px-4 py-3 bg-gray-50/50 dark:bg-slate-800/50 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {entry.ip && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">IP</p>
                          <p className="text-sm font-mono text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700">
                            {entry.ip}
                          </p>
                        </div>
                      )}
                      {entry.domain_name && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.nom_de_domaine')}</p>
                          <p className="text-sm font-mono text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700">
                            {entry.domain_name}
                          </p>
                        </div>
                      )}
                    </div>

                    {entry.port != null && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.port')}</p>
                        <p className="text-sm font-mono text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 inline-block">
                          {entry.port}
                        </p>
                      </div>
                    )}

                    {entry.url && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          URL
                        </p>
                        <p className="text-sm font-mono text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 break-all text-xs">
                          {entry.url}
                        </p>
                      </div>
                    )}

                    {entry.context && entry.context !== '<p><br></p>' && entry.context !== '' && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.contexte')}</p>
                        <div
                          className="text-sm text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: entry.context }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {entry.first_activity && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.premiere_activite')}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{formatDateTime(entry.first_activity)}</p>
                        </div>
                      )}
                      {entry.last_activity && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.derniere_activite')}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{formatDateTime(entry.last_activity)}</p>
                        </div>
                      )}
                    </div>

                    {entry.malware && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.malware_outil')}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Bug className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                          {entry.malware.file_name}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      {t('auto.ajoute_le')}{formatDateTime(entry.created_at)}
                    </p>

                    {!isClosed && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditForm(entry); }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {t('auto.modifier')}</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                          className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('auto.supprimer')}</button>
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
