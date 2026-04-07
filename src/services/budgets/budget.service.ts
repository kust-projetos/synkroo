/**
 * Budget Service
 * Handles dental treatment quotes/budgets management
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import type { Json } from '@/lib/supabase/database.types'

export type BudgetStatus = 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'

export interface BudgetItem {
  id?: string
  budget_id?: string
  procedure_id?: string | null
  procedure_name: string
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
  notes?: string | null
}

export interface Budget {
  id?: string
  clinic_id: string
  patient_id: string
  appointment_id?: string | null
  title?: string | null
  description?: string | null
  total_value: number
  discount_percent: number
  discount_value: number
  final_value: number
  status: BudgetStatus
  valid_until?: string | null
  sent_at?: string | null
  responded_at?: string | null
  converted_at?: string | null
  conversion_appointment_id?: string | null
  notes?: string | null
  follow_up_sequence: number
  next_follow_up_at?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  items?: BudgetItem[]
  patient?: {
    id: string
    name: string
    phone: string
  }
}

export interface CreateBudgetInput {
  clinic_id: string
  patient_id: string
  appointment_id?: string
  title?: string
  description?: string
  items: Omit<BudgetItem, 'id' | 'budget_id'>[]
  discount_percent?: number
  discount_value?: number
  valid_until?: string
  notes?: string
  created_by?: string
}

export interface BudgetListFilters {
  clinic_id: string
  patient_id?: string
  status?: BudgetStatus
  from_date?: string
  to_date?: string
}

/**
 * Calculate budget totals from items
 */
export function calculateBudgetTotals(
  items: Pick<BudgetItem, 'quantity' | 'unit_price' | 'discount_percent'>[],
  discountPercent: number = 0
): { total_value: number; discount_value: number; final_value: number } {
  const total_value = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unit_price
    const itemDiscount = itemTotal * (item.discount_percent / 100)
    return sum + (itemTotal - itemDiscount)
  }, 0)

  const discount_value = total_value * (discountPercent / 100)
  const final_value = total_value - discount_value

  return {
    total_value: Math.round(total_value * 100) / 100,
    discount_value: Math.round(discount_value * 100) / 100,
    final_value: Math.round(final_value * 100) / 100,
  }
}

/**
 * Create a new budget with items
 */
export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const supabase = await createTypedClient()

  const { discount_percent = 0, discount_value = 0 } = input
  const totals = calculateBudgetTotals(input.items, discount_percent)

  // Create budget
  const { data: budget, error: budgetError } = await (supabase
    .from('budgets') as any)
    .insert({
      clinic_id: input.clinic_id,
      patient_id: input.patient_id,
      appointment_id: input.appointment_id,
      title: input.title,
      description: input.description,
      total_value: totals.total_value,
      discount_percent: input.discount_percent || 0,
      discount_value: totals.discount_value,
      final_value: totals.final_value,
      status: 'pending',
      valid_until: input.valid_until,
      notes: input.notes,
      created_by: input.created_by,
    })
    .select()
    .single()

  if (budgetError || !budget) {
    dbLogger.error('Error creating budget', budgetError)
    throw new Error('Failed to create budget')
  }

  // Create budget items
  const budgetItems = input.items.map((item) => ({
    budget_id: (budget as any).id,
    procedure_id: item.procedure_id,
    procedure_name: item.procedure_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_percent: item.discount_percent || 0,
    total_price: item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100),
    notes: item.notes,
  }))

  const { data: items, error: itemsError } = await (supabase
    .from('budget_items') as any)
    .insert(budgetItems)
    .select()

  if (itemsError) {
    dbLogger.error('Error creating budget items', itemsError)
    // Try to cleanup the budget
    await supabase.from('budgets').delete().eq('id', budget.id)
    throw new Error('Failed to create budget items')
  }

  return {
    ...budget,
    items: items as BudgetItem[],
  }
}

/**
 * Get budget by ID with items
 */
export async function getBudgetById(budgetId: string): Promise<Budget | null> {
  const supabase = await createTypedClient()

  const { data: budget, error } = await supabase
    .from('budgets')
    .select(`
      *,
      patients (id, name, phone),
      budget_items (*)
    `)
    .eq('id', budgetId)
    .single()

  if (error) {
    dbLogger.error('Error fetching budget', error)
    return null
  }

  return budget as Budget
}

/**
 * List budgets with filters
 */
export async function listBudgets(filters: BudgetListFilters): Promise<Budget[]> {
  const supabase = await createTypedClient()

  let query = supabase
    .from('budgets')
    .select(`
      *,
      patients (id, name, phone),
      budget_items (*)
    `)
    .eq('clinic_id', filters.clinic_id)
    .order('created_at', { ascending: false })

  if (filters.patient_id) {
    query = query.eq('patient_id', filters.patient_id)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.from_date) {
    query = query.gte('created_at', filters.from_date)
  }

  if (filters.to_date) {
    query = query.lte('created_at', filters.to_date)
  }

  const { data, error } = await query

  if (error) {
    dbLogger.error('Error listing budgets', error)
    return []
  }

  return data as Budget[]
}

