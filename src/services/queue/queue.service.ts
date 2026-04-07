/**
 * Queue Service
 * Main queue service with optimized polling for Supabase LISTEN/NOTIFY pattern
 *
 * Uses 500ms polling intervals since Supabase doesn't support raw LISTEN.
 * Exponential backoff: 1s -> 2s -> 4s (max 3 retries)
 */

import { dbLogger } from '@/lib/logger'
import { agentQueueRepo, QueueEntry } from './agent-queue.repo'

export const BACKOFF_CONFIG = {
  initialDelay: 1000,
  multiplier: 2,
  maxDelay: 16000,
  maxRetries: 3,
}

export type QueueCallback = (entry: QueueEntry) => Promise<void>

interface ListenerRegistration {
  callback: QueueCallback
  intervalId: ReturnType<typeof setInterval> | null
}

/**
 * Queue Service
 * Handles message queuing and optimized polling for agent communication
 */
export class QueueService {
  private listeners: Map<string, ListenerRegistration[]> = new Map()
  private pollIntervalMs = 500

  /**
   * Enqueue a message for an agent
   */
  async enqueue(
    fromAgent: string,
    toAgent: string,
    payload: Record<string, unknown>,
    scheduledFor?: string
  ): Promise<string> {
    const queueId = await agentQueueRepo.enqueue({
      fromAgent,
      toAgent,
      payload,
      scheduledFor,
    })

    dbLogger.info('Message enqueued', { queueId, fromAgent, toAgent })

    // Notify any listeners for this agent
    this.notifyListeners(toAgent)

    return queueId
  }

  /**
   * Start listening for messages for a specific agent
   * Uses polling at 500ms intervals
   */
  startListening(agent: string, callback: QueueCallback): void {
    if (!this.listeners.has(agent)) {
      this.listeners.set(agent, [])
    }

    const registrations = this.listeners.get(agent)!
    const registration: ListenerRegistration = {
      callback,
      intervalId: null,
    }

    // Create polling interval
    const intervalId = setInterval(async () => {
      try {
        const pending = await agentQueueRepo.getPending({ agent, limit: 10 })

        for (const entry of pending) {
          // Skip if already being processed by another callback
          if (this.isProcessing(entry.id)) {
            continue
          }

          try {
            // Mark as processing
            await agentQueueRepo.updateStatus({ id: entry.id, status: 'processing' })

            // Execute callback
            await callback(entry)

            // Mark as done
            await agentQueueRepo.updateStatus({ id: entry.id, status: 'done' })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            dbLogger.error('Error processing queue message', error, {
              queueId: entry.id,
              agent,
            })

            // Check retry count and handle failure
            const { retryCount } = await agentQueueRepo.incrementRetry(entry.id)

            if (retryCount > BACKOFF_CONFIG.maxRetries) {
              // Move to DLQ after max retries
              await agentQueueRepo.moveToDLQ(entry.id, errorMessage)
              dbLogger.error('Message moved to DLQ after max retries', {
                queueId: entry.id,
                retryCount,
              })
            } else {
              // Reset to pending for next poll cycle
              dbLogger.warn('Message will retry', {
                queueId: entry.id,
                retryCount,
                nextRetry: new Date(Date.now() + BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, retryCount - 1)).toISOString(),
              })
            }
          }
        }
      } catch (error) {
        dbLogger.error('Error in queue poll cycle', error, { agent })
      }
    }, this.pollIntervalMs)

    registration.intervalId = intervalId
    registrations.push(registration)

    dbLogger.info('Started listening for queue messages', { agent })
  }

  /**
   * Stop listening for messages for a specific agent
   */
  stopListening(agent: string, callback: QueueCallback): void {
    const registrations = this.listeners.get(agent)
    if (!registrations) {
      return
    }

    const index = registrations.findIndex((r) => r.callback === callback)
    if (index !== -1) {
      const registration = registrations[index]
      if (registration.intervalId) {
        clearInterval(registration.intervalId)
      }
      registrations.splice(index, 1)
      dbLogger.info('Stopped listening for queue messages', { agent })
    }

    if (registrations.length === 0) {
      this.listeners.delete(agent)
    }
  }

  /**
   * Stop all listeners
   */
  stopAllListening(): void {
    for (const [agent, registrations] of this.listeners.entries()) {
      for (const registration of registrations) {
        if (registration.intervalId) {
          clearInterval(registration.intervalId)
        }
      }
    }
    this.listeners.clear()
    dbLogger.info('Stopped all queue listeners')
  }

  /**
   * Get pending messages for an agent
   */
  async getPending(agent: string, limit?: number): Promise<QueueEntry[]> {
    return agentQueueRepo.getPending({ agent, limit })
  }

  /**
   * Manually dequeue and process the next message for an agent
   * Returns the processed entry or null if no messages
   */
  async processNext(agent: string): Promise<QueueEntry | null> {
    const entry = await agentQueueRepo.dequeue(agent)
    if (!entry) {
      return null
    }

    try {
      // Find and call the registered callback
      const registrations = this.listeners.get(agent)
      if (registrations && registrations.length > 0) {
        // Use the first registered callback
        await registrations[0].callback(entry)
      }

      await agentQueueRepo.updateStatus({ id: entry.id, status: 'done' })
      return entry
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const { retryCount } = await agentQueueRepo.incrementRetry(entry.id)

      if (retryCount > BACKOFF_CONFIG.maxRetries) {
        await agentQueueRepo.moveToDLQ(entry.id, errorMessage)
        dbLogger.error('Message moved to DLQ after max retries', {
          queueId: entry.id,
          retryCount,
        })
      }

      throw error
    }
  }

  /**
   * Notify listeners that a new message is available
   */
  private notifyListeners(agent: string): void {
    // The polling mechanism already handles checking for new messages
    // This method exists for potential future real-time notification integration
  }

  /**
   * Track which queue entries are currently being processed
   */
  private processingIds: Set<string> = new Set()

  /**
   * Check if a queue entry is currently being processed
   */
  private isProcessing(id: string): boolean {
    return this.processingIds.has(id)
  }

  /**
   * Mark a queue entry as processing
   */
  private markProcessing(id: string): void {
    this.processingIds.add(id)
  }

  /**
   * Unmark a queue entry from processing
   */
  private unmarkProcessing(id: string): void {
    this.processingIds.delete(id)
  }
}

export const queueService = new QueueService()
