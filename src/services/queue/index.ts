/**
 * Queue Service Module
 * Multi-agent queue system with LISTEN/NOTIFY pattern support
 */

// Repository
export { AgentQueueRepository, agentQueueRepo } from './agent-queue.repo'
export type { QueueEntry, DLQEntry, QueueStatus, EnqueueParams, UpdateStatusParams, GetPendingParams } from './agent-queue.repo'

// Main Queue Service
export { QueueService, queueService, BACKOFF_CONFIG } from './queue.service'
export type { QueueCallback } from './queue.service'

// DLQ Service
export { DLQService, dlqService } from './dlq.service'
export type { MoveToDLQParams, RetryFromDLQParams } from './dlq.service'
