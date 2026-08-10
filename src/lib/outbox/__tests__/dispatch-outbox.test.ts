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
  it('routes operation filters and dead-letter callbacks', async () => {
    const deadLetterJob = { ...job, attempts: 5, operation: 'campaign' };
    claimOutboxJob.mockResolvedValue(deadLetterJob);
    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    markOutboxRetry.mockResolvedValue(undefined);

    await expect(dispatchNextOutbox(async () => { throw new Error('provider down'); }, { operations: ['campaign'], onDeadLetter }))
      .resolves.toEqual({ status: 'dead_letter', jobId: 'job-1' });
    expect(claimOutboxJob).toHaveBeenCalledWith({ operations: ['campaign'] });
    expect(onDeadLetter).toHaveBeenCalledWith(deadLetterJob, expect.any(Error));
  });
});
