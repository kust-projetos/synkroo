/**
 * scripts/migrate-vps.ts
 *
 * Applies Drizzle migrations to VPS PostgreSQL instances (production and staging).
 *
 * Usage:
 *   npx tsx scripts/migrate-vps.ts --target=production
 *   npx tsx scripts/migrate-vps.ts --target=staging
 *   npx tsx scripts/migrate-vps.ts --target=all
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 */

import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';

import {
  loadVpsEnv,
  readVpsSetting,
  repoRootFromModuleUrl,
  vpsEnvSourceHint,
} from './lib/vps-env.mjs';

// Re-exported to preserve this module's public surface: the parser now lives
// in the shared provider-neutral module (CRLF-safe), still covered by
// scripts/__tests__/migrate-vps-env.test.mjs.
export { parseVpsEnvContent } from './lib/vps-env.mjs';

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
  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // All connection values come exclusively from process.env or the resolved
  // private env file. No credentials, hosts, or ports are hardcoded in this file.
  const host = readVpsSetting('VPS_IP', { values });
  if (!host) {
    throw new Error(`VPS_IP is missing: set it in process.env or ${hint}`);
  }
  const portRaw = readVpsSetting('VPS_PG_PORT', { values });
  if (!portRaw) {
    throw new Error(`VPS_PG_PORT is missing: set it in process.env or ${hint}`);
  }
  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    throw new Error(`VPS_PG_PORT is invalid: expected a numeric port in process.env or ${hint}`);
  }
  const prodPassword = readVpsSetting('VPS_POSTGRES_PASSWORD', { values });
  // Strict credential separation: the staging password comes ONLY from
  // VPS_STAGING_PASSWORD (env or env file). Never fall back to the production
  // password — cross-environment credential reuse is a P1 finding.
  const stagingPassword = readVpsSetting('VPS_STAGING_PASSWORD', { values });

  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'production';
  if (targetArg !== 'production' && targetArg !== 'staging' && targetArg !== 'all') {
    throw new Error(
      `Invalid --target="${targetArg}": expected one of "production", "staging" or "all".`,
    );
  }

  if ((targetArg === 'production' || targetArg === 'all') && !prodPassword) {
    throw new Error(`VPS_POSTGRES_PASSWORD is missing: set it in process.env or ${hint}`);
  }
  if ((targetArg === 'staging' || targetArg === 'all') && !stagingPassword) {
    throw new Error(`VPS_STAGING_PASSWORD is missing: set it in process.env or ${hint}`);
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
      password: prodPassword,
    });
  }
  if (targetArg === 'staging' || targetArg === 'all') {
    targets.push({
      name: 'staging',
      database: 'synkroo_staging',
      user: 'synkroo_staging',
      password: stagingPassword,
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
