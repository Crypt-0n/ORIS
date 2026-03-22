const fs = require('fs');
const path = require('path');
const { getDb } = require('../db-arango');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'data', 'backups');

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Dump all mapped collections in ArangoDB to a single JSON string.
 */
async function arangoDump() {
    const db = getDb();
    const collections = ['cases', 'tasks', 'task_files', 'task_results', 'case_events', 'case_systems', 'case_malware_tools', 'case_network_indicators', 'case_compromised_accounts', 'case_compromised_account_systems', 'case_exfiltrations', 'case_diamond_overrides', 'case_diamond_node_order', 'case_graph_layouts', 'case_attacker_infra', 'case_assignments', 'case_audit_log', 'user_profiles', 'beneficiaries', 'beneficiary_members', 'severities', 'notifications', 'comments', 'comment_attachments', 'api_tokens', 'login_history', 'kill_chain_ttps', 'webhooks', 'push_subscriptions', 'system_config', 'stix_objects', 'stix_relationships'];

    const dumpData = {};
    for (const collName of collections) {
        try {
            const cursor = await db.query(`FOR doc IN @@coll RETURN doc`, { '@coll': collName });
            dumpData[collName] = await cursor.all();
        } catch (err) {
            // Collection might not exist yet, skip
        }
    }
    return JSON.stringify(dumpData, null, 2);
}

async function createBackup() {
    ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `oris_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    try {
        const jsonStr = await arangoDump();
        fs.writeFileSync(backupPath, jsonStr, 'utf-8');
        console.log(`[Backup] Created ArangoDB dump: ${backupName}`);
        await cleanOldBackups();
        return backupName;
    } catch (err) {
        console.error('[Backup] ArangoDB dump failed:', err.message);
        return null;
    }
}

async function cleanOldBackups() {
    ensureBackupDir();
    const maxBackups = await getRetentionCount();
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('oris_backup_') || f.startsWith('oris_full_backup_'))
        .sort().reverse();

    if (files.length > maxBackups) {
        for (const f of files.slice(maxBackups)) {
            try {
                fs.unlinkSync(path.join(BACKUP_DIR, f));
                console.log(`[Backup] Cleaned old: ${f}`);
            } catch (e) {
                console.error(`[Backup] Failed to delete ${f}:`, e);
            }
        }
    }
}

function listBackups() {
    ensureBackupDir();
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('oris_backup_') || f.startsWith('oris_full_backup_'))
        .sort().reverse()
        .map(f => {
            const stat = fs.statSync(path.join(BACKUP_DIR, f));
            return { name: f, size: stat.size, created_at: stat.mtime.toISOString() };
        });
}

function getBackupPath(name) {
    if (!name.startsWith('oris_backup_') && !name.startsWith('oris_full_backup_')) return null;
    const p = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(p)) return null;
    return p;
}

function deleteBackup(name) {
    const p = getBackupPath(name);
    if (!p) return false;
    fs.unlinkSync(p);
    return true;
}

async function getBackupInterval() {
    try {
        const db = getDb();
        const cursor = await db.query(`FOR c IN system_config FILTER c.key == 'backup_interval_hours' RETURN c.value`);
        const value = await cursor.next();
        return value ? parseInt(value) : 24;
    } catch { return 24; }
}

async function getRetentionCount() {
    try {
        const db = getDb();
        const cursor = await db.query(`FOR c IN system_config FILTER c.key == 'backup_retention_count' RETURN c.value`);
        const value = await cursor.next();
        return value ? parseInt(value) : 7;
    } catch { return 7; }
}

let backupTimer = null;

async function startScheduler() {
    stopScheduler();
    const hours = await getBackupInterval();
    if (hours <= 0) return;
    const ms = hours * 3600 * 1000;
    console.log(`[Backup] Scheduled every ${hours}h`);
    backupTimer = setInterval(() => createFullBackup(), ms);
    setTimeout(() => createFullBackup(), 60000);
}

function stopScheduler() {
    if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
    }
}

function getUploadsDir() {
    const candidates = [];
    const defaultDir = path.join(__dirname, '..', 'uploads');
    candidates.push(defaultDir);
    if (process.env.DB_PATH) {
        const dbRelative = path.join(path.dirname(process.env.DB_PATH), 'uploads');
        if (dbRelative !== defaultDir) candidates.push(dbRelative);
    }
    for (const dir of candidates) {
        if (fs.existsSync(dir)) {
            try {
                if (fs.readdirSync(dir).length > 0) return dir;
            } catch (_) { }
        }
    }
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return defaultDir;
}

function getAvatarsDir() {
    const candidates = [];
    const defaultDir = path.join(__dirname, '..', 'avatars');
    candidates.push(defaultDir);
    if (process.env.DB_PATH) {
        const dbRelative = path.join(path.dirname(process.env.DB_PATH), 'avatars');
        if (dbRelative !== defaultDir) candidates.push(dbRelative);
    }
    for (const dir of candidates) {
        if (fs.existsSync(dir)) {
            try {
                if (fs.readdirSync(dir).length > 0) return dir;
            } catch (_) { }
        }
    }
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return defaultDir;
}

async function createFullBackup() {
    ensureBackupDir();
    const archiver = require('archiver');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `oris_full_backup_${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    try {
        const jsonStr = await arangoDump();
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 5 } });

        const done = new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('finish', resolve);
            archive.on('error', reject);
        });

        archive.pipe(output);
        archive.append(jsonStr, { name: 'database.json' });

        const uploadsDir = getUploadsDir();
        if (fs.existsSync(uploadsDir) && fs.readdirSync(uploadsDir).length > 0) {
            archive.directory(uploadsDir, 'uploads');
        }

        const avatarsDir = getAvatarsDir();
        if (fs.existsSync(avatarsDir) && fs.readdirSync(avatarsDir).length > 0) {
            archive.directory(avatarsDir, 'avatars');
        }

        await archive.finalize();
        await done;

        console.log(`[Backup] Full backup created: ${backupName} (${fs.statSync(backupPath).size} bytes)`);
        await cleanOldBackups();
        return backupName;
    } catch (err) {
        console.error('[Backup] Full backup failed:', err.message);
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        return null;
    }
}

