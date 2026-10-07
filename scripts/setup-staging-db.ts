/**
 * scripts/setup-staging-db.ts
 *
 * Configures the synkroo_staging role and database on the VPS PostgreSQL instance.
 *
 * Config: SYNKROO_VPS_ENV (canonical) > legacy fallback (deprecated,
 * see scripts/lib/load-vps-env.ts) > process.env only. This script WRITES the
 * config file (staging password bootstrap), so it requires a resolved file —
 * env-only mode fails fast instead of writing somewhere unknown.
 *
 * Idempotence: the staging password is generated ONLY when absent and never
 * rotated on re-runs; an existing role is verified (connect with the
 * configured password) instead of ALTERed. Re-running with equal values does
 * not rewrite the .env file (atomic tmp+rename with .bak backup on change).
 *
 * Usage:
 *   npx tsx scripts/setup-staging-db.ts
 *   npx tsx scripts/setup-staging-db.ts --dry-run   # plan only, no DB/file writes
 */

import { Client } from 'pg';
import * as crypto from 'crypto';
import {
  describeOrigin,
  getVpsValue,
  isDryRun,
  loadVpsEnv,
  redactSecrets,
  requireVpsValue,
  writeVpsEnvKey,
  type LoadedVpsEnv,
} from './lib/load-vps-env';

/**
 * Server-side literal quoting via `quote_literal($1)`: the password travels
 * as a bound parameter and only the already-quoted literal is interpolated
 * into DDL. Role/database identifiers below are fixed constants.
 */
async function quoteLiteral(adminClient: Client, value: string): Promise<string> {
  const { rows } = await adminClient.query('SELECT quote_literal($1) AS q', [value]);
  const quoted = (rows[0] as { q: unknown }).q;
  if (typeof quoted !== 'string') {
    throw new Error('Failed to quote staging password (unexpected quote_literal result).');
  }
  return quoted;
}

