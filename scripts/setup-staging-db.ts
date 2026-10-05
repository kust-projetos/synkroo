/**
 * scripts/setup-staging-db.ts
 *
 * Configures the synkroo_staging role and database on ONE VPS PostgreSQL
 * instance.
 *
 * Usage:
 *   npx tsx scripts/setup-staging-db.ts --side=source
 *   npx tsx scripts/setup-staging-db.ts --side=target
 *
 *   --side (REQUIRED) source = the current VPS, target = the destination VPS.
 *          There is no default: a missing or invalid side aborts.
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * Connection values come from VPS_<SIDE>_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD},
 * each falling back to its deprecated generic VPS_* alias with a warning.
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
  VPS_SIDE_INVALID_CODE,
  VPS_SIDES,
  applyEnvFileWrites,
  assertEnvFileWritable,
  loadVpsEnv,
  planEnvFileWrites,
  readCliFlag,
  requireVpsSideSetting,
  resolveVpsSideSettings,
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

const USAGE = [
  'Usage:',
  '  npx tsx scripts/setup-staging-db.ts --side=source|target',
  '',
  '  --side REQUIRED. source = current VPS, target = destination VPS.',
].join('\n');

async function main() {
  const side = readCliFlag(process.argv.slice(2), 'side');
  if (side === undefined || !VPS_SIDES.includes(side)) {
    console.error(
      side === undefined
        ? `--side is required (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`
        : `--side="${side}" is not a valid side (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`,
    );
    console.error(USAGE);
    process.exit(1);
  }

  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // The staging password is NOT required here: when absent it is generated
  // below and persisted before any mutation. Every other value must resolve.
  const settings = resolveVpsSideSettings(side, {
    values,
    hint,
    require: ['IP', 'PG_PORT', 'POSTGRES_PASSWORD'],
    warn: (message: string) => console.warn(message),
  });
  // All connection values come exclusively from process.env or the resolved
  // private env file. No credentials, hosts, or ports are hardcoded in this file.
  // `requireVpsSideSetting` narrows the fields this script cannot run without:
  // the resolver may legitimately leave optional fields undefined.
  const host = requireVpsSideSetting(settings, 'ip', hint) as string;
  const port = requireVpsSideSetting(settings, 'pgPort', hint) as number;
  const prodPassword = requireVpsSideSetting(settings, 'postgresPassword', hint) as string;

  console.log(`side=${side} host=${host}:${port} source_env=${hint}`);
  if (settings.usedLegacyKeys.length > 0) {
    console.warn(
      `[deprecated] side="${side}" ainda lê as chaves genéricas ` +
        `${settings.usedLegacyKeys.join(', ')} — renomeie para as chaves ` +
        `VPS_${side.toUpperCase()}_* no .env`,
    );
  }

  // Strict credential separation: staging is never backfilled from production.
  let stagingPassword = settings.stagingPassword;
  const stagingGenerated = !stagingPassword;
  if (stagingGenerated) {
    stagingPassword = crypto.randomBytes(24).toString('hex');
  }

  // Persist the EFFECTIVE staging password in every case that would drift from
  // disk: `required` when it was generated here (losing it would orphan the
  // role credential), and synchronised when process.env supplied a value the
  // file does not already hold. A value that came from the file needs no write.
  // Same rule for the production override.
  //
  // The destination key is the one the effective value came from, so a
  // deprecated generic alias is not resurrected by this script: a generated or
  // absent value lands on the prefixed key (VPS_<SIDE>_STAGING_PASSWORD), while
  // an override of an existing generic alias keeps writing that alias.
  const stagingKey = settings.keys.stagingPassword;
  const postgresKey = settings.keys.postgresPassword;
  const { writes } = planEnvFileWrites({
    envPath,
    fileValues: values,
    overrides: {
      [stagingKey]: { value: stagingPassword, required: stagingGenerated },
      [postgresKey]: { value: prodPassword, required: false },
    },
  });
  const target = assertEnvFileWritable({ envPath, writes });
  if (target) {
    applyEnvFileWrites(target, writes);
    const stagingNote =
      stagingGenerated || settings.origins.stagingPassword === SETTING_ORIGIN_PROCESS
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
