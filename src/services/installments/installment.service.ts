/**
 * Installment Service
 * Handles budget installment management
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export type InstallmentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface BudgetInstallment {
  id?: string
  budget_id: string
  amount: number
  due_date: string
  status: InstallmentStatus
  paid_at?: string | null
  payment_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface CreateInstallmentInput {
  budget_id: string
  amount: number
  due_date: string
}

export interface UpdateInstallmentInput {
  amount?: number
  due_date?: string
}

/**
 * Create multiple installments for a budget (batch create per D-08)
 */
export async function createInstallments(
  budgetId: string,
  installments: CreateInstallmentInput[]
): Promise<BudgetInstallment[]> {
  const supabase = await createTypedClient()

  const installmentsData = installments.map((inst) => ({
    budget_id: budgetId,
    amount: inst.amount,
    due_date: inst.due_date,
    status: 'pending' as InstallmentStatus,
  }))

  const { data, error } = await (supabase
    .from('budget_installments') as any)
    .insert(installmentsData)
    .select()

  if (error) {
    dbLogger.error('Error creating installments', error)
    throw new Error('Failed to create installments')
  }

  return data as BudgetInstallment[]
}

/**
 * Get installments by budget ID with status
 */
export async function getInstallmentsByBudget(budgetId: string): Promise<BudgetInstallment[]> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('budget_installments')
    .select('*')
    .eq('budget_id', budgetId)
    .order('due_date', { ascending: true })

  if (error) {
    dbLogger.error('Error fetching installments', error)
    return []
  }

  // Calculate current status based on date and paid status
  const now = new Date()
  return (data as BudgetInstallment[]).map((inst) => {
    if (inst.status === 'paid') return inst
    if (inst.status === 'cancelled') return inst
    if (new Date(inst.due_date) < now) {
      return { ...inst, status: 'overdue' as InstallmentStatus }
    }
    return inst
  })
}

/**
 * Update installment (amount/due_date) before it is paid
 */
export async function updateInstallment(
  id: string,
  input: UpdateInstallmentInput
): Promise<BudgetInstallment | null> {
  const supabase = await createTypedClient()

  // Check if installment is already paid
  const { data: existing } = await supabase
    .from('budget_installments')
    .select('status')
    .eq('id', id)
    .single()

  if (existing && (existing as any).status === 'paid') {
    throw new Error('Cannot update a paid installment')
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.amount !== undefined) updateData.amount = input.amount
  if (input.due_date !== undefined) updateData.due_date = input.due_date

  const { data, error } = await (supabase
    .from('budget_installments') as any)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    dbLogger.error('Error updating installment', error)
    return null
  }

  return data as BudgetInstallment
}

/**
 * Delete unpaid installment
 */
export async function deleteInstallment(id: string): Promise<boolean> {
  const supabase = await createTypedClient()

  // Check if installment is already paid
  const { data: existing } = await supabase
    .from('budget_installments')
    .select('status')
    .eq('id', id)
    .single()

  if (existing && (existing as any).status === 'paid') {
    throw new Error('Cannot delete a paid installment')
  }

  const { error } = await supabase
    .from('budget_installments')
    .delete()
    .eq('id', id)

  if (error) {
    dbLogger.error('Error deleting installment', error)
    return false
  }

  return true
}

/**
 * Mark installment as paid, link payment
 */
export async function markInstallmentPaid(
  id: string,
  paymentId: string
): Promise<BudgetInstallment | null> {
  const supabase = await createTypedClient()

  const now = new Date().toISOString()

  const { data, error } = await (supabase
    .from('budget_installments') as any)
    .update({
      status: 'paid',
      paid_at: now,
      payment_id: paymentId,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    dbLogger.error('Error marking installment as paid', error)
    return null
  }

  return data as BudgetInstallment
}

/**
 * Get remaining balance for a budget
 * Calculates: budget.final_value - sum(paid installments)
 */
export async function getRemainingBalance(budgetId: string): Promise<number> {
  const supabase = await createTypedClient()

  // Get budget final value
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('final_value')
    .eq('id', budgetId)
    .single()

  if (budgetError || !budget) {
    dbLogger.error('Error fetching budget for remaining balance', budgetError)
    return 0
  }

  // Get sum of paid installments
  const { data: paidInstallments, error: installmentsError } = await supabase
    .from('budget_installments')
    .select('amount')
    .eq('budget_id', budgetId)
    .eq('status', 'paid')

  if (installmentsError) {
    dbLogger.error('Error fetching paid installments', installmentsError)
    return (budget as any).final_value || 0
  }

  const paidSum = (paidInstallments as BudgetInstallment[]).reduce(
    (sum, inst) => sum + inst.amount,
    0
  )

  return Math.max(0, ((budget as any).final_value || 0) - paidSum)
}
