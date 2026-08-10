import type { OutboxJob } from './outbox-repository';
import { claimOutboxJob, markOutboxDelivered, markOutboxRetry } from './outbox-repository';

export type OutboxSender = (job: OutboxJob) => Promise<void>;

export type OutboxDispatchOptions = { operations?: readonly string[]; onDeadLetter?: (job: OutboxJob, error: unknown) => Promise<void> };

export async function dispatchNextOutbox(sender: OutboxSender, options: OutboxDispatchOptions = {}): Promise<{
  status: 'delivered' | 'retryable' | 'dead_letter' | 'empty';
  jobId?: string;
}> {
  const job = await claimOutboxJob({ operations: options.operations });
  if (!job) return { status: 'empty' };
  try {
    await sender(job);
    await markOutboxDelivered(job.id);
    return { status: 'delivered', jobId: job.id };
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : 'OUTBOX_SEND_FAILED';
    const deadLetter = job.attempts >= 5;
    await markOutboxRetry(job.id, job.attempts, errorCode);
    if (deadLetter && options.onDeadLetter) await options.onDeadLetter(job, error);
    return { status: deadLetter ? 'dead_letter' : 'retryable', jobId: job.id };
  }
}
