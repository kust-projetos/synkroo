/**
 * P1 money-path fail-closed (ROI): technical DB failure must PROPAGATE
 * (throw), never resolve to fabricated zero/success metrics.
 * Legitimate empty data (EXPECTED_EMPTY) must still resolve to zero.
 */
import { calculateROI, getROIMetrics } from '@/services/analytics/roi.service'

jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let counter = 0
let results: any[][] = []
let failWith: unknown = null
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  innerJoin: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any, onR: any) {
    // P1: failure mode must follow the thenable protocol — `await` passes
    // (resolve, reject), so invoke the reject callback instead of returning
    // a detached rejected promise (which `await` would never settle on).
    if (failWith) {
      if (typeof onR === 'function') { onR(failWith); return Promise.resolve(undefined as any) }
      return Promise.reject(failWith)
    }
    const idx = counter++
    const d = results[idx] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => {
  let d: any = null
  return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) }
})

function seed(...seeded: any[][]) { counter = 0; results = seeded; failWith = null }
function failDb(err: unknown = new Error('DB down')) { counter = 0; results = []; failWith = err }
beforeEach(() => { counter = 0; results = []; failWith = null; jest.clearAllMocks(); mdb.then.mockClear() })

const cid = 'c1'
const ps = '2026-03-01T00:00:00.000Z'
const pe = '2026-03-31T23:59:59.999Z'

describe('ROI fail-closed (P1)', () => {
  it('calculateROI rejects on DB failure instead of fabricating zero revenue', async () => {
    failDb()
    await expect(calculateROI(cid, ps, pe)).rejects.toThrow('DB down')
  })

  it('calculateROI still resolves legitimate zero when period is genuinely empty', async () => {
    seed([], [], [], [])
    const r = await calculateROI(cid, ps, pe)
    expect(r.savings.messagesHandled).toBe(0)
    expect(r.revenue.appointmentsBooked).toBe(0)
    expect(r.revenue.totalRevenue).toBe(0)
  })

  it('getROIMetrics rejects on DB failure instead of zeroed metrics with implicit success', async () => {
    failDb()
    await expect(getROIMetrics(cid, 'month', '2026-06-01')).rejects.toThrow('DB down')
  })

  it('getROIMetrics still resolves comparison on genuinely empty data', async () => {
    seed([], [], [], [], [], [])
    const r = await getROIMetrics(cid, 'month', '2026-06-01')
    expect(r).toHaveProperty('comparison')
    expect(r.revenue.totalRevenue).toBe(0)
  })
})
