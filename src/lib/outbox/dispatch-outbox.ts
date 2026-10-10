import type { OutboxJob } from './outbox-repository';
import { claimOutboxJob, markOutboxDeadLetter, markOutboxDeferred, markOutboxDelivered, markOutboxRetry, type OutboxSuccessHook } from './outbox-repository';
import {
  isDeferredOutboxError,
  isPermanentOutboxError,
  isReminderSettlementRejectedError,
  outboxErrorCode,
} from './errors';

/** Reexport conveniente: dispatchers e handlers importam o tipo de um só lugar. */
export type { OutboxSuccessHook };

export type OutboxSender = (job: OutboxJob) => Promise<void | OutboxSuccessHook>;

export type OutboxDispatchOptions = {
  operations?: readonly string[];
  onDeadLetter?: (job: OutboxJob, error: unknown) => Promise<void>;
  /**
   * Filtro INTERNO opcional por id do job — isolamento de teste (banco de
   * integração compartilhado). Repassado ao claim, que passa a só enxergar
   * aquele job. O worker de produção NUNCA o passa: sem `jobId` o claim segue
   * genérico por operação, exatamente como antes.
   */
  jobId?: string;
};

export type OutboxDispatchStatus = 'delivered' | 'retryable' | 'dead_letter' | 'lease_lost' | 'empty';

export type OutboxDispatchResult = { status: OutboxDispatchStatus; jobId?: string };

/**
 * DLQ imediata de falha permanente — o marco cercado roda primeiro e o callback
 * de reconciliação só depois de o banco confirmar a mudança de status.
 *
 * Compartilhado pelos dois caminhos que NÃO podem reexecutar o efeito externo:
 * o erro permanente do sender (entrega não confirmada) e a rejeição SEMÂNTICA
 * lançada de dentro da transação de liquidação. Em ambos, a linha vai para
 * `dead_letter` sem consumir tentativa e sem reportar entrega.
 */
async function deadLetterPermanently(
  job: OutboxJob,
  claimGeneration: number,
  error: unknown,
  onDeadLetter?: (job: OutboxJob, error: unknown) => Promise<void>,
): Promise<OutboxDispatchResult> {
  // O callback só roda DEPOIS de o update ter sido confirmado: sem confirmação
  // da DLQ não há reconciliação a disparar.
  if (!(await markOutboxDeadLetter(job.id, claimGeneration, outboxErrorCode(error)))) {
    return { status: 'lease_lost', jobId: job.id };
  }
  if (onDeadLetter) await onDeadLetter(job, error);
  return { status: 'dead_letter', jobId: job.id };
}

/**
 * Despacha o próximo job elegível.
 *
 * `lease_lost` — o lease adquirido no claim foi perdido antes (ou durante) a
 * liquidação: outro worker reclamou a linha depois do lease de 5min e a
 * geração do claim mudou, ou a linha já foi liquidada. Nenhum desfecho é
 * reportado (não `delivered`, não `retryable`, não `dead_letter`) e nenhum
 * callback roda: a execução atual NÃO é dona da linha. O worker trata o
 * resultado como não-vazio e segue para o próximo claim — a fila não para.
 *
 * Só o ERRO DO SENDER é classificado no caminho de falha — com UMA exceção
 * tipada no caminho de sucesso: a rejeição SEMÂNTICA da liquidação
 * (`ReminderSettlementRejectedError`), lançada pelo hook de dentro da
 * transação de `markOutboxDelivered`. Nela a entrega ao provider JÁ ocorreu e
 * o `delivered` foi desfeito junto com o hook, então reexecutar o job
 * reexecutaria o envio: a linha vai direto para a DLQ com código fixo.
 * Qualquer OUTRO erro daquela transação (queda do banco, timeout, escrita do
 * hook) PROPAGA — nunca é reinterpretado como falha de provider, o que
 * induziria retry/duplicate-send, e nunca gera segunda liquidação.
 *
 * Hook de liquidação de sucesso — o sender pode devolver um
 * `OutboxSuccessHook` em vez de `void`. Ele só é chamado quando o UPDATE
 * cercado confirmou que esta execução é dona da linha, e recebe o `tx` da
 * mesma transação: comita ou desfaz junto com o `delivered`. Um lease
 * obsoleto (`markOutboxDelivered` devolve `false`) nunca chega a invocá-lo,
 * então o efeito colateral (ex.: marcar o lembrete como entregue) não
 * acontece para uma execução que não é dona da linha.
 */
