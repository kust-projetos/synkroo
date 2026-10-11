import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { checkMigrations } from './db';

/** Timeout por statement nas queries de readiness — estouro vira 503 `db-unreachable`. */
const READINESS_STATEMENT_TIMEOUT = '3s';

export interface ReadinessResult {
  ok: boolean;
  reason?: 'migrations-incomplete' | 'maintenance-control-missing' | 'db-unreachable';
  durationMs: number;
}

/**
 * Readiness real (DB acessível via query barata + migrations compatíveis
 * contra o ledger do Drizzle + SHAPE do gate de manutenção do outbox).
 * Todas as queries rodam numa transação com
 * `set_config('statement_timeout', <timeout>, true)` (3s) — equivalente a
 * `SET LOCAL statement_timeout`, mas aceitando o valor como parâmetro de
 * protocolo. `SET LOCAL statement_timeout = $1` é rejeitado pelo PostgreSQL
 * (o valor de SET não admite bind parameter), o que faria a transação
 * falhar mesmo com o banco são e virar falso negativo de `db-unreachable`.
 * Nunca lança: falha de inicialização
 * do client, timeout ou ledger incompleto viram resultado fechado com
 * motivo estático (sem `error.message` do driver).
 *
 * Ledger 36/36 sobre a migration 0036 ORIGINAL (sem `outbox_control`/trigger)
 * NÃO é completo: `maintenance-control-missing` falha fechado e aponta o
 * repair explícito — nunca um falso "ready". A checagem é FUNCIONAL: shape dos
 * objetos, existência da linha singleton e trigger habilitado (`tgenabled`).
 */
export async function checkReadiness(): Promise<ReadinessResult> {
  const started = Date.now();
  const durationMs = () => Date.now() - started;
  try {
    const db = getDb();
    let migrations: Awaited<ReturnType<typeof checkMigrations>> | undefined;
    await db.transaction(async (tx) => {
      // is_local=true: escopo da transação (equivale a SET LOCAL), reverte
      // no COMMIT/ROLLBACK — sem vazar o timeout para a sessão do pool.
      await tx.execute(sql`SELECT set_config('statement_timeout', ${READINESS_STATEMENT_TIMEOUT}, true)`);
      await tx.execute(sql`SELECT 1`);
      migrations = await checkMigrations(tx);
    });

    if (!migrations!.ledgerComplete) {
      return { ok: false, reason: 'migrations-incomplete', durationMs: durationMs() };
    }
    if (migrations!.maintenanceControl !== 'present') {
      return { ok: false, reason: 'maintenance-control-missing', durationMs: durationMs() };
    }

    return { ok: true, durationMs: durationMs() };
  } catch {
    // Intencional: sem error.message do driver — motivo curto estático.
    // Cobre DB fora, timeout de statement e falha de inicialização do client.
    return { ok: false, reason: 'db-unreachable', durationMs: durationMs() };
  }
}
