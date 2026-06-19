/**
 * Idempotent seed of test clinic for integration tests.
 * Run before jest --config jest.integration.config.js
 */
import { Client } from 'pg';

const CONN_STRING =
  process.env.DATABASE_URL ||
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

const client = new Client({ connectionString: CONN_STRING });

try {
  await client.connect();
  const res = await client.query(
    `INSERT INTO clinics (id, name, slug, phone, email)
     VALUES ('00000000-0000-0000-0000-000000000001', 'Test Clinic', 'test-clinic', '+5500000000000', 'test@clinic.local')
     ON CONFLICT (id) DO NOTHING`
  );
  console.log(`seed-test-clinic: rowCount=${res.rowCount ?? 0}`);
} catch (err) {
  console.error('seed-test-clinic: ERROR', err.message);
  await client.end();
  process.exit(1);
}

await client.end();
