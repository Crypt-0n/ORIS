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
    'case_events',
    'case_diamond_overrides',
    'case_diamond_node_order',
    'case_graph_layouts',
    'case_assignments',
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
    'kill_chain_ttps',
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

    const eventsCol = db.collection('case_events');
    await eventsCol.ensureIndex({ type: 'persistent', fields: ['case_id'] }).catch(() => {});
    await eventsCol.ensureIndex({ type: 'persistent', fields: ['task_id'] }).catch(() => {});

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

    const ttpCol = db.collection('kill_chain_ttps');
    const ttpCount = await ttpCol.count();
    if (ttpCount.count === 0) {
        const defaultTtps = [
            {
                _key: 'ttp-t1566',
                kill_chain_type: 'mitre_attack',
                phase_value: 'att_initial_access',
                ttp_id: 'T1566',
                name: 'Phishing',
                description: 'Adversaries may send phishing messages to gain access to victim systems.',
                url: 'https://attack.mitre.org/techniques/T1566/',
                order: 1,
                created_at: new Date().toISOString()
            },
            {
                _key: 'ttp-t1059',
                kill_chain_type: 'mitre_attack',
                phase_value: 'att_execution',
                ttp_id: 'T1059',
                name: 'Command and Scripting Interpreter',
                description: 'Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.',
                url: 'https://attack.mitre.org/techniques/T1059/',
                order: 2,
                created_at: new Date().toISOString()
            },
            {
                _key: 'ttp-t1053',
                kill_chain_type: 'mitre_attack',
                phase_value: 'att_persistence',
                ttp_id: 'T1053',
                name: 'Scheduled Task/Job',
                description: 'Adversaries may abuse task scheduling functionality to facilitate initial or recurring execution of malicious code.',
                url: 'https://attack.mitre.org/techniques/T1053/',
                order: 3,
                created_at: new Date().toISOString()
            },
            {
                _key: 'ttp-ckc-recon',
                kill_chain_type: 'cyber_kill_chain',
                phase_value: 'reconnaissance',
                ttp_id: 'CKC-01',
                name: 'Active Scanning',
                description: 'Scanning infrastructure to find vulnerabilities.',
                url: '',
                order: 1,
                created_at: new Date().toISOString()
            },
            {
                _key: 'ttp-ckc-delivery',
                kill_chain_type: 'cyber_kill_chain',
                phase_value: 'delivery',
                ttp_id: 'CKC-03',
                name: 'Spearphishing Attachment',
                description: 'Targeted emails with malicious attachments.',
                url: '',
                order: 1,
                created_at: new Date().toISOString()
            },
            {
                _key: 'ttp-ckc-exploit',
                kill_chain_type: 'cyber_kill_chain',
                phase_value: 'exploitation',
                ttp_id: 'CKC-04',
                name: 'Exploitation for Client Execution',
                description: 'Exploiting software vulnerabilities to execute code.',
                url: '',
                order: 1,
                created_at: new Date().toISOString()
            }
        ];
        for (const ttp of defaultTtps) {
            await ttpCol.save(ttp);
        }
        console.log('[ArangoDB] Seeded default TTPs');
    }
}

function closeArango() {
    if (_db) _db.close();
    if (_sysDb) _sysDb.close();
}

module.exports = { getDb, getGraph, getSysDb, initArango, closeArango, STIX_GRAPH_NAME };
