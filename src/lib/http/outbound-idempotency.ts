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
 * - `claimed` → ARMA o marco durável `dispatching` e executa; sucesso marca
 *   `completed`, entrega não confirmada (`isDeliveryUnknown`) marca `unknown`
 *   — TERMINAL, sem retry por TTL —, demais falhas/throw marcam `failed`;
 * - `completed` → `{ deduped: true }` (handler NÃO executa; o resultado anterior
 *   não é persistido — sem schema novo);
 * - `unknown` → `{ deduped: true, deliveryUnknown: true }`: o efeito pode ter
 *   ocorrido; handler NÃO executa e NÃO se reporta sucesso — reconciliação manual;
 * - `in_progress`/`retry_after` → lança `OutboundSendConflictError` (NÃO envia
 *   e NÃO reporta sucesso: o caller decide — job retry ou `conflict` da action);
 * - falha de infra no claim → fail-open: warn + executa sem dedup (mensageria
 *   prioriza disponibilidade; o dedup é best-effort). Conflito legítimo NUNCA
 *   é tratado como infra (ver `IdempotencyInfraError`).
 *
 * E4 (HIGH-1) — garantia terminal do dispatch. Os marcos finais são
 * best-effort: se a escrita de `unknown`/`failed` falhar DEPOIS do dispatch, a
 * linha continuaria `in_progress` com TTL de 600s e seria reclaimada
 * (duplicate-send). Por isso o claim `claimed` é convertido em `dispatching`
 * (`expires_at = NULL`) ANTES de chamar o handler:
 * - liquidação normal (`completed`/`failed`/`unknown`) sobrescreve o marco;
 * - liquidação que falha ou trava deixa `dispatching` — não-expirável: o
 *   replay devolve `unknown` (nunca sucesso, nunca reexecução);
 * - falha ao ARMAR o marco aborta ANTES do handler (fail-closed): sem marco
 *   durável não há dispatch.
 *
 * E4 (HIGH-2) — liquidação com espera limitada: nenhuma escrita de marco
 * prende a resposta do envio. Se o banco não responde dentro de
 * `OUTBOUND_SETTLE_TIMEOUT_MS`, a resposta segue (o marco `dispatching` já
 * garante ausência de reenvio) e a escrita continua em segundo plano, com
 * rejeição absorvida (nunca unhandled).
 */

import { dbLogger } from '@/lib/logger';
import {
  claimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyDispatching,
  markIdempotencyKeyFailed,
  markIdempotencyKeyUnknown,
  IdempotencyInfraError,
} from '@/lib/idempotency';

export const OUTBOUND_JOB_TYPE = 'whatsapp:outbound';
/** TTL do claim in_progress/failed: curto — falha/crash liberam retry em 10min. */
export const OUTBOUND_IDEMPOTENCY_TTL_SECONDS = 600;
/** TTL de `completed` para âncoras de conteúdo (reenvio legítimo tardio). */
export const OUTBOUND_CONTENT_COMPLETED_TTL_MS = 10 * 60 * 1000;
/**
 * Espera máxima da liquidação do claim (E4 / HIGH-2). Escrita de marco é
 * best-effort e NÃO pode prender a resposta do envio: passado o limite, a
 * resposta é devolvida e a escrita segue em segundo plano — o marco durável
 * `dispatching` já impede qualquer reenvio nesse intervalo.
 */
export const OUTBOUND_SETTLE_TIMEOUT_MS = 1_000;

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
  /**
   * Replay de um claim `unknown`: o efeito FOI despachado em uma tentativa
   * anterior e a entrega nunca foi confirmada. O provider NÃO é chamado de
   * novo e o resultado NÃO é sucesso — o caller recebe o mesmo estado de
   * entrega desconhecida para reconciliação manual.
   */
  deliveryUnknown?: boolean;
}

