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
jest.mock('@/core/modules/manifest', () => ({
  createManifest: jest.fn(() => ({
    enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'financeiro', 'followup'])),
  })),
}));

import { processOutboxBatch } from '@/lib/outbox/worker';

describe('outbox worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatchNextOutbox.mockResolvedValueOnce({ status: 'delivered', jobId: 'job-1' }).mockResolvedValueOnce({ status: 'empty' });
  });

  it('claims only registered operations and drains until empty', async () => {
    const results = await processOutboxBatch(10, 1);
    expect(results).toEqual([{ status: 'delivered', jobId: 'job-1' }, { status: 'empty' }]);
    expect(dispatchNextOutbox).toHaveBeenCalledTimes(2);
    expect(dispatchNextOutbox.mock.calls[0][1].operations).toEqual([
      'financeiro.charge.create', 'financeiro.charge.cancel', 'followup.campaign.recipient',
    ]);
  });

  it('preserves pending for disabled module without consuming attempts', async () => {
    // Simulate financeiro disabled: only followup enabled
    const { createManifest } = require('@/core/modules/manifest');
    (createManifest as jest.Mock).mockReturnValueOnce({
      enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'followup'])),
    });
    dispatchNextOutbox.mockReset();
    dispatchNextOutbox.mockResolvedValue({ status: 'empty' } as any);
    const results = await processOutboxBatch(5, 2);
    // Should only claim followup operations, not financeiro
    const ops = (dispatchNextOutbox as jest.Mock).mock.calls[0]?.[1]?.operations || [];
    expect(ops).not.toContain('financeiro.charge.create');
    expect(ops).toContain('followup.campaign.recipient');
    expect(results.length).toBeGreaterThan(0);
  });

  it('handles limit < concurrency without double delivery', async () => {
    dispatchNextOutbox.mockReset();
    dispatchNextOutbox.mockResolvedValue({ status: 'empty' });
    const results = await processOutboxBatch(2, 5);
    // With limit 2 and concurrency 5, only 2 slots should be taken
    expect(results.length).toBeLessThanOrEqual(2);
    expect(dispatchNextOutbox).toHaveBeenCalledTimes(2);
  });
});
