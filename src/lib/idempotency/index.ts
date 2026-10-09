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
import { eq, and, lte, or, isNotNull } from 'drizzle-orm';
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
 * Read the stored claim row (status + fingerprint + result_ref + claimed-at).
 * Returns null when absent or unreadable. Falls back through legacy shapes
 * on pre-migration DBs (sem result_ref → sem fingerprint).
 */
interface ClaimRowFull {
  status: string | null;
  fingerprint: string | null;
  resultRef: string | null;
  createdAt: Date | null;
}

async function readClaimRow(key: string): Promise<ClaimRowFull | null> {
  const db = getDb();
  try {
    const [row] = await db
      .select({
        status: idempotencyKeys.status,
        fingerprint: idempotencyKeys.fingerprint,
        resultRef: idempotencyKeys.resultRef,
        createdAt: idempotencyKeys.createdAt,
      })
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key))
      .limit(1);
    return (row ?? null) as ClaimRowFull | null;
  } catch (err) {
    if (!isMissingIdemColumn(err)) {
      // Erro real (não é coluna ausente) — tenta formas legadas antes de desistir.
    }
    try {
      const [row] = await db
        .select({ status: idempotencyKeys.status, fingerprint: idempotencyKeys.fingerprint })
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, key))
        .limit(1);
      return row
        ? { status: row.status, fingerprint: row.fingerprint, resultRef: null, createdAt: null }
        : null;
    } catch {
      try {
        const [row] = await db
          .select({ status: idempotencyKeys.status })
          .from(idempotencyKeys)
          .where(eq(idempotencyKeys.key, key))
          .limit(1);
        return row
          ? { status: row.status, fingerprint: null, resultRef: null, createdAt: null }
          : null;
      } catch {
        return null;
      }
    }
  }
}

/** True when the DB error is a missing idempotency column (pre-migration). */
function isMissingIdemColumn(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /fingerprint|result_ref/i.test(msg) &&
    /column|does not exist|no such column|undefined column/i.test(msg)
  );
}

/** True when the DB error is a missing fingerprint column (pre-migration). */
function isMissingFingerprintColumn(err: unknown): boolean {
  return isMissingIdemColumn(err);
}

/**
 * Persiste o vínculo resultado→chave (result_ref) na linha do claim.
 * Best-effort: pré-migration (coluna ausente) → comportamento legado, sem erro.
 */
async function persistResultRef(key: string, ref: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({ resultRef: ref })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    if (isMissingIdemColumn(err)) return; // pré-migration: legado
    dbLogger.warn('Failed to persist idempotency result_ref', { key });
  }
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
 * Marca o claim como `completed`.
 *
 * `completedTtlMs` (opcional, backward-compatible) torna a âncora de conteúdo
 * reclaimable depois do TTL: quando informado, `expires_at` recebe
 * `now + completedTtlMs`; quando omitido, o estado é permanente
 * (`expires_at = NULL`). A escrita explícita da expiração é necessária porque
 * o marco `dispatching` zera `expires_at` antes do dispatch — deixar o valor
 * anterior (NULL) faria um `completed` com TTL parecer expirado para sempre.
 * Best-effort, como os demais marcos.
 */
export async function markIdempotencyKeyCompleted(
  key: string,
  completedTtlMs?: number,
): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({
        status: 'completed',
        expiresAt: completedTtlMs === undefined ? null : new Date(Date.now() + completedTtlMs),
      })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    dbLogger.error('Failed to mark idempotency key completed', err, { key });
  }
}

/**
 * Mark an idempotency key as failed (allows retry if not expired).
 *
 * `ttlSeconds` (opcional, backward-compatible): quando informado, grava
 * `expires_at = now + ttlSeconds`. Quem usa o marco `dispatching` (que zera
 * `expires_at` antes do dispatch) DEVE informar o TTL, senão a falha ficaria
 * sem expiração e o retry legítimo nunca seria liberado. Omitir preserva o
 * comportamento legado (não altera `expires_at`).
 */
