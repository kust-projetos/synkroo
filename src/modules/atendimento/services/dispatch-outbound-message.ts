import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import {
  OUTBOX_OPERATIONS,
  type OutboundMessagePayload,
} from '@/lib/outbox/operations';
import { sendByChannel } from './send-message-service';

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

export async function dispatchOutboundMessageJob(job: OutboxJob): Promise<void> {
  if (job.operation !== OUTBOX_OPERATIONS.ATENDIMENTO_OUTBOUND_MESSAGE) {
    throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
  }

  const payload = payloadFrom(job);
  const result = await sendByChannel(payload.channel, payload.externalId, payload.message);
  if (!result.success) throw new Error(result.error ?? 'OUTBOUND_MESSAGE_FAILED');
  if (payload.reminderId) {
    const { markReminderDelivered } = await import('@/modules/operacional/public');
    await markReminderDelivered(payload.reminderId, result.messageId);
  }
}
