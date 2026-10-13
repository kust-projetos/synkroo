/**
 * P1A-SOFT-CAST — guard de status do money-path (installments).
 *
 * parseInstallmentStatus rejeita lixo; toSnake (via getInstallmentsByBudget)
 * falha fechado em linha corrompida em vez de propagar status fabricado.
 */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = []
let counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }),
  from: jest.fn(function (this: any) { return this }),
  where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) {
    const d = results[counter++] ?? []
    return Promise.resolve(typeof onF === 'function' ? onF(d) : d)
  }),
} as any
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb), closeDb: jest.fn() }))

import { getInstallmentsByBudget, isInstallmentStatus, parseInstallmentStatus } from '../installment.service'

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

const mk = (o: any = {}) => ({
  id: 'i1', budgetId: 'b1', amount: '100', dueDate: new Date('2026-12-31'),
  status: 'pending', paidAt: null, paymentId: null,
  createdAt: new Date(), updatedAt: new Date(), ...o,
})

describe('installment status guard', () => {
  it.each(['pending', 'paid', 'overdue', 'cancelled'])('aceita status válido %s', (s) => {
    expect(isInstallmentStatus(s)).toBe(true)
    expect(parseInstallmentStatus(s)).toBe(s)
  })

  it.each(['foo', '', 'PAID', 'scheduled', null, undefined, 123])('rejeita status inválido %p', (v) => {
    expect(isInstallmentStatus(v)).toBe(false)
    expect(() => parseInstallmentStatus(v)).toThrow(/Invalid installment status/)
  })

  it('getInstallmentsByBudget falha fechado em linha com status corrompido', async () => {
    seed([mk({ status: 'weird_status' })])
    await expect(getInstallmentsByBudget('b1')).rejects.toThrow(/Invalid installment status/)
  })

  it('getInstallmentsByBudget mantém linha válida', async () => {
    seed([mk({ status: 'pending' })])
    const rows = await getInstallmentsByBudget('b1')
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
  })
})