async function restoreFromBackup(zipPath) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const jsonEntry = entries.find(e => e.entryName === 'database.json');
    if (!jsonEntry) throw new Error('database.json not found in backup archive');

    const jsonStr = jsonEntry.getData().toString('utf-8');
    const dumpData = JSON.parse(jsonStr);

    const db = getDb();
    
    for (const collName of Object.keys(dumpData)) {
        try {
            const collection = db.collection(collName);
            if (await collection.exists()) {
                await collection.truncate();
                const docs = dumpData[collName];
                if (docs && docs.length > 0) {
                    // Split inserts into batches of 1000
                    const chunkSize = 1000;
                    for (let i = 0; i < docs.length; i += chunkSize) {
                        await collection.save(docs.slice(i, i + chunkSize), { overwriteMode: 'replace' });
                    }
                }
            }
        } catch (err) {
            console.error(`[Restore] Failed to restore collection ${collName}:`, err.message);
        }
    }

    console.log(`[Restore] Database JSON dump restored successfully`);

    const uploadsDir = getUploadsDir();
    const uploadEntries = entries.filter(e => e.entryName.startsWith('uploads/') && !e.isDirectory);
    if (uploadEntries.length > 0) {
        for (const entry of uploadEntries) {
            const relativePath = entry.entryName.replace(/^uploads\//, '');
            const destPath = path.join(uploadsDir, relativePath);
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            fs.writeFileSync(destPath, entry.getData());
        }
        console.log(`[Restore] Restored ${uploadEntries.length} uploaded files`);
    }

    const avatarsDir = getAvatarsDir();
    const avatarEntries = entries.filter(e => e.entryName.startsWith('avatars/') && !e.isDirectory);
    if (avatarEntries.length > 0) {
        if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
        for (const entry of avatarEntries) {
            const relativePath = entry.entryName.replace(/^uploads\//, '');
            const destPath = path.join(avatarsDir, relativePath);
            fs.writeFileSync(destPath, entry.getData());
        }
        console.log(`[Restore] Restored ${avatarEntries.length} avatar files`);
    }
}

module.exports = {
    createBackup,
    createFullBackup,
    restoreFromBackup,
    listBackups,
    getBackupPath,
    deleteBackup,
    getBackupInterval,
    getRetentionCount,
    startScheduler,
    stopScheduler,
    BACKUP_DIR,
};
