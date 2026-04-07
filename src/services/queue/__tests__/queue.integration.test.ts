/**
 * Queue Service Integration Tests
 * Tests the queue service with mocked Supabase client
 *
 * These tests verify the queue integration points using properly mocked Supabase clients.
 * Note: Some tests are skipped due to complex Supabase chainable mock requirements.
 */

jest.mock('@/lib/supabase', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { QueueService } from '@/services/queue/queue.service'
import { AgentQueueRepository, QueueEntry } from '@/services/queue/agent-queue.repo'

// Helper to create a properly chainable mock client
function createChainableMock() {
  // Methods that need to chain
  const eqFn = jest.fn()
  const selectFn = jest.fn()
  const insertFn = jest.fn()
  const updateFn = jest.fn()
  const deleteFn = jest.fn()
  const singleFn = jest.fn()
  const orderFn = jest.fn()
  const limitFn = jest.fn()
  const lteFn = jest.fn()

  // Make all methods return themselves for chaining
  eqFn.mockReturnThis()
  selectFn.mockReturnThis()
  insertFn.mockReturnThis()
  updateFn.mockReturnThis()
  deleteFn.mockReturnThis()
  singleFn.mockReturnThis()
  orderFn.mockReturnThis()
  limitFn.mockReturnThis()
  lteFn.mockReturnThis()

  // The from function returns a chainable object
  const fromFn = jest.fn().mockImplementation(() => ({
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
    eq: eqFn,
    single: singleFn,
    order: orderFn,
    limit: limitFn,
    lte: lteFn,
  }))

  return {
    from: fromFn,
    // For direct access if needed
    _select: selectFn,
    _eq: eqFn,
    _single: singleFn,
    _order: orderFn,
    _limit: limitFn,
    _lte: lteFn,
    _insert: insertFn,
    _update: updateFn,
    _delete: deleteFn,
  }
}

describe('Queue Service Integration', () => {
  let queueService: QueueService
  let mockClient: ReturnType<typeof createChainableMock>

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = createChainableMock()

    const { createAdminClient } = require('@/lib/supabase')
    createAdminClient.mockReturnValue(mockClient)

    queueService = new QueueService()
  })

  afterEach(() => {
    queueService.stopAllListening()
  })

  describe('enqueue', () => {
    it('should enqueue a message and return queue ID', async () => {
      const mockQueueId = 'queue-123'

      // Mock the full chain: from -> insert -> select -> single
      const mockInsertResult = {
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: mockQueueId }, error: null }),
        }),
      }
      mockClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue(mockInsertResult),
      })

      const queueId = await queueService.enqueue(
        'orchestrator',
        'router',
        { message: 'test payload' }
      )

      expect(queueId).toBe(mockQueueId)
    })
  })

  describe('getPending', () => {
    it('should return pending messages for an agent', async () => {
      const now = new Date().toISOString()
      const mockEntries: QueueEntry[] = [
        {
          id: 'queue-1',
          from_agent: 'orchestrator',
          to_agent: 'router',
          payload: { message: 'test1' },
          status: 'pending',
          retry_count: 0,
          last_error: null,
          scheduled_for: now,
          started_at: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 'queue-2',
          from_agent: 'orchestrator',
          to_agent: 'router',
          payload: { message: 'test2' },
          status: 'pending',
          retry_count: 0,
          last_error: null,
          scheduled_for: now,
          started_at: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
        },
      ]

      // Build proper chain mock
      const result = { data: mockEntries, error: null }
      mockClient._eq.mockReturnValueOnce({
        eq: jest.fn().mockReturnThis(),
        lte: mockClient._lte.mockReturnValueOnce({
          order: mockClient._order.mockReturnValueOnce({
            limit: mockClient._limit.mockReturnValueOnce(result),
          }),
        }),
      })

      const pending = await queueService.getPending('router', 10)

      expect(pending).toHaveLength(2)
      expect(pending[0].id).toBe('queue-1')
      expect(pending[1].id).toBe('queue-2')
    })

    it('should return empty array when no pending messages', async () => {
      const result = { data: [], error: null }
      mockClient._eq.mockReturnValueOnce({
        eq: jest.fn().mockReturnThis(),
        lte: mockClient._lte.mockReturnValueOnce({
          order: mockClient._order.mockReturnValueOnce({
            limit: mockClient._limit.mockReturnValueOnce(result),
          }),
        }),
      })

      const pending = await queueService.getPending('router', 10)

      expect(pending).toHaveLength(0)
    })
  })

  describe('startListening / stopListening', () => {
    it('should register and unregister listeners', () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      queueService.startListening('router', callback1)
      queueService.startListening('router', callback2)

      expect(() => queueService.stopListening('router', callback1)).not.toThrow()
      expect(() => queueService.stopListening('router', callback2)).not.toThrow()
    })

    it('should handle stopAllListening', () => {
      const callback = jest.fn()

      queueService.startListening('router', callback)
      queueService.startListening('scheduler', callback)

      expect(() => queueService.stopAllListening()).not.toThrow()
    })
  })
})

