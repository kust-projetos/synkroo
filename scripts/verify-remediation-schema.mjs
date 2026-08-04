import pg from 'pg';

const url = process.env.TEST_DATABASE_URL || process.env.STAGING_TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL or STAGING_TEST_DATABASE_URL is required');

const pool = new pg.Pool({ connectionString: url });
try {
  const required = {
    outbox_jobs: ['clinic_id', 'operation', 'business_key'],
    consents: ['clinic_id', 'contact_id', 'contact_type', 'purpose'],
  };
  for (const [table, columns] of Object.entries(required)) {
    const result = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
      ['public', table],
    );
    const found = new Set(result.rows.map((row) => row.column_name));
    for (const column of columns) if (!found.has(column)) throw new Error(`missing ${table}.${column}`);
  }
  console.log(JSON.stringify({ status: 'pass', checks: Object.keys(required) }));
} finally {
  await pool.end();
}
