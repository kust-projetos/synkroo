const claimOutboxJob = jest.fn();
const markOutboxDelivered = jest.fn();
const markOutboxRetry = jest.fn();

jest.mock('../outbox-repository', () => ({
  claimOutboxJob: (...args: unknown[]) => claimOutboxJob(...args),
  markOutboxDelivered: (...args: unknown[]) => markOutboxDelivered(...args),
  markOutboxRetry: (...args: unknown[]) => markOutboxRetry(...args),
}));

import { dispatchNextOutbox } from '../dispatch-outbox';

const job = { id: 'job-1', attempts: 1 } as any;

describe('outbox dispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delivers a claimed job once', async () => {
    claimOutboxJob.mockResolvedValue(job);

    await expect(dispatchNextOutbox(async () => undefined)).resolves.toEqual({ status: 'delivered', jobId: 'job-1' });
    expect(markOutboxDelivered).toHaveBeenCalledWith('job-1');
  });

  it('returns empty when no pending job exists', async () => {
    claimOutboxJob.mockResolvedValue(undefined);

    await expect(dispatchNextOutbox(async () => undefined)).resolves.toEqual({ status: 'empty' });
  });
});
