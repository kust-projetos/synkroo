/**
 * Treatment Plan Service
 * Handles dental treatment plans with progress tracking
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export type TreatmentPlanStatus = 'active' | 'completed' | 'cancelled' | 'paused'
export type TreatmentPlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface TreatmentPlanItem {
  id?: string
  treatment_plan_id?: string
  procedure_id?: string | null
  procedure_name: string
  session_number: number
  appointment_id?: string | null
  status: TreatmentPlanItemStatus
  scheduled_at?: string | null
  completed_at?: string | null
  notes?: string | null
  created_at?: string
}

export interface TreatmentPlan {
  id?: string
  clinic_id: string
  patient_id: string
  title: string
  description?: string | null
  total_sessions: number
  completed_sessions: number
  status: TreatmentPlanStatus
  started_at?: string | null
  expected_completion_at?: string | null
  completed_at?: string | null
  last_session_at?: string | null
  next_session_due_at?: string | null
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  items?: TreatmentPlanItem[]
  patient?: {
    id: string
    name: string
    phone: string
  }
}

export interface CreateTreatmentPlanInput {
  clinic_id: string
  patient_id: string
  title: string
  description?: string
  total_sessions: number
  started_at?: string
  expected_completion_at?: string
  notes?: string
  created_by?: string
  items: Omit<TreatmentPlanItem, 'id' | 'treatment_plan_id' | 'created_at'>[]
}

export interface UpdateTreatmentPlanInput {
  title?: string
  description?: string
  status?: TreatmentPlanStatus
  total_sessions?: number
  expected_completion_at?: string
  notes?: string
}

export interface TreatmentPlanProgress {
  totalSessions: number
  completedSessions: number
  percent: number
}

/**
 * Create a new treatment plan with items
 */
export async function createTreatmentPlan(input: CreateTreatmentPlanInput): Promise<TreatmentPlan> {
  const supabase = await createTypedClient()

  // Create treatment plan
  const { data: plan, error: planError } = await (supabase
    .from('treatment_plans') as any)
    .insert({
      clinic_id: input.clinic_id,
      patient_id: input.patient_id,
      title: input.title,
      description: input.description,
      total_sessions: input.total_sessions,
      completed_sessions: 0,
      status: 'active',
      started_at: input.started_at,
      expected_completion_at: input.expected_completion_at,
      notes: input.notes,
      created_by: input.created_by,
    })
    .select()
    .single()

  if (planError || !plan) {
    dbLogger.error('Error creating treatment plan', planError)
    throw new Error('Failed to create treatment plan')
  }

  // Create treatment plan items
  if (input.items.length > 0) {
    const items = input.items.map((item, index) => ({
      treatment_plan_id: (plan as any).id,
      procedure_id: item.procedure_id,
      procedure_name: item.procedure_name,
      session_number: item.session_number || index + 1,
      appointment_id: item.appointment_id,
      status: item.status || 'pending',
      scheduled_at: item.scheduled_at,
      notes: item.notes,
    }))

    const { data: createdItems, error: itemsError } = await (supabase
      .from('treatment_plan_items') as any)
      .insert(items)
      .select()

    if (itemsError) {
      dbLogger.error('Error creating treatment plan items', itemsError)
      // Cleanup on failure
      await supabase.from('treatment_plans').delete().eq('id', (plan as any).id)
      throw new Error('Failed to create treatment plan items')
    }

    return {
      ...plan,
      items: createdItems as TreatmentPlanItem[],
    }
  }

  return plan as TreatmentPlan
}

/**
 * Get treatment plans by patient with progress
 */
export async function getTreatmentPlansByPatient(
  patientId: string,
  clinicId: string
): Promise<TreatmentPlan[]> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('treatment_plans')
    .select(`
      *,
      patients (id, name, phone),
      treatment_plan_items (*)
    `)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) {
    dbLogger.error('Error fetching treatment plans', error)
    return []
  }

  return data as TreatmentPlan[]
}

/**
 * Get single treatment plan by ID with items
 */
