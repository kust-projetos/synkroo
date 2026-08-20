/**
 * Idempotent seed of deterministic clinic and credentials for integration/E2E tests.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  "postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo";
let CLINIC_ID = "00000000-0000-0000-0000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const DEMO_EMAIL = "admin@clinicademo.com";
const DEMO_PASSWORD = "demo123";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function parseDbUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "5432", 10),
      user: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    throw new Error("Invalid DATABASE_URL");
  }
}

const parsed = parseDbUrl(DB_URL);
const adminClient = new Client({ ...parsed, database: "postgres" });
await adminClient.connect();
try {
  await adminClient.query(`CREATE DATABASE "${parsed.database}"`);
} catch (error) {
  if (error.code !== "42P04") throw error;
} finally {
  await adminClient.end();
}

const client = new Client({ connectionString: DB_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO clinics (id, name, slug, phone, email)
     VALUES ($1, 'Clinica Demo', 'clinica-demo', '+5500000000000', 'contato@clinicademo.com')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, phone = EXCLUDED.phone, email = EXCLUDED.email, deleted_at = NULL
     RETURNING id`,
    [CLINIC_ID],
  );
  const clinicResult = await client.query(
    "SELECT id FROM clinics WHERE slug = $1 LIMIT 1",
    ["clinica-demo"],
  );
  CLINIC_ID = clinicResult.rows[0].id;
  await client.query(
    `INSERT INTO users (id, clinic_id, email, name, role, is_active)
     VALUES ($1, $2, $3, 'Admin Demo', 'owner', true)
     ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, email = EXCLUDED.email, role = EXCLUDED.role, is_active = true`,
    [USER_ID, CLINIC_ID, DEMO_EMAIL],
  );
  await client.query(
    `INSERT INTO user_credentials (user_id, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
    [USER_ID, hashPassword(DEMO_PASSWORD)],
  );
  await client.query(
    `INSERT INTO dentists (id, clinic_id, name, phone, email, cro, specialty, is_active, working_hours)
     VALUES
       ('00000000-0000-4000-8000-000000000010', $1, 'Dra. Ana Demo', '+5511999000010', 'ana.demo@clinicademo.com', 'CRO-E2E-001', 'Clínica Geral', true, '{}'::jsonb),
       ('00000000-0000-4000-8000-000000000011', $1, 'Dr. Bruno Demo', '+5511999000011', 'bruno.demo@clinicademo.com', 'CRO-E2E-002', 'Implantodontia', true, '{}'::jsonb)
     ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, name = EXCLUDED.name, is_active = true, deleted_at = NULL`,
    [CLINIC_ID],
  );
  await client.query(
    `INSERT INTO procedures (id, clinic_id, name, description, duration_minutes, price, category, is_active)
     VALUES
       ('00000000-0000-4000-8000-000000000020', $1, 'Consulta Demo', 'Consulta clínica para fixtures E2E', 30, '150.00', 'Consulta', true),
       ('00000000-0000-4000-8000-000000000021', $1, 'Limpeza Demo', 'Profilaxia para fixtures E2E', 60, '220.00', 'Preventiva', true),
       ('00000000-0000-4000-8000-000000000022', $1, 'Implante Demo', 'Implantodontia para fixtures E2E', 120, '3500.00', 'Implantodontia', true)
     ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, name = EXCLUDED.name, duration_minutes = EXCLUDED.duration_minutes, price = EXCLUDED.price, is_active = true, deleted_at = NULL`,
    [CLINIC_ID],
  );
  await client.query("COMMIT");
  console.log("seed-test-clinic: deterministic clinic and credentials ready");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(
    "seed-test-clinic: ERROR",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
