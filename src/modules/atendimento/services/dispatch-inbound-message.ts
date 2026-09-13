import { sendWhatsAppMessage } from './channel-service';
import { buildOutboundIdempotencyKey } from '@/lib/http/outbound-idempotency';
import { processConfirmationResponse, processWaitlistConfirmation } from '@/modules/operacional/public';
import { whatsappLogger } from '@/lib/logger';
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

  const confirmation = await processConfirmationResponse(
    input.clinicId,
    input.externalConversationId,
    input.content,
  );
  if (confirmation.processed && confirmation.responseMessage) {
    await sendReply(input, confirmation.responseMessage, job.id, confirmation.action === 'confirmed' ? 'confirmacao' : 'cancelamento');
    return;
  }

  const waitlist = await processWaitlistConfirmation(
    input.clinicId,
    input.externalConversationId,
    input.content,
  );
  if (waitlist.processed && waitlist.responseMessage) {
    await sendReply(input, waitlist.responseMessage, job.id, 'agendamento');
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
 * sucesso). O registro de histórico é mantido por execução (semântica de
 * attempt-log); o invariante garantido é o não-reenvio ao provider.
 */
async function sendReply(
  input: InboundMessageJobPayload,
  message: string,
  jobId: string,
  intent?: string,
): Promise<boolean> {
  const key = buildOutboundIdempotencyKey('whatsapp', input.clinicId, `inbox:${jobId}`);
  const sent = await sendWhatsAppMessage(input.externalConversationId, message, key);
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
