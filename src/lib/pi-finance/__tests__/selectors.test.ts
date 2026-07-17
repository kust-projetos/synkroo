/**
 * selectors.test.ts — pure selectors over FinanceData.
 * Uses an in-memory synthetic dataset so the math is auditable in the test body.
 */
import {
  getBankAccounts,
  getCreditCards,
  getSummary,
  getCreditSummary,
  getPayableSummary,
  getSpendingByCategory,
} from '@/lib/pi-finance/selectors'
import type { FinanceData } from '@/lib/pi-finance/types'

function buildFixture(): FinanceData {
  const now = new Date().toISOString()
  return {
    accounts: [
      { id: 'a-bank-1', householdId: 'h', name: 'Nubank', kind: 'bank', balanceCents: 500000, status: 'active' },
      { id: 'a-bank-2', householdId: 'h', name: 'Itaú', kind: 'bank', balanceCents: 200000, status: 'active' },
      { id: 'a-bank-archived', householdId: 'h', name: 'Old', kind: 'bank', balanceCents: 999999, status: 'archived' },
      { id: 'a-card-1', householdId: 'h', name: 'Nubank Card', kind: 'credit_card', balanceCents: -50000, status: 'active', creditLimitCents: 800000, closingDay: 5, dueDay: 13 },
      { id: 'a-card-2', householdId: 'h', name: 'Itaú Card', kind: 'credit_card', balanceCents: 0, status: 'active', creditLimitCents: 500000, closingDay: 20, dueDay: 28 },
    ],
    categories: [
      { id: 'c-salary', householdId: 'h', name: 'Renda > Salário', kind: 'income', status: 'active' },
      { id: 'c-moradia', householdId: 'h', name: 'Moradia > Aluguel', kind: 'expense', status: 'active' },
      { id: 'c-mercado', householdId: 'h', name: 'Alimentação > Mercado', kind: 'expense', status: 'active' },
      { id: 'c-rest', householdId: 'h', name: 'Alimentação > Restaurante', kind: 'expense', status: 'active' },
    ],
    transactions: [
      { id: 't1', householdId: 'h', kind: 'income', description: 'salário', amountCents: 1000000, date: now, accountId: 'a-bank-1', categoryId: 'c-salary' },
      { id: 't2', householdId: 'h', kind: 'expense', description: 'aluguel', amountCents: 300000, date: now, accountId: 'a-bank-1', categoryId: 'c-moradia' },
      { id: 't3', householdId: 'h', kind: 'expense', description: 'mercado', amountCents: 150000, date: now, accountId: 'a-bank-2', categoryId: 'c-mercado' },
      { id: 't4', householdId: 'h', kind: 'expense', description: 'restaurante', amountCents: 50000, date: now, accountId: 'a-bank-2', categoryId: 'c-rest' },
      { id: 't5', householdId: 'h', kind: 'income', description: 'freela', amountCents: 200000, date: now, accountId: 'a-bank-1', categoryId: 'c-salary' },
    ],
    payables: [
      { id: 'p1', householdId: 'h', accountId: 'a-bank-1', description: 'A', amountCents: 100000, dueDate: '2026-06-05', type: 'one_time', status: 'paid', paidDate: '2026-06-05', categoryId: 'c-moradia' },
      { id: 'p2', householdId: 'h', accountId: 'a-bank-2', description: 'B', amountCents: 50000, dueDate: '2026-07-05', type: 'one_time', status: 'paid', paidDate: '2026-07-04', categoryId: 'c-moradia' },
      { id: 'p3', householdId: 'h', accountId: 'a-bank-1', description: 'C', amountCents: 29700, dueDate: '2026-07-20', type: 'one_time', status: 'pending', categoryId: 'c-rest' },
    ],
    budgets: [],
    goals: [],
    cardStatements: [
      { id: 'cs1', householdId: 'h', accountId: 'a-card-1', cycleYearMonth: '2026-07', closingDate: '2026-07-05', dueDate: '2026-07-13', totalCents: 77740, paidCents: 0, status: 'open' },
      { id: 'cs2', householdId: 'h', accountId: 'a-card-2', cycleYearMonth: '2026-07', closingDate: '2026-07-20', dueDate: '2026-07-28', totalCents: 0, paidCents: 0, status: 'open' },
      { id: 'cs3', householdId: 'h', accountId: 'a-card-1', cycleYearMonth: '2026-06', closingDate: '2026-06-05', dueDate: '2026-06-13', totalCents: 100000, paidCents: 0, status: 'open' },
    ],
  }
}

describe('pi-finance selectors', () => {
  const fx = buildFixture()

  it('getBankAccounts returns only active bank-kind accounts', () => {
    const banks = getBankAccounts(fx)
    expect(banks.map((a) => a.id).sort()).toEqual(['a-bank-1', 'a-bank-2'])
  })

  it('getCreditCards returns only active credit_card-kind accounts', () => {
    const cards = getCreditCards(fx)
    expect(cards.map((a) => a.id).sort()).toEqual(['a-card-1', 'a-card-2'])
    // both must have creditLimitCents
    for (const c of cards) expect(typeof c.creditLimitCents).toBe('number')
  })

  it('getSummary sums active bank balances and all income/expense transactions', () => {
    const s = getSummary(fx)
    expect(s.bankBalanceCents).toBe(700000) // 500000 + 200000 (archived ignored)
    expect(s.incomeCents).toBe(1200000) // 1000000 + 200000
    expect(s.expenseCents).toBe(500000) // 300000 + 150000 + 50000
    expect(s.resultCents).toBe(700000)
  })

  it('getCreditSummary defaults to 2026-07 and counts only that cycle', () => {
    const c = getCreditSummary(fx)
    expect(c.currentInvoiceCents).toBe(77740)
    expect(c.totalLimitCents).toBe(1300000)
    expect(c.freeLimitCents).toBe(1222260)
  })

  it('getCreditSummary accepts an explicit cycle', () => {
    const c = getCreditSummary(fx, '2026-06')
    expect(c.currentInvoiceCents).toBe(100000)
    expect(c.totalLimitCents).toBe(1300000)
    expect(c.freeLimitCents).toBe(1200000)
  })

  it('getPayableSummary aggregates pending/paid totals and pending count', () => {
    const p = getPayableSummary(fx)
    expect(p.totalCents).toBe(179700) // 100000 + 50000 + 29700
    expect(p.paidCents).toBe(150000) // 100000 + 50000
    expect(p.pendingCents).toBe(29700)
    expect(p.pendingCount).toBe(1)
  })

  it('getSpendingByCategory groups expenses by top-level category, sorted desc', () => {
    const groups = getSpendingByCategory(fx)
    // expenses: Moradia 300000, Alimentação 150000+50000=200000
    expect(groups[0]).toEqual({ topCategory: 'Moradia', amountCents: 300000 })
    expect(groups[1]).toEqual({ topCategory: 'Alimentação', amountCents: 200000 })
    expect(groups.reduce((s, g) => s + g.amountCents, 0)).toBe(500000)
  })
})
