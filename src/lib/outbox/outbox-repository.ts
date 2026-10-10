import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { getDb } from '@/lib/db/client';
import { outboxJobs } from '@/lib/db/schema';
import type { OutboxOperation } from './operations';

export type OutboxStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter';
export type OutboxJob = typeof outboxJobs.$inferSelect;

/**
 * Hook de liquidação de sucesso (E4) — escrita adicional que SÓ deve acontecer
 * depois de a entrega estar confirmada E cercada pelo lease do claim.
 *
 * Recebe o `tx` da transação de liquidação: o hook e o UPDATE que marca
 * `delivered` cometem ou falham juntos. Um holder de lease obsoleto NUNCA
 * chega aqui (o fence já recusou o UPDATE antes de invocar o hook), e uma
 * falha do hook desfaz os dois UPDATEs — o job volta a `processing` para
 * replay, e o claim de idempotência dedupa o reenvio ao provider.
 *
 * O tipo é intencionalmente frouxo no `tx` (o executor transacional do
 * Drizzle) para não acoplar `src/lib/outbox` a um schema de módulo.
 */
export type OutboxSuccessHook = (tx: any) => Promise<void>;

type OutboxInsert = {
  clinicId: string;
  operation: OutboxOperation;
  businessKey: string;
  payload: Record<string, unknown>;
};

type TestOutboxInsert = Omit<OutboxInsert, 'operation'> & { operation: string };

export async function enqueueOutbox(db: any, job: OutboxInsert): Promise<OutboxJob | undefined> {
  const [row] = await db.insert(outboxJobs).values(job).onConflictDoNothing().returning();
  return row;
}

/** Test-only escape hatch for exercising generic dispatch behavior. */
export async function enqueueOutboxForTests(db: any, job: TestOutboxInsert): Promise<OutboxJob | undefined> {
  return enqueueOutbox(db, job as OutboxInsert);
}

const OUTBOX_LEASE_MS = 5 * 60 * 1000;

export type ClaimOutboxOptions = {
  now?: Date;
  operations?: readonly string[];
  /**
   * Filtro INTERNO opcional por id do job — isolamento de teste contra banco de
   * integração compartilhado, onde outra suite pode deixar uma linha elegível
   * para a mesma operação. Quando presente, o claim só enxerga aquele job, ALÉM
   * dos filtros de elegibilidade/operação (nunca em lugar deles).
   *
   * Aditivo por desenho: o worker de produção NUNCA passa `jobId`, então o
   * claim em produção continua genérico por operação, inalterado.
   */
  jobId?: string;
};

/**
 * Claim atômico do próximo job elegível.
 *
 * `claim_generation` é incrementada no MESMO UPDATE que muda o status para
 * `processing` — o lease devolvido ao caller é o par
 * `(id, claimGeneration)`, e ele é a ÚNICA fence válida da liquidação
 * (ver `src/lib/db/migrations/0036_outbox_claim_generation.sql`).
 * `attempts` também incrementa aqui e NÃO serve de fence: o defer a decrementa.
 */
export async function claimOutboxJob(options: ClaimOutboxOptions = {}): Promise<OutboxJob | undefined> {
  const db = getDb();
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - OUTBOX_LEASE_MS);
  if (options.operations?.length === 0) return undefined;
  return db.transaction(async (tx: any) => {
    const claimable = or(
      eq(outboxJobs.status, 'pending'),
      and(eq(outboxJobs.status, 'processing'), lte(outboxJobs.updatedAt, staleBefore)),
    );
    const filters = [claimable, lte(outboxJobs.nextAttemptAt, now)];
    if (options.operations) filters.push(inArray(outboxJobs.operation, options.operations));
    // Isolamento de teste: reduz o claim a um job conhecido sem afrouxar nenhum
    // dos filtros acima (o perfil de produção nunca passa `jobId`).
    if (options.jobId) filters.push(eq(outboxJobs.id, options.jobId));
    const [job] = await tx.select().from(outboxJobs).where(and(...filters))
      .orderBy(outboxJobs.nextAttemptAt).limit(1).for('update', { skipLocked: true });
    if (!job) return undefined;
    const [claimed] = await tx.update(outboxJobs).set({
      status: 'processing',
      attempts: sql`${outboxJobs.attempts} + 1`,
      claimGeneration: sql`${outboxJobs.claimGeneration} + 1`,
      updatedAt: now,
    }).where(and(eq(outboxJobs.id, job.id), claimable)).returning();
    return claimed;
  });
}

/**
 * Fence completa do lease — aplicada no WHERE de TODO marco de liquidação,
 * antes de qualquer valor. O par `(id, claimGeneration)` é o lease devolvido
 * por `claimOutboxJob`; `claim_generation` é a parte que separa holders, porque
 * `attempts` volta a repetir depois do defer + reclaim (ABA).
 */
const LEASE_FENCE = (
  id: string,
  claimGeneration: number,
): ReturnType<typeof and> => and(
  eq(outboxJobs.id, id),
  eq(outboxJobs.status, 'processing'),
  eq(outboxJobs.claimGeneration, claimGeneration),
);

/**
 * Liquidação com fence: devolve `true` somente quando o UPDATE casou o lease
 * inteiro. `false` = o lease foi perdido (reclaim após os 5min de stale, ou a
 * linha já foi liquidada) — a execução atual NÃO é dona da linha e NÃO deve
 * reportar desfecho nem chamar callback. A decisão é atômica no banco, via
 * `RETURNING`: sem read-then-write e sem corrida entre o envio e a liquidação.
 */
