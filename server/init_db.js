/**
 * Database initialization — ORIS.
 * 
 * Runs Knex migrations to create/update the schema.
 * This replaces the previous raw SQL schema + auto-migration approach.
 * Works with PostgreSQL, MySQL, and SQLite.
 */
const db = require('./db');

async function initDatabase() {
    console.log('Running database migrations...');
    try {
        const [batchNo, log] = await db.migrate.latest();
        if (log.length === 0) {
            console.log('Database schema is up to date.');
        } else {
            console.log(`Batch ${batchNo} applied ${log.length} migrations:`);
            log.forEach(f => console.log(`  - ${f}`));
        }
    } catch (err) {
        console.error('Migration failed:', err);
        throw err;
    }
}

// Export the promise so callers can await it
module.exports = initDatabase();
