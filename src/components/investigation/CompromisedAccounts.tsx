import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Trash2,
  Edit3,
  X,
  KeyRound,
  Save,
  ChevronDown,
  ChevronUp,
  Server,
  AlertTriangle,
  Search,
  Check,
} from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { useTranslation } from "react-i18next";

interface SystemEntry {
  id: string;
  name: string;
  has_investigation: boolean;
}

interface LinkedSystem {
  id: string;
  system_id: string;
  name: string;
  has_investigation: boolean;
}

interface AccountEntry {
  id: string;
  case_id: string;
  account_name: string;
  domain: string;
  sid: string;
  privileges: string;
  first_malicious_activity: string | null;
  last_malicious_activity: string | null;
  context: string;
  created_at: string;
  linked_systems: LinkedSystem[];
}

interface CompromisedAccountsProps {
  caseId: string;
  isClosed: boolean;
  onNavigateToSystems?: () => void;
  filterIds?: string[];
}

export function CompromisedAccounts({ caseId, isClosed, onNavigateToSystems, filterIds }: CompromisedAccountsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formAccountName, setFormAccountName] = useState('');
  const [formDomain, setFormDomain] = useState('');
  const [formSid, setFormSid] = useState('');
  const [formPrivileges, setFormPrivileges] = useState('');
  const [formFirstActivity, setFormFirstActivity] = useState('');
  const [formLastActivity, setFormLastActivity] = useState('');
  const [formContext, setFormContext] = useState('');
  const [formSystemIds, setFormSystemIds] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchSystems();
  }, [caseId]);

  const fetchSystems = async () => {
    try {
      const data = await api.get(`/investigation/systems/by-case/${caseId}`);
      if (!data || data.length === 0) {
        setSystems([]);
        return;
      }

      const tasksData = await api.get(`/tasks/by-case/${caseId}`);
      const systemsWithTasks = new Set((tasksData || []).map((t: any) => t.system_id).filter(Boolean));

      setSystems(data.map((s: any) => ({
        ...s,
        has_investigation: systemsWithTasks.has(s.id),
      })));
    } catch (err) { console.error(err); }
  };

  const fetchEntries = async () => {
    try {
      const data = await api.get(`/investigation/accounts/by-case/${caseId}`);
      if (!data || data.length === 0) {
        setEntries([]); setLoading(false); return;
      }

      const linksData = await api.get(`/investigation/account_systems/${caseId}`);
      const tasksData = await api.get(`/tasks/by-case/${caseId}`);
      const systemsWithTasks = new Set((tasksData || []).map((t: any) => t.system_id).filter(Boolean));

      const enriched: AccountEntry[] = data.map((a: any) => {
        const accountLinks = (linksData || []).filter((l: any) => l.account_id === a.id);
        return {
          ...a,
          linked_systems: accountLinks.map((l: any) => ({
            id: l.id,
            system_id: l.system_id,
            name: l.system_name || 'Systeme inconnu',
            has_investigation: systemsWithTasks.has(l.system_id),
          })),
        };
      });
      setEntries(filterIds ? enriched.filter((a: any) => filterIds.includes(a.id)) : enriched);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormAccountName('');
    setFormDomain('');
    setFormSid('');
    setFormPrivileges('');
    setFormFirstActivity('');
    setFormLastActivity('');
    setFormContext('');
    setFormSystemIds([]);
    setFormError('');
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (entry: AccountEntry) => {
    setFormAccountName(entry.account_name);
    setFormDomain(entry.domain);
    setFormSid(entry.sid);
    setFormPrivileges(entry.privileges);
    setFormFirstActivity(entry.first_malicious_activity ? new Date(entry.first_malicious_activity).toISOString().slice(0, 19) : '');
    setFormLastActivity(entry.last_malicious_activity ? new Date(entry.last_malicious_activity).toISOString().slice(0, 19) : '');
    setFormContext(entry.context);
    setFormSystemIds(entry.linked_systems.map(ls => ls.system_id));
    setEditingId(entry.id);
    setShowForm(true);
    setFormError('');
  };

  const toggleSystemSelection = (systemId: string) => {
    setFormSystemIds(prev =>
      prev.includes(systemId)
        ? prev.filter(id => id !== systemId)
        : [...prev, systemId]
    );
  };

  const handleSubmit = async () => {
    if (!formAccountName.trim()) {
      setFormError('Le nom du compte est obligatoire');
      return;
    }

    setSaving(true);
    setFormError('');

    const cleanContext = formContext === '<p><br></p>' ? '' : formContext;

    const payload = {
      case_id: caseId,
      account_name: formAccountName.trim(),
      domain: formDomain.trim(),
      sid: formSid.trim(),
      privileges: formPrivileges.trim(),
      first_malicious_activity: formFirstActivity ? formFirstActivity + 'Z' : null,
      last_malicious_activity: formLastActivity ? formLastActivity + 'Z' : null,
      context: cleanContext,
      created_by: user!.id,
    };

    try {
      let accountId: string | null = null;

      if (editingId) {
        const { created_by: _, case_id: __, ...updatePayload } = payload;
        await api.put(`/investigation/accounts/${editingId}`, updatePayload);
        accountId = editingId;
        await api.delete(`/investigation/account_systems/by-account/${editingId}`);
      } else {
        const data = await api.post('/investigation/accounts', payload);
        accountId = data.id;
      }

      if (formSystemIds.length > 0 && accountId) {
        const systemLinks = formSystemIds.map(systemId => ({
          account_id: accountId!,
          system_id: systemId,
        }));
        await api.post('/investigation/account_systems', systemLinks);
      }

      resetForm();
      fetchEntries();
    } catch (err) {
      setFormError('Erreur lors de la sauvegarde');
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce compte compromis ?')) return;
    try {
      await api.delete(`/investigation/accounts/${id}`);
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

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">{t('auto.chargement')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-slate-400">
          {entries.length} {t('auto.compte')}{entries.length !== 1 ? 's' : ''} {t('auto.compromis')}</span>
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
        <AccountForm
          editingId={editingId}
          systems={systems}
          formAccountName={formAccountName}
          formDomain={formDomain}
          formSid={formSid}
          formPrivileges={formPrivileges}
          formFirstActivity={formFirstActivity}
          formLastActivity={formLastActivity}
          formContext={formContext}
          formSystemIds={formSystemIds}
          formError={formError}
          saving={saving}
          onAccountNameChange={setFormAccountName}
          onDomainChange={setFormDomain}
          onSidChange={setFormSid}
          onPrivilegesChange={setFormPrivileges}
          onFirstActivityChange={setFormFirstActivity}
          onLastActivityChange={setFormLastActivity}
          onContextChange={setFormContext}
          onToggleSystem={toggleSystemSelection}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      )}

      {entries.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-400">
          <KeyRound className="w-10 h-10 mb-3" />
          <p className="text-sm">{t('auto.aucun_compte_compromis_enregis')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <AccountCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              isClosed={isClosed}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onEdit={() => openEditForm(entry)}
              onDelete={() => handleDelete(entry.id)}
              onNavigateToSystems={onNavigateToSystems}
              formatDateTime={formatDateTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AccountFormProps {
  editingId: string | null;
  systems: SystemEntry[];
  formAccountName: string;
  formDomain: string;
  formSid: string;
  formPrivileges: string;
  formFirstActivity: string;
  formLastActivity: string;
  formContext: string;
  formSystemIds: string[];
  formError: string;
  saving: boolean;
  onAccountNameChange: (v: string) => void;
  onDomainChange: (v: string) => void;
  onSidChange: (v: string) => void;
  onPrivilegesChange: (v: string) => void;
  onFirstActivityChange: (v: string) => void;
  onLastActivityChange: (v: string) => void;
  onContextChange: (v: string) => void;
  onToggleSystem: (id: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function AccountForm({
  editingId,
  systems,
  formAccountName,
  formDomain,
  formSid,
  formPrivileges,
  formFirstActivity,
  formLastActivity,
  formContext,
  formSystemIds,
  formError,
  saving,
  onAccountNameChange,
  onDomainChange,
  onSidChange,
  onPrivilegesChange,
  onFirstActivityChange,
  onLastActivityChange,
  onContextChange,
  onToggleSystem,
  onSubmit,
  onCancel,
}: AccountFormProps) {
  const { t } = useTranslation();
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 sm:p-5 bg-gray-50 dark:bg-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
          {editingId ? 'Modifier le compte compromis' : 'Nouveau compte compromis'}
        </h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200">
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
              {t('auto.nom_du_compte_12')}<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formAccountName}
              onChange={(e) => onAccountNameChange(e.target.value)}
              placeholder={t('auto.ex_admin_jdupont')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              {t('auto.domaine')}</label>
            <input
              type="text"
              value={formDomain}
              onChange={(e) => onDomainChange(e.target.value)}
              placeholder={t('auto.ex_corp_local')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              {t('auto.privileges')}</label>
            <input
              type="text"
              value={formPrivileges}
              onChange={(e) => onPrivilegesChange(e.target.value)}
              placeholder={t('auto.ex_domain_admin')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              SID
            </label>
            <input
              type="text"
              value={formSid}
              onChange={(e) => onSidChange(e.target.value)}
              placeholder={t('auto.ex_s_1_5_21')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              {t('auto.premiere_activite_utc')}</label>
            <input
              type="datetime-local"
              step="1"
              value={formFirstActivity}
              onChange={(e) => onFirstActivityChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
              {t('auto.derniere_activite_utc')}</label>
            <input
              type="datetime-local"
              step="1"
              value={formLastActivity}
              onChange={(e) => onLastActivityChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
            {t('auto.utilise_sur')}</label>
          <SystemMultiSelect
            systems={systems}
            selectedIds={formSystemIds}
            onToggle={onToggleSystem}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            {t('auto.contexte')}</label>
          <RichTextEditor
            value={formContext}
            onChange={onContextChange}
            placeholder={t('auto.contexte_de_la_compromission')}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 sm:flex-none px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition dark:text-slate-300"
        >
          {t('auto.annuler')}</button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : editingId ? 'Mettre a jour' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

interface AccountCardProps {
  entry: AccountEntry;
  isExpanded: boolean;
  isClosed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNavigateToSystems?: () => void;
  formatDateTime: (dateStr: string) => string;
}

function AccountCard({
  entry,
  isExpanded,
  isClosed,
  onToggle,
  onEdit,
  onDelete,
  onNavigateToSystems,
  formatDateTime,
}: AccountCardProps) {
  const { t } = useTranslation();
  const uninvestigatedSystems = entry.linked_systems.filter(ls => !ls.has_investigation);

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-3 px-3 sm:px-4 py-3 w-full text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition"
        onClick={onToggle}
      >
        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
          <KeyRound className="w-4 h-4 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-gray-800 dark:text-white text-sm truncate">
              {entry.domain ? `${entry.domain}\\${entry.account_name}` : entry.account_name}
            </span>
            {entry.privileges && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                {entry.privileges}
              </span>
            )}
          </div>
          {entry.linked_systems.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
              <Server className="w-3 h-3" />
              {entry.linked_systems.map(ls => ls.name).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {entry.linked_systems.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-slate-400 mr-1 hidden sm:flex items-center gap-1">
              <Server className="w-3 h-3" />
              {entry.linked_systems.length}
            </span>
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
            {entry.domain && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.domaine')}</p>
                <p className="text-sm text-gray-700 dark:text-slate-300">{entry.domain}</p>
              </div>
            )}
            {entry.sid && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">SID</p>
                <p className="text-sm font-mono text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700 break-all text-xs">
                  {entry.sid}
                </p>
              </div>
            )}
          </div>

          {entry.privileges && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.privileges')}</p>
              <p className="text-sm text-gray-700 dark:text-slate-300">{entry.privileges}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {entry.first_malicious_activity && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.premiere_activite_malveillante')}</p>
                <p className="text-sm text-gray-700 dark:text-slate-300">{formatDateTime(entry.first_malicious_activity)}</p>
              </div>
            )}
            {entry.last_malicious_activity && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.derniere_activite_malveillante')}</p>
                <p className="text-sm text-gray-700 dark:text-slate-300">{formatDateTime(entry.last_malicious_activity)}</p>
              </div>
            )}
          </div>

          {entry.linked_systems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                {t('auto.utilise_sur_13')}{entry.linked_systems.length} {t('auto.systeme')}{entry.linked_systems.length > 1 ? 's' : ''})
              </p>
              <div className="space-y-1">
                {entry.linked_systems.map(ls => (
                  <div
                    key={ls.id}
                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded border border-gray-100 dark:border-slate-700 text-sm"
                  >
                    <Server className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 flex-shrink-0" />
                    <span className="flex-1 truncate text-gray-700 dark:text-slate-300">{ls.name}</span>
                    {ls.has_investigation ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 flex-shrink-0 flex items-center gap-0.5">
                        <Search className="w-3 h-3" />
                        {t('auto.investigation_14')}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex-shrink-0 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {t('auto.non_analyse')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uninvestigatedSystems.length > 0 && !isClosed && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {t('auto.investigation_recommandee')}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {uninvestigatedSystems.length === 1
                    ? `Le systeme ${uninvestigatedSystems[0].name} n'a pas encore fait l'objet d'une investigation.`
                    : `Les systemes ${uninvestigatedSystems.map(s => s.name).join(', ')} n'ont pas encore fait l'objet d'une investigation.`
                  }
                  {' '}{t('auto.il_est_recommande_de_lancer_un')}</p>
                {onNavigateToSystems && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onNavigateToSystems(); }}
                    className="mt-1.5 text-xs text-amber-800 dark:text-amber-300 hover:underline font-medium flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    {t('auto.aller_aux_systemes')}</button>
                )}
              </div>
            </div>
          )}

          {entry.context && entry.context !== '<p><br></p>' && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('auto.contexte')}</p>
              <div
                className="text-sm text-gray-700 dark:text-slate-300 rich-text-content bg-white dark:bg-slate-800 px-3 py-2 rounded border border-gray-100 dark:border-slate-700"
                dangerouslySetInnerHTML={{ __html: entry.context }}
              />
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-slate-400">
            {t('auto.ajoute_le')}{formatDateTime(entry.created_at)}
          </p>

          {!isClosed && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {t('auto.modifier')}</button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
}

interface SystemMultiSelectProps {
  systems: SystemEntry[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

function SystemMultiSelect({ systems, selectedIds, onToggle }: SystemMultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = systems.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedSystems = systems.filter(s => selectedIds.includes(s.id));

  if (systems.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
        {t('auto.aucun_systeme_enregistre_dans_')}</p>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="min-h-[38px] w-full px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 cursor-text flex flex-wrap items-center gap-1.5"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {selectedSystems.map(sys => (
          <span
            key={sys.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 text-xs"
          >
            <Server className="w-3 h-3" />
            {sys.name}
            {!sys.has_investigation && <AlertTriangle className="w-3 h-3 text-amber-500" />}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(sys.id); }}
              className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-200"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={selectedSystems.length === 0 ? 'Rechercher un systeme...' : ''}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 py-0.5"
        />
        <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-500 dark:text-slate-400">{t('auto.aucun_resultat')}</p>
          ) : (
            filtered.map(sys => {
              const selected = selectedIds.includes(sys.id);
              return (
                <button
                  key={sys.id}
                  type="button"
                  onClick={() => onToggle(sys.id)}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm transition ${selected
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-slate-500'
                    }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <Server className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-slate-400" />
                  <span className="flex-1 truncate">{sys.name}</span>
                  {!sys.has_investigation && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex-shrink-0 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      {t('auto.non_analyse')}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
