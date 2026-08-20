/** Payment Service — migrated to Drizzle */
import { eq, and, inArray, asc, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgets, budgetInstallments, payments, treatmentPlans, treatmentPlanItems } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'
import { getRemainingBalance } from '@/services/installments/installment.service'
import { updateSessionProgress } from '@/services/treatment-plans/treatment-plan.service'

export interface Payment {
  id?: string
  budget_id: string | null
  amount: number
  payment_method: string
  paid_at: string
  notes: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export interface RecordPaymentInput {
  budget_id: string
  amount: number
  payment_method: string
  notes?: string
  created_by: string
}

export interface PaymentResult {
  payment: Payment
  sessions_completed: number
  remaining_balance: number
}

function toSnake(r: any): Payment {
  return {
    id: r.id,
    budget_id: r.budgetId,
    amount: Number(r.amount ?? 0),
    payment_method: r.paymentMethod,
    paid_at: r.paidAt?.toISOString?.() ?? '',
    notes: r.notes,
    created_by: r.createdBy,
    created_at: r.createdAt?.toISOString?.() ?? '',
    updated_at: r.updatedAt?.toISOString?.() ?? '',
  }
}

async function getSessionCost(budgetId: string): Promise<number | null> {
  const db = getDb()
  const [budget] = await db
    .select({ finalValue: budgets.finalValue, treatmentPlanId: budgets.treatmentPlanId })
    .from(budgets)
    .where(eq(budgets.id, budgetId))

  if (!budget || !budget.treatmentPlanId) return null

  const [plan] = await db
    .select({ totalSessions: treatmentPlans.totalSessions })
    .from(treatmentPlans)
    .where(eq(treatmentPlans.id, budget.treatmentPlanId))

  if (!plan) return null
  const totalSessions = plan.totalSessions || 1
  return Number(budget.finalValue ?? 0) / totalSessions
}

async function autoCompleteSessions(
  treatmentPlanId: string,
  sessionsToComplete: number,
): Promise<number> {
  if (sessionsToComplete <= 0) return 0

  const db = getDb()
  const items = await db
    .select({ id: treatmentPlanItems.id })
    .from(treatmentPlanItems)
    .where(
      and(
        eq(treatmentPlanItems.treatmentPlanId, treatmentPlanId),
        eq(treatmentPlanItems.status as any, 'pending'),
      ),
    )
    .orderBy(asc(treatmentPlanItems.sessionNumber))
    .limit(sessionsToComplete)

  let completed = 0
  for (const item of items) {
    const result = await updateSessionProgress(item.id, treatmentPlanId)
    if (result) completed++
  }
  return completed
}

async function checkAndUpdateBudgetStatus(budgetId: string): Promise<void> {
  const db = getDb()
  const [budget] = await db
    .select({ finalValue: budgets.finalValue })
    .from(budgets)
    .where(eq(budgets.id, budgetId))
  if (!budget) return

  const installments = await db
    .select({ amount: budgetInstallments.amount, status: budgetInstallments.status })
    .from(budgetInstallments)
    .where(eq(budgetInstallments.budgetId, budgetId))
  if (!installments.length) return

  const totalPaid = installments
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0)

  if (totalPaid >= Number(budget.finalValue ?? 0)) {
    await db
      .update(budgets)
      .set({ status: 'converted', updatedAt: new Date() } as any)
      .where(eq(budgets.id, budgetId))
  }
}

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentResult> {
  const db = getDb()
  const remainingBalance = await getRemainingBalance(input.budget_id)

  if (input.amount > remainingBalance) {
    throw new Error(
      `Payment amount (${input.amount}) exceeds remaining balance (${remainingBalance})`,
    )
  }

  const now = new Date().toISOString()
  const [paymentRow] = await db
    .insert(payments)
    .values({
      budgetId: input.budget_id,
      amount: String(input.amount),
      paymentMethod: input.payment_method,
      paidAt: new Date(),
      notes: input.notes ?? null,
      createdBy: input.created_by,
    } as any)
    .returning()

  if (!paymentRow) {
    dbLogger.error('Error creating payment — no row returned')
    throw new Error('Failed to record payment')
  }

  let sessionsCompleted = 0
  const sessionCost = await getSessionCost(input.budget_id)

  if (sessionCost && sessionCost > 0) {
    const sessionsToComplete = Math.floor(input.amount / sessionCost)
    const [budgetData] = await db
      .select({ treatmentPlanId: budgets.treatmentPlanId })
      .from(budgets)
      .where(eq(budgets.id, input.budget_id))

    if (budgetData?.treatmentPlanId) {
      sessionsCompleted = await autoCompleteSessions(
        budgetData.treatmentPlanId,
        sessionsToComplete,
      )
    }
  }

  await checkAndUpdateBudgetStatus(input.budget_id)
  const newRemainingBalance = await getRemainingBalance(input.budget_id)

  return {
    payment: {
      id: paymentRow.id,
      budget_id: input.budget_id,
      amount: input.amount,
      payment_method: input.payment_method,
      paid_at: now,
      notes: input.notes ?? null,
      created_by: input.created_by,
    },
    sessions_completed: sessionsCompleted,
    remaining_balance: newRemainingBalance,
  }
}

export async function getPaymentsByBudget(budgetId: string): Promise<Payment[]> {
  const db = getDb()
  try {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.budgetId, budgetId))
      .orderBy(desc(payments.paidAt))
    return rows.map(toSnake)
  } catch (e) {
    dbLogger.error('Error fetching payments by budget', e)
    return []
  }
}

export async function getPaymentsByPatient(patientId: string): Promise<Payment[]> {
  const db = getDb()
  try {
    const budgetRows = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(eq(budgets.patientId, patientId))
    if (!budgetRows.length) return []

    const budgetIds = budgetRows.map((b) => b.id)
    const rows = await db
      .select()
      .from(payments)
      .where(inArray(payments.budgetId, budgetIds))
      .orderBy(desc(payments.paidAt))
    return rows.map(toSnake)
  } catch (e) {
    dbLogger.error('Error fetching payments by patient', e)
    return []
  }
}