/**
 * Update budget status
 */
export async function updateBudgetStatus(
  budgetId: string,
  status: BudgetStatus,
  metadata?: {
    responded_at?: string
    converted_at?: string
    conversion_appointment_id?: string
    sent_at?: string
  }
): Promise<Budget | null> {
  const supabase = await createTypedClient()

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...metadata,
  }

  const { data, error } = await (supabase
    .from('budgets') as any)
    .update(updateData)
    .eq('id', budgetId)
    .select()
    .single()

  if (error) {
    dbLogger.error('Error updating budget status', error)
    return null
  }

  return data as Budget
}

/**
 * Mark budget as sent
 */
export async function markBudgetSent(budgetId: string): Promise<Budget | null> {
  return updateBudgetStatus(budgetId, 'sent', {
    sent_at: new Date().toISOString(),
  })
}

/**
 * Accept a budget
 */
export async function acceptBudget(budgetId: string): Promise<Budget | null> {
  return updateBudgetStatus(budgetId, 'accepted', {
    responded_at: new Date().toISOString(),
  })
}

/**
 * Reject a budget
 */
export async function rejectBudget(budgetId: string): Promise<Budget | null> {
  return updateBudgetStatus(budgetId, 'rejected', {
    responded_at: new Date().toISOString(),
  })
}

/**
 * Convert budget to appointment
 */
export async function convertBudgetToAppointment(
  budgetId: string,
  appointmentId: string
): Promise<Budget | null> {
  return updateBudgetStatus(budgetId, 'converted', {
    responded_at: new Date().toISOString(),
    converted_at: new Date().toISOString(),
    conversion_appointment_id: appointmentId,
  })
}

/**
 * Get budgets needing follow-up
 */
export async function getBudgetsNeedingFollowUp(clinicId: string): Promise<Budget[]> {
  const supabase = await createTypedClient()

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      patients (id, name, phone),
      budget_items (*)
    `)
    .eq('clinic_id', clinicId)
    .eq('status', 'sent')
    .lte('next_follow_up_at', now)
    .is('deleted_at', null)

  if (error) {
    dbLogger.error('Error fetching budgets for follow-up', error)
    return []
  }

  return data as Budget[]
}

/**
 * Schedule next follow-up
 */
export async function scheduleNextFollowUp(
  budgetId: string,
  daysFromNow: number = 3
): Promise<Budget | null> {
  const supabase = await createTypedClient()

  const nextFollowUp = new Date()
  nextFollowUp.setDate(nextFollowUp.getDate() + daysFromNow)

  const { data, error } = await (supabase
    .from('budgets') as any)
    .update({
      follow_up_sequence: 1, // Increment
      next_follow_up_at: nextFollowUp.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', budgetId)
    .select()
    .single()

  if (error) {
    dbLogger.error('Error scheduling follow-up', error)
    return null
  }

  return data as Budget
}

/**
 * Delete budget (soft delete by marking as expired or hard delete)
 */
export async function deleteBudget(budgetId: string, hardDelete: boolean = false): Promise<boolean> {
  const supabase = await createTypedClient()

  if (hardDelete) {
    // First delete items
    await supabase.from('budget_items').delete().eq('budget_id', budgetId)
    // Then delete budget
    const { error } = await supabase.from('budgets').delete().eq('id', budgetId)
    return !error
  }

  // Soft delete - mark as expired
  const { error } = await (supabase
    .from('budgets') as any)
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', budgetId)

  return !error
}

/**
 * Get budget statistics for dashboard
 */
export async function getBudgetStats(clinicId: string): Promise<{
  total: number
  pending: number
  sent: number
  accepted: number
  rejected: number
  converted: number
  total_value: number
  conversion_rate: number
}> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('budgets')
    .select('status, final_value')
    .eq('clinic_id', clinicId) as any

  if (error) {
    dbLogger.error('Error fetching budget stats', error)
    return {
      total: 0,
      pending: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      converted: 0,
      total_value: 0,
      conversion_rate: 0,
    }
  }

  const stats = {
    total: (data as any[])?.length || 0,
    pending: (data as any[])?.filter((b: any) => b.status === 'pending').length || 0,
    sent: (data as any[])?.filter((b: any) => b.status === 'sent').length || 0,
    accepted: (data as any[])?.filter((b: any) => b.status === 'accepted').length || 0,
    rejected: (data as any[])?.filter((b: any) => b.status === 'rejected').length || 0,
    converted: (data as any[])?.filter((b: any) => b.status === 'converted').length || 0,
    total_value: (data as any[])?.reduce((sum: number, b: any) => sum + (b.final_value || 0), 0) || 0,
    conversion_rate: 0,
  }

  // Calculate conversion rate (converted / (accepted + rejected + converted))
  const totalResponded = stats.accepted + stats.rejected + stats.converted
  stats.conversion_rate = totalResponded > 0 ? (stats.converted / totalResponded) * 100 : 0

  return stats
}