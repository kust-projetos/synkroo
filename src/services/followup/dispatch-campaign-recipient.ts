import { dispatchNextOutbox } from '@/lib/outbox/dispatch-outbox';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import * as campaignRepo from '@/repositories/campaigns';

async function sendCampaignMessage(phone: string, message: string, idempotencyKey: string): Promise<void> {
  if (!phone) throw new Error('CAMPAIGN_RECIPIENT_PHONE_MISSING');
  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_TOKEN;
  if (!url || !token) throw new Error('WHATSAPP_NOT_CONFIGURED');
  const formattedPhone = phone.replace(/\D/g, '').startsWith('55') ? phone.replace(/\D/g, '') : `55${phone.replace(/\D/g, '')}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: formattedPhone, type: 'text', text: { body: message } }),
  });
  if (!response.ok) throw new Error('CAMPAIGN_SEND_FAILED');
}

export async function dispatchCampaignRecipientJob(job: OutboxJob): Promise<void> {
  if (job.operation !== 'followup.campaign.recipient') throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
  const payload = job.payload as Record<string, string>;
  await sendCampaignMessage(payload.phone, payload.message, job.businessKey);
  await campaignRepo.markRecipientSent(payload.recipientId);
  await campaignRepo.updateCampaignCounts(payload.campaignId);
}

export async function markCampaignRecipientDeadLetter(job: OutboxJob): Promise<void> {
  const payload = job.payload as Record<string, string>;
  await campaignRepo.markRecipientError(payload.recipientId, 'OUTBOX_DEAD_LETTER');
  await campaignRepo.updateCampaignCounts(payload.campaignId);
}

const CAMPAIGN_OPERATIONS = ['followup.campaign.recipient'] as const;

export function dispatchNextCampaignRecipient() {
  return dispatchNextOutbox(dispatchCampaignRecipientJob, { operations: CAMPAIGN_OPERATIONS, onDeadLetter: markCampaignRecipientDeadLetter });
}
