import type { OutboxJob } from './outbox-repository';
import { claimOutboxJob, markOutboxDelivered, markOutboxRetry } from './outbox-repository';

export type OutboxSender = (job: OutboxJob) => Promise<void>;

export async function dispatchNextOutbox(sender: OutboxSender): Promise<{
  status: 'delivered' | 'retryable' | 'dead_letter' | 'empty';
  jobId?: string;
}> {
  const job = await claimOutboxJob();
  if (!job) return { status: 'empty' };
  try {
    await sender(job);
    await markOutboxDelivered(job.id);
    return { status: 'delivered', jobId: job.id };
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : 'OUTBOX_SEND_FAILED';
    await markOutboxRetry(job.id, job.attempts, errorCode);
    return { status: job.attempts >= 5 ? 'dead_letter' : 'retryable', jobId: job.id };
  }
}
