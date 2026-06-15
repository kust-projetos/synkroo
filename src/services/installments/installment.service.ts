/** Installment Service — migrated to Drizzle */
import { eq, and, asc, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgetInstallments, budgets } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export type InstallmentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface BudgetInstallment {
  id?: string; budget_id: string; amount: number; due_date: string
  status: InstallmentStatus; paid_at?: string | null; payment_id?: string | null
  created_at?: string; updated_at?: string
}

export interface CreateInstallmentInput { budget_id: string; amount: number; due_date: string }
export interface UpdateInstallmentInput { amount?: number; due_date?: string }

const BI = budgetInstallments

function toSnake(r: any): BudgetInstallment {
  return {
    id: r.id, budget_id: r.budgetId, amount: Number(r.amount ?? 0),
    due_date: r.dueDate?.toISOString?.() ?? r.dueDate ?? '',
    status: r.status as InstallmentStatus,
    paid_at: r.paidAt?.toISOString?.() ?? null, payment_id: r.paymentId ?? null,
    created_at: r.createdAt?.toISOString?.() ?? '', updated_at: r.updatedAt?.toISOString?.() ?? '',
  }
}

export async function createInstallments(budgetId: string, installments: CreateInstallmentInput[]): Promise<BudgetInstallment[]> {
  const db = getDb()
  const rows = installments.map((i) => ({ budgetId, amount: String(i.amount), dueDate: new Date(i.due_date), status: 'pending' }))
  const data = await db.insert(BI).values(rows as any).returning()
  return data.map(toSnake)
}

export async function getInstallmentsByBudget(budgetId: string): Promise<BudgetInstallment[]> {
  const db = getDb()
  const rows = await db.select().from(BI).where(eq(BI.budgetId, budgetId)).orderBy(asc(BI.dueDate))
  const now = new Date()
  return rows.map((r) => {
    const inst = toSnake(r)
    if (inst.status === 'paid' || inst.status === 'cancelled') return inst
    if (new Date(inst.due_date) < now) return { ...inst, status: 'overdue' as InstallmentStatus }
    return inst
  })
}

export async function updateInstallment(id: string, input: UpdateInstallmentInput): Promise<BudgetInstallment | null> {
  const db = getDb()
  const [existing] = await db.select({ status: BI.status }).from(BI).where(eq(BI.id, id))
  if (existing && existing.status === 'paid') throw new Error('Cannot update a paid installment')

  const set: any = { updatedAt: new Date() }
  if (input.amount !== undefined) set.amount = String(input.amount)
  if (input.due_date !== undefined) set.dueDate = new Date(input.due_date)

  const [data] = await db.update(BI).set(set).where(eq(BI.id, id)).returning()
  return data ? toSnake(data) : null
}

export async function deleteInstallment(id: string): Promise<boolean> {
  const db = getDb()
  const [existing] = await db.select({ status: BI.status }).from(BI).where(eq(BI.id, id))
  if (existing && existing.status === 'paid') throw new Error('Cannot delete a paid installment')
  await db.delete(BI).where(eq(BI.id, id))
  return true
}

export async function markInstallmentPaid(id: string, paymentId: string): Promise<BudgetInstallment | null> {
  const db = getDb()
  const now = new Date()
  const [data] = await db.update(BI).set({ status: 'paid', paidAt: now, paymentId, updatedAt: now } as any).where(eq(BI.id, id)).returning()
  return data ? toSnake(data) : null
}

export async function getRemainingBalance(budgetId: string): Promise<number> {
  const db = getDb()
  const [budget] = await db.select({ finalValue: budgets.finalValue }).from(budgets).where(eq(budgets.id, budgetId))
  if (!budget) return 0

  const paid = await db.select({ amount: BI.amount }).from(BI).where(and(eq(BI.budgetId, budgetId), eq(BI.status, 'paid')))
  const paidSum = paid.reduce((s, i) => s + Number(i.amount ?? 0), 0)
  return Math.max(0, Number(budget.finalValue ?? 0) - paidSum)
}
