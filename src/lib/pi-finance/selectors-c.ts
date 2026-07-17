/**
 * Slice C selectors — extra pure readers over FinanceData that weren't
 * needed by the summary screen in Slice B. Imported by both the lib barrel
 * (so the UI gets them via `@/lib/pi-finance`) and the unit tests.
 */

import type { Account, Budget, Category, FinanceData, Goal, Transaction } from './types'
import { getBankAccounts, getCreditCards } from './selectors'

/**
 * Live-app definition of net worth:
 *   accountsCents + goalsCents - openInvoicesCents - debtsCents
 * where:
 *   - accountsCents        = sum of active bank balances
 *   - goalsCents           = sum of `currentAmountCents` of active goals
 *   - openInvoicesCents    = sum of `totalCents` for the current cycle's
 *                            open card statements
 *   - debtsCents           = sum of `currentAmountCents` of active
 *                            `debt_payoff` goals (zero in the seed)
 */
export function getWealth(data: FinanceData, cycleYearMonth: string = '2026-07') {
  const accountsCents = getBankAccounts(data).reduce((s, a) => s + a.balanceCents, 0)
  const goalsCents = data.goals
    .filter((g) => g.status === 'active')
    .reduce((s, g) => s + g.currentAmountCents, 0)
  const openInvoicesCents = data.cardStatements
    .filter((c) => c.cycleYearMonth === cycleYearMonth)
    .reduce((s, c) => s + c.totalCents, 0)
  const debtsCents = data.goals
    .filter((g) => g.goalType === 'debt_payoff' && g.status === 'active')
    .reduce((s, g) => s + g.currentAmountCents, 0)
  return {
    accountsCents,
    goalsCents,
    openInvoicesCents,
    debtsCents,
    netWorthCents: accountsCents + goalsCents - openInvoicesCents - debtsCents,
  }
}

export type WealthBreakdown = ReturnType<typeof getWealth>

/** Latest N transactions linked to an account, descending by date. */
export function getAccountTransactions(data: FinanceData, accountId: string, limit: number = 3): Transaction[] {
  return [...data.transactions]
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(0, limit))
}

export interface CardUsage {
  card: Account
  usedCents: number
  limitCents: number
  freeLimitCents: number
  percentUsed: number
}

export function getCardUsage(data: FinanceData, cycleYearMonth: string = '2026-07'): CardUsage[] {
  return getCreditCards(data).map((card) => {
    const stmt = data.cardStatements.find(
      (c) => c.accountId === card.id && c.cycleYearMonth === cycleYearMonth,
    )
    const usedCents = stmt ? stmt.totalCents : 0
    const limitCents = card.creditLimitCents ?? 0
    const freeLimitCents = limitCents - usedCents
    const percentUsed = limitCents > 0 ? (usedCents / limitCents) * 100 : 0
    return { card, usedCents, limitCents, freeLimitCents, percentUsed }
  })
}

export interface BudgetUsage {
  budget: Budget
  amountCents: number
  spentCents: number
  remainingCents: number
  percentUsed: number
}

export function getBudgetUsage(data: FinanceData): BudgetUsage[] {
  return data.budgets
    .map((b) => ({
      budget: b,
      amountCents: b.amountCents,
      spentCents: b.spentCents,
      remainingCents: b.remainingCents,
      percentUsed: b.percentUsed,
    }))
    .sort((a, b) => b.percentUsed - a.percentUsed)
}

export interface GoalWithProgress extends Goal {
  percentUsed: number
}

export function getGoalsWithProgress(data: FinanceData): GoalWithProgress[] {
  return data.goals
    .filter((g) => g.status === 'active')
    .map((g) => ({
      ...g,
      percentUsed: g.targetAmountCents > 0 ? (g.currentAmountCents / g.targetAmountCents) * 100 : 0,
    }))
}

export function getCategories(data: FinanceData, kind?: 'income' | 'expense'): Category[] {
  const arr = kind ? data.categories.filter((c) => c.kind === kind) : data.categories
  return [...arr].sort((a, b) => a.name.localeCompare(b.name))
}

export interface PeriodReport {
  cycleYearMonth: string
  incomeCents: number
  expenseCents: number
  resultCents: number
  transactionCount: number
  avgTicketCents: number
  savingsRate: number
}

export function getReport(data: FinanceData, cycleYearMonth: string): PeriodReport {
  const matching = data.transactions.filter((t) => t.date.startsWith(cycleYearMonth))
  const incomeCents = matching.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountCents, 0)
  const expenseCents = matching.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amountCents, 0)
  const transactionCount = matching.length
  const avgTicketCents = transactionCount > 0 ? Math.round((incomeCents + expenseCents) / transactionCount) : 0
  const savingsRate = incomeCents > 0 ? ((incomeCents - expenseCents) / incomeCents) * 100 : 0
  return { cycleYearMonth, incomeCents, expenseCents, resultCents: incomeCents - expenseCents, transactionCount, avgTicketCents, savingsRate }
}

/** Pure month shift on YYYY-MM strings; negative deltas go backwards. */
export function shiftMonth(cycleYearMonth: string, delta: number): string {
  const parts = cycleYearMonth.split('-')
  const y = Number(parts[0] ?? 1970)
  let m = Number(parts[1] ?? 1) + delta
  let ny = y
  while (m < 1) { m += 12; ny -= 1 }
  while (m > 12) { m -= 12; ny += 1 }
  return `${ny}-${String(m).padStart(2, '0')}`
}

export interface MonthlyFlowPoint {
  cycleYearMonth: string
  incomeCents: number
  expenseCents: number
}

export function getMonthlyFlow(data: FinanceData, baseCycle: string = '2026-07', months: number = 6): MonthlyFlowPoint[] {
  return Array.from({ length: months }, (_, i) => {
    const cycleYearMonth = shiftMonth(baseCycle, -(months - 1 - i))
    const r = getReport(data, cycleYearMonth)
    return { cycleYearMonth: r.cycleYearMonth, incomeCents: r.incomeCents, expenseCents: r.expenseCents }
  })
}
