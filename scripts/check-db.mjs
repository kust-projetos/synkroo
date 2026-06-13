#!/usr/bin/env node
/**
 * DB health check — uses pg driver to verify PostgreSQL connectivity.
 * Exit code 0 = healthy, 1 = unhealthy.
 *
 * Loads .env.local or .env automatically so it works as `npm run db:health`.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Try loading .env.local first, then .env
try {
  require('dotenv').config({ path: resolve(__dirname, '..', '.env.local') });
} catch { /* ignore */ }
try {
  require('dotenv').config();
} catch { /* ignore */ }

import pg from 'pg';

const { Pool } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || 'synkroo'}:${process.env.POSTGRES_PASSWORD || 'change-me-local-dev-password'}@${process.env.POSTGRES_HOST || '127.0.0.1'}:${process.env.POSTGRES_PORT || '55432'}/${process.env.POSTGRES_DB || 'synkroo'}`;

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    const result = await pool.query('SELECT 1 AS ok');
    if (result.rows[0]?.ok === 1) {
      console.log(`✅ Database healthy (via DATABASE_URL)`);
      process.exit(0);
    } else {
      console.error(`❌ Unexpected response: ${JSON.stringify(result.rows)}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Database connection failed`);
    console.error(`   URL: ${databaseUrl.replace(/\/\/.*@/, '//user:pass@')}`);
    console.error(`   Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error(`\n   Make sure the database is running: docker compose up -d`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
