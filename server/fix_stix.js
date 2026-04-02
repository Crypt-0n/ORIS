const { Database, aql } = require('arangojs');
require('dotenv').config();
async function run() {
  const db = new Database({
    url: process.env.ARANGO_URL || 'http://127.0.0.1:8529',
    databaseName: process.env.ARANGO_DB_NAME || 'oris'
  });
  db.useBasicAuth(process.env.ARANGO_USER || 'root', process.env.ARANGO_PASSWORD || 'oris_dev');
  
  try {
    const cursor = await db.query(aql`
      FOR obj IN stix_objects
        FILTER obj.data.x_oris_task_id != null
        LET task = (FOR t IN tasks FILTER t._key == obj.data.x_oris_task_id RETURN t)[0]
        FILTER NOT task
        UPDATE obj WITH { data: MERGE(obj.data, { x_oris_task_id: null }) } IN stix_objects
        RETURN obj._key
    `);
    const results = await cursor.all();
    console.log(`Fixed ${results.length} orphaned STIX objects.`);
  } catch (err) { console.error(err); }
}
run();
