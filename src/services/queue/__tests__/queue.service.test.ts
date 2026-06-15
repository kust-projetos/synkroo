/**
 * Tests for Queue Service — Drizzle mocks
 */

jest.mock('@/lib/logger', () => ({ dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  limit: jest.fn(function (this: any) { return this }),
  insert: jest.fn(function (this: any) { return this }),
  values: jest.fn(function (this: any) { return this }),
  returning: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }),
  set: jest.fn(function (this: any) { return this }),
  delete: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }

import { QueueService, BACKOFF_CONFIG } from '../queue.service'
import { DLQService } from '../dlq.service'

describe('Queue Service', () => {
  let queueService: QueueService
  beforeEach(() => { jest.clearAllMocks(); counter = 0; results = []; queueService = new QueueService() })

  describe('enqueue', () => {
    it('enqueues and returns ID', async () => {
      seed([{ id: 'queue-123' }])
      const r = await queueService.enqueue('agent1', 'agent2', { message: 'hello' })
      expect(r).toBe('queue-123')
    })

    it('throws on failure', async () => {
      seed([])
      await expect(queueService.enqueue('agent1', 'agent2', { msg: 'x' })).rejects.toBeDefined()
    })
  })

  describe('getPending', () => {
    it('returns pending messages', async () => {
      seed([
        { id: 'q1', toAgent: 'agent1', fromAgent: 'a0', status: 'pending', payload: {}, retryCount: 0, processAfter: new Date(0), error: null, completedAt: null, createdAt: new Date() },
        { id: 'q2', toAgent: 'agent1', fromAgent: 'a0', status: 'pending', payload: {}, retryCount: 0, processAfter: new Date(0), error: null, completedAt: null, createdAt: new Date() },
      ])
      const r = await queueService.getPending('agent1', 10)
      expect(r).toHaveLength(2)
    })

    it('returns empty when none', async () => {
      seed([])
      const r = await queueService.getPending('agent1')
      expect(r).toHaveLength(0)
    })
  })
})

describe('DLQ Service', () => {
  let dlqService: DLQService
  const queueRow = { id: 'queue-1', fromAgent: 'agent1', toAgent: 'agent2', payload: { msg: 'hello' }, status: 'failed', retryCount: 3, error: 'Max retries', processAfter: new Date(), completedAt: null, createdAt: new Date() }

  beforeEach(() => { jest.clearAllMocks(); counter = 0; results = []; dlqService = new DLQService() })

  describe('moveToDLQ', () => {
    it('moves to DLQ and returns dlqId', async () => {
      seed([queueRow], [{ id: 'dlq-1' }])
      const r = await dlqService.moveToDLQ({ queueId: 'queue-1', error: 'Max retries exceeded' })
      expect(r).toBe('dlq-1')
    })

    it('throws if queue entry not found', async () => {
      seed([])
      await expect(dlqService.moveToDLQ({ queueId: 'missing', error: 'err' })).rejects.toThrow('not found')
    })
  })

  describe('getDLQEntries', () => {
    it('returns DLQ entries', async () => {
      seed([{ id: 'dlq-1', originalQueueId: 'q1', fromAgent: 'a1', toAgent: 'a2', payload: {}, error: 'err', retryCount: 3, createdAt: new Date() }])
      const r = await dlqService.getDLQEntries(10)
      expect(r).toHaveLength(1)
    })
  })

  describe('retryFromDLQ', () => {
    it('re-enqueues from DLQ', async () => {
      seed([{ id: 'dlq-1', fromAgent: 'a1', toAgent: 'a2', payload: {}, error: 'err', retryCount: 3, createdAt: new Date(), originalQueueId: 'q1', manualActionRequired: true }], [{ id: 'new-q1' }])
      const r = await dlqService.retryFromDLQ({ dlqId: 'dlq-1' })
      expect(r).toBe('new-q1')
    })
  })
})
