const dispatchNextOutbox = jest.fn();
const dispatchChargeJob = jest.fn();
const dispatchCampaignRecipientJob = jest.fn();
const markCampaignRecipientDeadLetter = jest.fn();

jest.mock('@/lib/outbox/dispatch-outbox', () => ({ dispatchNextOutbox: (...args: unknown[]) => dispatchNextOutbox(...args) }));
jest.mock('@/modules/financeiro/services/dispatch-charge-job', () => ({ dispatchChargeJob: (...args: unknown[]) => dispatchChargeJob(...args) }));
jest.mock('@/services/followup/dispatch-campaign-recipient', () => ({
  dispatchCampaignRecipientJob: (...args: unknown[]) => dispatchCampaignRecipientJob(...args),
  markCampaignRecipientDeadLetter: (...args: unknown[]) => markCampaignRecipientDeadLetter(...args),
}));

import { processOutboxBatch } from '@/lib/outbox/worker';

describe('outbox worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatchNextOutbox.mockResolvedValueOnce({ status: 'delivered', jobId: 'job-1' }).mockResolvedValueOnce({ status: 'empty' });
  });

  it('claims only registered operations and drains until empty', async () => {
    const results = await processOutboxBatch(10);
    expect(results).toEqual([{ status: 'delivered', jobId: 'job-1' }, { status: 'empty' }]);
    expect(dispatchNextOutbox).toHaveBeenCalledTimes(2);
    expect(dispatchNextOutbox.mock.calls[0][1].operations).toEqual([
      'financeiro.charge.create', 'financeiro.charge.cancel', 'followup.campaign.recipient',
    ]);
  });
});
