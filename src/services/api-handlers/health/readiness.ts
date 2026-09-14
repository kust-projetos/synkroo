import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { checkMigrations } from './db';

/** Timeout por statement nas queries de readiness — estouro vira 503 `db-unreachable`. */
const READINESS_STATEMENT_TIMEOUT = '3s';

export interface ReadinessResult {
  ok: boolean;
  reason?: 'migrations-incomplete' | 'db-unreachable';
  durationMs: number;
}

/**
 * Readiness real (DB acessível via query barata + migrations compatíveis
 * contra o ledger do Drizzle). Todas as queries rodam numa transação com
 * `SET LOCAL statement_timeout` (3s). Nunca lança: falha de inicialização
 * do client, timeout ou ledger incompleto viram resultado fechado com
 * motivo estático (sem `error.message` do driver).
 */
export async function checkReadiness(): Promise<ReadinessResult> {
  const started = Date.now();
  const durationMs = () => Date.now() - started;
  try {
    const db = getDb();
    let migrationsComplete = false;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL statement_timeout = ${READINESS_STATEMENT_TIMEOUT}`);
      await tx.execute(sql`SELECT 1`);
      migrationsComplete = (await checkMigrations(tx)).complete;
    });

    if (!migrationsComplete) {
      return { ok: false, reason: 'migrations-incomplete', durationMs: durationMs() };
    }

    return { ok: true, durationMs: durationMs() };
  } catch {
    // Intencional: sem error.message do driver — motivo curto estático.
    // Cobre DB fora, timeout de statement e falha de inicialização do client.
    return { ok: false, reason: 'db-unreachable', durationMs: durationMs() };
  }
}
