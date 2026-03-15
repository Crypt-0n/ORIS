import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Upload,
  Server,
  Calendar,
  FileText,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { useTranslation } from "react-i18next";

interface SystemEntry {
  id: string;
  name: string;
}

interface ExfiltrationEntry {
  id: string;
  case_id: string;
  exfiltration_date: string | null;
  source_system_id: string | null;
  exfil_system_id: string | null;
  destination_system_id: string | null;
  file_name: string;
  file_size: number | null;
  file_size_unit: string;
  content_description: string;
  other_info: string;
  created_at: string;
  source_system?: SystemEntry;
  exfil_system?: SystemEntry;
  destination_system?: SystemEntry;
}

interface ExfiltrationsProps {
  caseId: string;
  isClosed: boolean;
  filterIds?: string[];
}

const FILE_SIZE_UNITS = ['Octets', 'Ko', 'Mo', 'Go', 'To', 'Po'];

export function Exfiltrations({ caseId, isClosed, filterIds }: ExfiltrationsProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ExfiltrationEntry[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState('');
  const [formSourceSystemId, setFormSourceSystemId] = useState('');
  const [formExfilSystemId, setFormExfilSystemId] = useState('');
  const [formDestSystemId, setFormDestSystemId] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileSize, setFormFileSize] = useState('');
  const [formFileSizeUnit, setFormFileSizeUnit] = useState('Octets');
  const [formContentDesc, setFormContentDesc] = useState('');
  const [formOtherInfo, setFormOtherInfo] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchSystems();

    // Since real-time doesn't work out of the box with the basic HTTP API without websockets,
    // we will rely on manual refresh or periodic polling if needed. For now, 
    // it will just refresh on component mount or caseId change.
  }, [caseId]);

  const fetchSystems = async () => {
    try {
      const data = await api.get(`/investigation/systems/by-case/${caseId}`);
      const sorted = (data || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setSystems(sorted);
    } catch { setSystems([]); }
  };

  const fetchEntries = async () => {
    try {
      const data = await api.get(`/investigation/exfiltrations/by-case/${caseId}`);
      const list = (data || []).sort((a: any, b: any) => {
        if (!a.exfiltration_date) return 1;
        if (!b.exfiltration_date) return -1;
        return new Date(b.exfiltration_date).getTime() - new Date(a.exfiltration_date).getTime();
      });

      if (list.length > 0) {
        const sysIds = [...new Set([
          ...list.map((e: any) => e.source_system_id),
          ...list.map((e: any) => e.exfil_system_id),
          ...list.map((e: any) => e.destination_system_id),
        ].filter(Boolean))];

        let systemMap = new Map<string, SystemEntry>();
        if (sysIds.length > 0) {
          try {
            const sysData = await Promise.all(sysIds.map((id) => api.get(`/investigation/systems/${id}`)));
            sysData.filter(Boolean).forEach((s: any) => systemMap.set(s.id, s));
          } catch (err) { console.error(err); }
        }

        const enriched = list.map((e: any) => ({
          ...e,
          source_system: e.source_system_id ? systemMap.get(e.source_system_id) : undefined,
          exfil_system: e.exfil_system_id ? systemMap.get(e.exfil_system_id) : undefined,
          destination_system: e.destination_system_id ? systemMap.get(e.destination_system_id) : undefined,
        }));
        setEntries(filterIds ? enriched.filter((e: any) => filterIds.includes(e.id)) : enriched);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormDate('');
    setFormSourceSystemId('');
    setFormExfilSystemId('');
    setFormDestSystemId('');
    setFormFileName('');
    setFormFileSize('');
    setFormFileSizeUnit('Octets');
    setFormContentDesc('');
    setFormOtherInfo('');
    setFormError('');
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (entry: ExfiltrationEntry) => {
    setFormDate(entry.exfiltration_date ? new Date(entry.exfiltration_date).toISOString().slice(0, 19) : '');
    setFormSourceSystemId(entry.source_system_id || '');
    setFormExfilSystemId(entry.exfil_system_id || '');
    setFormDestSystemId(entry.destination_system_id || '');
    setFormFileName(entry.file_name || '');
    setFormFileSize(entry.file_size != null ? String(entry.file_size) : '');
    setFormFileSizeUnit(entry.file_size_unit || 'Octets');
    setFormContentDesc(entry.content_description || '');
    setFormOtherInfo(entry.other_info || '');
    setEditingId(entry.id);
    setShowForm(true);
    setFormError('');
  };

  const handleSubmit = async () => {
    setSaving(true);
    setFormError('');

    const payload = {
      case_id: caseId,
      exfiltration_date: formDate ? formDate + 'Z' : null,
      source_system_id: formSourceSystemId || null,
      exfil_system_id: formExfilSystemId || null,
      destination_system_id: formDestSystemId || null,
      file_name: formFileName.trim(),
      file_size: formFileSize.trim() ? parseFloat(formFileSize.trim()) : null,
      file_size_unit: formFileSizeUnit,
      content_description: formContentDesc,
      other_info: formOtherInfo,
    };

    try {
      if (editingId) {
        await api.put(`/investigation/exfiltrations/${editingId}`, payload);
      } else {
        await api.post('/investigation/exfiltrations', payload);
      }
      resetForm();
      fetchEntries(); // Refresh list after update/create
    } catch (error) {
      setFormError(editingId ? 'Erreur lors de la mise a jour' : "Erreur lors de l'ajout");
      console.error(error);
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/investigation/exfiltrations/${id}`);
      if (expandedId === id) setExpandedId(null);
      fetchEntries(); // Refresh after deletion
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
    }) + ' UTC';
  };

  const formatFileSize = (size: number | null, unit: string) => {
    if (size == null) return null;
    return `${size.toLocaleString('fr-FR')} ${unit}`;
  };

  const getEntryLabel = (entry: ExfiltrationEntry) => {
    if (entry.file_name) return entry.file_name;
    if (entry.exfiltration_date) return formatDateTime(entry.exfiltration_date);
    return 'Exfiltration';
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {entries.length} {t('auto.exfiltration')}{entries.length !== 1 ? 's' : ''}
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
              {editingId ? "Modifier l'exfiltration" : 'Nouvelle exfiltration'}
            </h4>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded border border-transparent dark:border-red-800">{formError}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
                {t('auto.date_et_heure_utc')}</label>
              <input
                type="datetime-local"
                step="1"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.systeme_exfil')}</label>
                <select
                  value={formExfilSystemId}
                  onChange={(e) => setFormExfilSystemId(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.source_donnees')}</label>
                <select
                  value={formSourceSystemId}
                  onChange={(e) => setFormSourceSystemId(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.destination_18')}</label>
                <select
                  value={formDestSystemId}
                  onChange={(e) => setFormDestSystemId(e.target.value)}
                  className="w-full px-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs bg-white dark:bg-slate-800 dark:text-white"
                >
                  <option value="">{t('auto.aucun')}</option>
                  {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.nom_du_fichier')}</label>
                <input
                  type="text"
                  value={formFileName}
                  onChange={(e) => setFormFileName(e.target.value)}
                  placeholder={t('auto.ex_archive_zip')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.taille')}</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formFileSize}
                    onChange={(e) => setFormFileSize(e.target.value)}
                    placeholder="256"
                    className="flex-1 min-w-0 px-2 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    value={formFileSizeUnit}
                    onChange={(e) => setFormFileSizeUnit(e.target.value)}
                    className="w-16 flex-shrink-0 px-1 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs bg-white dark:bg-slate-800 dark:text-white"
                  >
                    {FILE_SIZE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.description_du_contenu')}</label>
              <RichTextEditor
                value={formContentDesc}
                onChange={setFormContentDesc}
                placeholder={t('auto.description_du_contenu_exfiltr')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">{t('auto.autres_informations')}</label>
              <RichTextEditor
                value={formOtherInfo}
                onChange={setFormOtherInfo}
                placeholder={t('auto.autres_informations_pertinente')}
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
          <Upload className="w-10 h-10 mb-3" />
          <p className="text-sm">{t('auto.aucune_exfiltration_enregistre')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const label = getEntryLabel(entry);
            const fileSize = formatFileSize(entry.file_size, entry.file_size_unit);

            return (
              <div key={entry.id} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 w-full text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-gray-800 dark:text-white text-sm truncate">
                        {label}
                      </span>
                      {fileSize && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700 flex-shrink-0">
                          {fileSize}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {entry.exfiltration_date && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(entry.exfiltration_date)}
                        </p>
                      )}
                      {entry.destination_system && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                          <Server className="w-3 h-3" />
                          {entry.destination_system.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 px-3 sm:px-4 py-3 bg-gray-50/50 dark:bg-slate-800/50 space-y-3">
                    {entry.exfiltration_date && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.date_et_heure')}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{formatDateTime(entry.exfiltration_date)}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {entry.exfil_system && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.systeme_d_exfiltration_19')}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-1">
                            <Server className="w-3.5 h-3.5 text-gray-400" />
                            {entry.exfil_system.name}
                          </p>
                        </div>
                      )}
                      {entry.source_system && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.systeme_source')}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-1">
                            <Server className="w-3.5 h-3.5 text-gray-400" />
                            {entry.source_system.name}
                          </p>
                        </div>
                      )}
                      {entry.destination_system && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.destination_20')}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300 flex items-center gap-1">
                            <Server className="w-3.5 h-3.5 text-orange-500" />
                            {entry.destination_system.name}
                          </p>
                        </div>
                      )}
                    </div>

                    {entry.file_name && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.nom_du_fichier')}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300 font-mono bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          {entry.file_name}
                        </p>
                      </div>
                    )}

                    {fileSize && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.taille')}</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{fileSize}</p>
                      </div>
                    )}

                    {entry.content_description && entry.content_description !== '<p><br></p>' && entry.content_description !== '' && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.description_du_contenu')}</p>
                        <div
                          className="text-sm text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: entry.content_description }}
                        />
                      </div>
                    )}

                    {entry.other_info && entry.other_info !== '<p><br></p>' && entry.other_info !== '' && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.autres_informations')}</p>
                        <div
                          className="text-sm text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 prose prose-sm dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: entry.other_info }}
                        />
                      </div>
                    )}

                    <p className="text-xs text-gray-400 dark:text-slate-400">
                      {t('auto.ajoute_le')}{new Date(entry.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
