/**
 * Knex Migration Regression Tests
 * 
 * Ensures the Knex.js migration infrastructure works correctly and
 * prevents recurrence of known issues (e.g., init_db race condition,
 * remaining db.prepare calls in runtime code).
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Use isolated test DB
const TEST_DB = '/tmp/oris_knex_regression_test.sqlite';

beforeAll(() => {
    // Clean up any previous test DB
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    process.env.DB_PATH = TEST_DB;
});

afterAll(async () => {
    // Clean up
    try {
        const db = require('../db');
        await db.destroy();
    } catch (e) { /* ignore */ }
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('init_db.js contract', () => {
    test('exports a thenable (Promise), not a function', () => {
        // This test prevents the Docker CMD hang bug:
        // If init_db.js exports a function instead of a promise,
        // `node init_db.js` would hang because the async work
        // never starts without being called.
        // If it exports a promise, index.js can `await` it.
        const initDb = require('../init_db');
        expect(typeof initDb.then).toBe('function');
        expect(typeof initDb.catch).toBe('function');
    });

    test('resolves successfully (migrations apply)', async () => {
        const initDb = require('../init_db');
        await expect(initDb).resolves.not.toThrow();
    });
});

describe('Knex connection and migration', () => {
    let db;

    beforeAll(() => {
        db = require('../db');
    });

    test('db exports a Knex instance', () => {
        expect(db).toBeDefined();
        expect(typeof db).toBe('function'); // Knex instance is callable
        expect(db.client).toBeDefined();
        expect(db.client.config).toBeDefined();
    });

    test('can execute raw SQL', async () => {
        const result = await db.raw('SELECT 1 as ok');
        expect(result).toBeDefined();
        expect(result[0]?.ok || result.rows?.[0]?.ok).toBe(1);
    });

    test('all expected tables are created', async () => {
        const tables = await db.raw(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'knex_%' ORDER BY name"
        );
        const tableNames = tables.map(t => t.name);

        const expectedTables = [
            'api_tokens', 'beneficiaries', 'beneficiary_members',
            'case_assignments', 'case_audit_log',
            'case_compromised_account_systems', 'case_compromised_accounts',
            'case_diamond_node_order', 'case_diamond_overrides',
            'case_events', 'case_exfiltrations', 'case_graph_layouts',
            'case_malware_tools', 'case_network_indicators', 'case_systems',
            'cases', 'comment_attachments', 'comments',
            'login_history', 'notifications', 'push_subscriptions',
            'severities', 'system_config', 'task_files', 'task_results',
            'tasks', 'user_profiles', 'webhooks',
        ];

        for (const table of expectedTables) {
            expect(tableNames).toContain(table);
        }
    });

    test('seed data exists (severities, task_results)', async () => {
        const severities = await db('severities').select('label');
        expect(severities.length).toBeGreaterThanOrEqual(4);

        const taskResults = await db('task_results').select('label');
        expect(taskResults.length).toBeGreaterThanOrEqual(3);
    });

    test('can insert and query user_profiles', async () => {
        const id = 'test-user-' + Date.now();
        await db('user_profiles').insert({
            id, email: `${id}@test.local`, password_hash: 'test',
            full_name: 'Test User', role: '["user"]',
        });
        const user = await db('user_profiles').where({ id }).first();
        expect(user).toBeDefined();
        expect(user.email).toBe(`${id}@test.local`);
        await db('user_profiles').where({ id }).del();
    });

    test('transactions work (commit)', async () => {
        const id1 = 'trx-test-1-' + Date.now();
        const id2 = 'trx-test-2-' + Date.now();
        await db.transaction(async trx => {
            await trx('beneficiaries').insert({ id: id1, name: 'TRX Test 1' });
            await trx('beneficiaries').insert({ id: id2, name: 'TRX Test 2' });
        });
        const rows = await db('beneficiaries').whereIn('id', [id1, id2]);
        expect(rows.length).toBe(2);
        await db('beneficiaries').whereIn('id', [id1, id2]).del();
    });

    test('transactions work (rollback)', async () => {
        const id = 'trx-rollback-' + Date.now();
        try {
            await db.transaction(async trx => {
                await trx('beneficiaries').insert({ id, name: 'Will Rollback' });
                throw new Error('intentional rollback');
            });
        } catch (e) {
            expect(e.message).toBe('intentional rollback');
        }
        const row = await db('beneficiaries').where({ id }).first();
        expect(row).toBeUndefined();
    });

    test('onConflict().merge() works for upserts', async () => {
        await db('system_config').insert({ key: 'test_upsert', value: 'v1' })
            .onConflict('key').merge({ value: 'v1' });
        let row = await db('system_config').where({ key: 'test_upsert' }).first();
        expect(row.value).toBe('v1');

        await db('system_config').insert({ key: 'test_upsert', value: 'v2' })
            .onConflict('key').merge({ value: 'v2' });
        row = await db('system_config').where({ key: 'test_upsert' }).first();
        expect(row.value).toBe('v2');

        await db('system_config').where({ key: 'test_upsert' }).del();
    });
});

