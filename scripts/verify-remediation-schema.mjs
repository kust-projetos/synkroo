import pg from 'pg';

export const REQUIRED_SCHEMA = Object.freeze({
  outbox_jobs: Object.freeze({
    columns: Object.freeze(['clinic_id', 'operation', 'business_key']),
    uniqueKey: Object.freeze(['clinic_id', 'operation', 'business_key']),
  }),
  consents: Object.freeze({
    columns: Object.freeze(['clinic_id', 'contact_id', 'contact_type', 'purpose']),
    uniqueKey: Object.freeze(['clinic_id', 'contact_id', 'contact_type', 'purpose']),
  }),
});

function sameColumns(left, right) {
  return left.length === right.length && left.every((column, index) => column === right[index]);
}

export function validateSchemaMetadata(metadata) {
  for (const [table, contract] of Object.entries(REQUIRED_SCHEMA)) {
    const actual = metadata[table];
    if (!actual) throw new Error(`missing table ${table}`);
    for (const column of contract.columns) {
      if (!actual.columns.includes(column)) throw new Error(`missing ${table}.${column}`);
    }
    if (!actual.uniqueKeys.some((key) => sameColumns(key, contract.uniqueKey))) {
      throw new Error(`missing ${table} unique key (${contract.uniqueKey.join(', ')})`);
    }
  }
}

async function readSchemaMetadata(pool) {
  const metadata = {};
  for (const table of Object.keys(REQUIRED_SCHEMA)) {
    const columns = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
      ['public', table],
    );
    const uniqueKeys = await pool.query(`
      SELECT array_agg(attribute.attname ORDER BY key.ordinality) AS columns
      FROM pg_index AS index_definition
      JOIN pg_class AS table_definition ON table_definition.oid = index_definition.indrelid
      CROSS JOIN LATERAL unnest(index_definition.indkey) WITH ORDINALITY AS key(attnum, ordinality)
      JOIN pg_attribute AS attribute
        ON attribute.attrelid = table_definition.oid
       AND attribute.attnum = key.attnum
      WHERE table_definition.relnamespace = 'public'::regnamespace
        AND table_definition.relname = $1
        AND index_definition.indisunique = true
      GROUP BY index_definition.indexrelid
    `, [table]);
    metadata[table] = {
      columns: columns.rows.map((row) => row.column_name),
      uniqueKeys: uniqueKeys.rows.map((row) => row.columns),
    };
  }
  return metadata;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.TEST_DATABASE_URL || process.env.STAGING_TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL or STAGING_TEST_DATABASE_URL is required');

  const pool = new pg.Pool({ connectionString: url });
  try {
    const metadata = await readSchemaMetadata(pool);
    validateSchemaMetadata(metadata);
    console.log(JSON.stringify({ status: 'pass', checks: Object.keys(REQUIRED_SCHEMA) }));
  } finally {
    await pool.end();
  }
}
