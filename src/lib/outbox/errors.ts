/**
 * Erros tipados do outbox — falhas PERMANENTES (sem retry automático) e o
 * DEFER (retry adiado, sem consumir tentativa).
 *
 * Um job do outbox é at-least-once por construção: `claimOutboxJob` devolve o
 * job e o worker re-executa enquanto o status permitir. Quando o efeito
 * externo PODE já ter ocorrido (entrega não confirmada), reexecutar é
 * duplicate-send — o único comportamento seguro é falhar de forma PERMANENTE:
 * a linha vai direto para `dead_letter`, sem consumir tentativa de retry, e a
 * reconciliação fica com o operador. No outro extremo, um CONFLITO de claim
 * de idempotência não é falha do job: o handler não rodou, e a espera pelo TTL
 * da chave não pode consumir o orçamento de tentativas — o job é ADIADO
 * (`OutboxDeferredError`).
 *
 * Módulo standalone e sem imports: `dispatch-outbox` (genérico) e os handlers
 * de módulo precisam reconhecer a mesma classe sem criar ciclo
 * (`dispatch-outbound-message` → `dispatch-outbox` → handlers).
 *
 * Código gravado na DLQ é SANITIZADO e estável: nunca carrega payload,
 * telefone, texto de mensagem, token ou detalhe de provider. Detalhe de
 * provider fica no log do servidor, nunca em `last_error_code`.
 */

/**
 * Falha permanente do job. `code` é o valor gravado em
 * `outbox_jobs.last_error_code` — livre de PII/segredo por construção.
 */
export class PermanentOutboxError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? `Permanent outbox failure: ${code}`);
    this.name = 'PermanentOutboxError';
    this.code = code;
  }
}

/**
 * Código da DLQ para efeito despachado sem confirmação de entrega.
 * Também é o estado TERMINAL da linha de idempotência (`unknown`), que não
 * volta a reenviar depois do TTL — ver `markIdempotencyKeyUnknown`.
 */
export const OUTBOX_DELIVERY_UNKNOWN_CODE = 'OUTBOX_DELIVERY_UNKNOWN';

/**
 * O dispatch ocorreu, mas a entrega não foi confirmada (timeout, exceção
 * after-dispatch, HTTP ambíguo). NÃO é falha conhecida e NUNCA é sucesso:
 * retry automático reexecutaria o side effect. A linha do outbox vai para
 * `dead_letter` e a linha de idempotência permanece `unknown` (terminal)
 * para reconciliação manual.
 */
export class OutboxDeliveryUnknownError extends PermanentOutboxError {
  constructor() {
    super(
      OUTBOX_DELIVERY_UNKNOWN_CODE,
      'Outbound delivery not confirmed; the effect may have been dispatched.',
    );
  }
}

/**
 * Código sanitizado e estável do defer — gravado em
 * `outbox_jobs.last_error_code` (nunca carrega chave, telefone ou payload).
 */
export const OUTBOX_SEND_DEFERRED_CODE = 'OUTBOX_SEND_DEFERRED';

/**
 * Código da DLQ para a liquidação do lembrete recusada pelo cerco de tenant.
 * Fixo e estável: nunca carrega `reminderId`, telefone nem detalhe de banco.
 */
export const REMINDER_SETTLEMENT_REJECTED_CODE = 'REMINDER_SETTLEMENT_REJECTED';

/**
 * A liquidação do lembrete foi RECUSADA por semântica, não por infra:
 * `markReminderDelivered` não casou nenhuma linha — id inexistente, status já
 * não `queued` ou compromisso do lembrete em OUTRA clínica (payload
 * descasado). É falha PERMANENTE, e o motivo é duplo:
 *
 * - a entrega AO PROVIDER já ocorreu, então reexecutar o job reexecutaria o
 *   envio (duplicate-send, ainda que deduplicado pelo claim);
 * - liquidar a linha como `delivered` marcaria como entregue um lembrete que
 *   não foi enviado.
 *
 * O dispatcher captura exatamente este tipo LANÇADO DE DENTRO da transação de
 * liquidação (`markOutboxDelivered` + hook) e move a linha para `dead_letter`
 * com este código, sem consumir tentativa e sem reportar entrega. FALHA DE
 * ESCRITA no banco (queda, timeout, rollback) NÃO é este erro: continua
 * propagando como falha transitória da liquidação, com o job voltando a
 * `processing` — as duas coisas nunca são confundidas.
 */
export class ReminderSettlementRejectedError extends PermanentOutboxError {
  constructor() {
    super(
      REMINDER_SETTLEMENT_REJECTED_CODE,
      'Reminder settlement rejected: no queued reminder row matched the tenant fence.',
    );
  }
}

/** True quando o erro classifica a liquidação do lembrete como recusada (DLQ). */
export function isReminderSettlementRejectedError(error: unknown): error is ReminderSettlementRejectedError {
  return error instanceof ReminderSettlementRejectedError;
}

/**
 * Job ADIADO (defer), não falho: o envio com chave encontrou a chave de
 * idempotência ainda ativa (`in_progress`) ou falhada recentemente
 * (`retry_after`) — outra execução é dona da operação lógica, ou a falha
 * determinística anterior vive dentro do TTL do claim. NÃO é permanente
 * (nunca vai direto à DLQ) e NÃO é sucesso (nunca `delivered`): o dispatcher
 * devolve o job a `pending` com `next_attempt_at` depois do TTL do claim e
 * devolve a tentativa de retry — reexecutar agora reenviaria o mesmo conflito
 * e esgotaria o orçamento de tentativas antes da primeira tentativa real de
 * handler (TTL do claim de 600s vs backoff de 60/180/420/900s).
 */
export class OutboxDeferredError extends Error {
  readonly code: string;
  /**
   * Segundos até o job voltar a ser elegível. O produtor garante o piso do
   * TTL do claim (`OUTBOUND_IDEMPOTENCY_TTL_SECONDS`), que NUNCA é anterior
   * ao `expires_at` da chave conflitante.
   */
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message?: string) {
    super(message ?? 'Outbound send deferred; the idempotency claim is still active or recently failed.');
    this.name = 'OutboxDeferredError';
    this.code = OUTBOX_SEND_DEFERRED_CODE;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** True quando o erro classifica o job como adiado (defer, retry posterior). */
export function isDeferredOutboxError(error: unknown): error is OutboxDeferredError {
  return error instanceof OutboxDeferredError;
}

/** True quando o erro classifica o job como permanente (DLQ imediata). */
export function isPermanentOutboxError(error: unknown): error is PermanentOutboxError {
  return error instanceof PermanentOutboxError;
}

/**
 * Código sanitizado do erro para `outbox_jobs.last_error_code`.
 * Erro permanente ou defer → `code` estável e fixo (sem PII/segredo); demais
 * → `name` do Error (contrato histórico do dispatcher); valor não-Error →
 * fallback determinístico.
 */
export function outboxErrorCode(error: unknown): string {
  if (error instanceof PermanentOutboxError) return error.code;
  if (error instanceof OutboxDeferredError) return error.code;
  return error instanceof Error ? error.name : 'OUTBOX_SEND_FAILED';
}