export async function markIdempotencyKeyFailed(
  key: string,
  error: string,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({
        status: 'failed',
        error,
        ...(ttlSeconds === undefined
          ? {}
          : { expiresAt: new Date(Date.now() + ttlSeconds * 1000) }),
      })
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
 *
 * `options.resultRef` (optional, backward-compatible): derives the
 * result→key binding from the handler result; persisted on success and
 * exposed as `resultRef` (+ `claimedAt`) on 'already_processed' replays.
 * Callers sem option mantêm o comportamento legado. Pré-migration (coluna
 * ausente) → fallback legado silencioso.
 */
export interface WithIdempotencyOptions<T = unknown> {
  /** Deriva o vínculo resultado→chave a partir do resultado (ex.: id criado). */
  resultRef?: (result: T) => string | undefined;
}

export interface WithIdempotencyResult<T = unknown> {
  status: 'completed' | 'already_processed' | 'conflict';
  result?: T;
  /** Vínculo resultado→chave (quando persistido); undefined no legado. */
  resultRef?: string | null;
  /** created_at do claim original — limite temporal do fallback por domínio. */
  claimedAt?: Date | null;
}

export async function withIdempotency<T>(
  key: string,
  jobType: string,
  handler: () => Promise<T>,
  fingerprint?: string,
  options?: WithIdempotencyOptions<T>,
): Promise<WithIdempotencyResult<T>>;
export async function withIdempotency<T>(
  key: string,
  jobType: string,
  handler: () => Promise<T>,
  options?: WithIdempotencyOptions<T>,
): Promise<WithIdempotencyResult<T>>;
export async function withIdempotency<T>(
  key: string,
  jobType: string,
  handler: () => Promise<T>,
  fingerprintOrOptions?: string | WithIdempotencyOptions<T>,
  maybeOptions?: WithIdempotencyOptions<T>,
): Promise<WithIdempotencyResult<T>> {
  const fingerprint = typeof fingerprintOrOptions === 'string' ? fingerprintOrOptions : undefined;
  const options = typeof fingerprintOrOptions === 'object' ? fingerprintOrOptions : maybeOptions;
  // Already done? (fingerprint-aware: mismatch → conflict, never reuse.)
  if (fingerprint !== undefined) {
    const existing = await readClaimRow(key);
    if (existing?.status === 'completed') {
      if (existing.fingerprint != null && existing.fingerprint !== fingerprint) {
        dbLogger.warn('Idempotency fingerprint mismatch', { key, jobType });
        return { status: 'conflict' };
      }
      return {
        status: 'already_processed',
        resultRef: existing.resultRef ?? undefined,
        claimedAt: existing.createdAt ?? undefined,
      };
    }
  } else {
    if (await isIdempotencyKeyProcessed(key)) {
      const existing = await readClaimRow(key);
      return {
        status: 'already_processed',
        resultRef: existing?.resultRef ?? undefined,
        claimedAt: existing?.createdAt ?? undefined,
      };
    }
  }

  // Claim it
  const claimed = await tryClaimIdempotencyKey(key, jobType, 3600, fingerprint);
  if (!claimed) {
    return { status: 'conflict' };
  }

  // Execute
  try {
    const result = await handler();
    const ref = options?.resultRef?.(result);
    if (ref) await persistResultRef(key, ref);
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
 * - `retry_after`: falhou e o TTL ainda não expirou (NÃO executar ainda);
 * - `unknown`: efeito DISPACHADO sem confirmação de entrega (estado TERMINAL).
 *
 * `unknown` NUNCA é reclaimable — ao contrário de `failed`, cujo TTL libera
 * retry legítimo. Reexecutar uma operação cujo efeito pode já ter ocorrido é
 * duplicate-send; a única saída é reconciliação manual pelo caller (o efeito
 * continua `unknown`, nunca vira sucesso). Sem coluna nova: `status` é `text`
 * livre, e `unknown` é apenas mais um valor — nenhuma migração de schema.
 */
export type ClaimOutcome = 'claimed' | 'completed' | 'in_progress' | 'retry_after' | 'unknown';

/**
 * Razão padronizada (sem detalhe de provider/PII) gravada no claim
 * `unknown`. O dispatch ocorreu e a entrega não foi confirmada.
 */
export const IDEMPOTENCY_UNKNOWN_REASON = 'delivery unknown: effect dispatched but delivery not confirmed';

/**
 * Razão padronizada (sem detalhe de provider/PII) gravada no marco
 * `dispatching`: registra que o dispatch FOI INICIADO e ainda não foi
 * liquidado. Se a linha permanecer assim, o replay trata como `unknown`.
 */
export const IDEMPOTENCY_DISPATCHING_REASON = 'dispatching: effect dispatch started; settlement pending';

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
 * como outcome (`completed`/`in_progress`/`retry_after`/`unknown`).
 *
 * `unknown` é terminal: o EFEITO pode ter ocorrido, então a chave não volta a
 * executar — nem depois do TTL. O replay devolve o próprio `unknown` para o
 * caller reconciliar manualmente. `dispatching` (marco pré-dispatch, ver
 * `markIdempotencyKeyDispatching`) é classificado como `unknown` pelo mesmo
 * motivo: a liquidação não foi registrada e o efeito pode ter ocorrido.
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

  // Estado TERMINAL do efeito: o dispatch ocorreu e a entrega não foi
  // confirmada. Nunca executa e nunca reclama — a expiração é irrelevante
  // aqui, porque reexecutar seria duplicate-send.
  //
  // `dispatching` (marco durável pré-dispatch) entra na mesma regra: o
  // dispatch FOI INICIADO e a liquidação não foi registrada (crash, falha de
  // DB no marco final). O efeito pode ter ocorrido, então o replay devolve
  // `unknown` — reconciliação manual, jamais reexecução.
  if (row.status === 'unknown' || row.status === 'dispatching') return 'unknown';

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

/**
 * Marca o claim como `unknown` — estado terminal. O dispatch ocorreu mas a
 * entrega NÃO foi confirmada (timeout/exceção/HTTP ambíguo), que NÃO é falha
 * conhecida: a chave fica fechada, sem retry por TTL. A razão é padronizada
 * (sem texto de provider/PII). Best-effort, como os demais marcos.
 *
 * `expires_at` é zerado: estado terminal NUNCA expira (regra estrutural, não
 * apenas a checagem de status em `settleClaim`).
 */
export async function markIdempotencyKeyUnknown(key: string, reason?: string): Promise<void> {
  try {
    const db = getDb();
    await db
      .update(idempotencyKeys)
      .set({ status: 'unknown', error: reason ?? IDEMPOTENCY_UNKNOWN_REASON, expiresAt: null })
      .where(eq(idempotencyKeys.key, key));
  } catch (err) {
    dbLogger.error('Failed to mark idempotency key unknown', err, { key });
  }
}

/**
 * Marco DURÁVEL de dispatch (E4 / HIGH-1): gravado ANTES de invocar o
 * provider, com `expires_at = NULL`.
 *
 * Motivo: os marcos finais (`completed`/`failed`/`unknown`) são best-effort.
 * Se a escrita final falhar depois do dispatch, a linha continuaria
 * `in_progress` com TTL de 600s — passado o TTL ela seria reclaimada e o
 * efeito reexecutado (duplicate-send). Com `dispatching` persistido antes, a
 * liquidação falha de forma SEGURA: a linha permanece `dispatching`
 * (não-expirável) e o replay devolve `unknown` (nunca sucesso, nunca retry).
 *
 * Condicional (WHERE status = 'in_progress'): só arma se a chave continua
 * claimada por esta execução — uma corrida com outro worker devolve `false` e
 * o caller NÃO despacha. Diferente dos marcos finais, este NÃO é best-effort:
 * falha de infra PROPAGA (`IdempotencyInfraError`), porque sem o marco durável
 * o dispatch não pode ocorrer (fail-closed).
 *
 * @returns `true` quando a linha passou a `dispatching`; `false` quando a
 *          condição não casou (outro writer/reclaim — não despachar).
 */
export async function markIdempotencyKeyDispatching(key: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(idempotencyKeys)
    .set({ status: 'dispatching', error: IDEMPOTENCY_DISPATCHING_REASON, expiresAt: null })
    .where(and(
      eq(idempotencyKeys.key, key),
      eq(idempotencyKeys.status, 'in_progress'),
    ))
    .returning({ key: idempotencyKeys.key });
  return updated.length === 1;
}

/**
 * Reclaim condicional de in_progress/failed expirado. Um vencedor por UPDATE.
 *
 * Invariante: `expires_at = NULL` NUNCA é reclaimable. Os únicos escritores de
 * NULL são os marcos terminais (`dispatching`/`unknown`) e o `completed`
 * permanente — nenhum deles deve voltar a executar. A condição `isNotNull` é
 * defesa extra: a expiração em SQL é NULL para essas linhas, e um `lte`
 * sozinho nunca casaria, mas a regra fica EXPLÍCITA no predicado.
 */
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
      isNotNull(idempotencyKeys.expiresAt),
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
  // Terminal: efeito possivelmente ocorrido. Preserva `unknown`/`dispatching`
  // mesmo que o vencedor do reclaim tenha deixado a linha expirada.
  if (row.status === 'unknown' || row.status === 'dispatching') return 'unknown';
  if (row.status === 'completed') {
    const expired = !row.expiresAt || row.expiresAt <= new Date();
    if (completedTtlMs === undefined || !expired) return 'completed';
    return 'in_progress';
  }
  return row.status === 'failed' ? 'retry_after' : 'in_progress';
}
