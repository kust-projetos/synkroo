// ──────────────────────────────────────────────
// Drizzle DB client — shared server-side handle
// Uses node-postgres (pg) pool under the hood.
//
// Runtime detection:
//   Workers  → binding env.HYPERDRIVE.connectionString (via setDbConnectionString)
//   Node.js  → process.env.DATABASE_URL
//   Neither  → explicit error
// ──────────────────────────────────────────────
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let _hyperdriveConnString: string | null = null;
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _lastConnString: string | null = null;

/**
 * Inject the Hyperdrive connection string (called at Worker bootstrap).
 * Pass `null` to reset (useful in tests).
 */
export function setDbConnectionString(connString: string | null): void {
  _hyperdriveConnString = connString;
}

/**
 * Resolve the active connection string:
 *   1. Hyperdrive binding (Workers runtime)
 *   2. DATABASE_URL env var (dev/local)
 *   3. Throw with guidance if both are absent
 */
export function resolveConnectionString(): string {
  if (_hyperdriveConnString) return _hyperdriveConnString;
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) return envUrl;
  throw new Error(
    '[DB] No database connection available.\n' +
      '  In production (Workers): call setDbConnectionString(env.HYPERDRIVE.connectionString) at bootstrap.\n' +
      '  In dev/local: set DATABASE_URL in .env.local or .env.\n' +
      '  Example: DATABASE_URL=postgres://synkroo:synkroo_dev@localhost:5432/synkroo',
  );
}

/**
 * Return the shared Drizzle DB handle.
 * Lazily connects on first call using the resolved connection string.
 * Recreates pool if connection string changes.
 */
export function getDb() {
  const connString = resolveConnectionString();

  // Recreate pool if connection string changed (e.g., dev → prod or test reset)
  if (_db && connString !== _lastConnString) {
    _db = null;
    _pool = null;
    _lastConnString = null;
  }
  if (_db) return _db;

  _pool = new Pool({ connectionString: connString });
  _db = drizzle(_pool, { schema });
  _lastConnString = connString;
  return _db;
}

/**
 * Close the DB pool (useful in tests / teardown).
 */
export async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    _lastConnString = null;
  }
}
