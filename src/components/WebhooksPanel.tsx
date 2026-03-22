import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Zap, X, Check, Copy } from 'lucide-react';
import { api } from '../lib/api';

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
  created_at: string;
  last_triggered_at: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  '*': 'Tous les événements',
  case_created: 'Dossier créé',
  case_closed: 'Dossier fermé',
  case_reopened: 'Dossier réouvert',
  case_updated: 'Dossier modifié',
  task_created: 'Tâche créée',
  task_closed: 'Tâche fermée',
  task_reopened: 'Tâche réouverte',
  task_updated: 'Tâche modifiée',
  comment_added: 'Commentaire ajouté',
  assignment_added: 'Intervenant ajouté',
  assignment_removed: 'Intervenant retiré',
};

export function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WebhookItem | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const [form, setForm] = useState({ name: '', url: '', events: ['*'] as string[], secret: '' });

  useEffect(() => { fetchWebhooks(); }, []);

  const fetchWebhooks = async () => {
    try {
      const data = await api.get('/webhooks');
      setWebhooks(data.webhooks || []);
      setAvailableEvents(data.availableEvents || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveWebhook = async () => {
    try {
      if (editing) {
        await api.put(`/webhooks/${editing.id}`, form);
      } else {
        await api.post('/webhooks', form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', url: '', events: ['*'], secret: '' });
      fetchWebhooks();
    } catch (err) { console.error(err); }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Supprimer ce webhook ?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      fetchWebhooks();
    } catch (err) { console.error(err); }
  };

  const toggleWebhook = async (wh: WebhookItem) => {
    try {
      await api.put(`/webhooks/${wh.id}`, { enabled: !wh.enabled });
      fetchWebhooks();
    } catch (err) { console.error(err); }
  };

  const testWebhook = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const result = await api.post(`/webhooks/${id}/test`, {});
      setTestResult({ id, ok: result.success, msg: `${result.status} ${result.statusText}` });
    } catch (err: any) {
      setTestResult({ id, ok: false, msg: err.message || 'Échec' });
    } finally { setTesting(null); }
  };

  const openEdit = (wh: WebhookItem) => {
    const events = JSON.parse(wh.events || '["*"]');
    setForm({ name: wh.name, url: wh.url, events, secret: wh.secret || '' });
    setEditing(wh);
    setShowForm(true);
  };

  const openNew = () => {
    setForm({ name: '', url: '', events: ['*'], secret: '' });
    setEditing(null);
    setShowForm(true);
  };

  const toggleEvent = (ev: string) => {
    if (ev === '*') {
      setForm({ ...form, events: ['*'] });
      return;
    }
    let newEvents = form.events.filter(e => e !== '*');
    if (newEvents.includes(ev)) {
      newEvents = newEvents.filter(e => e !== ev);
    } else {
      newEvents.push(ev);
    }
    if (newEvents.length === 0) newEvents = ['*'];
    setForm({ ...form, events: newEvents });
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-white flex items-center gap-2">
          <Webhook className="w-4 h-4 text-blue-500" />
          Webhooks ({webhooks.length})
        </h3>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-8 text-center">
          <Webhook className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Aucun webhook configuré</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => {
            const events = JSON.parse(wh.events || '["*"]');
            return (
              <div key={wh.id} className={`bg-white dark:bg-slate-900 rounded-lg border p-4 ${
                wh.enabled ? 'border-gray-200 dark:border-slate-700' : 'border-gray-100 dark:border-slate-800 opacity-60'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-800 dark:text-white">{wh.name}</span>
                      {wh.secret && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium">HMAC</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-mono truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {events.map((ev: string) => (
                        <span key={ev} className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                          {EVENT_LABELS[ev] || ev}
                        </span>
                      ))}
                    </div>
                    {wh.last_triggered_at && (
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">Dernier envoi : {fmtDate(wh.last_triggered_at)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => testWebhook(wh.id)} title="Tester" disabled={testing === wh.id}
                      className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition">
                      {testing === wh.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    </button>
                    <button onClick={() => toggleWebhook(wh)} title={wh.enabled ? 'Désactiver' : 'Activer'}
                      className="p-1.5 text-gray-400 hover:text-blue-500 transition">
                      {wh.enabled ? <ToggleRight className="w-5 h-5 text-blue-500" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => openEdit(wh)} title="Modifier"
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteWebhook(wh.id)} title="Supprimer"
                      className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {testResult?.id === wh.id && (
                  <div className={`mt-2 text-xs px-3 py-1.5 rounded-lg ${
                    testResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  }`}>
                    {testResult.ok ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
                    {testResult.msg}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
              {editing ? 'Modifier le webhook' : 'Nouveau webhook'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Nom</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg" placeholder="Mon webhook Slack" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">URL</label>
                <input value={form.url} onChange={e => setForm({...form, url: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg font-mono text-xs" placeholder="https://hooks.slack.com/..." />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Secret HMAC (optionnel)</label>
                <input value={form.secret} onChange={e => setForm({...form, secret: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg font-mono text-xs" placeholder="whsec_..." />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Événements</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <button onClick={() => toggleEvent('*')}
                    className={`text-xs px-2 py-1 rounded-lg border transition ${
                      form.events.includes('*') ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400'
                    }`}>Tous</button>
                  {availableEvents.map(ev => (
                    <button key={ev} onClick={() => toggleEvent(ev)}
                      className={`text-xs px-2 py-1 rounded-lg border transition ${
                        form.events.includes(ev) && !form.events.includes('*')
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400'
                      }`}>{EVENT_LABELS[ev] || ev}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={saveWebhook} disabled={!form.name || !form.url}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 text-sm">
                {editing ? 'Modifier' : 'Créer'}
              </button>
              <button onClick={() => { setShowForm(false); setEditing(null); }}
                className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
