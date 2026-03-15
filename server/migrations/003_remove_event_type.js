/**
 * Migration 003 — Remove event_type from case_events
 *
 * The event_type field is replaced by kill_chain phase + linked objects
 * for behavior derivation (lateralisation, C2, exfiltration).
 * 
 * SQLite does not support DROP COLUMN directly in older versions,
 * so we recreate the table without the column.
 */
exports.up = async function(knex) {
    const client = knex.client.config.client;

    // Check if event_type column exists
    const hasCol = await knex.schema.hasColumn('case_events', 'event_type');
    if (!hasCol) return; // Already removed (fresh DB from updated 001)

    if (client === 'sqlite3' || client === 'better-sqlite3') {
        // SQLite: recreate table without event_type
        await knex.schema.renameTable('case_events', 'case_events_old');
        await knex.schema.createTable('case_events', t => {
            t.string('id', 191).primary();
            t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
            t.string('task_id', 191).references('id').inTable('tasks').onDelete('SET NULL');
            t.text('description').defaultTo('');
            t.string('event_datetime', 100).notNullable();
            t.string('kill_chain', 255);
            t.string('malware_id', 191).references('id').inTable('case_malware_tools').onDelete('SET NULL');
            t.string('compromised_account_id', 191).references('id').inTable('case_compromised_accounts').onDelete('SET NULL');
            t.string('exfiltration_id', 191).references('id').inTable('case_exfiltrations').onDelete('SET NULL');
            t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
            t.timestamp('created_at').defaultTo(knex.fn.now());
            t.timestamp('updated_at').defaultTo(knex.fn.now());
        });
        await knex.raw(`
            INSERT INTO case_events (id, case_id, task_id, description, event_datetime, kill_chain,
                malware_id, compromised_account_id, exfiltration_id, created_by, created_at, updated_at)
            SELECT id, case_id, task_id, description, event_datetime, kill_chain,
                malware_id, compromised_account_id, exfiltration_id, created_by, created_at, updated_at
            FROM case_events_old
        `);
        await knex.schema.dropTable('case_events_old');
    } else {
        // PostgreSQL / MySQL: simple ALTER TABLE
        await knex.schema.alterTable('case_events', t => {
            t.dropColumn('event_type');
        });
    }
};

exports.down = async function(knex) {
    const hasCol = await knex.schema.hasColumn('case_events', 'event_type');
    if (hasCol) return;

    await knex.schema.alterTable('case_events', t => {
        t.string('event_type', 100).defaultTo('misc');
    });
};
