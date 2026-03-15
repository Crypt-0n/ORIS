const fs = require('fs');
const path = require('path');
const db = require('../db');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'data', 'backups');

function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Create a backup. Strategy depends on the database dialect:
 * - SQLite: file copy of the .db file
 * - PostgreSQL/MySQL: Knex-based SQL dump (no external tools needed)
 */
async function createBackup() {
    ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const config = db.client.config;
    const dialect = config.client;

    if (dialect === 'better-sqlite3') {
        const backupName = `oris_backup_${timestamp}.sqlite.sql`;
        const backupPath = path.join(BACKUP_DIR, backupName);
        try {
            const sql = await knexDump(dialect);
            fs.writeFileSync(backupPath, sql, 'utf-8');
            console.log(`[Backup] Created (SQLite SQL): ${backupName}`);
            await cleanOldBackups();
            return backupName;
        } catch (err) {
            console.error('[Backup] SQLite SQL dump failed:', err.message);
            return null;
        }
    }

    // PostgreSQL or MySQL: Knex-based SQL dump
    if (dialect === 'pg' || dialect === 'mysql2') {
        const ext = dialect === 'pg' ? 'pgsql' : 'mysql';
        const backupName = `oris_backup_${timestamp}.${ext}.sql`;
        const backupPath = path.join(BACKUP_DIR, backupName);
        try {
            const sql = await knexDump(dialect);
            fs.writeFileSync(backupPath, sql, 'utf-8');
            console.log(`[Backup] Created (${dialect === 'pg' ? 'PostgreSQL' : 'MySQL'}): ${backupName}`);
            await cleanOldBackups();
            return backupName;
        } catch (err) {
            console.error(`[Backup] ${dialect} dump failed:`, err.message);
            return null;
        }
    }

    console.error(`[Backup] Unsupported dialect: ${dialect}`);
    return null;
}

/**
 * Knex-based SQL dump: exports all table data as INSERT statements.
 * Works without pg_dump or mysqldump installed.
 */
async function knexDump(dialect) {
    const lines = [];
    const quote = dialect === 'mysql2' ? '`' : '"';
    const now = new Date().toISOString();
    const dialectLabel = dialect === 'pg' ? 'PostgreSQL' : dialect === 'mysql2' ? 'MySQL' : 'SQLite';

    lines.push(`-- ORIS Backup — ${dialectLabel}`);
    lines.push(`-- Generated: ${now}`);
    lines.push(`-- Restore: import this SQL file into your database`);
    lines.push('');

    // Get all table names
    let tables;
    if (dialect === 'pg') {
        const result = await db.raw(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'knex_migrations' AND tablename != 'knex_migrations_lock' ORDER BY tablename"
        );
        tables = result.rows.map(r => r.tablename);
    } else if (dialect === 'mysql2') {
        const result = await db.raw(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT IN ('knex_migrations', 'knex_migrations_lock') ORDER BY table_name"
        );
        tables = (result[0] || []).map(r => r.TABLE_NAME || r.table_name);
    } else {
        // SQLite
        const result = await db.raw(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'knex_%' AND name != 'sqlite_sequence' ORDER BY name"
        );
        tables = result.map(r => r.name);
    }

    // Disable FK checks at the top
    if (dialect === 'pg') {
        lines.push('SET session_replication_role = replica;');
    } else if (dialect === 'mysql2') {
        lines.push('SET FOREIGN_KEY_CHECKS = 0;');
    } else {
        lines.push('PRAGMA foreign_keys = OFF;');
    }
    lines.push('');

    for (const table of tables) {
        const rows = await db(table).select('*');
        if (rows.length === 0) continue;

        lines.push(`-- Table: ${table} (${rows.length} rows)`);

        // Clear table before inserting
        if (dialect === 'pg') {
            lines.push(`TRUNCATE TABLE ${quote}${table}${quote} CASCADE;`);
        } else if (dialect === 'mysql2') {
            lines.push(`TRUNCATE TABLE ${quote}${table}${quote};`);
        } else {
            lines.push(`DELETE FROM ${quote}${table}${quote};`);
        }

        // Batch INSERT (100 rows per statement for efficiency)
        const columns = Object.keys(rows[0]);
        const colList = columns.map(c => `${quote}${c}${quote}`).join(', ');
        const batchSize = 100;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const values = batch.map(row => {
                const vals = columns.map(col => {
                    const val = row[col];
                    if (val === null || val === undefined) return 'NULL';
                    if (typeof val === 'number') return String(val);
                    if (typeof val === 'boolean') return val ? '1' : '0';
                    if (val instanceof Date) return `'${val.toISOString()}'`;
                    // Escape single quotes
                    const escaped = String(val).replace(/'/g, "''");
                    return `'${escaped}'`;
                });
                return `(${vals.join(', ')})`;
            });
            lines.push(`INSERT INTO ${quote}${table}${quote} (${colList}) VALUES`);
            lines.push(values.join(',\n') + ';');
        }

        lines.push('');
    }

    // Re-enable FK checks
    if (dialect === 'pg') {
        lines.push('SET session_replication_role = DEFAULT;');
    } else if (dialect === 'mysql2') {
        lines.push('SET FOREIGN_KEY_CHECKS = 1;');
    } else {
        lines.push('PRAGMA foreign_keys = ON;');
    }

    return lines.join('\n');
}

