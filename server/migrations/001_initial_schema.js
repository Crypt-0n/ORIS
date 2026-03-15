/**
 * Initial schema — All tables, indexes, and seed data.
 * This migration is dialect-agnostic (works on PostgreSQL, MySQL, SQLite).
 * 
 * IMPORTANT: Columns used as primary keys, foreign keys, or in unique/index
 * constraints MUST use string() (VARCHAR) instead of text(), because MySQL
 * does not support TEXT columns in key constraints without a prefix length.
 */
exports.up = async function(knex) {
    // --- Core tables ---

    await knex.schema.createTable('user_profiles', t => {
        t.string('id', 191).primary();
        t.string('email', 191).unique().notNullable();
        t.text('password_hash');
        t.string('full_name', 255).notNullable();
        t.text('role').notNullable().defaultTo('[]');
        t.integer('is_active').defaultTo(1);
        t.text('pin_hash');
        t.text('avatar_url');
        t.text('totp_secret');
        t.integer('totp_enabled').defaultTo(0);
        t.text('notification_preferences').defaultTo('{}');
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('system_config', t => {
        t.string('key', 191).primary();
        t.text('value').notNullable();
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('severities', t => {
        t.string('id', 191).primary();
        t.string('label', 191).unique().notNullable();
        t.string('color', 50).notNullable();
        t.integer('order').notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('task_results', t => {
        t.string('id', 191).primary();
        t.string('label', 191).unique().notNullable();
        t.string('color', 50).notNullable();
        t.integer('order').notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('beneficiaries', t => {
        t.string('id', 191).primary();
        t.string('name', 255).notNullable().unique();
        t.text('description');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('cases', t => {
        t.string('id', 191).primary();
        t.string('case_number', 191).unique();
        t.string('type', 50).notNullable().defaultTo('case');
        t.string('title', 500).notNullable();
        t.text('description').notNullable();
        t.string('author_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.string('severity_id', 191).notNullable().references('id').inTable('severities');
        t.string('status', 50).notNullable().defaultTo('open');
        t.string('tlp', 50).notNullable().defaultTo('AMBER');
        t.string('pap', 50).notNullable().defaultTo('GREEN');
        t.string('kill_chain_type', 100).defaultTo('cyber_kill_chain');
        t.string('attacker_utc_offset', 20);
        t.text('closure_summary');
        t.string('closed_at', 100);
        t.string('closed_by', 191).references('id').inTable('user_profiles');
        t.string('beneficiary_id', 191).notNullable().references('id').inTable('beneficiaries');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('beneficiary_members', t => {
        t.string('id', 191).primary();
        t.string('beneficiary_id', 191).notNullable().references('id').inTable('beneficiaries').onDelete('CASCADE');
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.integer('is_team_lead').defaultTo(0);
        t.text('role').defaultTo('["case_viewer","alert_viewer"]');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.unique(['beneficiary_id', 'user_id']);
    });

    await knex.schema.createTable('case_assignments', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.timestamp('assigned_at').defaultTo(knex.fn.now());
        t.unique(['case_id', 'user_id']);
    });

    // --- Tasks & comments (must exist before case_events references tasks) ---

    await knex.schema.createTable('tasks', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('title', 500).notNullable();
        t.text('description').notNullable().defaultTo('');
        t.string('result_id', 191).references('id').inTable('task_results');
        t.string('status', 50).notNullable().defaultTo('open');
        t.string('assigned_to', 191).references('id').inTable('user_profiles');
        t.string('system_id', 191);
        t.string('malware_id', 191);
        t.integer('is_osint').defaultTo(0);
        t.text('closure_comment');
        t.string('closed_at', 100);
        t.string('closed_by', 191).references('id').inTable('user_profiles');
        t.text('investigation_status');
        t.text('initial_investigation_status');
        t.string('closure_comment_modified_by', 191);
        t.string('closure_comment_modified_at', 100);
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('comments', t => {
        t.string('id', 191).primary();
        t.string('task_id', 191).notNullable().references('id').inTable('tasks').onDelete('CASCADE');
        t.string('author_id', 191).notNullable().references('id').inTable('user_profiles');
        t.text('content').notNullable();
        t.string('parent_id', 191).references('id').inTable('comments').onDelete('CASCADE');
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // --- Investigation tables ---

    await knex.schema.createTable('case_systems', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('name', 255).notNullable();
        t.string('system_type', 100).notNullable();
        t.text('ip_addresses').defaultTo('[]');
        t.string('owner', 255).defaultTo('');
        t.string('network_indicator_id', 191);
        t.text('investigation_status');
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('case_malware_tools', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('system_id', 191).references('id').inTable('case_systems').onDelete('SET NULL');
        t.string('file_name', 500).notNullable();
        t.text('file_path').defaultTo('');
        t.text('hashes').defaultTo('[]');
        t.text('description').defaultTo('');
        t.integer('is_malicious').defaultTo(1);
        t.string('creation_date', 100);
        t.string('modification_date', 100);
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191);
    });

    await knex.schema.createTable('case_compromised_accounts', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('system_id', 191).references('id').inTable('case_systems').onDelete('SET NULL');
        t.string('account_name', 255).notNullable();
        t.string('domain', 255).defaultTo('');
        t.string('sid', 255).defaultTo('');
        t.text('privileges').defaultTo('');
        t.text('context').defaultTo('');
        t.string('first_malicious_activity', 100);
        t.string('last_malicious_activity', 100);
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191);
    });

    await knex.schema.createTable('case_exfiltrations', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('exfiltration_date', 100);
        t.string('source_system_id', 191).references('id').inTable('case_systems').onDelete('SET NULL');
        t.string('exfil_system_id', 191).references('id').inTable('case_systems').onDelete('SET NULL');
        t.string('destination_system_id', 191).references('id').inTable('case_systems').onDelete('SET NULL');
        t.string('file_name', 500);
        t.float('file_size');
        t.string('file_size_unit', 50).defaultTo('Octets');
        t.text('content_description').defaultTo('');
        t.text('other_info').defaultTo('');
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191);
    });

    await knex.schema.createTable('case_network_indicators', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('ip', 100);
        t.string('domain_name', 255);
        t.integer('port');
        t.text('url');
        t.text('context').defaultTo('');
        t.string('first_activity', 100);
        t.string('last_activity', 100);
        t.string('malware_id', 191).references('id').inTable('case_malware_tools').onDelete('SET NULL');
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191);
    });

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

    await knex.schema.createTable('case_compromised_account_systems', t => {
        t.string('id', 191).primary();
        t.string('account_id', 191).notNullable().references('id').inTable('case_compromised_accounts').onDelete('CASCADE');
        t.string('system_id', 191).notNullable().references('id').inTable('case_systems').onDelete('CASCADE');
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });



    // --- File storage ---

    await knex.schema.createTable('task_files', t => {
        t.string('id', 191).primary();
        t.string('task_id', 191).notNullable().references('id').inTable('tasks').onDelete('CASCADE');
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('file_name', 500).notNullable();
        t.integer('file_size').notNullable();
        t.string('content_type', 255).notNullable();
        t.text('storage_path').notNullable();
        t.string('uploaded_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('comment_attachments', t => {
        t.string('id', 191).primary();
        t.string('comment_id', 191).notNullable().references('id').inTable('comments').onDelete('CASCADE');
        t.string('file_name', 500).notNullable();
        t.integer('file_size').notNullable();
        t.string('content_type', 255).notNullable();
        t.text('storage_path').notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // --- Audit & security ---

    await knex.schema.createTable('case_audit_log', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles');
        t.string('action', 100).notNullable();
        t.string('entity_type', 100).notNullable();
        t.string('entity_id', 191).notNullable();
        t.text('details').defaultTo('{}');
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('login_history', t => {
        t.string('id', 191).primary();
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.string('ip_address', 100);
        t.text('user_agent');
        t.integer('success').notNullable().defaultTo(1);
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('api_tokens', t => {
        t.string('id', 191).primary();
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.string('name', 255).notNullable();
        t.string('token_hash', 255).notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.string('last_used_at', 100);
    });

    // --- Notifications & push ---

    await knex.schema.createTable('notifications', t => {
        t.string('id', 191).primary();
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.string('type', 50).notNullable().defaultTo('mention');
        t.string('title', 500).notNullable();
        t.text('body');
        t.text('link');
        t.integer('is_read').notNullable().defaultTo(0);
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('push_subscriptions', t => {
        t.string('id', 191).primary();
        t.string('user_id', 191).notNullable().references('id').inTable('user_profiles').onDelete('CASCADE');
        t.string('endpoint', 500).notNullable().unique();
        t.text('keys_p256dh').notNullable();
        t.text('keys_auth').notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
    });

    // --- Webhooks ---

    await knex.schema.createTable('webhooks', t => {
        t.string('id', 191).primary();
        t.string('name', 255).notNullable();
        t.text('url').notNullable();
        t.text('events').notNullable().defaultTo('["*"]');
        t.text('secret');
        t.integer('enabled').notNullable().defaultTo(1);
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.string('last_triggered_at', 100);
    });

    // --- Diamond model ---

    await knex.schema.createTable('case_diamond_overrides', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('event_id', 191).notNullable();
        t.text('label').defaultTo('');
        t.text('adversary').defaultTo('[]');
        t.text('infrastructure').defaultTo('[]');
        t.text('capability').defaultTo('[]');
        t.text('victim').defaultTo('[]');
        t.text('notes').defaultTo('');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191).notNullable().references('id').inTable('user_profiles');
        t.unique(['case_id', 'event_id']);
    });

    await knex.schema.createTable('case_diamond_node_order', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().unique();
        t.text('node_order').defaultTo('[]');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191).notNullable();
    });

    await knex.schema.createTable('case_graph_layouts', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('graph_type', 100).notNullable();
        t.text('layout_data').notNullable();
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
        t.string('updated_by', 191).notNullable().references('id').inTable('user_profiles');
        t.unique(['case_id', 'graph_type']);
    });

    // --- Performance indexes ---

    await knex.schema.table('tasks', t => { t.index('assigned_to'); t.index('case_id'); t.index('status'); });
    await knex.schema.table('case_assignments', t => { t.index('case_id'); t.index('user_id'); });
    await knex.schema.table('beneficiary_members', t => { t.index('beneficiary_id'); t.index('user_id'); });
    await knex.schema.table('cases', t => { t.index('author_id'); t.index(['status', 'type']); t.index('beneficiary_id'); });
    await knex.schema.table('comments', t => { t.index('task_id'); });
    await knex.schema.table('case_audit_log', t => { t.index('case_id'); });
    await knex.schema.table('notifications', t => { t.index(['user_id', 'is_read']); });
    await knex.schema.table('case_events', t => { t.index('case_id'); });
    await knex.schema.table('case_systems', t => { t.index('case_id'); });
    await knex.schema.table('case_malware_tools', t => { t.index('case_id'); });
    await knex.schema.table('case_network_indicators', t => { t.index('case_id'); });
    await knex.schema.table('case_exfiltrations', t => { t.index('case_id'); });
    await knex.schema.table('case_compromised_accounts', t => { t.index('case_id'); });
    await knex.schema.table('task_files', t => { t.index('task_id'); });
    await knex.schema.table('login_history', t => { t.index('user_id'); });
    await knex.schema.table('comment_attachments', t => { t.index('comment_id'); });

    // --- Seed data ---

    await knex('severities').insert([
        { id: 'sev_low', label: 'Faible', color: '#10b981', order: 1 },
        { id: 'sev_med', label: 'Moyenne', color: '#f59e0b', order: 2 },
        { id: 'sev_high', label: 'Élevée', color: '#ef4444', order: 3 },
        { id: 'sev_crit', label: 'Critique', color: '#dc2626', order: 4 },
    ]);

    await knex('task_results').insert([
        { id: 'res_success', label: 'Succès', color: '#10b981', order: 1 },
        { id: 'res_fail', label: 'Échec', color: '#ef4444', order: 2 },
        { id: 'res_fp', label: 'Faux Positif', color: '#6b7280', order: 3 },
        { id: 'res_wait', label: 'En attente', color: '#f59e0b', order: 4 },
        { id: 'res_na', label: 'Non applicable', color: '#9ca3af', order: 5 },
    ]);

    await knex('system_config').insert({ key: 'initialization_complete', value: 'false' });
};

exports.down = async function(knex) {
    const tables = [
        'case_graph_layouts', 'case_diamond_node_order', 'case_diamond_overrides',
        'comment_attachments', 'task_files', 'case_compromised_account_systems',
        'case_events', 'case_exfiltrations', 'case_network_indicators',
        'case_malware_tools', 'case_compromised_accounts', 'case_systems',
        'comments', 'tasks', 'case_audit_log', 'case_assignments',
        'beneficiary_members', 'cases', 'beneficiaries',
        'push_subscriptions', 'notifications', 'webhooks',
        'login_history', 'api_tokens',
        'task_results', 'severities', 'system_config', 'user_profiles',
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
};
