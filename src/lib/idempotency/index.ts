/**
 * Idempotency Helper (ADR-BASE-13: Cloudflare Queues)
 *
 * Garante at-least-once com idempotency key em todo side effect assíncrono.
 * Usado por jobs enfileirados via Cloudflare Queues.
 *
 * Padrão: producer gera idempotency key, consumer verifica antes de executar.
 */

import { getDb } from '@/lib/db/client';
import { idempotencyKeys } from '@/lib/db/schema/infra';
import { eq, and, lte, or } from 'drizzle-orm';
import { dbLogger } from '@/lib/logger';

/**
 * Check if an idempotency key has already been processed.
 * Returns true if the key exists and was successfully processed.
 */
export async function isIdempotencyKeyProcessed(key: string): Promise<boolean> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ status: idempotencyKeys.status })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);
    return row?.status === 'completed';
  } catch {
    return false;
  }
}

/**
 * Read the stored claim row (status + fingerprint). Returns null when absent
 * or unreadable. Falls back to a fingerprint-less read on pre-migration DBs.
 */
async function readClaimRow(key: string): Promise<{ status: string | null; fingerprint: string | null } | null> {
  const db = getDb();
  try {
    const [row] = await db
      .select({ status: idempotencyKeys.status, fingerprint: idempotencyKeys.fingerprint })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);
    return (row ?? null) as { status: string | null; fingerprint: string | null } | null;
  } catch {
    try {
      const [row] = await db
        .select({ status: idempotencyKeys.status })
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, key))
        .limit(1);
      return row ? { status: row.status, fingerprint: null } : null;
    } catch {
      return null;
    }
  }
}

/** True when the DB error is a missing fingerprint column (pre-migration). */
function isMissingFingerprintColumn(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /fingerprint/i.test(msg) && /column|does not exist|no such column|undefined column/i.test(msg);
}

/**
 * Claim an idempotency key atomically.
 * Returns true if this caller successfully claimed the key.
 * If the key already exists (completed or in-progress), returns false.
 *
 * `fingerprint` (optional, backward-compatible): domain payload digest bound
 * to the key at claim time. When both the stored and incoming fingerprints
 * are present and differ, the claim is refused (false) — same path as a
 * divergent-payload replay, never a silent reuse.
 */
export async function tryClaimIdempotencyKey(
  key: string,
  jobType: string,
  ttlSeconds = 3600,
  fingerprint?: string,
): Promise<boolean> {
  const db = getDb();
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Fingerprint guard pre-insert: same key + divergent payload → conflict.
    if (fingerprint !== undefined) {
      const existing = await readClaimRow(key);
      if (existing && existing.fingerprint != null && existing.fingerprint !== fingerprint) {
        dbLogger.warn('Idempotency fingerprint mismatch', { key, jobType });
        return false;
      }
    }

    // INSERT ... ON CONFLICT DO NOTHING — atomic first claim.
    const values: Record<string, unknown> = { key, jobType, status: 'in_progress', expiresAt };
    if (fingerprint !== undefined) values.fingerprint = fingerprint;
    let rows: Array<{ key: string }>;
    try {
      rows = await db
        .insert(idempotencyKeys)
        .values(values as never)
        .onConflictDoNothing()
        .returning({ key: idempotencyKeys.key });
    } catch (err) {
      // Pre-migration DB without the fingerprint column → retry legacy shape.
      if (fingerprint !== undefined && isMissingFingerprintColumn(err)) {
        rows = await db
          .insert(idempotencyKeys)
          .values({ key, jobType, status: 'in_progress', expiresAt })
          .onConflictDoNothing()
          .returning({ key: idempotencyKeys.key });
      } else {
        throw err;
      }
    }
    if (rows.length === 1) return true;

    // Lost the insert race — re-read and enforce fingerprint before reclaim.
    if (fingerprint !== undefined) {
      const existing = await readClaimRow(key);
      if (existing && existing.fingerprint != null && existing.fingerprint !== fingerprint) {
        dbLogger.warn('Idempotency fingerprint mismatch', { key, jobType });
        return false;
      }
    }

    // A failed/expired claim may be retried, but only one caller can win the
    // conditional UPDATE. Completed or live in-progress claims remain closed.
    const reclaimed = await db
      .update(idempotencyKeys)
      .set({ status: 'in_progress', error: null, expiresAt })
      .where(and(
        eq(idempotencyKeys.key, key),
        lte(idempotencyKeys.expiresAt, now),
        or(eq(idempotencyKeys.status, 'failed'), eq(idempotencyKeys.status, 'in_progress')),
      ))
      .returning({ key: idempotencyKeys.key });
    return reclaimed.length === 1;
  } catch (err) {
    // If duplicate key error, someone else claimed it
    dbLogger.warn('Idempotency key conflict', { key, jobType });
    return false;
  }
}

