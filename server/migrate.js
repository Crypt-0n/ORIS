const { initArango, getDb } = require('./db-arango');
async function migrate() {
    await initArango();
    const db = getDb();
    console.log("Start migration...");
    const cursor = await db.query(`
        FOR obj IN stix_objects
        FILTER obj.type == 'relationship'
        LET inserted = (
            INSERT {
                _key: obj._key,
                _from: CONCAT('stix_objects/', obj.data.source_ref),
                _to: CONCAT('stix_objects/', obj.data.target_ref),
                case_id: obj.case_id,
                relationship_type: obj.data.relationship_type,
                data: obj.data,
                created_by_user_id: obj.created_by_user_id,
                created_at: obj.created_at,
                updated_at: obj.updated_at
            } INTO stix_relationships
        )
        REMOVE obj IN stix_objects
        RETURN obj._key
    `);
    const migrated = await cursor.all();
    console.log("Migrated items: ", migrated.length);
    console.log(migrated);
    process.exit(0);
}
migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