export interface OutboundIdempotencyOptions<T> {
  jobType?: string;
  isSuccess?: (result: T) => boolean;
  /**
   * Classifica o resultado como entrega NÃO confirmada (efeito possivelmente
   * ocorrido). Quando verdadeiro e `isSuccess` é falso, o claim é marcado
   * `unknown` — terminal, sem retry por TTL — em vez de `failed`.
   */
  isDeliveryUnknown?: (result: T) => boolean;
  /** Repassado ao claim: permite reclaim de `completed` após o TTL. */
  completedTtlMs?: number;
}

/**
 * Espera a liquidação do claim com limite de tempo. Se o banco não responde
 * dentro de `OUTBOUND_SETTLE_TIMEOUT_MS`, a promessa de liquidação segue em
 * segundo plano e a resposta é devolvida — segurança não depende dela, porque
 * o marco `dispatching` (não-expirável) já está persistido.
 *
 * Rejeição (rápida ou tardia) é absorvida e apenas registrada: a liquidação é
 * best-effort e NUNCA pode transformar um envio já ocorrido em erro do caller
 * — isso induziria retry e, com ele, duplicate-send. Como o `catch` é anexado
 * antes da corrida, nenhuma rejeição vira unhandled rejection.
 */
async function settleBounded(settle: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bounded = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), OUTBOUND_SETTLE_TIMEOUT_MS);
  });
  const guarded = Promise.resolve(settle).catch((err) => {
    dbLogger.warn(
      'outbound-idempotency: claim settlement failed; the durable dispatching marker still prevents any resend',
      { error: err instanceof Error ? err.message : String(err) },
    );
  });
  try {
    await Promise.race([guarded, bounded]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  if (outcome === 'unknown') {
    // Efeito possivelmente ocorrido: NUNCA sucesso, NUNCA messageId, NUNCA
    // retry automático. O caller reconcilia manualmente.
    return { deduped: true, deliveryUnknown: true };
  }
  if (outcome === 'in_progress' || outcome === 'retry_after') {
    throw new OutboundSendConflictError(key, outcome);
  }

  // Marco DURÁVEL antes de qualquer dispatch (E4/HIGH-1): sem ele, uma falha
  // de escrita no marco final deixaria a chave `in_progress` expirável e
  // reexecutável dentro de 600s — duplicate-send.
  let armed: boolean;
  try {
    armed = await markIdempotencyKeyDispatching(key);
  } catch (err) {
    // Sem marco durável NÃO se despacha. Falha de infra propagada (o caller
    // trata; dedup continue indisponível até o claim anterior expirar/reclaim).
    throw new IdempotencyInfraError(
      `Outbound dispatch marker unavailable for key ${jobType}`,
      { cause: err },
    );
  }
  if (!armed) {
    // Condicional não casou: a chave deixou de estar claimada por esta
    // execução (corrida/estado inesperado). Fail-closed, sem dispatch.
    throw new OutboundSendConflictError(key, 'in_progress');
  }

  try {
    const result = await handler();
    if (isSuccess(result)) {
      await settleBounded(markIdempotencyKeyCompleted(key, opts?.completedTtlMs));
    } else if (opts?.isDeliveryUnknown?.(result)) {
      // Estado TERMINAL: efeito despachado sem entrega confirmada. Marca
      // `unknown` (não `failed`) para que o TTL NÃO libere re-dispatch.
      await settleBounded(markIdempotencyKeyUnknown(key));
    } else {
      await settleBounded(
        markIdempotencyKeyFailed(key, 'provider reported failure', OUTBOUND_IDEMPOTENCY_TTL_SECONDS),
      );
    }
    return { deduped: false, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // `dispatching` está persistido: se esta escrita falhar ou travar, a linha
    // permanece não-expirável e o replay devolve `unknown` — nunca reexecução.
    await settleBounded(
      markIdempotencyKeyFailed(key, message, OUTBOUND_IDEMPOTENCY_TTL_SECONDS),
    );
    throw err;
  }
}
