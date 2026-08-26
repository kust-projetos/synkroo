import { dispatchNextOutbox } from '../dispatch-outbox';

jest.mock('../outbox-repository', () => ({
  claimOutboxJob: jest.fn(),
  markOutboxDelivered: jest.fn(),
  markOutboxRetry: jest.fn(),
}));

const { claimOutboxJob, markOutboxRetry, markOutboxDelivered } = require('../outbox-repository');

describe('F7.07 retry bounded + DLQ observável', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retryable when attempts <5', async () => {
    claimOutboxJob.mockResolvedValueOnce({ id: 'j1', attempts: 2, operation: 'followup.campaign.recipient' });
    const sender = jest.fn().mockRejectedValueOnce(new Error('CAMPAIGN_SEND_FAILED'));
    const onDeadLetter = jest.fn();
    const res = await dispatchNextOutbox(sender, { onDeadLetter });
    expect(res.status).toBe('retryable');
    expect(markOutboxRetry).toHaveBeenCalledWith('j1', 2, 'Error');
    expect(onDeadLetter).not.toHaveBeenCalled();
  });

  test('dead_letter when attempts >=5 and onDeadLetter called', async () => {
    claimOutboxJob.mockResolvedValueOnce({ id: 'j2', attempts: 5, operation: 'followup.campaign.recipient', payload: { recipientId: 'r1' } });
    const sender = jest.fn().mockRejectedValueOnce(new Error('OUT OF RETRIES'));
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    const res = await dispatchNextOutbox(sender, { onDeadLetter });
    expect(res.status).toBe('dead_letter');
    expect(markOutboxRetry).toHaveBeenCalledWith('j2', 5, 'Error');
    expect(onDeadLetter).toHaveBeenCalledWith(expect.objectContaining({ id: 'j2' }), expect.any(Error));
  });

  test('delivered on success', async () => {
    claimOutboxJob.mockResolvedValueOnce({ id: 'j3', attempts: 0, operation: 'followup.campaign.recipient' });
    const sender = jest.fn().mockResolvedValueOnce(undefined);
    const res = await dispatchNextOutbox(sender, {});
    expect(res.status).toBe('delivered');
    expect(markOutboxDelivered).toHaveBeenCalledWith('j3');
  });
});
