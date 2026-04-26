/**
 * Payment Service
 * Handles payment recording with auto-complete logic per D-09 and D-11
 */

import { createTypedClient } from '@/lib/supabase/typed'
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

/**
 * Get cost per session for a treatment plan
 * session_cost = budget.final_value / treatment_plan.total_sessions
 */
async function getSessionCost(budgetId: string): Promise<number | null> {
  const supabase = await createTypedClient()

  // Get budget with treatment plan
  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('final_value, treatment_plan_id')
    .eq('id', budgetId)
    .single()

  if (budgetError || !budget || !(budget as any).treatment_plan_id) {
    return null
  }

  const treatmentPlanId = (budget as any).treatment_plan_id

  // Get treatment plan total sessions
  const { data: plan, error: planError } = await supabase
    .from('treatment_plans')
    .select('total_sessions')
    .eq('id', treatmentPlanId)
    .single()

  if (planError || !plan) {
    return null
  }

  const totalSessions = (plan as any).total_sessions || 1
  return ((budget as any).final_value || 0) / totalSessions
}

/**
 * Auto-complete sessions based on payment amount
 * Formula: sessions_to_complete = floor(payment_amount / session_cost)
 * Completes sessions oldest-first via treatment_plan_items ordered by session_number ASC
 */
async function autoCompleteSessions(
  treatmentPlanId: string,
  sessionsToComplete: number
): Promise<number> {
  if (sessionsToComplete <= 0) return 0

  const supabase = await createTypedClient()

  // Get pending sessions ordered by session_number ASC
  const { data: pendingItems, error } = await supabase
    .from('treatment_plan_items')
    .select('id')
    .eq('treatment_plan_id', treatmentPlanId)
    .eq('status', 'pending')
    .order('session_number', { ascending: true })
    .limit(sessionsToComplete)

  if (error || !pendingItems || pendingItems.length === 0) {
    return 0
  }

  let completed = 0
  for (const item of pendingItems) {
    const result = await updateSessionProgress((item as any).id)
    if (result) {
      completed++
    }
  }

  return completed
}

/**
 * Record a payment with validation and auto-complete logic
 * Implements D-09 (auto-complete) and D-11 (budget status trigger)
 */
export async function recordPayment(input: RecordPaymentInput): Promise<PaymentResult> {
  const supabase = await createTypedClient()

  // Validate amount does not exceed remaining balance
  const remainingBalance = await getRemainingBalance(input.budget_id)
  if (input.amount > remainingBalance) {
    throw new Error(`Payment amount (${input.amount}) exceeds remaining balance (${remainingBalance})`)
  }

  // Create payment record
  const now = new Date().toISOString()

  const { data: payment, error: paymentError } = await (supabase
    .from('payments') as any)
    .insert({
      budget_id: input.budget_id,
      amount: input.amount,
      payment_method: input.payment_method,
      paid_at: now,
      notes: input.notes || null,
      created_by: input.created_by,
    })
    .select()
    .single()

  if (paymentError || !payment) {
    dbLogger.error('Error creating payment', paymentError)
    throw new Error('Failed to record payment')
  }

  // Trigger D-09: Auto-complete sessions if budget has treatment_plan_id
  let sessionsCompleted = 0
  const sessionCost = await getSessionCost(input.budget_id)

  if (sessionCost && sessionCost > 0) {
    const sessionsToComplete = Math.floor(input.amount / sessionCost)
    const budgetData = await supabase
      .from('budgets')
      .select('treatment_plan_id')
      .eq('id', input.budget_id)
      .single()

    if (budgetData.data && (budgetData.data as any).treatment_plan_id) {
      sessionsCompleted = await autoCompleteSessions(
        (budgetData.data as any).treatment_plan_id,
        sessionsToComplete
      )
    }
  }

  // Trigger D-11: Check if all installments are paid -> update budget status
  await checkAndUpdateBudgetStatus(input.budget_id)

  // Calculate new remaining balance
  const newRemainingBalance = await getRemainingBalance(input.budget_id)

  return {
    payment: payment as Payment,
    sessions_completed: sessionsCompleted,
    remaining_balance: newRemainingBalance,
  }
}

/**
 * Check if all installments are paid and update budget status
 * D-11: When all installments paid, budget status -> 'paid' or similar
 */
async function checkAndUpdateBudgetStatus(budgetId: string): Promise<void> {
  const supabase = await createTypedClient()

  // Get budget final value
  const { data: budget } = await supabase
    .from('budgets')
    .select('final_value')
    .eq('id', budgetId)
    .single()

  if (!budget) return

  // Get all installments
  const { data: installments } = await supabase
    .from('budget_installments')
    .select('amount, status')
    .eq('budget_id', budgetId)

  if (!installments || installments.length === 0) return

  // Get total paid amount
  const totalPaid = (installments as any[])
    .filter((inst) => inst.status === 'paid')
    .reduce((sum, inst) => sum + inst.amount, 0)

  // Check if fully paid
  if (totalPaid >= ((budget as any).final_value || 0)) {
    // Update budget status to indicate fully paid
    // Using 'converted' as the terminal paid status (per D-11)
    await (supabase
      .from('budgets') as any)
      .update({
        status: 'converted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', budgetId)
  }
}

/**
 * Get payments for a budget
 */
export async function getPaymentsByBudget(budgetId: string): Promise<Payment[]> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('budget_id', budgetId)
    .order('paid_at', { ascending: false })

  if (error) {
    dbLogger.error('Error fetching payments', error)
    return []
  }

  return data as Payment[]
}

/**
 * Get all payments for a patient
 */
export async function getPaymentsByPatient(patientId: string): Promise<Payment[]> {
  const supabase = await createTypedClient()

  // Get all budgets for the patient
  const { data: budgets, error: budgetsError } = await supabase
    .from('budgets')
    .select('id')
    .eq('patient_id', patientId)

  if (budgetsError || !budgets || budgets.length === 0) {
    return []
  }

  const budgetIds = (budgets as any[]).map((b) => b.id)

  // Get all payments for those budgets
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .in('budget_id', budgetIds)
    .order('paid_at', { ascending: false })

  if (paymentsError) {
    dbLogger.error('Error fetching patient payments', paymentsError)
    return []
  }

  return payments as Payment[]
}
