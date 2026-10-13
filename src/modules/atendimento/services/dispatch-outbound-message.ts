import type { OutboxJob, OutboxSuccessHook } from '@/lib/outbox/outbox-repository';
import {
  OutboxDeferredError,
  OutboxDeliveryUnknownError,
  ReminderSettlementRejectedError,
} from '@/lib/outbox/errors';
import {
  OUTBOUND_IDEMPOTENCY_TTL_SECONDS,
  OutboundSendConflictError,
  buildOutboundIdempotencyKey,
} from '@/lib/http/outbound-idempotency';
import {
  OUTBOX_OPERATIONS,
  type OutboundMessagePayload,
} from '@/lib/outbox/operations';
import { sendByChannel, type SendResult } from './send-message-service';

function payloadFrom(job: OutboxJob): OutboundMessagePayload {
  const payload = job.payload as Partial<OutboundMessagePayload>;
  if (
    (payload.channel !== 'whatsapp' && payload.channel !== 'instagram' && payload.channel !== 'web')
    || typeof payload.externalId !== 'string'
    || !payload.externalId
    || typeof payload.message !== 'string'
    || !payload.message
  ) {
    throw new Error('INVALID_OUTBOUND_MESSAGE_PAYLOAD');
  }
  return payload as OutboundMessagePayload;
}

/**
 * Chave de idempotência estável do job de WhatsApp (E4).
 *
 * Ancorada em (tenant, job): `whatsapp:send:<clinicId>:outbox:<jobId>`. O job
 * do outbox é auto-retentável e o provider não tem `Idempotency-Key`, então
 * sem essa chave cada retry reexecutaria o dispatch (duplicate-send) — inclusive
 * depois de uma queda/outage. A chave é reaproveitada pelo claim: o replay do
 * MESMO job devolve dedup (provider NÃO chamado) e o efeito só ocorre uma vez.
 * WAHA + fallback sidecar contam como UMA operação lógica sob o mesmo claim.
 *
 * Instagram e web devolvem `undefined` (contratos existentes preservados; o
 * stub do Instagram não implementa envio real).
 */
function outboundJobIdempotencyKey(job: OutboxJob, channel: OutboundMessagePayload['channel']): string | undefined {
  if (channel !== 'whatsapp') return undefined;
  return buildOutboundIdempotencyKey('whatsapp', job.clinicId, `outbox:${job.id}`);
}

export async function dispatchOutboundMessageJob(
  job: OutboxJob,
): Promise<void | OutboxSuccessHook> {
  if (job.operation !== OUTBOX_OPERATIONS.ATENDIMENTO_OUTBOUND_MESSAGE) {
    throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
  }

  const payload = payloadFrom(job);
  let result: SendResult;
  try {
    result = await sendByChannel(
      payload.channel,
      payload.externalId,
      payload.message,
      outboundJobIdempotencyKey(job, payload.channel),
    );
  } catch (err) {
    // Conflito do claim de idempotência do envio COM chave (`in_progress` =
    // outra execução é dona da operação lógica; `retry_after` = falha
    // determinística anterior ainda dentro do TTL de 600s). Só a rota com
    // chave (WhatsApp) produz esse erro, e ele prova que o handler NÃO rodou:
    // o dispatcher defere o job (`OutboxDeferredError`) em vez de tratá-lo
    // como falha de envio — retry normal agora reenviaria o conflito em
    // 60/180/420/900s contra o TTL de 600s e esgotaria as tentativas. O
    // defer usa o próprio TTL do claim como piso, que nunca é anterior ao
    // `expires_at` da chave (o claim nasce com `now + 600s`). Falha de infra
    // (`IdempotencyInfraError`) e os demais erros propagate intactos
    // (fail-closed, nunca defer silencioso).
    if (err instanceof OutboundSendConflictError) {
      throw new OutboxDeferredError(OUTBOUND_IDEMPOTENCY_TTL_SECONDS);
    }
    throw err;
  }
  // E4 — efeito possivelmente despachado sem entrega confirmada: falha
  // PERMANENTE. Retry automático (`markOutboxRetry`) reexecutaria o
  // side effect; o dispatcher reconhece o erro tipado, move a linha direto para
  // `dead_letter` e devolve `dead_letter`. Sucesso NUNCA é reportado aqui e a
  // linha de idempotência permanece terminal `unknown` para reconciliação.
  if (result.delivery === 'unknown') {
    throw new OutboxDeliveryUnknownError();
  }
  if (!result.success) throw new Error(result.error ?? 'OUTBOUND_MESSAGE_FAILED');
  // Liquidação de sucesso do lembrete — HANDLER, não escrita imediata.
  //
  // O provider confirmou a entrega, mas a execução atual ainda NÃO é dona
  // comprovada da linha do outbox: um worker lento pode ter perdido o lease
  // de 5min para outro holder. Escrever `appointment_reminders` aqui
  // marcaria entregue um job cuja liquidação será recusada pelo fence — o
  // dispatcher devolveria `lease_lost` e o lembrete ficaria marcado sem
  // desfecho reportado.
  //
  // Por isso a marcação é devolvida como hook: o dispatcher só o invoca
  // DENTRO da transação cujo UPDATE cercado (`id, status, claim_generation`)
  // confirmou que esta execução é a dona da linha. Sem confirmação, não há
  // hook. Se o hook falhar por ESCRITA (queda/timeout do banco), o `delivered`
  // também é desfeito e o job volta a `processing` para replay (o claim de
  // idempotência dedupa o reenvio). Se a recusa for SEMÂNTICA — nenhuma linha
  // de lembrete casou — o desfecho é a DLQ (ver
  // `ReminderSettlementRejectedError`): a entrega ao provider já ocorreu e
  // liquidar como entregue marcaria um lembrete não enviado.
  if (payload.reminderId) {
    const reminderId = payload.reminderId;
    const messageId = result.messageId;
    return async (tx) => {
      const { markReminderDelivered } = await import('@/modules/operacional/public');
      const settled = await markReminderDelivered(reminderId, job.clinicId, messageId, tx);
      // `null`/`false` = nenhuma linha casou (id inexistente, status já não
      // `queued` ou compromisso do lembrete em OUTRA clínica — payload
      // descasado). Liquidar o job como entregue aqui marcaria um lembrete que
      // não foi enviado; reexecutar o job reexecutaria o envio (a entrega ao
      // provider JÁ ocorreu). Por isso a recusa é uma falha PERMANENTE tipada
      // (`ReminderSettlementRejectedError`): o dispatcher move a linha direto
      // para a DLQ com o código fixo `REMINDER_SETTLEMENT_REJECTED`.
      //
      // O erro é sanitizado por construção — nenhum reminderId, telefone,
      // texto ou detalhe de banco entra na mensagem. Falha de ESCRITA no banco
      // não passa por aqui: ela lança antes e continua propagando como falha
      // transitória da liquidação.
      if (!settled) throw new ReminderSettlementRejectedError();
    };
  }
}
