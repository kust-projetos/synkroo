import { and, eq, lte, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { outboxJobs } from '@/lib/db/schema';

export type OutboxStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter';
export type OutboxJob = typeof outboxJobs.$inferSelect;

type OutboxInsert = {
  clinicId: string;
  operation: string;
  businessKey: string;
  payload: Record<string, unknown>;
};

export async function enqueueOutbox(db: any, job: OutboxInsert): Promise<OutboxJob | undefined> {
  const [row] = await db.insert(outboxJobs).values(job).onConflictDoNothing().returning();
  return row;
}

const OUTBOX_LEASE_MS = 5 * 60 * 1000;

export async function claimOutboxJob(now = new Date()): Promise<OutboxJob | undefined> {
  const db = getDb();
  const staleBefore = new Date(now.getTime() - OUTBOX_LEASE_MS);
  return db.transaction(async (tx: any) => {
    const claimable = or(
      eq(outboxJobs.status, 'pending'),
      and(eq(outboxJobs.status, 'processing'), lte(outboxJobs.updatedAt, staleBefore)),
    );
    const [job] = await tx.select().from(outboxJobs).where(and(
      claimable,
      lte(outboxJobs.nextAttemptAt, now),
    )).orderBy(outboxJobs.nextAttemptAt).limit(1).for('update', { skipLocked: true });
    if (!job) return undefined;
    const [claimed] = await tx.update(outboxJobs).set({
      status: 'processing',
      attempts: sql`${outboxJobs.attempts} + 1`,
      updatedAt: now,
    }).where(and(eq(outboxJobs.id, job.id), claimable)).returning();
    return claimed;
  });
}

export async function markOutboxDelivered(id: string): Promise<void> {
  await getDb().update(outboxJobs).set({ status: 'delivered', updatedAt: new Date() })
    .where(and(eq(outboxJobs.id, id), eq(outboxJobs.status, 'processing')));
}

export async function markOutboxRetry(id: string, attempts: number, errorCode: string, now = new Date()): Promise<void> {
  const exhausted = attempts >= 5;
  const delaySeconds = Math.min(2 ** attempts * 30, 3600);
  await getDb().update(outboxJobs).set({
    status: exhausted ? 'dead_letter' : 'pending',
    nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000),
    lastErrorCode: errorCode,
    updatedAt: now,
  }).where(and(eq(outboxJobs.id, id), eq(outboxJobs.status, 'processing')));
}
