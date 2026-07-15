/**
 * seed.test.ts — verifies the static seed mirrors what the planner captured
 * from https://pi-finance-pwa.walissonead.workers.dev/ on 2026-07-05.
 *
 * Reference values (R$ = cents/100):
 *   saldo contas          29.550,70
 *   receitas              34.995,00
 *   despesas              23.021,70
 *   resultado             11.973,30
 *   fatura atual          777,40 (cycle 2026-07)
 *   limite total          13.000,00
 *   limite livre          12.222,60
 *   contas a pagar total  3.507,80
 *   contas a pagar pago   3.210,80
 *   contas a pagar pend.  297,00  (Curso Online, 2026-07-20)
 *   taxa de poupança      34.2%
 *   maior categoria       Moradia (1º nível) R$ 12.663,40
 *   cash burn 30d         R$ 41,40
 */
import {
  PI_FINANCE_TOKEN,
  initialFinanceData,
  createInitialSnapshot,
} from '@/lib/pi-finance/seed'
import { getSummary, getCreditSummary, getPayableSummary, getSpendingByCategory, getInsights } from '@/lib/pi-finance/selectors'

describe('pi-finance seed', () => {
  it('PI_FINANCE_TOKEN matches captured localStorage value', () => {
    expect(PI_FINANCE_TOKEN).toBe('cee1a6d7-77f7-4efb-a2a0-06877f6026ea')
  })

  it('initialFinanceData is fully populated', () => {
    expect(initialFinanceData.accounts.length).toBe(8)
    expect(initialFinanceData.categories.length).toBe(39)
    expect(initialFinanceData.transactions.length).toBe(144)
    expect(initialFinanceData.payables.length).toBe(8)
    expect(initialFinanceData.budgets.length).toBe(7)
    expect(initialFinanceData.goals.length).toBe(4)
    expect(initialFinanceData.cardStatements.length).toBe(9)
  })

  it('seed balances match the captured live summary', () => {
    const s = getSummary(initialFinanceData)
    expect(s.bankBalanceCents).toBe(2955070)
    expect(s.incomeCents).toBe(3499500)
    expect(s.expenseCents).toBe(2302170)
    expect(s.resultCents).toBe(1197330)
  })

  it('credit card totals for cycle 2026-07 match', () => {
    const c = getCreditSummary(initialFinanceData, '2026-07')
    expect(c.currentInvoiceCents).toBe(77740)
    expect(c.totalLimitCents).toBe(1300000)
    expect(c.freeLimitCents).toBe(1222260)
  })

  it('payables summary matches captured totals', () => {
    const p = getPayableSummary(initialFinanceData)
    expect(p.totalCents).toBe(350780)
    expect(p.paidCents).toBe(321080)
    expect(p.pendingCents).toBe(29700)
    expect(p.pendingCount).toBe(1)
  })

  it('top category by top-level group is Moradia (R$ 12.663,40)', () => {
    const groups = getSpendingByCategory(initialFinanceData)
    expect(groups[0]).toEqual({ topCategory: 'Moradia', amountCents: 1266340 })
    // sum of all groups equals total expenses
    const sum = groups.reduce((s, g) => s + g.amountCents, 0)
    expect(sum).toBe(2302170)
  })

  it('insights include savings rate, top category, next payable and cash burn', () => {
    const insights = getInsights(initialFinanceData)
    expect(insights.some((i) => /34,?2\s*%/i.test(i))).toBe(true)
    expect(insights.some((i) => /Moradia/.test(i))).toBe(true)
    expect(insights.some((i) => /Curso Online/.test(i))).toBe(true)
    expect(insights.some((i) => /41,40/.test(i))).toBe(true)
  })

  it('createInitialSnapshot returns a versioned snapshot referencing the seed token', () => {
    const snap = createInitialSnapshot()
    expect(snap.version).toBe(1)
    expect(snap.token).toBe(PI_FINANCE_TOKEN)
    expect(snap.data).toBe(initialFinanceData)
    // syncedAt must contain every entity key
    expect(Object.keys(snap.syncedAt).sort()).toEqual(
      [
        'accounts',
        'budgets',
        'cardStatements',
        'categories',
        'goals',
        'payables',
        'transactions',
      ].sort()
    )
  })
})
