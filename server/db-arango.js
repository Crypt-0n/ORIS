/**
 * ArangoDB connection module — ORIS.
 *
 * Provides a singleton connection to the ArangoDB database.
 * Used alongside the existing PostgreSQL db.js during the migration.
 *
 * Usage:
 *   const { getDb, getGraph } = require('./db-arango');
 *   const db = getDb();               // arangojs Database instance
 *   const graph = getGraph();         // arangojs Graph handle for stix_graph
 */
const { Database } = require('arangojs');

const ARANGO_URL = process.env.ARANGO_URL || 'http://localhost:8529';
const ARANGO_DB = process.env.ARANGO_DB || 'oris';
const ARANGO_USER = process.env.ARANGO_USER || 'root';
const ARANGO_PASSWORD = process.env.ARANGO_PASSWORD || 'oris_secret';

let _db = null;
let _sysDb = null;

/**
 * Get the system database connection (for creating the application database).
 */
function getSysDb() {
    if (!_sysDb) {
        _sysDb = new Database({
            url: ARANGO_URL,
            auth: { username: ARANGO_USER, password: ARANGO_PASSWORD },
            databaseName: '_system',
        });
    }
    return _sysDb;
}

/**
 * Get the application database connection.
 */
function getDb() {
    if (!_db) {
        _db = new Database({
            url: ARANGO_URL,
            auth: { username: ARANGO_USER, password: ARANGO_PASSWORD },
            databaseName: ARANGO_DB,
        });
    }
    return _db;
}

/**
 * Get the STIX graph handle.
 */
function getGraph() {
    return getDb().graph('stix_graph');
}

// ─── Document collections ────────────────────────────────────────
const DOCUMENT_COLLECTIONS = [
    'cases',
    'tasks',
    'task_files',
    'task_results',

    'case_assignments',
    'case_systems',
    'case_malware_tools',
    'case_compromised_accounts',
    'case_compromised_account_systems',
    'case_exfiltrations',
    'case_audit_log',
    'user_profiles',
    'beneficiaries',
    'beneficiary_members',
    'severities',
    'notifications',
    'comments',
    'comment_attachments',
    'api_tokens',
    'login_history',
    'kb_stix_objects',
    'webhooks',
    'push_subscriptions',
    'system_config',
    'stix_objects',
];

// ─── Edge collections (for STIX graph) ──────────────────────────
const EDGE_COLLECTIONS = [
    'stix_relationships',  // Generic STIX SROs
];

// ─── Named graph definition ─────────────────────────────────────
const STIX_GRAPH_NAME = 'stix_graph';

/**
 * Initialize the ArangoDB database: create the DB if it doesn't exist,
 * create all required document and edge collections, and set up the STIX graph.
 */
