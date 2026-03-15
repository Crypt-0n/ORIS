/**
 * Migration 002 — Task-Centric Investigation (Approach B: Highlight Container)
 *
 * 1. Adds `task_id` nullable FK to all 5 investigation entity tables,
 *    so objects can be scoped to a specific task while remaining case-level.
 *
 * 2. Creates `event_linked_objects` — a STIX-like relationship table (SRO)
 *    linking highlights (case_events) to investigation objects, with a
 *    Diamond Model axis classification.
 *
 * Backward-compatible: existing data has task_id = NULL → still visible at case level.
 */
exports.up = async function(knex) {
    // --- Phase 1: Add task_id to investigation tables ---

    await knex.schema.alterTable('case_systems', t => {
        t.string('task_id', 191).references('id').inTable('tasks').onDelete('SET NULL');
    });

    await knex.schema.alterTable('case_malware_tools', t => {
        t.string('task_id', 191).references('id').inTable('tasks').onDelete('SET NULL');
    });

    await knex.schema.alterTable('case_compromised_accounts', t => {
        t.string('task_id', 191).references('id').inTable('tasks').onDelete('SET NULL');
    });

    await knex.schema.alterTable('case_network_indicators', t => {
        t.string('task_id', 191).references('id').inTable('tasks').onDelete('SET NULL');
    });

    await knex.schema.alterTable('case_exfiltrations', t => {
        t.string('task_id', 191).references('id').inTable('tasks').onDelete('SET NULL');
    });

    // --- Phase 2: Create event_linked_objects (STIX SRO-like) ---

    await knex.schema.createTable('event_linked_objects', t => {
        t.string('id', 191).primary();
        t.string('event_id', 191).notNullable()
            .references('id').inTable('case_events').onDelete('CASCADE');
        t.string('object_type', 50).notNullable();   // system, malware, account, indicator, exfiltration
        t.string('object_id', 191).notNullable();
        t.string('diamond_axis', 50);                 // adversary, infrastructure, capability, victim
        t.string('created_by', 191).references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // Performance indexes
    await knex.schema.table('event_linked_objects', t => {
        t.index('event_id');
        t.index(['object_type', 'object_id']);
    });

    // Indexes for task_id lookups
    await knex.schema.table('case_systems', t => { t.index('task_id'); });
    await knex.schema.table('case_malware_tools', t => { t.index('task_id'); });
    await knex.schema.table('case_compromised_accounts', t => { t.index('task_id'); });
    await knex.schema.table('case_network_indicators', t => { t.index('task_id'); });
    await knex.schema.table('case_exfiltrations', t => { t.index('task_id'); });
};

exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('event_linked_objects');

    for (const table of [
        'case_systems', 'case_malware_tools', 'case_compromised_accounts',
        'case_network_indicators', 'case_exfiltrations',
    ]) {
        await knex.schema.alterTable(table, t => {
            t.dropColumn('task_id');
        });
    }
};
