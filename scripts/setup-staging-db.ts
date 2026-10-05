/**
 * scripts/setup-staging-db.ts
 *
 * Configures the synkroo_staging role and database on the VPS PostgreSQL instance.
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * Fail-closed preflight: the effective credentials are persisted BEFORE any
 * database mutation — a generated staging password, or a process.env override
 * that diverges from the file, would otherwise leave the DB holding a
 * credential that exists nowhere on disk. A missing/unwritable env file aborts
 * the run. Writes are atomic (temp file + rename) with mode 0600.
 *
 * Error output is secrets-safe: driver errors embed the statement text, and the
 * CREATE/ALTER ROLE statements carry the staging password, so only an
 * allowlisted code is ever printed.
 */

import { Client } from 'pg';
import * as crypto from 'crypto';

import {
  applyEnvFileWrites,
  assertEnvFileWritable,
  loadVpsEnv,
  planEnvFileWrites,
  readVpsSetting,
  readVpsSettingWithOrigin,
  SETTING_ORIGIN_PROCESS,
  vpsEnvSourceHint,
} from './lib/vps-env.mjs';
import {
  alterRolePasswordDdl,
  createDatabaseOwnedByDdl,
  createRoleWithPasswordDdl,
  grantAllOnSchemaPublicDdl,
  quotePgLiteral,
  safeDbErrorSummary,
} from './lib/pg-ddl.mjs';

const STAGING_ROLE = 'synkroo_staging';
const STAGING_DATABASE = 'synkroo_staging';

/** Missing-setting errors are operator-authored from key names + origin hints. */
function missingSettingError(key: string, hint: string): Error {
  const error = new Error(`${key} is missing: set it in process.env or ${hint}`) as Error & {
    code?: string;
  };
  error.code = 'SYNKROO_MISSING_SETTING';
  return error;
}

async function main() {
  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // All connection values come exclusively from process.env or the resolved
  // private env file. No credentials, hosts, or ports are hardcoded in this file.
  const host = readVpsSetting('VPS_IP', { values });
  if (!host) {
    throw missingSettingError('VPS_IP', hint);
  }
  const portRaw = readVpsSetting('VPS_PG_PORT', { values });
  if (!portRaw) {
    throw missingSettingError('VPS_PG_PORT', hint);
  }
  const port = parseInt(portRaw, 10);
  const prodPassword = readVpsSetting('VPS_POSTGRES_PASSWORD', { values });
  if (!prodPassword) {
    throw missingSettingError('VPS_POSTGRES_PASSWORD', hint);
  }

  // Strict credential separation: staging is never backfilled from production.
  const staging = readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', { values });
  let stagingPassword = staging.value;
  let stagingGenerated = false;
  if (!stagingPassword) {
    stagingPassword = crypto.randomBytes(24).toString('hex');
    stagingGenerated = true;
  }

  // Persist the EFFECTIVE staging password in every case that would drift from
  // disk: `required` when it was generated here (losing it would orphan the
  // role credential), and synchronised when process.env supplied a value the
  // file does not already hold. A value that came from the file needs no write.
  // Same rule for the production override.
  const { writes } = planEnvFileWrites({
    envPath,
    fileValues: values,
    overrides: {
      VPS_STAGING_PASSWORD: { value: stagingPassword, required: stagingGenerated },
      VPS_POSTGRES_PASSWORD: { value: prodPassword, required: false },
    },
  });
  const target = assertEnvFileWritable({ envPath, writes });
  if (target) {
    applyEnvFileWrites(target, writes);
    const stagingNote =
      stagingGenerated || staging.origin === SETTING_ORIGIN_PROCESS
        ? ' (staging password generated or overridden)'
        : '';
    console.log(`Persisted credentials to ${target} before touching the database${stagingNote}.`);
  }

  const adminClient = new Client({
    host,
    port,
    user: 'synkroo',
    password: prodPassword,
    database: 'synkroo',
    ssl: { rejectUnauthorized: false },
  });

  await adminClient.connect();
  console.log('Connected to VPS postgres as synkroo superuser.');

  // Create role synkroo_staging if not exists
  const roleCheck = await adminClient.query(
    `SELECT 1 FROM pg_roles WHERE rolname = ${quotePgLiteral(STAGING_ROLE)}`
  );
  if (roleCheck.rows.length === 0) {
    console.log(`Creating role ${STAGING_ROLE}...`);
    await adminClient.query(createRoleWithPasswordDdl({ role: STAGING_ROLE, password: stagingPassword }));
  } else {
    console.log(`Updating password for role ${STAGING_ROLE}...`);
    await adminClient.query(alterRolePasswordDdl({ role: STAGING_ROLE, password: stagingPassword }));
  }

  // Create database synkroo_staging if not exists
  const dbCheck = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = ${quotePgLiteral(STAGING_DATABASE)}`
  );
  if (dbCheck.rows.length === 0) {
    console.log(`Creating database ${STAGING_DATABASE}...`);
    await adminClient.query(
      createDatabaseOwnedByDdl({ database: STAGING_DATABASE, owner: STAGING_ROLE })
    );
  } else {
    console.log(`Database ${STAGING_DATABASE} already exists.`);
  }

  await adminClient.end();

  // Connect to synkroo_staging and install extensions & permissions
  const stagingAdminClient = new Client({
    host,
    port,
    user: 'synkroo',
    password: prodPassword,
    database: STAGING_DATABASE,
    ssl: { rejectUnauthorized: false },
  });
  await stagingAdminClient.connect();
  console.log(`Connected to ${STAGING_DATABASE} to configure extensions.`);
  await stagingAdminClient.query('CREATE EXTENSION IF NOT EXISTS vector;');
  await stagingAdminClient.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');
  await stagingAdminClient.query(grantAllOnSchemaPublicDdl({ role: STAGING_ROLE }));
  await stagingAdminClient.end();

  console.log('Staging database and role initialized successfully!');
}

main().catch((err) => {
  // Never print raw driver text: pg errors embed the failing statement, and the
  // CREATE/ALTER ROLE statements carry the staging password in clear text — a
  // password loaded from the env file or generated here would leak into logs.
  // Only an operator-authored preflight message (SYNKROO_* code) or an
  // allowlisted code is surfaced.
  console.error('Setup failed:', safeDbErrorSummary(err));
  process.exit(1);
});
