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
import * as schema from './schema/index';

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
function hydrateHyperdriveConnection(): void {
  const globalConnection = (globalThis as { __SYNKROO_HYPERDRIVE?: string }).__SYNKROO_HYPERDRIVE;
  if (globalConnection && globalConnection !== _hyperdriveConnString) {
    _hyperdriveConnString = globalConnection;
  }

  // Cloudflare context is read by instrumentation.ts and injected here. Keeping
  // this client free of the OpenNext ESM-only helper preserves Node/Jest support.
}

export function resolveConnectionString(): string {
  hydrateHyperdriveConnection();
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

  _pool = new Pool({
    connectionString: connString,
    max: 1,
    // Force a fresh Hyperdrive socket for each query; reused idle sockets can
    // be stale after a Workers isolate is suspended.
    maxUses: 1,
    // Do not let pg call client.end() from a suspended Workers isolate.
    // Hyperdrive owns origin pooling; the Worker-side socket must stay open.
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  // Workers can suspend isolates between requests; stale idle sockets may emit
  // asynchronously after the route has returned. Consume pool-level errors so
  // they do not become uncaught Worker exceptions (1101).
  _pool.on('error', () => undefined);
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
