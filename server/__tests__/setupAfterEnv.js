/**
 * Jest setupAfterEnv — runs in the test context where beforeAll/afterAll are available.
 * Handles dropping the ArangoDB isolated test database after tests finish.
 */

beforeAll(async () => {
    await require('../init_db');
});

afterAll(async () => {
    // Truncate all collections in the worker's isolated ArangoDB instance
    const dbName = global.__TEST_ARANGO_DB || process.env.ARANGO_DB;
    if (dbName) {
        try {
            const { getDb } = require('../db-arango');
            const db = getDb();
            const collections = await db.collections();
            for (const col of collections) {
                if (!col.name.startsWith('_')) {
                    await db.collection(col.name).truncate();
                }
            }
        } catch (e) {
            console.error(`[ArangoDB] Failed to truncate collections in ${dbName}:`, e.message);
        }
    }

});
