/**
 * Queue Service Integration Tests — migrated to Drizzle mocks
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
  innerJoin: jest.fn(function (this: any) { return this }),
  leftJoin: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { QueueService } from '@/services/queue/queue.service'

const mkRow = (id: string, toAgent = 'agent1') => ({ id, toAgent, fromAgent: 'a0', status: 'pending', payload: {}, retryCount: 0, processAfter: new Date(0), error: null, completedAt: null, createdAt: new Date() })

describe('QueueService Integration', () => {
  let qs: QueueService
  beforeEach(() => { qs = new QueueService() })

  it('enqueue returns ID', async () => { seed([{ id: 'q-1' }]); const r = await qs.enqueue('a1', 'a2', {}); expect(r).toBe('q-1') })
})
