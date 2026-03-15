/**
 * Jest setupAfterEnv — runs in the test context where beforeAll/afterAll are available.
 * Patches db.prepare() onto the Knex instance for backward compatibility with
 * tests written against the old better-sqlite3 driver.
 */

beforeAll(async () => {
    await require('../init_db');
    const db = require('../db');

    if (typeof db.prepare === 'function') return; // already patched

    db.prepare = function (sql) {
        return {
            run(...args) {
                return db.raw(sql, args);
            },
            get(...args) {
                return db.raw(sql, args).then(rows => {
                    return Array.isArray(rows) ? rows[0] : (rows?.rows?.[0] ?? rows?.[0]);
                });
            },
            all(...args) {
                return db.raw(sql, args).then(rows => {
                    return Array.isArray(rows) ? rows : (rows?.rows ?? []);
                });
            },
        };
    };
});

afterAll(async () => {
    try {
        const db = require('../db');
        if (db && typeof db.destroy === 'function') await db.destroy();
    } catch (e) { /* ignore */ }
    const fs = require('fs');
    const tmpDir = global.__TEST_TMP_DIR;
    if (tmpDir) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
});