async function settle(
  db: any,
  id: string,
  claimGeneration: number,
  values: PgUpdateSetSource<typeof outboxJobs>,
): Promise<boolean> {
  const rows = await db.update(outboxJobs).set(values)
    .where(LEASE_FENCE(id, claimGeneration))
    .returning({ id: outboxJobs.id });
  return rows.length > 0;
}

/**
 * Liquida a linha do lease como entregue. `false` ⇒ lease perdido — e, nesse
 * caso, o hook NUNCA é invocado.
 *
 * `afterDelivered` (opcional, E4) é um `OutboxSuccessHook`: escrita adicional
 * que só pode acontecer DEPOIS de o fence confirmar que esta execução é dona
 * da linha. Quando presente, o UPDATE cercado e o hook rodam na MESMA
 * transação: se o hook lançar, o `delivered` é desfeito com ele, o job volta a
 * `processing` para replay e o erro PROPAGA (nunca é reinterpretado como
 * falha de provider). Sem hook, a liquidação é o UPDATE simples de sempre —
 * contrato histórico preservado para todos os callers existentes.
 */
export async function markOutboxDelivered(
  id: string,
  claimGeneration: number,
  afterDelivered?: OutboxSuccessHook,
): Promise<boolean> {
  const db = getDb();
  // Sem hook: liquidação simples, sem transação (contrato histórico preservado).
  if (!afterDelivered) return settle(db, id, claimGeneration, { status: 'delivered', updatedAt: new Date() });
  // Com hook: o UPDATE cercado e a escrita adicional cometem ou falham juntos.
  // Uma falha do hook desfaz TAMBÉM o `delivered` — o job volta a `processing`
  // para replay, e o claim de idempotência dedupa o reenvio ao provider.
  return db.transaction(async (tx: any) => {
    const rows = await tx.update(outboxJobs).set({ status: 'delivered', updatedAt: new Date() })
      .where(LEASE_FENCE(id, claimGeneration))
      .returning({ id: outboxJobs.id });
    if (rows.length === 0) return false;
    await afterDelivered(tx);
    return true;
  });
}

/**
 * DLQ imediata de falha PERMANENTE: o efeito externo pode já ter ocorrido,
 * então retry automático é proibido (duplicate-send). O job vai direto para
 * `dead_letter` SEM consumir tentativa de retry e sem `next_attempt_at`
 * futuro — o status `dead_letter` nunca é claimable (ver `claimOutboxJob`), e
 * a reconciliação é manual.
 *
 * Fence `status = 'processing'` + `claim_generation` (como os demais marcos):
 * só a execução que claimed o job o move, e uma re-execução não reescreve uma
 * linha já liquidada. `errorCode` deve ser SANITIZADO (ver `outboxErrorCode`).
 * Devolve `false` quando o lease já não é deste worker — o caller NÃO deve
 * chamar o callback de reconciliação.
 */
export async function markOutboxDeadLetter(
  id: string,
  claimGeneration: number,
  errorCode: string,
  now = new Date(),
): Promise<boolean> {
  return settle(getDb(), id, claimGeneration, {
    status: 'dead_letter',
    lastErrorCode: errorCode,
    updatedAt: now,
  });
}

/** Liquida a linha do lease como retryável (backoff limitado, DLQ ao esgotar). `false` ⇒ lease perdido. */
export async function markOutboxRetry(
  id: string,
  claimGeneration: number,
  attempts: number,
  errorCode: string,
  now = new Date(),
): Promise<boolean> {
  const exhausted = attempts >= 5;
  const delaySeconds = Math.min(2 ** attempts * 30, 3600);
  return settle(getDb(), id, claimGeneration, {
    status: exhausted ? 'dead_letter' : 'pending',
    nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000),
    lastErrorCode: errorCode,
    updatedAt: now,
  });
}

/**
 * DEFER — conflito de claim de idempotência (`OutboxDeferredError`): a chave do
 * envio segue ativa (`in_progress`) ou falhada há pouco (`retry_after`), então
 * o handler NÃO rodou e o provider não foi elegível. O job volta a `pending`
 * com `next_attempt_at` depois do TTL do claim e a tentativa de retry é
 * DEVOLVIDA: esperar por uma chave alheia não pode consumir o orçamento de
 * tentativas — sem isso, o backoff de 60/180/420/900s reenviaria o conflito
 * contra um TTL de claim de 600s e a primeira falha real de provider já
 * encontraria o job em `dead_letter`.
 *
 * O decremento acontece no próprio UPDATE (`GREATEST(attempts - 1, 0)`, piso
 * em 0): sem read-modify-write e sem depender do `attempts` observado pelo
 * caller. `claim_generation` NUNCA é decrementada aqui — é justamente o
 * decremento de `attempts` que impediria usá-la como fence (o valor se repete
 * depois do reclaim). Fence `status = 'processing'` + `claim_generation` (como
 * os demais marcos): só a execução que claimed o job o move, e uma re-execução
 * não reescreve uma linha já liquidada. `errorCode` deve ser SANITIZADO (ver
 * `outboxErrorCode`). `retryAfterSeconds` NUNCA deve ser menor que o TTL
 * restante da chave — o caller usa `OUTBOUND_IDEMPOTENCY_TTL_SECONDS` (piso do
 * TTL do claim). Devolve `false` quando o lease já não é deste worker.
 */
export async function markOutboxDeferred(
  id: string,
  claimGeneration: number,
  errorCode: string,
  retryAfterSeconds: number,
  now = new Date(),
): Promise<boolean> {
  return settle(getDb(), id, claimGeneration, {
    status: 'pending',
    attempts: sql`GREATEST(${outboxJobs.attempts} - 1, 0)`,
    nextAttemptAt: new Date(now.getTime() + retryAfterSeconds * 1000),
    lastErrorCode: errorCode,
    updatedAt: now,
  });
}