export async function dispatchNextOutbox(sender: OutboxSender, options: OutboxDispatchOptions = {}): Promise<OutboxDispatchResult> {
  // `jobId` estreita o claim a um job conhecido (isolamento de teste); ausente —
  // como em todo o perfil de produção — o claim segue genérico por operação.
  const job = await claimOutboxJob(
    options.jobId
      ? { operations: options.operations, jobId: options.jobId }
      : { operations: options.operations },
  );
  if (!job) return { status: 'empty' };
  // Lease completo devolvido pelo claim: sem geração não há fence possível
  // (ver migration 0036) — falha fechada em vez de liquidar às cegas.
  if (typeof job.claimGeneration !== 'number') {
    throw new Error('OUTBOX_LEASE_INCOMPLETE:claim_generation');
  }
  const lease = job.claimGeneration;

  let senderError: unknown;
  let senderFailed = false;
  let successHook: OutboxSuccessHook | undefined;
  try {
    const outcome = await sender(job);
    // O sender só devolve hook DEPOIS do sucesso confirmado do provider
    // (`delivery !== 'unknown'`): um efeito ambíguo lança antes e nunca chega
    // aqui. O hook é opcional por desenho — os senders existentes devolvem
    // `void` e a assinatura continua compatível.
    if (outcome) successHook = outcome;
  } catch (error) {
    senderFailed = true;
    senderError = error;
  }

  // ─── Sucesso: liquida a entrega com a fence do lease ──────────────────────
  if (!senderFailed) {
    try {
      // O hook de liquidação entra na MESMA transação do UPDATE cercado: se o
      // lease foi perdido, o fence recusa o UPDATE e o hook NUNCA roda.
      if (!(await markOutboxDelivered(job.id, lease, successHook))) {
        return { status: 'lease_lost', jobId: job.id };
      }
      return { status: 'delivered', jobId: job.id };
    } catch (error) {
      // Rejeição SEMÂNTICA da liquidação: o hook não casou nenhuma linha de
      // lembrete (id inexistente, status já não `queued` ou lembrete de outro
      // tenant). A transação já desfez o `delivered` com o hook — a linha
      // continua `processing` com o lease intacto — e a entrega AO PROVIDER
      // ocorreu: reexecutar o job reexecutaria o envio e liquidar como
      // `delivered` marcaria um lembrete não enviado. Falha PERMANENTE ⇒ DLQ
      // com código fixo, sem consumir tentativa e sem marcar entrega.
      //
      // SÓ este tipo é capturado aqui. Qualquer outro erro da transação de
      // liquidação (queda do banco, timeout, escrita do hook) PROPAGA: o
      // efeito colateral não tem desfecho conhecido e tratá-lo como falha de
      // provider induziria retry sobre um efeito já ocorrido.
      if (!isReminderSettlementRejectedError(error)) throw error;
      return deadLetterPermanently(job, lease, error, options.onDeadLetter);
    }
  }

  // ─── Daqui em diante SOMENTE erros do sender são classificados ────────────
  const error = senderError;

  // Falha PERMANENTE (ex.: efeito despachado sem entrega confirmada): retry
  // automático reexecutaria o side effect. A linha vai direto para
  // `dead_letter`, sem consumir tentativa, e o callback de reconciliação roda
  // uma única vez. Sucesso NUNCA é reportado aqui.
  if (isPermanentOutboxError(error)) {
    return deadLetterPermanently(job, lease, error, options.onDeadLetter);
  }

  // DEFER — conflito de claim de idempotência: outra execução é dona da
  // operação lógica (`in_progress`) ou a falha determinística anterior ainda
  // vive dentro do TTL do claim (`retry_after`). O handler NÃO rodou e o
  // provider não foi elegível, então NÃO é falha do job: sem retry agora
  // (60/180/420/900s reenviariam o conflito contra um TTL de 600s e só ~2
  // tentativas reais sobreviveriam), sem DLQ (a linha não está esgotada — a
  // tentativa do claim é devolvida) e sem marcar entrega. O job volta a
  // `pending` depois do TTL do claim.
  if (isDeferredOutboxError(error)) {
    if (!(await markOutboxDeferred(job.id, lease, outboxErrorCode(error), error.retryAfterSeconds))) {
      return { status: 'lease_lost', jobId: job.id };
    }
    return { status: 'retryable', jobId: job.id };
  }

  const errorCode = outboxErrorCode(error);
  const deadLetter = job.attempts >= 5;
  if (!(await markOutboxRetry(job.id, lease, job.attempts, errorCode))) {
    return { status: 'lease_lost', jobId: job.id };
  }
  // Callback só depois do update confirmado; a exceção do callback NÃO
  // reliquida a linha (a liquidação já aconteceu e está fora deste catch).
  if (deadLetter && options.onDeadLetter) await options.onDeadLetter(job, error);
  return { status: deadLetter ? 'dead_letter' : 'retryable', jobId: job.id };
}