export async function getTreatmentPlanById(treatmentPlanId: string): Promise<TreatmentPlan | null> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('treatment_plans')
    .select(`
      *,
      patients (id, name, phone),
      treatment_plan_items (*)
    `)
    .eq('id', treatmentPlanId)
    .single()

  if (error) {
    dbLogger.error('Error fetching treatment plan', error)
    return null
  }

  return data as TreatmentPlan
}

/**
 * Update treatment plan
 */
export async function updateTreatmentPlan(
  treatmentPlanId: string,
  input: UpdateTreatmentPlanInput
): Promise<TreatmentPlan | null> {
  const supabase = await createTypedClient()

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.title !== undefined) updateData.title = input.title
  if (input.description !== undefined) updateData.description = input.description
  if (input.status !== undefined) {
    updateData.status = input.status
    if (input.status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }
  }
  if (input.total_sessions !== undefined) updateData.total_sessions = input.total_sessions
  if (input.expected_completion_at !== undefined) updateData.expected_completion_at = input.expected_completion_at
  if (input.notes !== undefined) updateData.notes = input.notes

  const { data, error } = await (supabase
    .from('treatment_plans') as any)
    .update(updateData)
    .eq('id', treatmentPlanId)
    .select()
    .single()

  if (error) {
    dbLogger.error('Error updating treatment plan', error)
    return null
  }

  return data as TreatmentPlan
}

/**
 * Update session/progress for a treatment plan item
 */
export async function updateSessionProgress(
  treatmentPlanItemId: string
): Promise<TreatmentPlanItem | null> {
  const supabase = await createTypedClient()

  const now = new Date().toISOString()

  // Update the item
  const { data: item, error: itemError } = await (supabase
    .from('treatment_plan_items') as any)
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    })
    .eq('id', treatmentPlanItemId)
    .select()
    .single()

  if (itemError || !item) {
    dbLogger.error('Error updating treatment plan item', itemError)
    return null
  }

  // Get the treatment plan to update progress
  const { data: plan, error: planError } = await supabase
    .from('treatment_plans')
    .select('id, completed_sessions, total_sessions')
    .eq('id', (item as any).treatment_plan_id)
    .single()

  if (planError || !plan) {
    dbLogger.error('Error fetching treatment plan for progress update', planError)
    return item as TreatmentPlanItem
  }

  // Update completed sessions count
  const { error: updateError } = await (supabase
    .from('treatment_plans') as any)
    .update({
      completed_sessions: (plan as any).completed_sessions + 1,
      last_session_at: now,
      updated_at: now,
    })
    .eq('id', (plan as any).id)

  if (updateError) {
    dbLogger.error('Error updating treatment plan progress', updateError)
  }

  // Check if all sessions are complete
  const newCompletedCount = (plan as any).completed_sessions + 1
  if (newCompletedCount >= (plan as any).total_sessions) {
    await (supabase
      .from('treatment_plans') as any)
      .update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      .eq('id', (plan as any).id)
  }

  return item as TreatmentPlanItem
}

/**
 * Get treatment plan progress aggregate
 */
export async function getTreatmentPlanProgress(
  treatmentPlanId: string
): Promise<TreatmentPlanProgress> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('treatment_plans')
    .select('total_sessions, completed_sessions')
    .eq('id', treatmentPlanId)
    .single()

  if (error || !data) {
    return { totalSessions: 0, completedSessions: 0, percent: 0 }
  }

  const totalSessions = (data as any).total_sessions || 0
  const completedSessions = (data as any).completed_sessions || 0
  const percent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0

  return { totalSessions, completedSessions, percent }
}

/**
 * Delete treatment plan (cascades to items)
 */
export async function deleteTreatmentPlan(treatmentPlanId: string): Promise<boolean> {
  const supabase = await createTypedClient()

  // Delete items first (in case cascade doesn't work)
  await supabase.from('treatment_plan_items').delete().eq('treatment_plan_id', treatmentPlanId)

  const { error } = await supabase.from('treatment_plans').delete().eq('id', treatmentPlanId)

  return !error
}