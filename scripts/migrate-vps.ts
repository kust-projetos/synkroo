/**
 * scripts/migrate-vps.ts
 *
 * Applies Drizzle migrations to VPS PostgreSQL instances (production and staging).
 *
 * Usage:
 *   npx tsx scripts/migrate-vps.ts --side=source --target=production
 *   npx tsx scripts/migrate-vps.ts --side=source --target=staging
 *   npx tsx scripts/migrate-vps.ts --side=target --target=all
 *
 *   --side   (REQUIRED) which VPS this run touches: `source` = the host the
 *            data lives on today, `target` = the host it is being moved to.
 *            There is no default: a missing or invalid side aborts.
 *   --target which database INSIDE that VPS: production | staging | all
 *            (default production). Orthogonal to --side.
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * Connection values come from VPS_<SIDE>_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD},
 * each falling back to its deprecated generic VPS_* alias with a warning.
 */

import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';

import {
  VPS_SIDE_INVALID_CODE,
  VPS_SIDES,
  loadVpsEnv,
  readCliFlag,
  repoRootFromModuleUrl,
  requireVpsSideSetting,
  resolveVpsSideSettings,
  vpsEnvSourceHint,
} from './lib/vps-env.mjs';

// Re-exported to preserve this module's public surface: the parser now lives
// in the shared provider-neutral module (CRLF-safe), still covered by
// scripts/__tests__/migrate-vps-env.test.mjs.
export { parseVpsEnvContent } from './lib/vps-env.mjs';

const USAGE = [
  'Usage:',
  '  npx tsx scripts/migrate-vps.ts --side=source|target [--target=production|staging|all]',
  '',
  '  --side   REQUIRED. source = current VPS, target = destination VPS.',
  '  --target database inside that VPS (default: production).',
].join('\n');

interface TargetConfig {
  name: string;
  database: string;
  user: string;
  password?: string;
}

async function runMigrationForTarget(
  host: string,
  port: number,
  target: TargetConfig,
  migrationsFolder: string,
) {
  console.log(`\n========================================`);
  console.log(`Starting migration for target: [${target.name}]`);
  console.log(`Host: ${host}:${port}, DB: ${target.database}, User: ${target.user}`);
  console.log(`========================================`);

  const client = new Client({
    host,
    port,
    user: target.user,
    password: target.password,
    database: target.database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log(`Connected to database [${target.database}] successfully.`);

    // Ensure prerequisite extensions exist
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await client.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');
    console.log('Prerequisite extensions (vector, btree_gist) verified.');

    const db = drizzle(client);
    console.log(`Applying Drizzle migrations from: ${migrationsFolder}...`);

    await migrate(db, { migrationsFolder });
    console.log(`SUCCESS: Migrations applied successfully for [${target.name}]!`);

    // Verification check
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log(`Verified: ${rows.length} tables found in [${target.database}].`);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);

  const side = readCliFlag(args, 'side');
  if (side === undefined || !VPS_SIDES.includes(side)) {
    console.error(
      side === undefined
        ? `--side is required (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`
        : `--side="${side}" is not a valid side (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`,
    );
    console.error(USAGE);
    process.exit(1);
  }

  const targetArg = readCliFlag(args, 'target') ?? 'production';
  if (targetArg !== 'production' && targetArg !== 'staging' && targetArg !== 'all') {
    throw new Error(
      `Invalid --target="${targetArg}": expected one of "production", "staging" or "all".`,
    );
  }

  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // Only the credentials this run actually connects with are mandatory: a
  // --target=staging run must not demand the production password, and vice
  // versa. Connection separation is preserved — staging is never backfilled.
  const requiredFields = ['IP', 'PG_PORT'];
  if (targetArg !== 'staging') requiredFields.push('POSTGRES_PASSWORD');
  if (targetArg !== 'production') requiredFields.push('STAGING_PASSWORD');

  // All connection values come exclusively from process.env or the resolved
  // private env file. No credentials, hosts, or ports are hardcoded in this file.
  const settings = resolveVpsSideSettings(side, {
    values,
    hint,
    require: requiredFields,
    warn: (message: string) => console.warn(message),
  });
  const host = requireVpsSideSetting(settings, 'ip', hint) as string;
  const port = requireVpsSideSetting(settings, 'pgPort', hint) as number;

  console.log(`side=${side} host=${host}:${port} source_env=${hint}`);
  if (settings.usedLegacyKeys.length > 0) {
    console.warn(
      `[deprecated] side="${side}" ainda lê as chaves genéricas ` +
        `${settings.usedLegacyKeys.join(', ')} — renomeie para as chaves ` +
        `VPS_${side.toUpperCase()}_* no .env`,
    );
  }

  // Repo-root derived from this script's location (not process.cwd()), so the
  // migration folder resolves the same regardless of the caller's directory.
  const migrationsFolder = path.resolve(repoRootFromModuleUrl(), 'src', 'lib', 'db', 'migrations');

  const targets: TargetConfig[] = [];
  if (targetArg === 'production' || targetArg === 'all') {
    targets.push({
      name: 'production',
      database: 'synkroo',
      user: 'synkroo',
      password: requireVpsSideSetting(settings, 'postgresPassword', hint) as string,
    });
  }
  if (targetArg === 'staging' || targetArg === 'all') {
    targets.push({
      name: 'staging',
      database: 'synkroo_staging',
      user: 'synkroo_staging',
      password: requireVpsSideSetting(settings, 'stagingPassword', hint) as string,
    });
  }

  for (const t of targets) {
    await runMigrationForTarget(host, port, t, migrationsFolder);
  }

  console.log('\nAll targeted migrations finished successfully!');
}

main().catch((err) => {
  console.error('\nMigration runner error:', err.message || err);
  process.exit(1);
});