/**
 * Mark an idempotency key as completed.
 */
export async function markIdempotencyKeyCompleted(key: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({ status: 'completed' })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    dbLogger.error('Failed to mark idempotency key completed', err, { key });
  }
}

/**
 * Mark an idempotency key as failed (allows retry if not expired).
 */
export async function markIdempotencyKeyFailed(key: string, error: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({ status: 'failed', error })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    dbLogger.error('Failed to mark idempotency key failed', err, { key });
  }
}

/**
 * Execute a job with idempotency guarantee.
 * If the key was already processed, returns 'already_processed'.
 * If the key was claimed by another instance, returns 'conflict'.
 * Otherwise, executes the handler and marks completed/failed.
 *
 * `fingerprint` (optional, backward-compatible): when both the stored and
 * incoming fingerprints are present and differ, returns 'conflict' (same
 * path as divergent-payload replay) instead of reusing the prior result.
 */
export async function withIdempotency<T>(
  key: string,
  jobType: string,
  handler: () => Promise<T>,
  fingerprint?: string,
): Promise<{ status: 'completed' | 'already_processed' | 'conflict'; result?: T }> {
  // Already done? (fingerprint-aware: mismatch → conflict, never reuse.)
  if (fingerprint !== undefined) {
    const existing = await readClaimRow(key);
    if (existing?.status === 'completed') {
      if (existing.fingerprint != null && existing.fingerprint !== fingerprint) {
        dbLogger.warn('Idempotency fingerprint mismatch', { key, jobType });
        return { status: 'conflict' };
      }
      return { status: 'already_processed' };
    }
  } else if (await isIdempotencyKeyProcessed(key)) {
    return { status: 'already_processed' };
  }

  // Claim it
  const claimed = await tryClaimIdempotencyKey(key, jobType, 3600, fingerprint);
  if (!claimed) {
    return { status: 'conflict' };
  }

  // Execute
  try {
    const result = await handler();
    await markIdempotencyKeyCompleted(key);
    return { status: 'completed', result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await markIdempotencyKeyFailed(key, errorMsg);
    throw err; // Re-throw for Queue retry
  }
}

// ─── Structured claim (Trilha A — review A2A3) ───────────────────────────────
// ADITIVO: não altera o comportamento das funções acima. Diferencia conflito
// legítimo de falha de infra e expõe estados finos para envio outbound.

/** Falha de infra no claim (DB indisponível) — distinta de conflito legítimo. */
export class IdempotencyInfraError extends Error {
  constructor(message: string, opts?: { cause?: unknown }) {
    super(message);
    this.name = 'IdempotencyInfraError';
    if (opts?.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

/**
 * Resultado fino do claim:
 * - `claimed`: esta execução conquistou a chave (pode executar);
 * - `completed`: já executada com sucesso (deduplicar);
 * - `in_progress`: outra execução ativa (NÃO executar, NÃO reportar sucesso);
 * - `retry_after`: falhou e o TTL ainda não expirou (NÃO executar ainda).
 */
export type ClaimOutcome = 'claimed' | 'completed' | 'in_progress' | 'retry_after';

export interface ClaimKeyOptions {
  /** TTL do claim in_progress/failed em segundos (default 3600). */
  ttlSeconds?: number;
  /**
   * TTL opcional do estado `completed` em ms (default undefined = permanente,
   * comportamento histórico). Quando definido e expirado, um `completed`
   * pode ser reclaimado (ex.: âncoras de conteúdo com reenvio legítimo tardio).
   */
  completedTtlMs?: number;
}

interface ClaimRow {
  status: string | null;
  expiresAt: Date | null;
}

/**
 * Claim estruturado de chave de idempotência.
 * Lança `IdempotencyInfraError` em falha de infra (nunca retorna `false`
 * silencioso — ver `tryClaimIdempotencyKey` legado). Conflito legítimo volta
 * como outcome (`completed`/`in_progress`/`retry_after`).
 */
export async function claimIdempotencyKey(
  key: string,
  jobType: string,
  opts: ClaimKeyOptions = {},
): Promise<ClaimOutcome> {
  const ttlSeconds = opts.ttlSeconds ?? 3600;
  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch (err) {
    throw new IdempotencyInfraError(`Idempotency store unavailable for key ${jobType}`, {
      cause: err,
    });
  }

  try {
    const rows = await db
      .select({ status: idempotencyKeys.status, expiresAt: idempotencyKeys.expiresAt })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);
    const row = (rows[0] ?? null) as ClaimRow | null;

    if (!row) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const inserted = await db
        .insert(idempotencyKeys)
        .values({ key, jobType, status: 'in_progress', expiresAt })
        .onConflictDoNothing()
        .returning({ key: idempotencyKeys.key });
      if (inserted.length === 1) return 'claimed';
      // Corrida: outro inseriu entre o SELECT e o INSERT — relê e classifica.
      const [reread] = await db
        .select({ status: idempotencyKeys.status, expiresAt: idempotencyKeys.expiresAt })
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, key))
        .limit(1);
      return reread
        ? settleClaim(db, key, reread as ClaimRow, ttlSeconds, opts.completedTtlMs)
        : 'in_progress';
    }

    return settleClaim(db, key, row, ttlSeconds, opts.completedTtlMs);
  } catch (err) {
    if (err instanceof IdempotencyInfraError) throw err;
    throw new IdempotencyInfraError(`Idempotency claim failed for key ${jobType}`, {
      cause: err,
    });
  }
}

