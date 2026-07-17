/**
 * Pure mutations on FinanceData.
 * Every function returns a NEW FinanceData object; the input is never mutated
 * (callers can hold onto prior snapshots for undo/audit).
 */

import type { Account, FinanceData, Payable, Transaction } from './types'

const HOUSEHOLD_ID = '550e8400-e29b-41d4-a716-446655440000'

function newId(prefix: string): string {
  // Deterministic-ish without bringing in `crypto` — combination of Math.random
  // and Date.now is enough for local-storage ids; never used as a security key.
  const r = Math.random().toString(16).slice(2, 10)
  const t = Date.now().toString(16)
  return `${prefix}-${t}${r}`
}

function withAccounts(data: FinanceData, accounts: Account[]): FinanceData {
  return {
    accounts,
    categories: data.categories,
    transactions: data.transactions,
    payables: data.payables,
    budgets: data.budgets,
    goals: data.goals,
    cardStatements: data.cardStatements,
  }
}

function withTransactions(data: FinanceData, transactions: Transaction[]): FinanceData {
  return {
    accounts: data.accounts,
    categories: data.categories,
    transactions,
    payables: data.payables,
    budgets: data.budgets,
    goals: data.goals,
    cardStatements: data.cardStatements,
  }
}

function withPayables(data: FinanceData, payables: Payable[]): FinanceData {
  return {
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    payables,
    budgets: data.budgets,
    goals: data.goals,
    cardStatements: data.cardStatements,
  }
}

export interface AddTransactionInput {
  kind: 'income' | 'expense'
  description: string
  amountCents: number
  /** YYYY-MM-DD */
  date: string
  accountId: string
  categoryId: string
}

/**
 * Append a transaction and update the linked account balance:
 *   income  → account += amountCents
 *   expense → account -= amountCents
 * Returns a new FinanceData. Throws if the account doesn't exist.
 */
export function addTransaction(data: FinanceData, input: AddTransactionInput): FinanceData {
  const account = data.accounts.find((a) => a.id === input.accountId)
  if (!account) throw new Error(`addTransaction: account ${input.accountId} not found`)
  const delta = input.kind === 'income' ? input.amountCents : -input.amountCents
  const accounts = data.accounts.map((a) =>
    a.id === account.id ? { ...a, balanceCents: a.balanceCents + delta } : a
  )
  const tx: Transaction = {
    id: newId('t'),
    householdId: HOUSEHOLD_ID,
    kind: input.kind,
    description: input.description,
    amountCents: input.amountCents,
    date: input.date,
    accountId: input.accountId,
    categoryId: input.categoryId,
  }
  return withTransactions(withAccounts(data, accounts), [...data.transactions, tx])
}

export interface AddPayableInput {
  accountId: string
  description: string
  amountCents: number
  /** YYYY-MM-DD */
  dueDate: string
  categoryId: string
  notes?: string
  type?: 'one_time' | 'recurring'
  reminderDaysBefore?: number
}

export function addPayable(data: FinanceData, input: AddPayableInput): FinanceData {
  if (!data.accounts.find((a) => a.id === input.accountId)) {
    throw new Error(`addPayable: account ${input.accountId} not found`)
  }
  const payable: Payable = {
    id: newId('p'),
    householdId: HOUSEHOLD_ID,
    accountId: input.accountId,
    description: input.description,
    amountCents: input.amountCents,
    dueDate: input.dueDate,
    type: input.type ?? 'one_time',
    status: 'pending',
    paidDate: null,
    reminderDaysBefore: input.reminderDaysBefore ?? 3,
    notes: input.notes ?? null,
    categoryId: input.categoryId,
  }
  return withPayables(data, [...data.payables, payable])
}

/**
 * Mark a payable as paid:
 *   - flips status → 'paid' and stores paidDate
 *   - appends a matching expense transaction
 *   - debits the linked account by amountCents
 * Returns unchanged data if the payable id is unknown (no throw).
 */
export function markPayablePaid(data: FinanceData, payableId: string, paidDate: string): FinanceData {
  const payable = data.payables.find((p) => p.id === payableId)
  if (!payable) return data

  const updatedPayables = data.payables.map((p) =>
    p.id === payableId ? { ...p, status: 'paid' as const, paidDate } : p
  )

  const account = data.accounts.find((a) => a.id === payable.accountId)
  const accounts = account
    ? data.accounts.map((a) =>
        a.id === account.id ? { ...a, balanceCents: a.balanceCents - payable.amountCents } : a
      )
    : data.accounts

  const tx: Transaction = {
    id: newId('t'),
    householdId: HOUSEHOLD_ID,
    kind: 'expense',
    description: payable.description,
    amountCents: payable.amountCents,
    date: paidDate,
    accountId: payable.accountId,
    categoryId: payable.categoryId,
  }

  return withTransactions(withPayables(withAccounts(data, accounts), updatedPayables), [...data.transactions, tx])
}
