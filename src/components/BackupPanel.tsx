import { useState, useEffect } from 'react';
import { Download, Trash2, RefreshCw, Loader2, HardDrive, Save, Archive, Upload } from 'lucide-react';
import { api } from '../lib/api';

interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

export function BackupPanel() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [interval, setInterval_] = useState(24);
  const [retention, setRetention] = useState(7);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingFull, setCreatingFull] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => { fetchBackups(); }, []);

  const fetchBackups = async () => {
    try {
      const data = await api.get('/backup');
      setBackups(data.backups || []);
      setInterval_(data.config?.interval || 24);
      setRetention(data.config?.retention || 7);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      await api.post('/backup', {});
      setTimeout(fetchBackups, 1000); // Give it a second to finish
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const deleteBackup = async (name: string) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    try {
      await api.delete(`/backup/${name}`);
      fetchBackups();
    } catch (err) { console.error(err); }
  };

  const downloadBackup = (name: string) => {
    const token = localStorage.getItem('oris_token');
    const a = document.createElement('a');
    a.href = `/api/backup/download/${name}?token=${token}`;
    a.download = name;
    a.click();
  };

  const createFullBackup = async () => {
    setCreatingFull(true);
    try {
      const data = await api.post('/backup/full', {});
      if (data.name) {
        downloadBackup(data.name);
        setTimeout(fetchBackups, 1000);
      }
    } catch (err) { console.error(err); }
    finally { setCreatingFull(false); }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.put('/backup/config', { interval: interval, retention });
    } catch (err) { console.error(err); }
    finally { setSavingConfig(false); }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1048576).toFixed(1)} Mo`;
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-white mb-4 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-500" />
          Configuration des sauvegardes
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Intervalle (heures)</label>
            <select value={interval} onChange={e => setInterval_(Number(e.target.value))}
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg dark:text-white">
              {[1, 2, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">Rétention (nb backups)</label>
            <select value={retention} onChange={e => setRetention(Number(e.target.value))}
              className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg dark:text-white">
              {[3, 5, 7, 10, 14, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button onClick={saveConfig} disabled={savingConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      </div>

      {/* Backup list */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-white">
            Sauvegardes ({backups.length})
          </h3>
           <div className="flex flex-wrap gap-2">
            <button onClick={fetchBackups}
              className="p-2 text-gray-500 hover:text-gray-600 dark:hover:text-slate-300 transition">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={createBackup} disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
              BDD seule
            </button>
            <button onClick={createFullBackup} disabled={creatingFull}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {creatingFull ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              Complète (BDD + fichiers)
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition cursor-pointer disabled:opacity-50">
              {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Importer (.zip)
              <input type="file" accept=".zip" className="hidden" disabled={restoring} onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm('⚠️ Cela va écraser toutes les données actuelles. Continuer ?')) { e.target.value = ''; return; }
                setRestoring(true); setRestoreMsg('');
                try {
                  const formData = new FormData();
                  formData.append('backup', file);
                  const resp = await fetch('/api/backup/restore-admin', {
                    method: 'POST', body: formData,
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('oris_token')}` }
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Restore failed');
                  setRestoreMsg('✅ Restauration réussie ! Rechargez la page.');
                  fetchBackups();
                } catch (err) {
                  setRestoreMsg(`❌ ${err instanceof Error ? err.message : 'Erreur'}`);
                } finally { setRestoring(false); e.target.value = ''; }
              }} />
            </label>
          </div>
          {restoreMsg && <p className={`mt-2 text-sm px-5 ${restoreMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>{restoreMsg}</p>}
        </div>

        {backups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Aucune sauvegarde</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {backups.map(b => (
              <div key={b.name} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white font-mono text-xs">{b.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    {fmtDate(b.created_at)} — {fmtSize(b.size)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => downloadBackup(b.name)} title="Télécharger"
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteBackup(b.name)} title="Supprimer"
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
