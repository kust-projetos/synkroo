/**
 * Idempotência outbound — Trilha A (etapa A3 do plano de hardening).
 *
 * Reaproveita o claim local de `src/lib/idempotency` (tabela `idempotency_keys`,
 * `INSERT ... ON CONFLICT DO NOTHING`): a chave é claimed ANTES do envio; uma
 * duplicata da mesma operação lógica não reenvia (retorna `deduped: true`).
 *
 * Ancoragem da chave: `buildOutboundIdempotencyKey(channel, clinicId, stableId)`
 * → `"<channel>:send:<clinicId>:<stableId>"`. A proteção é opt-in via parâmetro
 * (compatível com as assinaturas públicas), SEM exigir mudança de schema.
 *
 * NOTA Evolution API: a Evolution NÃO documenta suporte nativo a
 * `Idempotency-Key` no envio de mensagem (pesquisa do planner; sem evidência
 * no código/docs do repo) — por isso NENHUM header de idempotência é enviado
 * ao provider. O claim local é o mecanismo primário.
 *
 * Semântica por estado do claim (`claimIdempotencyKey`):
 * - `claimed` → executa; sucesso marca `completed`, falha/throw marca `failed`;
 * - `completed` → `{ deduped: true }` (handler NÃO executa; o resultado anterior
 *   não é persistido — sem schema novo);
 * - `in_progress`/`retry_after` → lança `OutboundSendConflictError` (NÃO envia
 *   e NÃO reporta sucesso: o caller decide — job retry ou `conflict` da action);
 * - falha de infra no claim → fail-open: warn + executa sem dedup (mensageria
 *   prioriza disponibilidade; o dedup é best-effort). Conflito legítimo NUNCA
 *   é tratado como infra (ver `IdempotencyInfraError`).
 */

import { dbLogger } from '@/lib/logger';
import {
  claimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyFailed,
  IdempotencyInfraError,
} from '@/lib/idempotency';

export const OUTBOUND_JOB_TYPE = 'whatsapp:outbound';
/** TTL do claim in_progress/failed: curto — falha/crash liberam retry em 10min. */
export const OUTBOUND_IDEMPOTENCY_TTL_SECONDS = 600;
/** TTL de `completed` para âncoras de conteúdo (reenvio legítimo tardio). */
export const OUTBOUND_CONTENT_COMPLETED_TTL_MS = 10 * 60 * 1000;

export type OutboundChannel = 'whatsapp' | 'instagram';

/**
 * Conflito de envio: outra execução está ativa (`in_progress`) ou falhou há
 * pouco (`retry_after`). O caller NÃO deve reportar sucesso — re-tentar o job
 * depois (outbox) ou mapear para `conflict` (action).
 */
export class OutboundSendConflictError extends Error {
  readonly key: string;
  readonly state: 'in_progress' | 'retry_after';

  constructor(key: string, state: 'in_progress' | 'retry_after') {
    super(`Outbound send conflict (${state}): ${key}`);
    this.name = 'OutboundSendConflictError';
    this.key = key;
    this.state = state;
  }
}

/**
 * Monta a chave determinística de uma operação lógica de envio.
 * Ex.: `whatsapp:send:clinic-123:msg-456`.
 */
export function buildOutboundIdempotencyKey(
  channel: OutboundChannel,
  clinicId: string,
  stableId: string,
): string {
  return `${channel}:send:${clinicId}:${stableId}`;
}

export interface OutboundIdempotentResult<T> {
  /** true quando a operação já tinha sido executada (provider NÃO chamado). */
  deduped: boolean;
  result?: T;
}

export interface OutboundIdempotencyOptions<T> {
  jobType?: string;
  isSuccess?: (result: T) => boolean;
  /** Repassado ao claim: permite reclaim de `completed` após o TTL. */
  completedTtlMs?: number;
}

/**
 * Executa `handler` (o envio ao provider) sob claim de idempotência.
 * `isSuccess` diz se o resultado conta como entregue (default: não-throw).
 */
export async function withOutboundIdempotency<T>(
  key: string,
  handler: () => Promise<T>,
  opts?: OutboundIdempotencyOptions<T>,
): Promise<OutboundIdempotentResult<T>> {
  const jobType = opts?.jobType ?? OUTBOUND_JOB_TYPE;
  const isSuccess = opts?.isSuccess ?? ((): boolean => true);

  let outcome: Awaited<ReturnType<typeof claimIdempotencyKey>>;
  try {
    outcome = await claimIdempotencyKey(key, jobType, {
      ttlSeconds: OUTBOUND_IDEMPOTENCY_TTL_SECONDS,
      completedTtlMs: opts?.completedTtlMs,
    });
  } catch (err) {
    if (err instanceof IdempotencyInfraError) {
      dbLogger.warn('outbound-idempotency: claim unavailable (infra); sending without dedup', { jobType });
      return { deduped: false, result: await handler() };
    }
    throw err;
  }

  if (outcome === 'completed') return { deduped: true };
  if (outcome === 'in_progress' || outcome === 'retry_after') {
    throw new OutboundSendConflictError(key, outcome);
  }

  try {
    const result = await handler();
    if (isSuccess(result)) await markIdempotencyKeyCompleted(key);
    else {
      await markIdempotencyKeyFailed(key, 'provider reported failure');
    }
    return { deduped: false, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markIdempotencyKeyFailed(key, message);
    throw err;
  }
}
