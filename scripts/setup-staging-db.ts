/**
 * scripts/setup-staging-db.ts
 *
 * Configures the synkroo_staging role and database on the VPS PostgreSQL instance.
 */

import { Client } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function loadVpsEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.resolve(process.cwd(), '..', 'vps-hostinger', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^['"]|['"]$/g, '');
        env[key] = val;
      }
    }
  }
  return env;
}

function updateVpsEnv(key: string, value: string) {
  const envPath = path.resolve(process.cwd(), '..', 'vps-hostinger', '.env');
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trimEnd() + `\n${key}=${value}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
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
  const prodPassword = process.env.VPS_POSTGRES_PASSWORD || vpsEnv.VPS_POSTGRES_PASSWORD;
  if (!prodPassword) {
    throw new Error('VPS_POSTGRES_PASSWORD is missing: set it in process.env or ../vps-hostinger/.env');
  }

  let stagingPassword = process.env.VPS_STAGING_PASSWORD || vpsEnv.VPS_STAGING_PASSWORD;
  if (!stagingPassword) {
    stagingPassword = crypto.randomBytes(24).toString('hex');
    updateVpsEnv('VPS_STAGING_PASSWORD', stagingPassword);
    console.log('Generated and saved new VPS_STAGING_PASSWORD to ../vps-hostinger/.env');
  }

  // Also ensure VPS_POSTGRES_PASSWORD is saved in ../vps-hostinger/.env
  updateVpsEnv('VPS_POSTGRES_PASSWORD', prodPassword);

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
    "SELECT 1 FROM pg_roles WHERE rolname = 'synkroo_staging'"
  );
  if (roleCheck.rows.length === 0) {
    console.log('Creating role synkroo_staging...');
    await adminClient.query(
      `CREATE ROLE synkroo_staging WITH LOGIN PASSWORD '${stagingPassword}' CREATEDB;`
    );
  } else {
    console.log('Updating password for role synkroo_staging...');
    await adminClient.query(
      `ALTER ROLE synkroo_staging WITH PASSWORD '${stagingPassword}' CREATEDB;`
    );
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
  console.error('Setup failed:', err);
  process.exit(1);
});
