/**
 * P1 money-path fail-closed (financial reports): technical DB failure must
 * PROPAGATE (throw), never resolve to a fabricated zero-revenue report or
 * empty list with implicit success. Legitimate empty data (EXPECTED_EMPTY)
 * must still resolve to zero/empty.
 */
import { getFinancialReport, getInactivePatients, getUpsellOpportunities } from '../financial-reports.service'
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = []
let counter = 0
let failWith: unknown = null
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  leftJoin: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any, onR: any) {
    // P1: failure mode follows the thenable protocol — `await` passes
    // (resolve, reject), so invoke the reject callback instead of returning
    // a detached rejected promise (which `await` would never settle on).
    if (failWith) {
      if (typeof onR === 'function') { onR(failWith); return Promise.resolve(undefined as any) }
      return Promise.reject(failWith)
    }
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })
function seed(...s: any[][]) { counter = 0; results = s; failWith = null }
function failDb(err: unknown = new Error('DB down')) { counter = 0; results = []; failWith = err }
beforeEach(() => { counter = 0; results = []; failWith = null; jest.clearAllMocks() })

describe('Financial fail-closed (P1)', () => {
  it('getFinancialReport rejects on DB failure instead of {revenue:0,…} with implicit success', async () => {
    failDb()
    await expect(getFinancialReport('c1', 'month')).rejects.toThrow('DB down')
  })

  it('getFinancialReport still resolves legitimate zero for a genuinely empty period', async () => {
    seed([], [], [])
    const r = await getFinancialReport('c1', 'month')
    expect(r.revenue).toBe(0)
    expect(r.payments).toBe(0)
    expect(r.outstanding).toBe(0)
  })

  it('getInactivePatients rejects on DB failure instead of silent []', async () => {
    failDb()
    await expect(getInactivePatients('c1')).rejects.toThrow('DB down')
  })

  it('getInactivePatients still resolves [] when there are genuinely no patients', async () => {
    seed([])
    await expect(getInactivePatients('c1')).resolves.toEqual([])
  })

  it('getUpsellOpportunities rejects on DB failure instead of silent []', async () => {
    failDb()
    await expect(getUpsellOpportunities('c1')).rejects.toThrow('DB down')
  })

  it('getUpsellOpportunities still resolves [] when there are genuinely no plans', async () => {
    seed([], [])
    await expect(getUpsellOpportunities('c1')).resolves.toEqual([])
  })
})