async function initArango() {
    const sysDb = getSysDb();

    // 1. Ensure the application database exists
    const databases = await sysDb.listDatabases();
    if (!databases.includes(ARANGO_DB)) {
        console.log(`[ArangoDB] Creating database '${ARANGO_DB}'...`);
        await sysDb.createDatabase(ARANGO_DB);
    }

    const db = getDb();

    // 2. Create document collections
    for (const name of DOCUMENT_COLLECTIONS) {
        const collection = db.collection(name);
        const exists = await collection.exists();
        if (!exists) {
            await collection.create();
            console.log(`[ArangoDB] Created collection '${name}'`);
        }
    }

    // 3. Create edge collections
    for (const name of EDGE_COLLECTIONS) {
        const collection = db.collection(name);
        const exists = await collection.exists();
        if (!exists) {
            await collection.create({ type: 3 }); // type 3 = edge collection
            console.log(`[ArangoDB] Created edge collection '${name}'`);
        }
    }

    // 4. Create the STIX named graph
    const graph = db.graph(STIX_GRAPH_NAME);
    const graphExists = await graph.exists();
    if (!graphExists) {
        await graph.create([
            {
                collection: 'stix_relationships',
                from: ['stix_objects'],
                to: ['stix_objects'],
            },
        ]);
        console.log(`[ArangoDB] Created graph '${STIX_GRAPH_NAME}'`);
    }

    // 5. Create indexes for common queries
    const casesCol = db.collection('cases');
    await casesCol.ensureIndex({ type: 'persistent', fields: ['case_number'], unique: true }).catch(() => {});
    await casesCol.ensureIndex({ type: 'persistent', fields: ['beneficiary_id'] }).catch(() => {});
    await casesCol.ensureIndex({ type: 'persistent', fields: ['status'] }).catch(() => {});
    await casesCol.ensureIndex({ type: 'persistent', fields: ['type'] }).catch(() => {});

    const tasksCol = db.collection('tasks');
    await tasksCol.ensureIndex({ type: 'persistent', fields: ['case_id'] }).catch(() => {});
    await tasksCol.ensureIndex({ type: 'persistent', fields: ['assigned_to'] }).catch(() => {});

    const stixObjCol = db.collection('stix_objects');
    await stixObjCol.ensureIndex({ type: 'persistent', fields: ['case_id'] }).catch(() => {});
    await stixObjCol.ensureIndex({ type: 'persistent', fields: ['type'] }).catch(() => {});

    const stixRelCol = db.collection('stix_relationships');
    await stixRelCol.ensureIndex({ type: 'persistent', fields: ['case_id'] }).catch(() => {});
    await stixRelCol.ensureIndex({ type: 'persistent', fields: ['_from'] }).catch(() => {});
    await stixRelCol.ensureIndex({ type: 'persistent', fields: ['_to'] }).catch(() => {});

    const usersCol = db.collection('user_profiles');
    await usersCol.ensureIndex({ type: 'persistent', fields: ['email'], unique: true }).catch(() => {});

    const assignCol = db.collection('case_assignments');
    await assignCol.ensureIndex({ type: 'persistent', fields: ['case_id'] }).catch(() => {});
    await assignCol.ensureIndex({ type: 'persistent', fields: ['user_id'] }).catch(() => {});

    const notifCol = db.collection('notifications');
    await notifCol.ensureIndex({ type: 'persistent', fields: ['user_id'] }).catch(() => {});

    const kbCol = db.collection('kb_stix_objects');
    await kbCol.ensureIndex({ type: 'persistent', fields: ['type'] }).catch(() => {});

    const auditCol = db.collection('case_audit_log');
    await auditCol.ensureIndex({ type: 'persistent', fields: ['case_id'] }).catch(() => {});

    // 6. Seed default data
    await seedDefaults(db);

    console.log('[ArangoDB] Database initialization complete.');
}

/**
 * Seed default severities and system config if they don't exist.
 */
async function seedDefaults(db) {
    const sevCol = db.collection('severities');
    const sevCount = await sevCol.count();
    if (sevCount.count === 0) {
        const defaultSeverities = [
            { _key: 'sev-info', label: 'Informationnel', color: '#3b82f6', level: 0 },
            { _key: 'sev-low', label: 'Faible', color: '#22c55e', level: 1 },
            { _key: 'sev-medium', label: 'Moyenne', color: '#f59e0b', level: 2 },
            { _key: 'sev-high', label: 'Élevée', color: '#ef4444', level: 3 },
            { _key: 'sev-critical', label: 'Critique', color: '#7c3aed', level: 4 },
        ];
        for (const sev of defaultSeverities) {
            await sevCol.save(sev);
        }
        console.log('[ArangoDB] Seeded default severities');
    }

    const cfgCol = db.collection('system_config');
    const cfgCount = await cfgCol.count();
    if (cfgCount.count === 0) {
        await cfgCol.save({ _key: 'ai_config', provider: 'none', model: '', api_key: '' });
        console.log('[ArangoDB] Seeded default system config');
    }

    const trCol = db.collection('task_results');
    const trCount = await trCol.count();
    if (trCount.count === 0) {
        const defaultResults = [
            { _key: 'result-ok', label: 'Conforme', color: '#22c55e' },
            { _key: 'result-nok', label: 'Non conforme', color: '#ef4444' },
            { _key: 'result-na', label: 'Non applicable', color: '#6b7280' },
            { _key: 'result-partial', label: 'Partiel', color: '#f59e0b' },
        ];
        for (const r of defaultResults) {
            await trCol.save(r);
        }
        console.log('[ArangoDB] Seeded default task results');
    }
}

function closeArango() {
    if (_db) _db.close();
    if (_sysDb) _sysDb.close();
}

module.exports = { getDb, getGraph, getSysDb, initArango, closeArango, STIX_GRAPH_NAME };
