/**
 * Pure selectors over FinanceData.
 * All functions accept the whole data object and return narrow views.
 * They never mutate the input.
 */

import type { Account, FinanceData, Payable, Transaction } from './types'
import { PI_FINANCE_NOW } from './seed'

/** Top-level category group derived from a Category.name like 'Moradia > Aluguel'. */
export function topCategoryOf(categoryName: string): string {
  const idx = categoryName.indexOf('>')
  return (idx === -1 ? categoryName : categoryName.slice(0, idx)).trim()
}

const isActive = <T extends { status: string }>(x: T) => x.status === 'active'

/** Active bank accounts (bank kind only). */
export function getBankAccounts(data: FinanceData): Account[] {
  return data.accounts.filter((a) => a.kind === 'bank' && isActive(a))
}

/** Active credit-card accounts. */
export function getCreditCards(data: FinanceData): Account[] {
  return data.accounts.filter((a) => a.kind === 'credit_card' && isActive(a))
}

function sumBankBalance(data: FinanceData): number {
  return getBankAccounts(data).reduce((s, a) => s + a.balanceCents, 0)
}

function sumByKind(data: FinanceData, kind: Transaction['kind']): number {
  return data.transactions.filter((t) => t.kind === kind).reduce((s, t) => s + t.amountCents, 0)
}

export interface FinanceSummary {
  bankBalanceCents: number
  incomeCents: number
  expenseCents: number
  resultCents: number
}

export function getSummary(data: FinanceData): FinanceSummary {
  const incomeCents = sumByKind(data, 'income')
  const expenseCents = sumByKind(data, 'expense')
  return {
    bankBalanceCents: sumBankBalance(data),
    incomeCents,
    expenseCents,
    resultCents: incomeCents - expenseCents,
  }
}

export interface CreditSummary {
  currentInvoiceCents: number
  totalLimitCents: number
  freeLimitCents: number
}

/** Credit summary scoped to a single billing cycle ('YYYY-MM'). */
export function getCreditSummary(data: FinanceData, cycleYearMonth: string = '2026-07'): CreditSummary {
  const cards = getCreditCards(data)
  const totalLimitCents = cards.reduce((s, c) => s + (c.creditLimitCents ?? 0), 0)
  const currentInvoiceCents = data.cardStatements
    .filter((c) => c.cycleYearMonth === cycleYearMonth)
    .reduce((s, c) => s + c.totalCents, 0)
  return {
    currentInvoiceCents,
    totalLimitCents,
    freeLimitCents: totalLimitCents - currentInvoiceCents,
  }
}

export interface PayableSummary {
  totalCents: number
  paidCents: number
  pendingCents: number
  pendingCount: number
}

export function getPayableSummary(data: FinanceData): PayableSummary {
  let totalCents = 0
  let paidCents = 0
  let pendingCents = 0
  let pendingCount = 0
  for (const p of data.payables) {
    totalCents += p.amountCents
    if (p.status === 'paid') paidCents += p.amountCents
    else if (p.status === 'pending') {
      pendingCents += p.amountCents
      pendingCount++
    }
  }
  return { totalCents, paidCents, pendingCents, pendingCount }
}

export interface CategorySpend {
  topCategory: string
  amountCents: number
}

/**
 * Group expense transactions by the top-level category (split on '>').
 * Sorted by amount desc.
 */
export function getSpendingByCategory(data: FinanceData): CategorySpend[] {
  const catMap = new Map(data.categories.map((c) => [c.id, c.name]))
  const totals = new Map<string, number>()
  for (const t of data.transactions) {
    if (t.kind !== 'expense') continue
    const name = catMap.get(t.categoryId)
    if (!name) continue
    const top = topCategoryOf(name)
    totals.set(top, (totals.get(top) ?? 0) + t.amountCents)
  }
  return [...totals.entries()]
    .map(([topCategory, amountCents]) => ({ topCategory, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents)
}

/** Next pending payable sorted by dueDate asc. */
export function getNextPendingPayable(data: FinanceData): Payable | null {
  const pendings = data.payables.filter((p) => p.status === 'pending')
  if (pendings.length === 0) return null
  return [...pendings].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]!
}

/** Cash delta over the last 30 days (negative = burn). Defaults eval time = now. */
export function getCashBurn30d(data: FinanceData, now: Date = new Date()): number {
  const cutoff = now.getTime() - 30 * 86400000
  let income = 0
  let expense = 0
  for (const t of data.transactions) {
    const dt = new Date(t.date).getTime()
    if (Number.isNaN(dt) || dt < cutoff) continue
    if (t.kind === 'income') income += t.amountCents
    else if (t.kind === 'expense') expense += t.amountCents
  }
  return income - expense // negative => burned cash
}

/**
 * Insights renderer — string array consumed by the live UI.
 * Order matches the captured ranking:
 *   1. savings rate
 *   2. top spending group
 *   3. budgets near limit
 *   4. next payable
 *   5. cash burn 30d
 */
export function getInsights(data: FinanceData, now: Date = PI_FINANCE_NOW): string[] {
  const insights: string[] = []

  const summary = getSummary(data)
  if (summary.incomeCents > 0) {
    const savingsRate = (summary.resultCents / summary.incomeCents) * 100
    insights.push(`Taxa de poupança — Você poupa ${savingsRate.toFixed(1).replace('.', ',')}% da sua renda. Excelente!`)
  }

  const groups = getSpendingByCategory(data)
  if (groups.length > 0) {
    const top = groups[0]!
    const reais = (top.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    insights.push(`Maior categoria de gasto — ${top.topCategory} — R$ ${reais} no período.`)
  }

  // budgets: spent/amount >= 0.8 => near limit
  const nearLimit = data.budgets.filter((b) => b.amountCents > 0 && b.spentCents / b.amountCents >= (b.alertThreshold ?? 80) / 100)
  if (nearLimit.length > 0) {
    // pick the highest percentUsed as "mais pressionado"
    const most = [...nearLimit].sort((a, b) => b.percentUsed - a.percentUsed)[0]!
    insights.push(`Orçamentos no limite — ${nearLimit.length} orçamentos perto do limite. Mais pressionado: ${most.name}.`)
  }

  const next = getNextPendingPayable(data)
  if (next) {
    const reais = (next.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const due = new Date(next.dueDate + 'T00:00:00Z')
    const days = Math.max(0, Math.round((due.getTime() - now.getTime()) / 86400000))
    insights.push(`Próxima conta a vencer — ${next.description} — R$ ${reais} em ${days} dias (${next.dueDate}).`)
  }

  const burn = getCashBurn30d(data, now)
  if (burn !== 0) {
    const reais = Math.abs(burn / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const verb = burn < 0 ? 'caiu' : 'subiu'
    insights.push(`Queima de caixa — Caixa ${verb} R$ ${reais} nos últimos 30 dias.`)
  }

  return insights
}
