/**
 * Migration: Create case_attacker_infra table and migrate existing
 * infrastructure_attaquant entries from case_systems.
 */
exports.up = async function(knex) {
    // 1. Create the new table
    await knex.schema.createTable('case_attacker_infra', t => {
        t.string('id', 191).primary();
        t.string('case_id', 191).notNullable().references('id').inTable('cases').onDelete('CASCADE');
        t.string('name', 255).notNullable();
        t.string('infra_type', 100).notNullable().defaultTo('autre');
        t.text('ip_addresses').defaultTo('[]');
        t.string('network_indicator_id', 191);
        t.text('description').defaultTo('');
        t.string('created_by', 191).notNullable().references('id').inTable('user_profiles');
        t.timestamp('created_at').defaultTo(knex.fn.now());
        t.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    await knex.schema.table('case_attacker_infra', t => {
        t.index('case_id');
    });

    // 2. Migrate existing infrastructure_attaquant systems to the new table
    const infraSystems = await knex('case_systems')
        .where('system_type', 'infrastructure_attaquant')
        .select('*');

    for (const sys of infraSystems) {
        await knex('case_attacker_infra').insert({
            id: sys.id,
            case_id: sys.case_id,
            name: sys.name,
            infra_type: 'autre',
            ip_addresses: sys.ip_addresses || '[]',
            network_indicator_id: sys.network_indicator_id || null,
            description: '',
            created_by: sys.created_by,
            created_at: sys.created_at,
            updated_at: sys.updated_at,
        });
    }

    // 3. Update diamond overrides: change type 'system' to 'attacker_infra' for migrated IDs
    const infraIds = new Set(infraSystems.map(s => s.id));
    if (infraIds.size > 0) {
        const overrides = await knex('case_diamond_overrides').select('*');
        for (const ov of overrides) {
            let changed = false;
            const updateAxis = (jsonStr) => {
                try {
                    const arr = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : (jsonStr || []);
                    const updated = arr.map(item => {
                        if (item.type === 'system' && infraIds.has(item.id)) {
                            changed = true;
                            return { ...item, type: 'attacker_infra' };
                        }
                        return item;
                    });
                    return JSON.stringify(updated);
                } catch {
                    return jsonStr;
                }
            };

            const newAdversary = updateAxis(ov.adversary);
            const newInfra = updateAxis(ov.infrastructure);
            const newCapability = updateAxis(ov.capability);
            const newVictim = updateAxis(ov.victim);

            if (changed) {
                await knex('case_diamond_overrides')
                    .where('id', ov.id)
                    .update({
                        adversary: newAdversary,
                        infrastructure: newInfra,
                        capability: newCapability,
                        victim: newVictim,
                    });
            }
        }

        // 4. Delete migrated systems from case_systems
        await knex('case_systems')
            .where('system_type', 'infrastructure_attaquant')
            .delete();
    }
};

exports.down = async function(knex) {
    // Move data back to case_systems if needed
    const infraItems = await knex('case_attacker_infra').select('*');
    for (const item of infraItems) {
        await knex('case_systems').insert({
            id: item.id,
            case_id: item.case_id,
            name: item.name,
            system_type: 'infrastructure_attaquant',
            ip_addresses: item.ip_addresses || '[]',
            owner: '',
            network_indicator_id: item.network_indicator_id || null,
            investigation_status: null,
            created_by: item.created_by,
            created_at: item.created_at,
            updated_at: item.updated_at,
        });
    }
    await knex.schema.dropTableIfExists('case_attacker_infra');
};
