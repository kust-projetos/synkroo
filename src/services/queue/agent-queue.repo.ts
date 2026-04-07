/**
 * Agent Queue Repository
 * Repository pattern for queue CRUD operations using Supabase
 */

import { createAdminClient } from '@/lib/supabase'
import { dbLogger } from '@/lib/logger'
import type { Json } from '@/lib/supabase/database.types'

export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface QueueEntry {
  id: string
  from_agent: string
  to_agent: string
  payload: Json
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
  payload: Json
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

export class AgentQueueRepository {
  private client() {
    return createAdminClient()
  }

  /**
   * Enqueue a message for an agent
   * Returns the queue entry ID
   */
  async enqueue(params: EnqueueParams): Promise<string> {
    const supabase = this.client()
    const scheduledFor = params.scheduledFor ?? new Date().toISOString()

    const { data, error } = await (supabase as any)
      .from('agent_queue')
      .insert({
        from_agent: params.fromAgent,
        to_agent: params.toAgent,
        payload: params.payload,
        status: 'pending',
        retry_count: 0,
        scheduled_for: scheduledFor,
      })
      .select('id')
      .single()

    if (error) {
      dbLogger.error('Failed to enqueue message', error, {
        fromAgent: params.fromAgent,
        toAgent: params.toAgent,
      })
      throw error
    }

    dbLogger.info('Message enqueued', {
      queueId: data.id,
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
    })

    return data.id
  }

  /**
   * Dequeue the next message for an agent
   * Returns the queue entry or null if no messages are ready
   */
  async dequeue(toAgent: string): Promise<QueueEntry | null> {
    const supabase = this.client()
    const now = new Date().toISOString()

    // Get the next pending message for this agent
    const { data, error } = await (supabase as any)
      .from('agent_queue')
      .select('*')
      .eq('to_agent', toAgent)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is not an error
      dbLogger.error('Failed to dequeue message', error, { toAgent })
      throw error
    }

    if (!data) {
      return null
    }

    // Mark as processing
    await this.updateStatus({ id: data.id, status: 'processing' })

    return data as QueueEntry
  }

  /**
   * Update the status of a queue entry
   */
  async updateStatus(params: UpdateStatusParams): Promise<void> {
    const supabase = this.client()

    const updateData: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    }

    if (params.status === 'processing') {
      updateData.started_at = new Date().toISOString()
    } else if (params.status === 'done') {
      updateData.completed_at = new Date().toISOString()
    } else if (params.status === 'failed' && params.error) {
      updateData.last_error = params.error
    }

    const { error } = await (supabase as any)
      .from('agent_queue')
      .update(updateData)
      .eq('id', params.id)

    if (error) {
      dbLogger.error('Failed to update queue status', error, {
        queueId: params.id,
        status: params.status,
      })
      throw error
    }

    dbLogger.debug('Queue status updated', {
      queueId: params.id,
      status: params.status,
    })
  }

  /**
   * Increment the retry count and calculate next scheduled time
   * Uses exponential backoff: 1s -> 2s -> 4s (max 3 retries)
   */
  async incrementRetry(id: string): Promise<{ retryCount: number; scheduledFor: string }> {
    const supabase = this.client()

    // Get current entry
    const { data: entry, error: fetchError } = await (supabase as any)
      .from('agent_queue')
      .select('retry_count')
      .eq('id', id)
      .single()

    if (fetchError || !entry) {
      dbLogger.error('Failed to get queue entry for retry', fetchError, { queueId: id })
      throw fetchError
    }

    const currentRetry = entry.retry_count ?? 0
    const newRetryCount = currentRetry + 1

    // Calculate backoff delay
    const BACKOFF_CONFIG = {
      initialDelay: 1000,
      multiplier: 2,
      maxDelay: 16000,
      maxRetries: 3,
    }

    const delay = Math.min(
      BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, currentRetry),
      BACKOFF_CONFIG.maxDelay
    )

    const scheduledFor = new Date(Date.now() + delay).toISOString()

    const { error } = await (supabase as any)
      .from('agent_queue')
      .update({
        retry_count: newRetryCount,
        scheduled_for: scheduledFor,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      dbLogger.error('Failed to increment retry count', error, { queueId: id })
      throw error
    }

    dbLogger.info('Retry count incremented', {
      queueId: id,
      retryCount: newRetryCount,
      scheduledFor,
    })

    return { retryCount: newRetryCount, scheduledFor }
  }

  /**
   * Get pending messages for an agent that are ready to process
   */
  async getPending(params: GetPendingParams): Promise<QueueEntry[]> {
    const supabase = this.client()
    const now = new Date().toISOString()
    const limit = params.limit ?? 10

    const { data, error } = await (supabase as any)
      .from('agent_queue')
      .select('*')
      .eq('to_agent', params.agent)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      dbLogger.error('Failed to get pending messages', error, { agent: params.agent })
      throw error
    }

    return (data ?? []) as QueueEntry[]
  }

  /**
   * Get a queue entry by ID
   */
  async getById(id: string): Promise<QueueEntry | null> {
    const supabase = this.client()

    const { data, error } = await (supabase as any)
      .from('agent_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') {
      dbLogger.error('Failed to get queue entry', error, { queueId: id })
      throw error
    }

    return data as QueueEntry | null
  }

  /**
   * Move a queue entry to the Dead Letter Queue
   */
  async moveToDLQ(queueId: string, error: string): Promise<string> {
    const supabase = this.client()

    // Get the original entry
    const entry = await this.getById(queueId)
    if (!entry) {
      throw new Error(`Queue entry not found: ${queueId}`)
    }

    // Insert into DLQ
    const { data, insertError } = await (supabase as any)
      .from('agent_dlq')
      .insert({
        original_queue_id: queueId,
        from_agent: entry.from_agent,
        to_agent: entry.to_agent,
        payload: entry.payload,
        error,
        retry_count: entry.retry_count,
      })
      .select('id')
      .single()

    if (insertError) {
      dbLogger.error('Failed to move to DLQ', insertError, { queueId })
      throw insertError
    }

    // Delete from main queue
    await (supabase as any)
      .from('agent_queue')
      .delete()
      .eq('id', queueId)

    dbLogger.info('Message moved to DLQ', { queueId, dlqId: data.id })

    return data.id
  }

  /**
   * Get DLQ entries
   */
  async getDLQEntries(limit: number = 100): Promise<DLQEntry[]> {
    const supabase = this.client()

    const { data, error } = await (supabase as any)
      .from('agent_dlq')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      dbLogger.error('Failed to get DLQ entries', error)
      throw error
    }

    return (data ?? []) as DLQEntry[]
  }

  /**
   * Re-enqueue a message from DLQ
   */
  async retryFromDLQ(dlqId: string): Promise<string> {
    const supabase = this.client()

    // Get DLQ entry
    const { data: dlqEntry, error: fetchError } = await (supabase as any)
      .from('agent_dlq')
      .select('*')
      .eq('id', dlqId)
      .single()

    if (fetchError || !dlqEntry) {
      dbLogger.error('Failed to get DLQ entry', fetchError, { dlqId })
      throw fetchError
    }

    // Insert back into main queue
    const { data, insertError } = await (supabase as any)
      .from('agent_queue')
      .insert({
        from_agent: dlqEntry.from_agent,
        to_agent: dlqEntry.to_agent,
        payload: dlqEntry.payload,
        status: 'pending',
        retry_count: 0,
        scheduled_for: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      dbLogger.error('Failed to re-enqueue from DLQ', insertError, { dlqId })
      throw insertError
    }

    // Delete from DLQ
    await (supabase as any)
      .from('agent_dlq')
      .delete()
      .eq('id', dlqId)

    dbLogger.info('Message re-enqueued from DLQ', { dlqId, queueId: data.id })

    return data.id
  }
}

export const agentQueueRepo = new AgentQueueRepository()