describe('No db.prepare in runtime code', () => {
    const serverDir = path.join(__dirname, '..');
    const runtimeDirs = ['routes', 'utils', 'middleware'];

    // Files that are allowed to have db.prepare (legacy, non-runtime)
    const EXCLUDED_PATTERNS = [
        /__tests__/,
        /node_modules/,
        /_test_/,
    ];

    function getJsFiles(dir) {
        const files = [];
        if (!fs.existsSync(dir)) return files;
        for (const entry of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && entry.endsWith('.js')) {
                files.push(fullPath);
            }
        }
        return files;
    }

    test('no db.prepare() in route files', () => {
        const files = getJsFiles(path.join(serverDir, 'routes'));
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            expect(content).not.toMatch(/db\.prepare\s*\(/);
        }
    });

    test('no db.prepare() in utility files', () => {
        const files = getJsFiles(path.join(serverDir, 'utils'));
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            expect(content).not.toMatch(/db\.prepare\s*\(/);
        }
    });

    test('no db.prepare() in middleware files', () => {
        const files = getJsFiles(path.join(serverDir, 'middleware'));
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            expect(content).not.toMatch(/db\.prepare\s*\(/);
        }
    });

    test('no db.prepare() in index.js', () => {
        const content = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf-8');
        expect(content).not.toMatch(/db\.prepare\s*\(/);
    });

    test('no PRAGMA calls in runtime code (SQLite-specific)', () => {
        for (const dir of runtimeDirs) {
            const files = getJsFiles(path.join(serverDir, dir));
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8');
                // Strip single-line comments before matching
                const codeOnly = content.split('\n')
                    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
                    .join('\n');
                expect(codeOnly).not.toMatch(/PRAGMA\s+table_info/i);
            }
        }
    });

    test('no CURRENT_TIMESTAMP in runtime queries (use ISO strings)', () => {
        for (const dir of runtimeDirs) {
            const files = getJsFiles(path.join(serverDir, dir));
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8');
                // Allow CURRENT_TIMESTAMP in comments but not in queries
                const lines = content.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
                const code = lines.join('\n');
                expect(code).not.toMatch(/CURRENT_TIMESTAMP/);
            }
        }
    });
});

describe('Dockerfile contract', () => {
    test('CMD does not run init_db.js as standalone script', () => {
        const dockerfile = fs.readFileSync(
            path.join(__dirname, '..', 'Dockerfile'), 'utf-8'
        );
        // init_db.js should NOT be run as a standalone node script in CMD
        // because it exports a promise and never exits
        expect(dockerfile).not.toMatch(/CMD.*node init_db\.js\s*&&/);
        expect(dockerfile).not.toMatch(/CMD.*node init_db\.js\s*;/);
    });

    test('CMD runs index.js (which handles migrations internally)', () => {
        const dockerfile = fs.readFileSync(
            path.join(__dirname, '..', 'Dockerfile'), 'utf-8'
        );
        expect(dockerfile).toMatch(/CMD.*node.*index\.js/);
    });
});

describe('Server startup', () => {
    let app;

    beforeAll(async () => {
        // Wait for init_db to complete
        await require('../init_db');
        app = require('../index');
    });

    test('health endpoint responds', async () => {
        const request = require('supertest');
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('setup-status responds without auth', async () => {
        const request = require('supertest');
        const res = await request(app).get('/api/admin/setup-status');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('hasAdmin');
        expect(res.body).toHaveProperty('isInitialized');
    });

    test('protected routes return 401 without token', async () => {
        const request = require('supertest');
        const res = await request(app).get('/api/cases');
        expect(res.status).toBe(401);
    });
});
