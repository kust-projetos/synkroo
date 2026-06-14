/**
 * Agent Queue Repository — migrated to Drizzle
 * Repository pattern for queue CRUD operations
 */

import { eq, lte, and, asc, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { agentQueue, agentDlq } from '@/lib/db/schema/agent'
import { dbLogger } from '@/lib/logger'

export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface QueueEntry {
  id: string
  from_agent: string
  to_agent: string
  payload: unknown
  status: QueueStatus
  retry_count: number
  last_error: string | null
  scheduled_for: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DLQEntry {
  id: string
  original_queue_id: string
  from_agent: string
  to_agent: string
  payload: unknown
  error: string
  retry_count: number
  moved_to_dlq_at: string
  created_at: string
}

export interface EnqueueParams {
  fromAgent: string
  toAgent: string
  payload: Record<string, unknown>
  scheduledFor?: string
}

export interface UpdateStatusParams {
  id: string
  status: QueueStatus
  error?: string
}

export interface GetPendingParams {
  agent: string
  limit?: number
}

// ─── Drizzle camelCase → Supabase snake_case mapper ───
function toSnakeQueue(r: any): QueueEntry {
  const now = new Date().toISOString()
  return {
    id: r.id,
    from_agent: r.fromAgent,
    to_agent: r.toAgent,
    payload: r.payload,
    status: r.status as QueueStatus,
    retry_count: r.retryCount ?? 0,
    last_error: r.error ?? null,
    scheduled_for: r.processAfter?.toISOString?.() ?? r.processAfter ?? now,
    started_at: null,
    completed_at: r.completedAt?.toISOString?.() ?? null,
    created_at: r.createdAt?.toISOString?.() ?? now,
    updated_at: now,
  }
}

function toSnakeDLQ(r: any): DLQEntry {
  const now = new Date().toISOString()
  return {
    id: r.id,
    original_queue_id: r.originalQueueId,
    from_agent: r.fromAgent,
    to_agent: r.toAgent,
    payload: r.payload,
    error: r.error,
    retry_count: r.retryCount ?? 0,
    moved_to_dlq_at: r.createdAt?.toISOString?.() ?? now,
    created_at: r.createdAt?.toISOString?.() ?? now,
  }
}

export class AgentQueueRepository {
  async enqueue(params: EnqueueParams): Promise<string> {
    const db = getDb()
    const scheduledFor = params.scheduledFor ?? new Date()

    const [row] = await db
      .insert(agentQueue)
      .values({
        fromAgent: params.fromAgent,
        toAgent: params.toAgent,
        payload: params.payload,
        status: 'pending',
        retryCount: 0,
        processAfter: new Date(scheduledFor),
      })
      .returning({ id: agentQueue.id })

    if (!row) {
      dbLogger.error('Failed to enqueue message — no row returned')
      throw new Error('Failed to enqueue message')
    }

    dbLogger.info('Message enqueued', { queueId: row.id, fromAgent: params.fromAgent, toAgent: params.toAgent })
    return row.id
  }

  async dequeue(toAgent: string): Promise<QueueEntry | null> {
    const db = getDb()
    const now = new Date()

    const [row] = await db
      .select()
      .from(agentQueue)
      .where(and(eq(agentQueue.toAgent, toAgent), eq(agentQueue.status as any, 'pending'), lte(agentQueue.processAfter, now)))
      .orderBy(asc(agentQueue.createdAt))
      .limit(1)

    if (!row) return null

    await this.updateStatus({ id: row.id, status: 'processing' })

    const entry = toSnakeQueue(row)
    entry.started_at = new Date().toISOString()
    return entry
  }

  async updateStatus(params: UpdateStatusParams): Promise<void> {
    const db = getDb()
    const updates: any = { status: params.status }

    if (params.status === 'done') {
      updates.completedAt = new Date()
    } else if (params.status === 'failed') {
      updates.error = params.error ?? null
    }

    await db.update(agentQueue).set(updates).where(eq(agentQueue.id, params.id))

    dbLogger.debug('Queue status updated', { queueId: params.id, status: params.status })
  }

  async incrementRetry(id: string): Promise<{ retryCount: number; scheduledFor: string }> {
    const db = getDb()

    const [entry] = await db.select({ retryCount: agentQueue.retryCount }).from(agentQueue).where(eq(agentQueue.id, id))

    if (!entry) {
      dbLogger.error('Failed to get queue entry for retry', null, { queueId: id })
      throw new Error(`Queue entry not found: ${id}`)
    }

    const currentRetry = entry.retryCount ?? 0
    const newRetryCount = currentRetry + 1

    const delay = Math.min(1000 * Math.pow(2, currentRetry), 16000)
    const scheduledFor = new Date(Date.now() + delay)

    await db
      .update(agentQueue)
      .set({ retryCount: newRetryCount, processAfter: scheduledFor, status: 'pending' })
      .where(eq(agentQueue.id, id))

    dbLogger.info('Retry count incremented', { queueId: id, retryCount: newRetryCount, scheduledFor })
    return { retryCount: newRetryCount, scheduledFor: scheduledFor.toISOString() }
  }

  async getPending(params: GetPendingParams): Promise<QueueEntry[]> {
    const db = getDb()
    const now = new Date()

    const rows = await db
      .select()
      .from(agentQueue)
      .where(and(eq(agentQueue.toAgent, params.agent), eq(agentQueue.status as any, 'pending'), lte(agentQueue.processAfter, now)))
      .orderBy(asc(agentQueue.createdAt))
      .limit(params.limit ?? 10)

    return rows.map(toSnakeQueue)
  }

  async getById(id: string): Promise<QueueEntry | null> {
    const db = getDb()
    const [row] = await db.select().from(agentQueue).where(eq(agentQueue.id, id))
    return row ? toSnakeQueue(row) : null
  }

  async moveToDLQ(queueId: string, error: string): Promise<string> {
    const db = getDb()
    const entry = await this.getById(queueId)

    if (!entry) throw new Error(`Queue entry not found: ${queueId}`)

    const [dlqRow] = await db
      .insert(agentDlq)
      .values({
        originalQueueId: queueId,
        fromAgent: entry.from_agent,
        toAgent: entry.to_agent,
        payload: entry.payload,
        error,
        retryCount: entry.retry_count,
      })
      .returning({ id: agentDlq.id })

    if (!dlqRow) {
      dbLogger.error('Failed to move to DLQ — no row returned', null, { queueId })
      throw new Error('Failed to move to DLQ')
    }

    await db.delete(agentQueue).where(eq(agentQueue.id, queueId))

    dbLogger.info('Message moved to DLQ', { queueId, dlqId: dlqRow.id })
    return dlqRow.id
  }

  async getDLQEntries(limit: number = 100): Promise<DLQEntry[]> {
    const db = getDb()
    const rows = await db.select().from(agentDlq).orderBy(desc(agentDlq.createdAt)).limit(limit)
    return rows.map(toSnakeDLQ)
  }

  async retryFromDLQ(dlqId: string): Promise<string> {
    const db = getDb()
    const [dlqEntry] = await db.select().from(agentDlq).where(eq(agentDlq.id, dlqId))

    if (!dlqEntry) {
      dbLogger.error('Failed to get DLQ entry', null, { dlqId })
      throw new Error(`DLQ entry not found: ${dlqId}`)
    }

    const [queueRow] = await db
      .insert(agentQueue)
      .values({
        fromAgent: dlqEntry.fromAgent ?? '',
        toAgent: dlqEntry.toAgent ?? '',
        payload: dlqEntry.payload,
        status: 'pending',
        retryCount: 0,
        processAfter: new Date(),
      })
      .returning({ id: agentQueue.id })

    if (!queueRow) {
      dbLogger.error('Failed to re-enqueue from DLQ — no row returned', null, { dlqId })
      throw new Error('Failed to re-enqueue from DLQ')
    }

    await db.delete(agentDlq).where(eq(agentDlq.id, dlqId))

    dbLogger.info('Message re-enqueued from DLQ', { dlqId, queueId: queueRow.id })
    return queueRow.id
  }
}

export const agentQueueRepo = new AgentQueueRepository()
