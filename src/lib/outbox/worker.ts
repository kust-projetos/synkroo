import type { OutboxJob } from './outbox-repository';
import { dispatchNextOutbox } from './dispatch-outbox';
import { dispatchChargeJob } from '@/modules/financeiro/services/dispatch-charge-job';
import { dispatchCampaignRecipientJob, markCampaignRecipientDeadLetter } from '@/services/followup/dispatch-campaign-recipient';

const HANDLERS: Record<string, (job: OutboxJob) => Promise<void>> = {
  'financeiro.charge.create': dispatchChargeJob,
  'financeiro.charge.cancel': dispatchChargeJob,
  'followup.campaign.recipient': dispatchCampaignRecipientJob,
};

export async function processOutboxBatch(limit = 25) {
  const results: Array<{ status: string; jobId?: string }> = [];
  const operations = Object.keys(HANDLERS);
  for (let index = 0; index < limit; index += 1) {
    const result = await dispatchNextOutbox(async (job) => {
      const handler = HANDLERS[job.operation];
      if (!handler) throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
      await handler(job);
    }, {
      operations,
      onDeadLetter: async (job) => {
        if (job.operation === 'followup.campaign.recipient') await markCampaignRecipientDeadLetter(job);
      },
    });
    results.push(result);
    if (result.status === 'empty') break;
  }
  return results;
}

export const outboxOperations = Object.keys(HANDLERS);