async function cleanOldBackups() {
    ensureBackupDir();
    const maxBackups = await getRetentionCount();
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('oris_backup_') || f.startsWith('oris_full_backup_'))
        .sort()
        .reverse();

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
        .sort()
        .reverse()
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
        const row = await db('system_config').where({ key: 'backup_interval_hours' }).select('value').first();
        return row ? parseInt(row.value) : 24;
    } catch { return 24; }
}

async function getRetentionCount() {
    try {
        const row = await db('system_config').where({ key: 'backup_retention_count' }).select('value').first();
        return row ? parseInt(row.value) : 7;
    } catch { return 7; }
}

let backupTimer = null;

async function startScheduler() {
    stopScheduler();
    const hours = await getBackupInterval();
    if (hours <= 0) return;
    const ms = hours * 3600 * 1000;
    console.log(`[Backup] Scheduled every ${hours}h`);
    backupTimer = setInterval(() => createBackup(), ms);
    setTimeout(() => createBackup(), 60000);
}

function stopScheduler() {
    if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
    }
}

function getUploadsDir() {
    // Check multiple possible upload directories
    const candidates = [];
    const defaultDir = path.join(__dirname, '..', 'uploads');
    candidates.push(defaultDir);
    if (process.env.DB_PATH) {
        const dbRelative = path.join(path.dirname(process.env.DB_PATH), 'uploads');
        if (dbRelative !== defaultDir) candidates.push(dbRelative);
    }
    // Find the first one that exists and has content
    for (const dir of candidates) {
        if (fs.existsSync(dir)) {
            try {
                const contents = fs.readdirSync(dir);
                if (contents.length > 0) return dir;
            } catch (_) { /* skip */ }
        }
    }
    // Fallback to the first existing one, even if empty
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
                const contents = fs.readdirSync(dir);
                if (contents.length > 0) return dir;
            } catch (_) { /* skip */ }
        }
    }
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return defaultDir;
}

/**
 * Create a full backup: ZIP containing database.sql + uploads/ folder.
 */
