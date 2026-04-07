/**
 * Tests for Queue Service
 * Tests queue operations, polling, and DLQ handling
 */

jest.mock('@/lib/supabase', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { QueueService, BACKOFF_CONFIG } from '../queue.service'
import { DLQService } from '../dlq.service'
import { AgentQueueRepository } from '../agent-queue.repo'

describe('Queue Service', () => {
  let queueService: QueueService
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    queueService = new QueueService()

    mockClient = {
      from: jest.fn(),
    }

    const { createAdminClient } = require('@/lib/supabase')
    createAdminClient.mockReturnValue(mockClient)
  })

  afterEach(() => {
    queueService.stopAllListening()
    jest.useRealTimers()
  })

  describe('enqueue', () => {
    it('should enqueue a message and return queue ID', async () => {
      const mockQueueId = 'queue-123'

      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: mockQueueId }, error: null }),
          }),
        }),
      })

      const result = await queueService.enqueue('agent1', 'agent2', { message: 'hello' })

      expect(result).toBe(mockQueueId)
      expect(mockClient.from).toHaveBeenCalledWith('agent_queue')
    })

    it('should throw on enqueue error', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      })

      await expect(
        queueService.enqueue('agent1', 'agent2', { message: 'hello' })
      ).rejects.toBeDefined()
    })
  })

  describe('getPending', () => {
    it('should return pending messages for an agent', async () => {
      const mockEntries = [
        { id: 'q1', to_agent: 'agent1', status: 'pending', payload: {} },
        { id: 'q2', to_agent: 'agent1', status: 'pending', payload: {} },
      ]

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: mockEntries, error: null }),
                }),
              }),
            }),
          }),
        }),
      })

      const result = await queueService.getPending('agent1', 10)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('q1')
    })

    it('should return empty array when no pending messages', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              lte: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      })

      const result = await queueService.getPending('agent1')

      expect(result).toHaveLength(0)
    })
  })
})

describe('DLQ Service', () => {
  let dlqService: DLQService
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    dlqService = new DLQService()

    mockClient = {
      from: jest.fn(),
    }

    const { createAdminClient } = require('@/lib/supabase')
    createAdminClient.mockReturnValue(mockClient)
  })

  describe('moveToDLQ', () => {
    it('should move a failed message to DLQ', async () => {
      const mockQueueEntry = {
        id: 'queue-1',
        from_agent: 'agent1',
        to_agent: 'agent2',
        payload: { message: 'hello' },
        retry_count: 3,
      }

      const mockDlqId = 'dlq-1'

      // First call to getById
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockQueueEntry, error: null }),
            }),
          }),
        })
        // Insert to DLQ
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: mockDlqId }, error: null }),
            }),
          }),
        })
        // Delete from queue
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await dlqService.moveToDLQ({ queueId: 'queue-1', error: 'Max retries exceeded' })

      expect(result).toBe(mockDlqId)
    })
  })

  describe('getDLQEntries', () => {
    it('should return DLQ entries', async () => {
      const mockEntries = [
        { id: 'dlq-1', original_queue_id: 'q1', error: 'Error 1' },
        { id: 'dlq-2', original_queue_id: 'q2', error: 'Error 2' },
      ]

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: mockEntries, error: null }),
          }),
        }),
      })

      const result = await dlqService.getDLQEntries(100)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('dlq-1')
    })
  })

  describe('retryFromDLQ', () => {
    it('should re-enqueue a message from DLQ', async () => {
      const mockDlqEntry = {
        id: 'dlq-1',
        from_agent: 'agent1',
        to_agent: 'agent2',
        payload: { message: 'retry' },
      }

      const mockQueueId = 'queue-retry-1'

      // Get DLQ entry
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockDlqEntry, error: null }),
            }),
          }),
        })
        // Insert back to queue
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: mockQueueId }, error: null }),
            }),
          }),
        })
        // Delete from DLQ
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await dlqService.retryFromDLQ({ dlqId: 'dlq-1' })

      expect(result).toBe(mockQueueId)
    })
  })
})

describe('AgentQueueRepository', () => {
  let repo: AgentQueueRepository
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    repo = new AgentQueueRepository()

    mockClient = {
      from: jest.fn(),
    }

    const { createAdminClient } = require('@/lib/supabase')
    createAdminClient.mockReturnValue(mockClient)
  })

  describe('enqueue', () => {
    it('should enqueue with default scheduled time', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'q-1' }, error: null }),
          }),
        }),
      })

      const result = await repo.enqueue({
        fromAgent: 'agent1',
        toAgent: 'agent2',
        payload: { test: true },
      })

      expect(result).toBe('q-1')
    })

    it('should enqueue with custom scheduled time', async () => {
      const scheduledFor = new Date(Date.now() + 60000).toISOString()

      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: 'q-1' }, error: null }),
          }),
        }),
      })

      await repo.enqueue({
        fromAgent: 'agent1',
        toAgent: 'agent2',
        payload: { test: true },
        scheduledFor,
      })

      const insertCall = mockClient.from.mock.calls[0][0]
      expect(insertCall).toBe('agent_queue')
    })
  })

  describe('incrementRetry', () => {
    it('should increment retry count with backoff', async () => {
      // Get current entry
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { retry_count: 0 }, error: null }),
            }),
          }),
        })
        // Update with new retry count
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await repo.incrementRetry('queue-1')

      expect(result.retryCount).toBe(1)
      expect(result.scheduledFor).toBeDefined()
    })

    it('should calculate exponential backoff correctly', async () => {
      // Get current entry with retry_count = 1
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { retry_count: 1 }, error: null }),
            }),
          }),
        })
        // Update with new retry count
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const beforeCall = Date.now()
      const result = await repo.incrementRetry('queue-1')
      const afterCall = Date.now()

      expect(result.retryCount).toBe(2)
      // Second retry should have 2s delay (1000 * 2^1)
      const expectedDelay = BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, 1)
      const scheduledTime = new Date(result.scheduledFor).getTime()
      expect(scheduledTime).toBeGreaterThanOrEqual(beforeCall + expectedDelay)
      expect(scheduledTime).toBeLessThanOrEqual(afterCall + expectedDelay + 10)
    })
  })
})

describe('Backoff Configuration', () => {
  it('should have correct default values', () => {
    expect(BACKOFF_CONFIG.initialDelay).toBe(1000)
    expect(BACKOFF_CONFIG.multiplier).toBe(2)
    expect(BACKOFF_CONFIG.maxDelay).toBe(16000)
    expect(BACKOFF_CONFIG.maxRetries).toBe(3)
  })

  it('should calculate backoff delays correctly', () => {
    // Retry 0: 1s
    expect(BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, 0)).toBe(1000)
    // Retry 1: 2s
    expect(BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, 1)).toBe(2000)
    // Retry 2: 4s
    expect(BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, 2)).toBe(4000)
    // Retry 3: 8s (capped by maxDelay of 16s so not reached)
    expect(BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, 3)).toBe(8000)
  })
})
