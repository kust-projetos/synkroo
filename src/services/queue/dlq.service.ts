/**
 * Dead Letter Queue Service
 * Handles failed messages that exceeded retry limits
 */

import { dbLogger } from '@/lib/logger'
import { agentQueueRepo, DLQEntry } from './agent-queue.repo'

export interface MoveToDLQParams {
  queueId: string
  error: string
}

export interface RetryFromDLQParams {
  dlqId: string
}

/**
 * Dead Letter Queue Service
 * Manages failed messages and re-enqueueing from DLQ
 */
export class DLQService {
  /**
   * Move a failed queue entry to the Dead Letter Queue
   */
  async moveToDLQ(params: MoveToDLQParams): Promise<string> {
    const dlqId = await agentQueueRepo.moveToDLQ(params.queueId, params.error)

    dbLogger.info('Message moved to DLQ', {
      queueId: params.queueId,
      dlqId,
    })

    return dlqId
  }

  /**
   * Get DLQ entries with optional limit
   */
  async getDLQEntries(limit: number = 100): Promise<DLQEntry[]> {
    const entries = await agentQueueRepo.getDLQEntries(limit)

    dbLogger.debug('Retrieved DLQ entries', { count: entries.length })

    return entries
  }

  /**
   * Re-enqueue a message from DLQ back to the main queue
   */
  async retryFromDLQ(params: RetryFromDLQParams): Promise<string> {
    const queueId = await agentQueueRepo.retryFromDLQ(params.dlqId)

    dbLogger.info('Message re-enqueued from DLQ', {
      dlqId: params.dlqId,
      queueId,
    })

    return queueId
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<{
    totalCount: number
    byAgent: Record<string, number>
    oldestEntry: string | null
  }> {
    const entries = await this.getDLQEntries(1000)

    const byAgent: Record<string, number> = {}
    let oldestEntry: string | null = null
    let oldestTime = Infinity

    for (const entry of entries) {
      // Count by agent
      byAgent[entry.to_agent] = (byAgent[entry.to_agent] || 0) + 1

      // Find oldest
      const createdAt = new Date(entry.created_at).getTime()
      if (createdAt < oldestTime) {
        oldestTime = createdAt
        oldestEntry = entry.created_at
      }
    }

    return {
      totalCount: entries.length,
      byAgent,
      oldestEntry,
    }
  }
}

export const dlqService = new DLQService()