/** Classifica uma linha existente, tentando reclaim quando o TTL permite. */
async function settleClaim(
  db: ReturnType<typeof getDb>,
  key: string,
  row: ClaimRow,
  ttlSeconds: number,
  completedTtlMs: number | undefined,
): Promise<ClaimOutcome> {
  const now = new Date();
  const expired = !row.expiresAt || row.expiresAt <= now;

  if (row.status === 'completed') {
    if (completedTtlMs === undefined || !expired) return 'completed';
    // completed expirado com TTL configurado → reclaim condicional (um vencedor).
    const reclaimed = await db
      .update(idempotencyKeys)
      .set({ status: 'in_progress', error: null, expiresAt: new Date(Date.now() + ttlSeconds * 1000) })
      .where(and(
        eq(idempotencyKeys.key, key),
        eq(idempotencyKeys.status, 'completed'),
        lte(idempotencyKeys.expiresAt, now),
      ))
      .returning({ key: idempotencyKeys.key });
    if (reclaimed.length === 1) return 'claimed';
    // Derrota na corrida: outro worker venceu — NUNCA presuma `completed` stale.
    // Releia e classifique o estado atual (o vencedor marcou `in_progress`, ou
    // até já concluiu — só `completed` confirmado na releitura dedupa).
    return rereadClaim(db, key, completedTtlMs);
  }

  if (row.status === 'failed') {
    if (!expired) return 'retry_after';
    return (await reclaimExpired(db, key, now, ttlSeconds)) ? 'claimed' : 'retry_after';
  }

  // in_progress (ou status desconhecido — fail-closed: não executa).
  if (!expired) return 'in_progress';
  return (await reclaimExpired(db, key, now, ttlSeconds)) ? 'claimed' : 'in_progress';
}

/** Reclaim condicional de in_progress/failed expirado. Um vencedor por UPDATE. */
async function reclaimExpired(
  db: ReturnType<typeof getDb>,
  key: string,
  now: Date,
  ttlSeconds: number,
): Promise<boolean> {
  const reclaimed = await db
    .update(idempotencyKeys)
    .set({ status: 'in_progress', error: null, expiresAt: new Date(now.getTime() + ttlSeconds * 1000) })
    .where(and(
      eq(idempotencyKeys.key, key),
      lte(idempotencyKeys.expiresAt, now),
      or(eq(idempotencyKeys.status, 'failed'), eq(idempotencyKeys.status, 'in_progress')),
    ))
      .returning({ key: idempotencyKeys.key });
  return reclaimed.length === 1;
}

/**
 * Releitura pós-derrota no reclaim: classifica o estado ATUAL sem presumir.
 * Só retorna `completed` se a releitura confirmar `completed` vivo (ou sem
 * TTL configurado); `completed` expirado com TTL após derrota indica outro
 * worker ativo → fail-closed (`in_progress`). `failed` → `retry_after`.
 */
async function rereadClaim(
  db: ReturnType<typeof getDb>,
  key: string,
  completedTtlMs: number | undefined,
): Promise<ClaimOutcome> {
  const [current] = await db
    .select({ status: idempotencyKeys.status, expiresAt: idempotencyKeys.expiresAt })
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);
  if (!current) return 'in_progress';
  const row = current as ClaimRow;
  if (row.status === 'completed') {
    const expired = !row.expiresAt || row.expiresAt <= new Date();
    if (completedTtlMs === undefined || !expired) return 'completed';
    return 'in_progress';
  }
  return row.status === 'failed' ? 'retry_after' : 'in_progress';
}
