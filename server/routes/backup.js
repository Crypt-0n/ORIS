const express = require('express');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../middleware/auth');
const { getDb } = require('../db-arango');
const BaseRepository = require('../repositories/BaseRepository');
const backup = require('../utils/backup');
const { requireAdmin, isAdmin } = require('../utils/access');

const router = express.Router();

// ── Public endpoints (no auth required) ─────────────────────────────
// These are only accessible when NO admin exists (fresh install)
router.get('/can-restore', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        const users = await repo.findWhere({});
        const hasAdmin = users.some(u => isAdmin(u.role));
        res.json({ canRestore: !hasAdmin });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

router.post('/restore', async (req, res) => {
    try {
        const repo = new BaseRepository(getDb(), 'user_profiles');
        const users = await repo.findWhere({});
        const hasAdmin = users.some(u => isAdmin(u.role));
        if (hasAdmin) return res.status(403).json({ error: 'Restore is only available on a fresh server with no admin user' });

        if (!req.files || !req.files.backup) return res.status(400).json({ error: 'No backup file uploaded. Use field name "backup".' });
        const file = req.files.backup;
        if (!file.name.endsWith('.zip')) return res.status(400).json({ error: 'Backup file must be a .zip archive' });

        const tmpPath = path.join(backup.BACKUP_DIR, '_restore_tmp.zip');
        if (!fs.existsSync(backup.BACKUP_DIR)) fs.mkdirSync(backup.BACKUP_DIR, { recursive: true });
        await file.mv(tmpPath);

        await backup.restoreFromBackup(tmpPath);
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        console.error('[Restore] Error:', err);
        res.status(500).json({ error: `Restore failed: ${err.message}` });
    }
});

// ── Authenticated admin endpoints ───────────────────────────────────
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', async (req, res) => {
    try {
        const backups = backup.listBackups();
        const interval = await backup.getBackupInterval();
        const retention = await backup.getRetentionCount();
        res.json({ backups, config: { interval, retention } });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal error' }); }
});

router.post('/', async (req, res) => {
    try {
        const name = await backup.createBackup();
        res.json({ success: true, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Backup failed' }); }
});

router.post('/full', async (req, res) => {
    try {
        const name = await backup.createFullBackup();
        if (!name) return res.status(500).json({ error: 'Full backup failed' });
        res.json({ success: true, name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Full backup failed' }); }
});

router.post('/restore-admin', async (req, res) => {
    try {
        if (!req.files || !req.files.backup) return res.status(400).json({ error: 'No backup file uploaded. Use field name "backup".' });
        const file = req.files.backup;
        if (!file.name.endsWith('.zip')) return res.status(400).json({ error: 'Backup file must be a .zip archive' });

        const tmpPath = path.join(backup.BACKUP_DIR, '_restore_tmp.zip');
        if (!fs.existsSync(backup.BACKUP_DIR)) fs.mkdirSync(backup.BACKUP_DIR, { recursive: true });
        await file.mv(tmpPath);

        await backup.restoreFromBackup(tmpPath);
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

        res.json({ success: true, message: 'Backup restored successfully' });
    } catch (err) {
        console.error('[Restore-Admin] Error:', err);
        res.status(500).json({ error: `Restore failed: ${err.message}` });
    }
});

router.get('/download/:name', (req, res) => {
    const p = backup.getBackupPath(req.params.name);
    if (!p) return res.status(404).json({ error: 'Backup not found' });
    res.download(p, req.params.name);
});

router.delete('/:name', (req, res) => {
    try {
        const ok = backup.deleteBackup(req.params.name);
        if (!ok) return res.status(404).json({ error: 'Backup not found' });
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Delete failed' }); }
});

router.put('/config', async (req, res) => {
    try {
        const { interval, retention } = req.body;
        const db = getDb();
        if (interval !== undefined) {
            await db.query(`UPSERT { key: 'backup_interval_hours' } INSERT { key: 'backup_interval_hours', value: @val } UPDATE { value: @val } IN system_config`, { val: String(interval) });
        }
        if (retention !== undefined) {
            await db.query(`UPSERT { key: 'backup_retention_count' } INSERT { key: 'backup_retention_count', value: @val } UPDATE { value: @val } IN system_config`, { val: String(retention) });
        }
        backup.startScheduler();
        res.json({ success: true });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Config update failed' }); }
});

module.exports = router;