async function createFullBackup() {
    ensureBackupDir();
    const archiver = require('archiver');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `oris_full_backup_${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    const config = db.client.config;
    const dialect = config.client;

    try {
        // Generate SQL dump
        const sql = await knexDump(dialect);

        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 5 } });

        const done = new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('finish', resolve);
            archive.on('error', reject);
        });

        archive.pipe(output);

        // Add SQL dump
        archive.append(sql, { name: 'database.sql' });

        // Add uploads directory — check all possible paths
        const uploadsDir = getUploadsDir();
        console.log(`[Backup] Using uploads dir: ${uploadsDir}`);
        if (fs.existsSync(uploadsDir)) {
            const contents = fs.readdirSync(uploadsDir);
            console.log(`[Backup] Uploads contents (${contents.length}): ${JSON.stringify(contents)}`);
            if (contents.length > 0) {
                archive.directory(uploadsDir, 'uploads');
            }
        }

        // Add avatars directory
        const avatarsDir = getAvatarsDir();
        console.log(`[Backup] Using avatars dir: ${avatarsDir}`);
        if (fs.existsSync(avatarsDir)) {
            const avatarContents = fs.readdirSync(avatarsDir);
            console.log(`[Backup] Avatars contents (${avatarContents.length}): ${JSON.stringify(avatarContents)}`);
            if (avatarContents.length > 0) {
                archive.directory(avatarsDir, 'avatars');
            }
        }

        await archive.finalize();
        await done;

        console.log(`[Backup] Full backup created: ${backupName} (${fs.statSync(backupPath).size} bytes)`);
        await cleanOldBackups();
        return backupName;
    } catch (err) {
        console.error('[Backup] Full backup failed:', err.message);
        // Clean up partial file
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
        return null;
    }
}

/**
 * Restore from a full backup ZIP file.
 * Supports cross-dialect restore (e.g. SQLite backup → MySQL target).
 * @param {string} zipPath - absolute path to the uploaded ZIP file
 */
async function restoreFromBackup(zipPath) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // Find database.sql
    const sqlEntry = entries.find(e => e.entryName === 'database.sql');
    if (!sqlEntry) throw new Error('database.sql not found in backup archive');

    let sqlContent = sqlEntry.getData().toString('utf-8');
    console.log(`[Restore] SQL content size: ${sqlContent.length} bytes`);

    const config = db.client.config;
    const targetDialect = config.client || 'better-sqlite3';

    // Detect source dialect from the SQL header
    let sourceDialect = 'better-sqlite3'; // default
    if (sqlContent.includes('-- ORIS Backup — MySQL')) sourceDialect = 'mysql2';
    else if (sqlContent.includes('-- ORIS Backup — PostgreSQL')) sourceDialect = 'pg';
    else if (sqlContent.includes('-- ORIS Backup — SQLite')) sourceDialect = 'better-sqlite3';

    const sourceQuote = sourceDialect === 'mysql2' ? '`' : '"';
    const targetQuote = targetDialect === 'mysql2' ? '`' : '"';

    console.log(`[Restore] Source dialect: ${sourceDialect}, Target dialect: ${targetDialect}`);

    // Convert identifier quoting if source and target use different quote chars
    if (sourceQuote !== targetQuote) {
        console.log(`[Restore] Converting identifier quoting: ${sourceQuote} → ${targetQuote}`);
        // Only convert quotes in SQL structural parts (table/column names),
        // NOT inside string values (which could contain JSON with double quotes).
        // Process line by line: convert only lines that are INSERT INTO, DELETE FROM,
        // TRUNCATE TABLE, or column-list lines (starting with '(')
        const lines = sqlContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Only convert on structural SQL lines, not on data value lines
            if (trimmed.startsWith('INSERT INTO') || trimmed.startsWith('DELETE FROM') ||
                trimmed.startsWith('TRUNCATE TABLE') || trimmed.startsWith('PRAGMA') ||
                trimmed.startsWith('SET ')) {
                // For INSERT INTO lines, only convert the part before VALUES
                const valuesIdx = line.indexOf('VALUES');
                if (valuesIdx !== -1) {
                    const before = line.substring(0, valuesIdx);
                    const after = line.substring(valuesIdx);
                    const escaped = sourceQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines[i] = before.replace(new RegExp(escaped, 'g'), targetQuote) + after;
                } else {
                    const escaped = sourceQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines[i] = line.replace(new RegExp(escaped, 'g'), targetQuote);
                }
            }
        }
        sqlContent = lines.join('\n');
    }

    // Convert DELETE FROM ↔ TRUNCATE TABLE if needed
    if (sourceDialect === 'better-sqlite3' && targetDialect === 'mysql2') {
        // SQLite uses DELETE FROM, MySQL can use either but DELETE FROM works fine
        // No change needed — DELETE FROM works on MySQL too
    }
    if (sourceDialect === 'mysql2' && targetDialect === 'better-sqlite3') {
        // MySQL TRUNCATE → SQLite DELETE FROM
        sqlContent = sqlContent.replace(/TRUNCATE TABLE/g, 'DELETE FROM');
    }

    // Convert ISO 8601 datetime values to MySQL-compatible format
    // MySQL rejects '2026-03-14T11:16:44.199Z' — needs '2026-03-14 11:16:44'
    // Also handles dates without seconds: '2026-03-09T09:30Z' → '2026-03-09 09:30:00'
    if (targetDialect === 'mysql2') {
        // With seconds (and optional ms and Z)
        sqlContent = sqlContent.replace(
            /'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z?'/g,
            "'$1 $2'"
        );
        // Without seconds (HH:MMZ or HH:MM)
        sqlContent = sqlContent.replace(
            /'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})Z?'/g,
            "'$1 $2:00'"
        );
    }

    // Parse SQL statements — split on semicolons at end of line
    // Then strip comment lines within each block (comments can precede SQL in same block)
    const rawStatements = sqlContent
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const statements = rawStatements.map(s => {
        // Remove comment lines within the block
        return s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
    }).filter(s => s.length > 0);

    // Handle last statement that may not have trailing newline
    const lastStmt = statements[statements.length - 1];
    if (lastStmt && lastStmt.endsWith(';')) {
        statements[statements.length - 1] = lastStmt.slice(0, -1);
    }

    console.log(`[Restore] Parsed ${statements.length} SQL statements`);

    let executed = 0;
    let errors = 0;

    // Use a transaction to ensure all operations happen on the same connection
    // This is critical for PRAGMA foreign_keys = OFF to work in SQLite
    await db.transaction(async trx => {
        // Disable FK checks within the transaction
        if (targetDialect === 'better-sqlite3') {
            await trx.raw('PRAGMA foreign_keys = OFF');
        } else if (targetDialect === 'pg') {
            await trx.raw('SET session_replication_role = replica');
        } else if (targetDialect === 'mysql2') {
            await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
        }

        for (const stmt of statements) {
            // Skip the FK control statements — we handle them ourselves above
            if (stmt.startsWith('PRAGMA foreign_keys') || stmt.startsWith('SET FOREIGN_KEY_CHECKS') || stmt.startsWith('SET session_replication_role')) {
                continue;
            }

            try {
                await trx.raw(stmt);
                executed++;
            } catch (err) {
                errors++;
                console.warn(`[Restore] Error on statement #${executed + errors}:`, err.message);
                console.warn(`[Restore]   SQL: ${stmt.substring(0, 120)}...`);
            }
        }

        // Re-enable FK checks
        if (targetDialect === 'better-sqlite3') {
            await trx.raw('PRAGMA foreign_keys = ON');
        } else if (targetDialect === 'pg') {
            await trx.raw('SET session_replication_role = DEFAULT');
        } else if (targetDialect === 'mysql2') {
            await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
        }
    });

    console.log(`[Restore] Executed ${executed} statements, ${errors} errors`);

    // Verify the restore worked — check that admin users exist
    const { isAdmin } = require('./access');
    const users = await db('user_profiles').select('role');
    const adminCount = users.filter(u => isAdmin(u.role)).length;
    console.log(`[Restore] Verification: ${users.length} users, ${adminCount} admins`);

    if (adminCount === 0) {
        throw new Error(`Restore completed but no admin user found (${executed} statements executed, ${errors} errors). Check server logs for details.`);
    }

    // Restore uploaded files
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

    // Restore avatar files
    const avatarsDir = getAvatarsDir();
    console.log(`[Restore] Avatars dir: ${avatarsDir}`);
    console.log(`[Restore] All ZIP entries: ${entries.map(e => e.entryName).join(', ')}`);
    const avatarEntries = entries.filter(e => e.entryName.startsWith('avatars/') && !e.isDirectory);
    console.log(`[Restore] Found ${avatarEntries.length} avatar entries in backup`);
    if (avatarEntries.length > 0) {
        if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
        for (const entry of avatarEntries) {
            const relativePath = entry.entryName.replace(/^avatars\//, '');
            const destPath = path.join(avatarsDir, relativePath);
            console.log(`[Restore] Writing avatar: ${entry.entryName} -> ${destPath} (${entry.getData().length} bytes)`);
            fs.writeFileSync(destPath, entry.getData());
        }
        console.log(`[Restore] Restored ${avatarEntries.length} avatar files to ${avatarsDir}`);
    } else {
        console.log(`[Restore] No avatar files found in backup ZIP`);
    }

    console.log(`[Restore] Database and files restored successfully`);
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