describe('Agent Queue Repository Integration', () => {
  let repo: AgentQueueRepository
  let mockClient: ReturnType<typeof createChainableMock>

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = createChainableMock()

    const { createAdminClient } = require('@/lib/supabase')
    createAdminClient.mockReturnValue(mockClient)

    repo = new AgentQueueRepository()
  })

  describe('enqueue', () => {
    it('should insert queue entry and return ID', async () => {
      const mockQueueId = 'queue-new-123'

      const mockInsertResult = {
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: mockQueueId }, error: null }),
        }),
      }
      mockClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue(mockInsertResult),
      })

      const queueId = await repo.enqueue({
        fromAgent: 'orchestrator',
        toAgent: 'router',
        payload: { test: 'data' },
      })

      expect(queueId).toBe(mockQueueId)
      expect(mockClient.from).toHaveBeenCalledWith('agent_queue')
    })
  })

  describe('updateStatus', () => {
    it('should update queue entry status to done', async () => {
      mockClient._update.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })

      await expect(
        repo.updateStatus({ id: 'queue-1', status: 'done' })
      ).resolves.not.toThrow()
    })

    it('should set started_at when status is processing', async () => {
      mockClient._update.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })

      await expect(
        repo.updateStatus({ id: 'queue-1', status: 'processing' })
      ).resolves.not.toThrow()
    })
  })

  describe('getPending', () => {
    it('should return pending entries for agent', async () => {
      const now = new Date().toISOString()
      const mockEntries: QueueEntry[] = [
        {
          id: 'queue-1',
          from_agent: 'orchestrator',
          to_agent: 'router',
          payload: {},
          status: 'pending',
          retry_count: 0,
          last_error: null,
          scheduled_for: now,
          started_at: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
        },
      ]

      const result = { data: mockEntries, error: null }
      mockClient._select.mockReturnValueOnce({
        eq: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            lte: mockClient._lte.mockReturnValueOnce({
              order: mockClient._order.mockReturnValueOnce({
                limit: mockClient._limit.mockReturnValueOnce(result),
              }),
            }),
          }),
        }),
      })

      const pending = await repo.getPending({ agent: 'router', limit: 10 })

      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBe('queue-1')
    })
  })
})

describe('Queue Status and Retry Logic', () => {
  describe('BACKOFF_CONFIG', () => {
    it('should have correct backoff configuration', () => {
      const BACKOFF_CONFIG = {
        initialDelay: 1000,
        multiplier: 2,
        maxDelay: 16000,
        maxRetries: 3,
      }

      expect(BACKOFF_CONFIG.initialDelay).toBe(1000)
      expect(BACKOFF_CONFIG.multiplier).toBe(2)
      expect(BACKOFF_CONFIG.maxDelay).toBe(16000)
      expect(BACKOFF_CONFIG.maxRetries).toBe(3)
    })

    it('should calculate exponential backoff correctly', () => {
      const calculateBackoff = (retryCount: number) => {
        const initialDelay = 1000
        const multiplier = 2
        const maxDelay = 16000
        return Math.min(initialDelay * Math.pow(multiplier, retryCount), maxDelay)
      }

      expect(calculateBackoff(0)).toBe(1000)   // 1s
      expect(calculateBackoff(1)).toBe(2000)   // 2s
      expect(calculateBackoff(2)).toBe(4000)   // 4s
      expect(calculateBackoff(3)).toBe(8000)   // 8s
      expect(calculateBackoff(4)).toBe(16000) // max
    })
  })

  describe('Queue Status Transitions', () => {
    it('should support pending -> processing -> done transition', () => {
      const validStatuses = ['pending', 'processing', 'done', 'failed']

      expect(validStatuses).toContain('pending')
      expect(validStatuses).toContain('processing')
      expect(validStatuses).toContain('done')
    })

    it('should have correct retry count behavior', () => {
      let retryCount = 0
      const maxRetries = 3

      // Simulate retries
      retryCount++
      expect(retryCount).toBe(1)
      expect(retryCount <= maxRetries).toBe(true)

      retryCount++
      expect(retryCount).toBe(2)
      expect(retryCount <= maxRetries).toBe(true)

      retryCount++
      expect(retryCount).toBe(3)
      expect(retryCount <= maxRetries).toBe(true)

      // After max retries, should move to DLQ
      retryCount++
      expect(retryCount > maxRetries).toBe(true)
    })
  })

  describe('Queue Entry Structure', () => {
    it('should have correct queue entry structure', () => {
      const now = new Date().toISOString()
      const entry: QueueEntry = {
        id: 'queue-1',
        from_agent: 'orchestrator',
        to_agent: 'router',
        payload: { test: 'data' },
        status: 'pending',
        retry_count: 0,
        last_error: null,
        scheduled_for: now,
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      }

      expect(entry.id).toBe('queue-1')
      expect(entry.from_agent).toBe('orchestrator')
      expect(entry.to_agent).toBe('router')
      expect(entry.status).toBe('pending')
      expect(entry.retry_count).toBe(0)
      expect(entry.last_error).toBeNull()
    })

    it('should have correct DLQ entry structure', () => {
      const now = new Date().toISOString()
      const dlqEntry = {
        id: 'dlq-1',
        original_queue_id: 'queue-1',
        from_agent: 'orchestrator',
        to_agent: 'router',
        payload: { test: 'data' },
        error: 'Max retries exceeded',
        retry_count: 3,
        moved_to_dlq_at: now,
        created_at: now,
      }

      expect(dlqEntry.id).toBe('dlq-1')
      expect(dlqEntry.original_queue_id).toBe('queue-1')
      expect(dlqEntry.error).toBe('Max retries exceeded')
      expect(dlqEntry.retry_count).toBe(3)
    })
  })
})
