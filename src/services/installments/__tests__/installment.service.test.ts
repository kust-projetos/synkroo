/** Tests for Installment Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  insert: jest.fn(function (this: any) { return this }), values: jest.fn(function (this: any) { return this }), returning: jest.fn(function (this: any) { return this }),
  update: jest.fn(function (this: any) { return this }), set: jest.fn(function (this: any) { return this }),
  delete: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { createInstallments, getInstallmentsByBudget, getRemainingBalance, markInstallmentPaid, deleteInstallment } from '../installment.service'

const mk = (o: any = {}) => ({ id: 'i1', budgetId: 'b1', amount: '100', dueDate: new Date('2026-12-31'), status: 'pending', paidAt: null, paymentId: null, createdAt: new Date(), updatedAt: new Date(), ...o })

describe('Installment Service', () => {
  it('createInstallments', async () => { seed([mk(), mk({ id: 'i2' })]); const r = await createInstallments('b1', [{ budget_id: 'b1', amount: 100, due_date: '2026-12-31' }, { budget_id: 'b1', amount: 200, due_date: '2026-12-31' }]); expect(r).toHaveLength(2) })
  it('getInstallmentsByBudget', async () => { seed([mk(), mk({ id: 'i2', status: 'paid', paidAt: new Date() })]); const r = await getInstallmentsByBudget('b1'); expect(r).toHaveLength(2) })
  it('getRemainingBalance', async () => { seed([{ finalValue: '500' }], [{ amount: '200', status: 'paid' }, { amount: '100', status: 'paid' }]); const r = await getRemainingBalance('b1'); expect(r).toBe(200) })
  it('getRemainingBalance no budget', async () => { seed([]); const r = await getRemainingBalance('b1'); expect(r).toBe(0) })
  it('markInstallmentPaid', async () => { seed([mk({ status: 'paid', paidAt: new Date(), paymentId: 'p1' })]); const r = await markInstallmentPaid('i1', 'p1'); expect(r?.status).toBe('paid') })
  it('deleteInstallment throws if paid', async () => { seed([mk({ status: 'paid' })]); await expect(deleteInstallment('i1')).rejects.toThrow('Cannot delete') })
})
