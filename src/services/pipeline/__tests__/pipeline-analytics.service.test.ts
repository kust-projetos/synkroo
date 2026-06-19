/** Tests for Pipeline Analytics Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { getConversionByStage, getAvgConversionTime } from '../pipeline-analytics.service'

describe('Pipeline Analytics Service', () => {
  describe('getConversionByStage', () => {
    it('returns empty when no stages', async () => { seed([]); const r = await getConversionByStage('c1'); expect(r).toEqual([]) })
    it('returns zeros for empty pipeline', async () => {
      seed([{ id: 's1', name: 'Novo', color: '#3B82F6', position: 1 }, { id: 's2', name: 'Qualificado', color: '#10B981', position: 2 }], [])
      const r = await getConversionByStage('c1'); expect(r).toHaveLength(2); expect(r[0].totalLeads).toBe(0)
    })
    it('calculates conversion rates', async () => {
      seed([{ id: 's1', name: 'Novo', color: '#3B82F6', position: 1 }], [{ stageId: 's1', convertedAt: new Date() }, { stageId: 's1', convertedAt: null }, { stageId: 's1', convertedAt: null }])
      const r = await getConversionByStage('c1'); expect(r[0].totalLeads).toBe(3); expect(r[0].convertedLeads).toBe(1); expect(r[0].conversionRate).toBeCloseTo(33.33, 1)
    })
  })
  describe('getAvgConversionTime', () => {
    it('returns avg days', async () => {
      const created = new Date('2026-01-01'); const converted = new Date('2026-01-11')
      seed([{ createdAt: created, convertedAt: converted }, { createdAt: new Date('2026-02-01'), convertedAt: new Date('2026-02-21') }])
      const r = await getAvgConversionTime('c1'); expect(r).toBe(15) // (10+20)/2 = 15
    })
    it('returns 0 when no converted leads', async () => { seed([]); const r = await getAvgConversionTime('c1'); expect(r).toBe(0) })
  })
})
