import { sendWhatsAppMessage } from './channel-service';
import { buildOutboundIdempotencyKey, OutboundSendConflictError } from '@/lib/http/outbound-idempotency';
import { dbLogger, whatsappLogger } from '@/lib/logger';
import { resolveInboundReply } from '@/modules/operacional/public';
import * as repo from '../repositories/conversations-repository';
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';
import { resolveInterlocutor } from '@/core/ia-channel/interlocutor';
import { buscarPacientePorTelefone } from '@/modules/operacional/public';
import { buscarLeadPorTelefone } from '@/modules/comercial/public';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';

export type InboundMessageJobPayload = {
  clinicId: string;
  conversationId: string;
  channel: 'whatsapp' | 'web';
  externalConversationId: string;
  externalProvider: string;
  externalMessageId: string;
  content: string;
  messageType: string;
  /** Button-tap marker persisted at ingress; absent (legacy jobs) means text. */
  messageKind?: 'text' | 'button';
  /**
   * Authenticated inbound event time (ISO string of the provider message
   * clock, e.g. `messages.metadata.authenticatedEventAt`). Absent/invalid
   * (legacy jobs) → the reply path escalates instead of mutating. Never
   * the DB insert time.
   */
  receivedAt?: string;
  metadata: Record<string, unknown>;
};

function payloadFrom(job: OutboxJob): InboundMessageJobPayload {
  const payload = job.payload as Partial<InboundMessageJobPayload>;
  if (
    typeof payload.clinicId !== 'string' ||
    typeof payload.conversationId !== 'string' ||
    (payload.channel !== 'whatsapp' && payload.channel !== 'web') ||
    typeof payload.externalConversationId !== 'string' ||
    typeof payload.externalProvider !== 'string' ||
    typeof payload.externalMessageId !== 'string' ||
    typeof payload.content !== 'string' ||
    typeof payload.messageType !== 'string'
  ) throw new Error('INVALID_INBOUND_OUTBOX_PAYLOAD');
  return { ...payload, metadata: payload.metadata ?? {} } as InboundMessageJobPayload;
}

export async function dispatchInboundMessageJob(job: OutboxJob): Promise<void> {
  const input = payloadFrom(job);
  // The widget is intentionally ingress-only in v1. Its durable persistence is
  // complete, but no browser history or outbound channel is exposed here.
  if (input.channel !== 'whatsapp') return;

  // Single routing point: exact "sim" consumes at most one unambiguous
  // pending (or waitlist offer); missing/ambiguous/non-exact identity
  // escalates the conversation to a human — never a blind mutation, and
  // never a silent fallthrough to the waitlist parser or the agent.
  // Button-kind jobs resolve through the button channel (no waitlist);
  // a missing/invalid event time fails closed inside the resolver.
  const decision = await resolveInboundReply({
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    senderPhone: input.externalConversationId,
    content: input.content,
    externalProvider: input.externalProvider,
    externalMessageId: input.externalMessageId,
    messageType: input.messageType,
    messageKind: input.messageKind ?? 'text',
    receivedAt: input.receivedAt,
  }, { allowWaitlist: input.messageKind === 'button' ? false : undefined });
  if (decision.kind === 'confirmed') {
    const sent = await sendReply(input, decision.responseMessage, job.id, 'confirmacao');
    if (!sent) {
      // The mutation is already committed, but the user was never told:
      // failing the job forces an outbox retry, and the redelivery replays
      // the stored outcome instead of duplicating it. Generic message on
      // purpose — no phone, content, or provider details.
      throw new Error('INBOUND_REPLY_SEND_FAILED');
    }
    return;
  }
  if (decision.kind === 'waitlist_scheduled') {
    const sent = await sendReply(input, decision.responseMessage, job.id, 'agendamento');
    if (!sent) {
      // Same retryable-failure contract as the confirmation branch.
      throw new Error('INBOUND_REPLY_SEND_FAILED');
    }
    return;
  }
  if (decision.kind === 'escalate') {
    dbLogger.info('dispatch-inbound: reply escalated without mutation', {
      conversationId: input.conversationId,
      reason: decision.reason,
    });
    await repo.escalateConversation(input.conversationId, input.clinicId);
    await repo.updateConversationTimestamp(input.clinicId, input.conversationId, new Date());
    return;
  }

  try {
    await capturarLead(input);
  } catch {
    // Lead capture is best-effort and must not prevent agent processing.
  }

  const result = await routeInboundToAgent({
    resolveInterlocutor: (clinicId, phone) => resolveInterlocutor({
      findPatientByPhone: async (value, id) => {
        const patient = await buscarPacientePorTelefone(id, value);
        return patient ? { id: patient.id, name: patient.name } : null;
      },
      findLeadByPhone: async (value, id) => {
        const lead = await buscarLeadPorTelefone(id, value);
        return lead ? { id: lead.id, name: lead.name } : null;
      },
    }, clinicId, phone),
    invokeAgent,
    sendReply: async (_conversationId, message) => sendReply(input, message, job.id),
    timezone: 'America/Sao_Paulo',
  }, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    phone: input.externalConversationId,
    content: input.content,
  });
  if (result.action === 'send_failed') {
    whatsappLogger.warn('[inbound] agent reply could not be sent', { conversationId: input.conversationId });
  }
}

async function capturarLead(input: InboundMessageJobPayload): Promise<void> {
  const { capturarLeadInbound } = await import('@/modules/comercial/public');
  await capturarLeadInbound({
    clinicId: input.clinicId,
    name: input.externalConversationId,
    phone: input.externalConversationId,
    source: input.externalProvider,
  });
}

/**
 * Responde via WhatsApp com idempotência outbound (A3).
 *
 * A chave ancora no OutboxJob estável (`whatsapp:send:<clinicId>:inbox:<jobId>`):
 * o redelivery do mesmo job não reenvia ao provider (retorna dedup como
 * sucesso). Conflito (`in_progress`/`retry_after`) NÃO é sucesso: warn + throw
 * para o outbox re-tentar o job depois. O registro de histórico é mantido por
 * execução (semântica de attempt-log); o invariante é o não-reenvio ao provider.
 */
async function sendReply(
  input: InboundMessageJobPayload,
  message: string,
  jobId: string,
  intent?: string,
): Promise<boolean> {
  const key = buildOutboundIdempotencyKey('whatsapp', input.clinicId, `inbox:${jobId}`);
  let sent;
  try {
    sent = await sendWhatsAppMessage(input.externalConversationId, message, key);
  } catch (err) {
    if (err instanceof OutboundSendConflictError) {
      dbLogger.warn('dispatch-inbound: send conflict; failing job for outbox retry', {
        jobId,
        state: err.state,
      });
    }
    throw err;
  }
  if (!sent.success) return false;
  await repo.appendOutboundMessage(input.clinicId, {
    conversationId: input.conversationId,
    content: message,
    messageType: 'text',
    intent,
    metadata: { source: 'inbound-outbox', externalProvider: input.externalProvider },
  });
  await repo.updateConversationTimestamp(input.clinicId, input.conversationId, new Date());
  return true;
}
