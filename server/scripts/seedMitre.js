/**
 * MITRE ATT&CK Enterprise Seeder
 *
 * Downloads the official STIX 2.1 bundle from the MITRE CTI repository
 * and upserts all objects into the ArangoDB `kb_stix_objects` collection.
 *
 * Usage:  node server/scripts/seedMitre.js
 */
const { initArango, getDb, closeArango } = require('../db-arango');

const MITRE_URL =
    'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';

async function seed() {
    console.log('[SeedMitre] Initializing database connection...');
    await initArango();
    const db = getDb();

    console.log('[SeedMitre] Downloading MITRE ATT&CK Enterprise bundle...');
    const res = await fetch(MITRE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    const bundle = await res.json();

    const objects = bundle.objects;
    if (!Array.isArray(objects) || objects.length === 0) {
        throw new Error('No objects found in the STIX bundle');
    }
    console.log(`[SeedMitre] Parsed ${objects.length} STIX objects.`);

    const col = db.collection('kb_stix_objects');

    // Process in batches of 500 for efficiency
    const BATCH = 500;
    let inserted = 0;
    let updated = 0;

    for (let i = 0; i < objects.length; i += BATCH) {
        const slice = objects.slice(i, i + BATCH);
        const queries = slice.map((obj) => {
            // ArangoDB _key cannot contain '--', replace with '_'
            const key = obj.id.replace(/--/g, '_');
            return db.query(
                `UPSERT { _key: @key }
                 INSERT MERGE(@obj, { _key: @key })
                 UPDATE @obj
                 IN kb_stix_objects
                 RETURN { type: OLD ? 'update' : 'insert' }`,
                { key, obj }
            );
        });
        const results = await Promise.all(queries);
        for (const cursor of results) {
            const r = await cursor.next();
            if (r.type === 'insert') inserted++;
            else updated++;
        }
        process.stdout.write(`\r[SeedMitre] Progress: ${Math.min(i + BATCH, objects.length)} / ${objects.length}`);
    }

    console.log(`\n[SeedMitre] Done — ${inserted} inserted, ${updated} updated.`);

    // Show attack-pattern count as sanity check
    const countCursor = await db.query(`RETURN LENGTH(FOR o IN kb_stix_objects FILTER o.type == 'attack-pattern' RETURN 1)`);
    const attackPatternCount = await countCursor.next();
    console.log(`[SeedMitre] attack-pattern count: ${attackPatternCount}`);

    closeArango();
}

seed().catch((err) => {
    console.error('[SeedMitre] Fatal error:', err);
    process.exit(1);
});
