/**
 * Database initialization — ORIS.
 * 
 * Initializes ArangoDB.
 * ArangoDB is the sole database for all features and STIX graph operations.
 */
const { initArango } = require('./db-arango');

async function initDatabase() {
    // 1. ArangoDB initialization (collections, graph, indexes, seeds)
    try {
        console.log('[ArangoDB] Starting initialization...');
        await initArango();
        console.log('[ArangoDB] Database is up to date.');
    } catch (err) {
        console.error('[ArangoDB] Initialization failed:', err);
        throw err;
    }
}

// Export the promise so callers can await it
module.exports = initDatabase();
