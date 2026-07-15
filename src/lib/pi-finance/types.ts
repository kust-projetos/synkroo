/**
 * Tiny domain types for the self-contained pi-finance clone.
 * Mirrors the shape of the snapshot captured from
 * https://pi-finance-pwa.walissonead.workers.dev/ on 2026-07-05.
 *
 * All currency values are integer cents (no floats).
 * All dates are either ISO-8601 strings ('YYYY-MM-DD' for calendar dates,
 * full ISO for timestamps) — never Date objects in serialised form.
 */

export type AccountKind = 'bank' | 'credit_card'
export type CategoryKind = 'income' | 'expense'
export type TransactionKind = 'income' | 'expense' | 'transfer'
export type AccountStatus = 'active' | 'archived'
export type PayableStatus = 'pending' | 'paid' | 'overdue'
export type PayableType = 'one_time' | 'recurring'
export type GoalType = 'savings' | 'purchase' | 'emergency_fund' | 'debt_payoff'
export type CardStatementStatus = 'open' | 'closed' | 'paid'

export interface Account {
  id: string
  householdId: string
  name: string
  kind: AccountKind
  balanceCents: number
  status: AccountStatus
  /** credit_card only */
  creditLimitCents?: number
  /** credit_card only — day of month (1..31) */
  closingDay?: number
  /** credit_card only — day of month (1..31) */
  dueDay?: number
}

export interface Category {
  id: string
  householdId: string
  /** hierarchical: 'Moradia > Aluguel' */
  name: string
  kind: CategoryKind
  status: AccountStatus
}

export interface Transaction {
  id: string
  householdId: string
  kind: TransactionKind
  description: string
  amountCents: number
  /** YYYY-MM-DD */
  date: string
  accountId: string
  categoryId: string
}

export interface Payable {
  id: string
  householdId: string
  accountId: string
  description: string
  amountCents: number
  /** YYYY-MM-DD */
  dueDate: string
  type: PayableType
  status: PayableStatus
  /** YYYY-MM-DD when status === 'paid' */
  paidDate?: string | null
  reminderDaysBefore?: number
  notes?: string | null
  categoryId: string
}

export interface Budget {
  id: string
  householdId: string
  categoryId: string
  name: string
  amountCents: number
  period: string
  /** YYYY-MM-DD */
  startDate: string
  alertThreshold: number
  rollover: boolean
  spentCents: number
  remainingCents: number
  percentUsed: number
}

export interface Goal {
  id: string
  householdId: string
  name: string
  goalType: GoalType
  targetAmountCents: number
  currentAmountCents: number
  /** YYYY-MM-DD */
  startDate: string
  status: AccountStatus
}

export interface CardStatement {
  id: string
  householdId: string
  accountId: string
  /** 'YYYY-MM' */
  cycleYearMonth: string
  /** YYYY-MM-DD */
  closingDate: string
  /** YYYY-MM-DD */
  dueDate: string
  totalCents: number
  paidCents: number
  status: CardStatementStatus
}

export interface FinanceData {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  payables: Payable[]
  budgets: Budget[]
  goals: Goal[]
  cardStatements: CardStatement[]
}

export interface FinanceSnapshot {
  version: number
  token: string
  syncedAt: { [K in keyof FinanceData]: string }
  data: FinanceData
}
