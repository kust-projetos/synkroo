// ──────────────────────────────────────────────
// Drizzle DB client — shared server-side handle
// Uses node-postgres (pg) pool under the hood.
// ──────────────────────────────────────────────
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Return the shared Drizzle DB handle.
 * Lazily connects on first call using DATABASE_URL env var.
 */
export function getDb() {
  if (_db) return _db;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      '[DB] DATABASE_URL is not set.\n' +
        '  Set it in .env.local or .env:\n' +
        '  DATABASE_URL=postgres://synkroo:synkroo_dev@localhost:5432/synkroo',
    );
  }

  _pool = new Pool({ connectionString: databaseUrl });
  _db = drizzle(_pool, { schema });
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
  }
}
