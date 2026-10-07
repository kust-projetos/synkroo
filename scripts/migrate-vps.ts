/**
 * scripts/migrate-vps.ts
 *
 * Applies Drizzle migrations to VPS PostgreSQL instances (production and staging).
 *
 * Config: SYNKROO_VPS_ENV (canonical) > legacy fallback (deprecated,
 * see scripts/lib/load-vps-env.ts) > process.env only.
 *
 * Usage:
 *   npx tsx scripts/migrate-vps.ts --target=production
 *   npx tsx scripts/migrate-vps.ts --target=staging
 *   npx tsx scripts/migrate-vps.ts --target=all
 *   npx tsx scripts/migrate-vps.ts --target=all --dry-run   # plan only, no DB writes
 */

import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import {
  describeOrigin,
  getVpsValue,
  isDryRun,
  loadVpsEnv,
  requireVpsValue,
  type LoadedVpsEnv,
} from './lib/load-vps-env';

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
  const vpsEnv: LoadedVpsEnv = loadVpsEnv({
    requiredKeys: ['VPS_IP', 'VPS_PG_PORT'],
  });
  const dryRun = isDryRun();
  // All connection values come exclusively from process.env or the
  // loader-resolved VPS config file. No credentials, hosts, or ports are
  // hardcoded in this file.
  const host = requireVpsValue(vpsEnv, 'VPS_IP');
  const portRaw = requireVpsValue(vpsEnv, 'VPS_PG_PORT');
  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    throw new Error(
      'VPS_PG_PORT is invalid: expected a numeric port ' +
        '(via SYNKROO_VPS_ENV file or VPS_PG_PORT in process.env).',
    );
  }
  const prodPassword = getVpsValue(vpsEnv, 'VPS_POSTGRES_PASSWORD');
  // Strict credential separation: the staging password comes ONLY from
  // VPS_STAGING_PASSWORD (env or file). Never fall back to the production
  // password — cross-environment credential reuse is a P1 finding.
  const stagingPassword = getVpsValue(vpsEnv, 'VPS_STAGING_PASSWORD');

  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'production';
  if (targetArg !== 'production' && targetArg !== 'staging' && targetArg !== 'all') {
    throw new Error(
      `Invalid --target="${targetArg}": expected one of "production", "staging" or "all".`,
    );
  }

  if ((targetArg === 'production' || targetArg === 'all') && !prodPassword) {
    throw new Error(
      'VPS_POSTGRES_PASSWORD is missing: set SYNKROO_VPS_ENV to a .env file ' +
        'containing it, or export VPS_POSTGRES_PASSWORD in process.env.',
    );
  }
  if ((targetArg === 'staging' || targetArg === 'all') && !stagingPassword) {
    throw new Error(
      'VPS_STAGING_PASSWORD is missing: set SYNKROO_VPS_ENV to a .env file ' +
        'containing it, or export VPS_STAGING_PASSWORD in process.env.',
    );
  }

  const migrationsFolder = path.resolve(process.cwd(), 'src', 'lib', 'db', 'migrations');

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
    if (dryRun) {
      console.log(
        `[dry-run] Would migrate target [${t.name}]: ` +
          `host ${host}:${port}, db ${t.database}, user ${t.user}, ` +
          `migrations ${migrationsFolder} (config: ${describeOrigin(vpsEnv)}).`,
      );
      continue;
    }
    await runMigrationForTarget(host, port, t, migrationsFolder);
  }

  console.log(
    dryRun
      ? '\nDry-run complete: no migrations applied.'
      : '\nAll targeted migrations finished successfully!',
  );
}

main().catch((err) => {
  console.error('\nMigration runner error:', err.message || err);
  process.exit(1);
});
