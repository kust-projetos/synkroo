/** Tests for Payment Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))
jest.mock('@/services/installments/installment.service', () => ({ getRemainingBalance: jest.fn() }))
jest.mock('@/services/treatment-plans/treatment-plan.service', () => ({ updateSessionProgress: jest.fn() }))

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
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? results[results.length - 1] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => {
  let d: any = null
  return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) }
})

import { recordPayment, getPaymentsByBudget, getPaymentsByPatient } from '../payment.service'
import { getRemainingBalance } from '@/services/installments/installment.service'
import { updateSessionProgress } from '@/services/treatment-plans/treatment-plan.service'

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => {
  counter = 0; results = []; jest.clearAllMocks()
  ;(getRemainingBalance as jest.Mock).mockResolvedValue(500)
  ;(updateSessionProgress as jest.Mock).mockResolvedValue(true)
})

const pRow = { id: 'p1', budgetId: 'b1', amount: '300', paymentMethod: 'pix', paidAt: new Date(), notes: null, createdBy: 'u1', createdAt: new Date(), updatedAt: new Date() }

describe('Payment Service', () => {
  describe('recordPayment', () => {
    it('records payment successfully', async () => {
      seed([pRow], [], [])
      const r = await recordPayment({ budget_id: 'b1', amount: 300, payment_method: 'pix', created_by: 'u1' })
      expect(r.payment.amount).toBe(300)
    })

    it('throws when amount exceeds balance', async () => {
      ;(getRemainingBalance as jest.Mock).mockResolvedValue(100)
      await expect(recordPayment({ budget_id: 'b1', amount: 300, payment_method: 'pix', created_by: 'u1' })).rejects.toThrow('exceeds')
    })

    it('auto-completes sessions with treatment plan', async () => {
      (getRemainingBalance as jest.Mock).mockResolvedValue(1000)
      seed(
        [pRow],
        [{ finalValue: '900', treatmentPlanId: 'tp1' }],
        [{ totalSessions: 3 }],
        [{ treatmentPlanId: 'tp1' }],
        [{ clinicId: 'clinic-1' }],
        [{ id: 'ti1' }, { id: 'ti2' }],
        [{ finalValue: '900' }],
        [{ amount: '300', status: 'paid' }],
      )
      const r = await recordPayment({ budget_id: 'b1', amount: 600, payment_method: 'pix', created_by: 'u1' })
      expect(r.sessions_completed).toBe(2) // 600/300 = 2
    })

    it('handles missing treatment plan', async () => {
      seed([pRow], [{ finalValue: '500', treatmentPlanId: null }], [])
      const r = await recordPayment({ budget_id: 'b1', amount: 300, payment_method: 'pix', created_by: 'u1' })
      expect(r.sessions_completed).toBe(0)
    })

    it('persists canonical 2-decimal string (0.3 → "0.30", not "0.3")', async () => {
      seed([pRow], [{ finalValue: '500', treatmentPlanId: null }], [{ finalValue: '500' }], [])
      const r = await recordPayment({ budget_id: 'b1', amount: 0.3, payment_method: 'pix', created_by: 'u1' })
      expect(r.payment.amount).toBe(0.3)
      expect(mdb.values).toHaveBeenCalledWith(expect.objectContaining({ amount: '0.30' }))
    })

    it('enforces overpayment boundary in cents (100 ok, 100.01 exceeds)', async () => {
      ;(getRemainingBalance as jest.Mock).mockResolvedValue(100)
      seed([pRow], [{ finalValue: '500', treatmentPlanId: null }], [{ finalValue: '500' }], [])
      await expect(recordPayment({ budget_id: 'b1', amount: 100, payment_method: 'pix', created_by: 'u1' })).resolves.toBeDefined()
      await expect(recordPayment({ budget_id: 'b1', amount: 100.01, payment_method: 'pix', created_by: 'u1' })).rejects.toThrow('exceeds')
    })

    it('marks budget converted on exact cents (0.10 + 0.20 >= 0.30)', async () => {
      ;(getRemainingBalance as jest.Mock).mockResolvedValue(500)
      seed(
        [pRow],
        [{ finalValue: '0.30', treatmentPlanId: null }],
        [{ finalValue: '0.30' }],
        [{ amount: '0.10', status: 'paid' }, { amount: '0.20', status: 'paid' }],
      )
      await recordPayment({ budget_id: 'b1', amount: 0.1, payment_method: 'pix', created_by: 'u1' })
      expect(mdb.update).toHaveBeenCalled()
      expect(mdb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'converted' }))
    })

    it('computes covered sessions exactly in cents (0.10 of 0.30/3 → 1 session)', async () => {
      (getRemainingBalance as jest.Mock).mockResolvedValue(1000)
      seed(
        [pRow],
        [{ finalValue: '0.30', treatmentPlanId: 'tp1' }],
        [{ totalSessions: 3 }],
        [{ treatmentPlanId: 'tp1' }],
        [{ clinicId: 'clinic-1' }],
        [{ id: 'ti1' }],
        [{ finalValue: '0.30' }],
        [{ amount: '0.10', status: 'paid' }],
      )
      const r = await recordPayment({ budget_id: 'b1', amount: 0.1, payment_method: 'pix', created_by: 'u1' })
      expect(r.sessions_completed).toBe(1)
    })
  })

  describe('getPaymentsByBudget', () => {
    it('returns payments', async () => {
      seed([pRow])
      const r = await getPaymentsByBudget('b1')
      expect(r).toHaveLength(1)
      expect(r[0].amount).toBe(300)
    })
  })

  describe('getPaymentsByPatient', () => {
    it('returns payments via budgets', async () => {
      seed([{ id: 'b1' }], [pRow])
      const r = await getPaymentsByPatient('p1')
      expect(r).toHaveLength(1)
    })

    it('returns empty when no budgets', async () => {
      seed([])
      const r = await getPaymentsByPatient('p1')
      expect(r).toEqual([])
    })
  })
})