async function main() {
  // Write mode: require a resolved file so generated secrets always land in
  // the loader-resolved path (explicit SYNKROO_VPS_ENV or acknowledged
  // legacy fallback), never in an ad-hoc location.
  const vpsEnv: LoadedVpsEnv = loadVpsEnv({
    requiredKeys: ['VPS_IP', 'VPS_PG_PORT', 'VPS_POSTGRES_PASSWORD'],
    requireFile: true,
  });
  const dryRun = isDryRun();
  // All connection values come exclusively from process.env or the
  // loader-resolved VPS config file. No credentials, hosts, or ports are
  // hardcoded in this file.
  const host = requireVpsValue(vpsEnv, 'VPS_IP');
  const portRaw = requireVpsValue(vpsEnv, 'VPS_PG_PORT');
  const port = parseInt(portRaw, 10);
  const prodPassword = requireVpsValue(vpsEnv, 'VPS_POSTGRES_PASSWORD');

  let stagingPassword = getVpsValue(vpsEnv, 'VPS_STAGING_PASSWORD');
  let stagingPasswordGenerated = false;
  if (!stagingPassword) {
    stagingPassword = crypto.randomBytes(24).toString('hex');
    stagingPasswordGenerated = true;
    if (dryRun) {
      console.log(
        `[dry-run] Would generate VPS_STAGING_PASSWORD and save it to ${vpsEnv.configPath} ` +
          `(config: ${describeOrigin(vpsEnv)}).`,
      );
    } else {
      const outcome = writeVpsEnvKey(vpsEnv.configPath, 'VPS_STAGING_PASSWORD', stagingPassword);
      console.log(
        `Generated and saved new VPS_STAGING_PASSWORD to ${vpsEnv.configPath} (${outcome}). ` +
          'Run scripts/update-hyperdrive.ts afterwards so Hyperdrive serves the new credential.',
      );
    }
  }

  // Also ensure VPS_POSTGRES_PASSWORD is saved in the resolved config file.
  // Idempotent: skipped when the stored value is already equal.
  if (dryRun) {
    console.log(
      `[dry-run] Would ensure VPS_POSTGRES_PASSWORD is stored in ${vpsEnv.configPath} (config: ${describeOrigin(vpsEnv)}).`,
    );
  } else {
    writeVpsEnvKey(vpsEnv.configPath, 'VPS_POSTGRES_PASSWORD', prodPassword);
  }

  const adminClient = new Client({
    host,
    port,
    user: 'synkroo',
    password: prodPassword,
    database: 'synkroo',
    ssl: { rejectUnauthorized: false },
  });

  if (dryRun) {
    console.log(
      `[dry-run] Would connect to ${host}:${port} as synkroo, ensure role synkroo_staging ` +
        `(create only if missing — never rotate), ensure database synkroo_staging, ` +
        `install extensions (vector, btree_gist), and grant schema usage. No changes made.`,
    );
    return;
  }

  await adminClient.connect();
  console.log('Connected to VPS postgres as synkroo superuser.');

  // Create role synkroo_staging if not exists. Never rotate the password of
  // an existing role: re-runs verify credentials instead, so Hyperdrive and
  // the config file cannot silently drift apart.
  const roleCheck = await adminClient.query(
    "SELECT 1 FROM pg_roles WHERE rolname = 'synkroo_staging'"
  );
  if (roleCheck.rows.length === 0) {
    console.log('Creating role synkroo_staging...');
    const quoted = await quoteLiteral(adminClient, stagingPassword);
    await adminClient.query(
      `CREATE ROLE synkroo_staging WITH LOGIN PASSWORD ${quoted} CREATEDB;`
    );
    if (!stagingPasswordGenerated) {
      console.log(
        'Role synkroo_staging created with the configured password. ' +
          'If Hyperdrive still serves an older credential, run scripts/update-hyperdrive.ts.',
      );
    }
  } else {
    console.log('Role synkroo_staging exists; verifying configured credentials (no rotation)...');
    const stagingProbe = new Client({
      host,
      port,
      user: 'synkroo_staging',
      password: stagingPassword,
      database: 'synkroo',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await stagingProbe.connect();
      await stagingProbe.end();
      console.log('Configured VPS_STAGING_PASSWORD authenticates as synkroo_staging.');
    } catch {
      throw new Error(
        'INCONSISTENCY: role synkroo_staging exists but the configured VPS_STAGING_PASSWORD ' +
          'does not authenticate. Refusing silent rotation: rotate deliberately ' +
          '(ALTER ROLE + update config + scripts/update-hyperdrive.ts) instead.',
      );
    }
  }

  // Create database synkroo_staging if not exists
  const dbCheck = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = 'synkroo_staging'"
  );
  if (dbCheck.rows.length === 0) {
    console.log('Creating database synkroo_staging...');
    await adminClient.query(
      `CREATE DATABASE synkroo_staging OWNER synkroo_staging;`
    );
  } else {
    console.log('Database synkroo_staging already exists.');
  }

  await adminClient.end();

  // Connect to synkroo_staging and install extensions & permissions
  const stagingAdminClient = new Client({
    host,
    port,
    user: 'synkroo',
    password: prodPassword,
    database: 'synkroo_staging',
    ssl: { rejectUnauthorized: false },
  });
  await stagingAdminClient.connect();
  console.log('Connected to synkroo_staging to configure extensions.');
  await stagingAdminClient.query('CREATE EXTENSION IF NOT EXISTS vector;');
  await stagingAdminClient.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');
  await stagingAdminClient.query('GRANT ALL ON SCHEMA public TO synkroo_staging;');
  await stagingAdminClient.end();

  console.log('Staging database and role initialized successfully!');
}

main().catch(err => {
  // Log the message string only (redacted): never the raw error object,
  // which may carry connection strings, SQL text, or other internals.
  const message = err instanceof Error ? redactSecrets(err.message) : 'unknown error';
  console.error('Setup failed:', message);
  process.exit(1);
});
