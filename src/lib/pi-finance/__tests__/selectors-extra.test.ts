/**
 * Slice C selectors: Wealth, CardUsage, BudgetUsage, GoalsWithProgress,
 * Categories, Report, MonthlyFlow, AccountTransactions.
 * All asserted against the captured live-app reference numbers.
 */
import {
  getWealth,
  getAccountTransactions,
  getCardUsage,
  getBudgetUsage,
  getGoalsWithProgress,
  getCategories,
  getReport,
  getMonthlyFlow,
  shiftMonth,
} from '@/lib/pi-finance'
import { initialFinanceData } from '@/lib/pi-finance/seed'

describe('Slice C selectors', () => {
  it('getWealth matches the captured patrimônio breakdown', () => {
    const w = getWealth(initialFinanceData)
    expect(w.accountsCents).toBe(2955070) // R$ 29.550,70
    expect(w.goalsCents).toBe(2000000)    // R$ 20.000,00
    expect(w.openInvoicesCents).toBe(77740) // current cycle 2026-07 open
    expect(w.debtsCents).toBe(0)          // no debt_payoff goals
    expect(w.netWorthCents).toBe(4877330) // 2955070 + 2000000 - 77740 - 0
  })

  it('getAccountTransactions returns latest 3 transactions for the account', () => {
    // Pick Nubank conta (id 9680dea2-...) — should have transactions across 2026.
    const nubank = initialFinanceData.accounts.find((a) => a.name === 'Conta Corrente Nubank')!
    const latest = getAccountTransactions(initialFinanceData, nubank.id, 3)
    expect(latest.length).toBe(3)
    // Sorted desc by date
    for (let i = 1; i < latest.length; i++) {
      expect(latest[i - 1]!.date >= latest[i]!.date).toBe(true)
    }
  })

  it('getCardUsage reports usedCents / limitCents for the current cycle', () => {
    const usage = getCardUsage(initialFinanceData, '2026-07')
    const nubank = usage.find((u) => u.card.name === 'Cartão Nubank')!
    expect(nubank.usedCents).toBe(77740)
    expect(nubank.limitCents).toBe(800000)
    expect(nubank.freeLimitCents).toBe(722260)
    expect(nubank.percentUsed).toBeCloseTo(9.7, 1)
    const itau = usage.find((u) => u.card.name === 'Cartão Itaú')!
    expect(itau.usedCents).toBe(0)
    expect(itau.limitCents).toBe(500000)
    expect(itau.percentUsed).toBe(0)
  })

  it('getBudgetUsage returns all seed budgets', () => {
    const usage = getBudgetUsage(initialFinanceData)
    expect(usage.length).toBe(7)
    // All zero in the seed.
    for (const u of usage) {
      expect(u.spentCents).toBe(0)
      expect(u.remainingCents).toBe(u.amountCents)
    }
  })

  it('getGoalsWithProgress reports percent of targetAmount reached', () => {
    const goals = getGoalsWithProgress(initialFinanceData)
    expect(goals.length).toBe(4)
    const macbook = goals.find((g) => g.name === 'MacBook Novo')!
    expect(macbook.currentAmountCents).toBe(350000)
    expect(macbook.targetAmountCents).toBe(1800000)
    expect(macbook.percentUsed).toBeCloseTo(350000 / 1800000 * 100, 2)
  })

  it('getCategories returns expense + income grouped/sorted when no kind given', () => {
    const all = getCategories(initialFinanceData)
    expect(all.length).toBe(39)
    const expenses = getCategories(initialFinanceData, 'expense')
    expect(expenses.length).toBe(35)
    const income = getCategories(initialFinanceData, 'income')
    expect(income.length).toBe(4)
  })

  it('getReport for 2026-07 matches the captured live Relatórios Mês tab', () => {
    const r = getReport(initialFinanceData, '2026-07')
    expect(r.incomeCents).toBe(0)
    expect(r.expenseCents).toBe(24500) // Seguro Auto
    expect(r.resultCents).toBe(-24500)
    expect(r.transactionCount).toBe(1)
    expect(r.avgTicketCents).toBe(24500)
    expect(r.savingsRate).toBe(0)
  })

  it('shiftMonth navigates across years correctly', () => {
    expect(shiftMonth('2026-07', -1)).toBe('2026-06')
    expect(shiftMonth('2026-07', -6)).toBe('2026-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-07', 0)).toBe('2026-07')
  })

  it('getMonthlyFlow returns 6 descending months ending in the base cycle', () => {
    const flow = getMonthlyFlow(initialFinanceData, '2026-07', 6)
    expect(flow).toHaveLength(6)
    expect(flow.map((p) => p.cycleYearMonth)).toEqual([
      '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07',
    ])
  })
})
