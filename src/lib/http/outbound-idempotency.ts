/**
 * Idempotência outbound — Trilha A (etapa A3 do plano de hardening).
 *
 * Reaproveita o claim local de `src/lib/idempotency` (tabela `idempotency_keys`,
 * `INSERT ... ON CONFLICT DO NOTHING`): a chave é claimed ANTES do envio; uma
 * duplicata da mesma operação lógica não reenvia (retorna `deduped: true`).
 *
 * Ancoragem da chave: `buildOutboundIdempotencyKey(channel, clinicId, stableId)`
 * → `"<channel>:send:<clinicId>:<stableId>"`. O `stableId` deve ser o id estável
 * do registro/outbox ANTES do envio. Não há id estável no fluxo atual dos
 * callers (webhook-processor, dispatch-inbound) — por isso a proteção é opt-in
 * via parâmetro (compatível com as assinaturas públicas) até a fiação dos
 * callers, SEM exigir mudança de schema.
 *
 * NOTA Evolution API: a Evolution NÃO documenta suporte nativo a
 * `Idempotency-Key` no envio de mensagem (pesquisa do planner; sem evidência
 * no código/docs do repo) — por isso NENHUM header de idempotência é enviado
 * ao provider. O claim local é o mecanismo primário.
 *
 * Semântica de conclusão (TTL curto — só o `completed` dedupa para sempre):
 * - sucesso do provider → `completed` (duplicata futura não reenvia);
 * - falha/throw → `failed` (permite retry após expirar o TTL de 10min);
 * - DB indisponível no claim → fail-open: envia sem proteção (log warn),
 *   porque mensageria prioriza disponibilidade; o dedup é best-effort.
 */

import { dbLogger } from '@/lib/logger';
import {
  tryClaimIdempotencyKey,
  markIdempotencyKeyCompleted,
  markIdempotencyKeyFailed,
} from '@/lib/idempotency';

export const OUTBOUND_JOB_TYPE = 'whatsapp:outbound';
/** TTL do claim: curto — falha/crash liberam retry em 10min; `completed` dedupa para sempre. */
export const OUTBOUND_IDEMPOTENCY_TTL_SECONDS = 600;

export type OutboundChannel = 'whatsapp' | 'instagram';

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
  /** true quando a operação já tinha sido executada/claimed (provider NÃO chamado). */
  deduped: boolean;
  result?: T;
}

/**
 * Executa `handler` (o envio ao provider) sob claim de idempotência.
 * `isSuccess` diz se o resultado conta como entregue (default: não-throw).
 * Em duplicata, o handler NÃO é executado e retorna `{ deduped: true }`
 * (o resultado anterior não é persistido na tabela — sem schema novo).
 */
export async function withOutboundIdempotency<T>(
  key: string,
  handler: () => Promise<T>,
  opts?: { jobType?: string; isSuccess?: (result: T) => boolean },
): Promise<OutboundIdempotentResult<T>> {
  const jobType = opts?.jobType ?? OUTBOUND_JOB_TYPE;
  const isSuccess = opts?.isSuccess ?? ((): boolean => true);

  let claimed: boolean;
  try {
    claimed = await tryClaimIdempotencyKey(key, jobType, OUTBOUND_IDEMPOTENCY_TTL_SECONDS);
  } catch (err) {
    dbLogger.warn('outbound-idempotency: claim unavailable; sending without dedup', { jobType });
    return { deduped: false, result: await handler() };
  }
  if (!claimed) return { deduped: true };

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
