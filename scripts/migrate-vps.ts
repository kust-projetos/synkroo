/**
 * scripts/migrate-vps.ts
 *
 * Applies Drizzle migrations to VPS PostgreSQL instances (production and staging).
 *
 * Usage:
 *   npx tsx scripts/migrate-vps.ts --target=production
 *   npx tsx scripts/migrate-vps.ts --target=staging
 *   npx tsx scripts/migrate-vps.ts --target=all
 */

import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parses `.env` content into a key/value map.
 *
 * Exported for unit testing (scripts/__tests__/migrate-vps-env.test.mjs).
 * Splits on `/\r?\n/` so files with Windows (CRLF) line endings parse the
 * same as LF: a trailing `\r` would otherwise defeat the end-of-line `$`
 * anchor and silently drop the line.
 */
export function parseVpsEnvContent(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }
  return env;
}

function loadVpsEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '..', 'vps-hostinger', '.env');
  if (fs.existsSync(envPath)) {
    return parseVpsEnvContent(fs.readFileSync(envPath, 'utf8'));
  }
  return {};
}

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
  const vpsEnv = loadVpsEnv();
  // All connection values come exclusively from process.env or ../vps-hostinger/.env.
  // No credentials, hosts, or ports are hardcoded in this file.
  const host = process.env.VPS_IP || vpsEnv.VPS_IP;
  if (!host) {
    throw new Error('VPS_IP is missing: set it in process.env or ../vps-hostinger/.env');
  }
  const portRaw = process.env.VPS_PG_PORT || vpsEnv.VPS_PG_PORT;
  if (!portRaw) {
    throw new Error('VPS_PG_PORT is missing: set it in process.env or ../vps-hostinger/.env');
  }
  const port = parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    throw new Error('VPS_PG_PORT is invalid: expected a numeric port in process.env or ../vps-hostinger/.env');
  }
  const prodPassword = process.env.VPS_POSTGRES_PASSWORD || vpsEnv.VPS_POSTGRES_PASSWORD;
  // Strict credential separation: the staging password comes ONLY from
  // VPS_STAGING_PASSWORD (env or vpsEnv). Never fall back to the production
  // password — cross-environment credential reuse is a P1 finding.
  const stagingPassword = process.env.VPS_STAGING_PASSWORD || vpsEnv.VPS_STAGING_PASSWORD;

  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'production';
  if (targetArg !== 'production' && targetArg !== 'staging' && targetArg !== 'all') {
    throw new Error(
      `Invalid --target="${targetArg}": expected one of "production", "staging" or "all".`,
    );
  }

  if ((targetArg === 'production' || targetArg === 'all') && !prodPassword) {
    throw new Error('VPS_POSTGRES_PASSWORD is missing: set it in process.env or ../vps-hostinger/.env');
  }
  if ((targetArg === 'staging' || targetArg === 'all') && !stagingPassword) {
    throw new Error('VPS_STAGING_PASSWORD is missing: set it in process.env or ../vps-hostinger/.env');
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
    await runMigrationForTarget(host, port, t, migrationsFolder);
  }

  console.log('\nAll targeted migrations finished successfully!');
}

main().catch((err) => {
  console.error('\nMigration runner error:', err.message || err);
  process.exit(1);
});
