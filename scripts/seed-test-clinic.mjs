/**
 * Idempotent seed of test clinic for integration tests.
 * Run before jest --config jest.integration.config.js
 */
import { Client } from 'pg';

const DB_URL =
  process.env.DATABASE_URL ||
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

// Parse connection string to extract server address and auth.
// We connect WITHOUT a database name to create it if absent.
function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '5432', 10),
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, '') || 'postgres',
    };
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }
}

const parsed = parseDbUrl(DB_URL);
const dbName = parsed.database;

// Connect to the default 'postgres' database to create the target DB if needed.
const adminClient = new Client({
  host: parsed.host,
  port: parsed.port,
  user: parsed.user,
  password: parsed.password,
  database: 'postgres',
});

await adminClient.connect();
try {
  await adminClient.query(`CREATE DATABASE "${dbName}"`);
  console.log(`seed-test-clinic: created database "${dbName}"`);
} catch (err) {
  if (err.code === '42P04') {
    // Database already exists — OK
  } else {
    throw err;
  }
}
await adminClient.end();

// Now seed the clinic data.
const client = new Client({ connectionString: DB_URL });

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
