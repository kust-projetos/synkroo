/**
 * Pending Actions Service with Undo/Rollback Support
 * Tracks agent actions that can be undone within a configurable time window.
 * Used for high-risk operations like appointment cancellations and reschedules.
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface PendingAction {
  id: string
  clinic_id: string
  conversation_id: string | null
  patient_id: string | null
  appointment_id: string | null
  action_type: string
  risk_score: number
  risk_level: string
  status: 'pending' | 'executed' | 'undone' | 'expired'
  snapshot_before: Record<string, unknown>
  snapshot_after: Record<string, unknown>
  undo_payload: Record<string, unknown>
  confirmation_count: number
  max_confirmations: number
  confirmed_at: string | null
  undo_deadline: string
  undone_at: string | null
  reasoning: string | null
  agent_intent: string | null
  confidence: number | null
  created_at: string
  updated_at: string
}

export interface CreatePendingActionParams {
  clinicId: string
  conversationId?: string
  patientId?: string
  appointmentId?: string
  actionType: string
  riskScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  snapshotBefore?: Record<string, unknown>
  snapshotAfter?: Record<string, unknown>
  undoPayload?: Record<string, unknown>
  undoWindowMinutes?: number
  maxConfirmations?: number
  reasoning?: string
  agentIntent?: string
  confidence?: number
}

const DEFAULT_UNDO_WINDOW_MINUTES = 5

export class PendingActionsService {
  /**
   * Create a new pending action with an undo deadline.
   */
  async createAction(params: CreatePendingActionParams): Promise<PendingAction> {
    const supabase = await createTypedClient()
    const undoWindow = params.undoWindowMinutes ?? DEFAULT_UNDO_WINDOW_MINUTES
    const undoDeadline = new Date(Date.now() + undoWindow * 60_000).toISOString()

    const { data, error } = await (supabase
      .from('pending_actions') as any)
      .insert({
        clinic_id: params.clinicId,
        conversation_id: params.conversationId ?? null,
        patient_id: params.patientId ?? null,
        appointment_id: params.appointmentId ?? null,
        action_type: params.actionType,
        risk_score: params.riskScore,
        risk_level: params.riskLevel,
        status: 'pending',
        snapshot_before: params.snapshotBefore ?? {},
        snapshot_after: params.snapshotAfter ?? {},
        undo_payload: params.undoPayload ?? {},
        max_confirmations: params.maxConfirmations ?? 1,
        undo_deadline: undoDeadline,
        reasoning: params.reasoning ?? null,
        agent_intent: params.agentIntent ?? null,
        confidence: params.confidence ?? null,
      })
      .select()
      .single()

    if (error) {
      dbLogger.error('Failed to create pending action', error, {
        actionType: params.actionType,
        clinicId: params.clinicId,
      })
      throw error
    }

    dbLogger.info('Pending action created', {
      actionId: (data as any).id,
      actionType: params.actionType,
      undoDeadline,
    })

    return data as PendingAction
  }

  /**
   * Confirm a pending action. Returns whether the action is fully confirmed
   * or needs additional confirmations.
   */
  async confirmAction(actionId: string): Promise<{ confirmed: boolean; requiresMore: boolean }> {
    const supabase = await createTypedClient()

    const { data: action, error: fetchError } = await supabase
      .from('pending_actions')
      .select('confirmation_count, max_confirmations')
      .eq('id', actionId)
      .single()

    if (fetchError || !action) {
      dbLogger.error('Failed to fetch action for confirmation', fetchError, { actionId })
      throw fetchError
    }

    const currentCount = (action as any).confirmation_count as number
    const maxConfirmations = (action as any).max_confirmations as number
    const newCount = currentCount + 1
    const isFullyConfirmed = newCount >= maxConfirmations

    const updateData: Record<string, unknown> = {
      confirmation_count: newCount,
      updated_at: new Date().toISOString(),
    }
    if (isFullyConfirmed) {
      updateData.confirmed_at = new Date().toISOString()
    }

    const { error: updateError } = await (supabase
      .from('pending_actions') as any)
      .update(updateData)
      .eq('id', actionId)

    if (updateError) {
      dbLogger.error('Failed to update confirmation count', updateError, { actionId })
      throw updateError
    }

    return { confirmed: isFullyConfirmed, requiresMore: !isFullyConfirmed }
  }

  /**
   * Mark a confirmed action as executed. Returns the undo deadline
   * so the caller can communicate the window to the patient.
   */
  async executeAction(actionId: string): Promise<{ executed: boolean; undoDeadline: Date }> {
    const supabase = await createTypedClient()

    const { data, error } = await (supabase
      .from('pending_actions') as any)
      .update({
        status: 'executed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('status', 'pending')
      .select('undo_deadline')
      .single()

    if (error || !data) {
      dbLogger.error('Failed to execute action', error, { actionId })
      return { executed: false, undoDeadline: new Date(0) }
    }

    return { executed: true, undoDeadline: new Date((data as any).undo_deadline) }
  }

  /**
   * Undo an executed action if still within the undo window.
   * Returns the undo payload so the caller can restore previous state.
   */
  async undoAction(actionId: string): Promise<{ undone: boolean; restored: Record<string, unknown> }> {
    const supabase = await createTypedClient()

    const { data: action, error: fetchError } = await supabase
      .from('pending_actions')
      .select('status, undo_deadline, undo_payload')
      .eq('id', actionId)
      .single()

    if (fetchError || !action) {
      dbLogger.error('Failed to fetch action for undo', fetchError, { actionId })
      return { undone: false, restored: {} }
    }

    const row = action as any
    if (row.status !== 'executed') {
      dbLogger.warn('Cannot undo action: not in executed state', { actionId, status: row.status })
      return { undone: false, restored: {} }
    }

    if (new Date(row.undo_deadline) <= new Date()) {
      dbLogger.warn('Cannot undo action: undo deadline has passed', {
        actionId,
        deadline: row.undo_deadline,
      })
      return { undone: false, restored: {} }
    }

    const { error: updateError } = await (supabase
      .from('pending_actions') as any)
      .update({
        status: 'undone',
        undone_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)

    if (updateError) {
      dbLogger.error('Failed to mark action as undone', updateError, { actionId })
      return { undone: false, restored: {} }
    }

    dbLogger.info('Action undone successfully', { actionId })

    return { undone: true, restored: row.undo_payload as Record<string, unknown> }
  }

  /**
   * Expire all executed actions whose undo deadline has passed.
   * Returns the number of actions expired.
   */
  async expireOldActions(): Promise<number> {
    const supabase = await createTypedClient()

    const { data, error } = await (supabase
      .from('pending_actions') as any)
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'executed')
      .lt('undo_deadline', new Date().toISOString())
      .select('id')

    if (error) {
      dbLogger.error('Failed to expire old actions', error)
      return 0
    }

    const count = data?.length ?? 0
    if (count > 0) {
      dbLogger.info('Expired old actions', { count })
    }

    return count
  }

  /**
   * Get all pending and executed actions for a conversation.
   */
  async getPendingForConversation(conversationId: string): Promise<PendingAction[]> {
    const supabase = await createTypedClient()

    const { data, error } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('conversation_id', conversationId)
      .in('status', ['pending', 'executed'])
      .order('created_at', { ascending: false })

    if (error) {
      dbLogger.error('Failed to get pending actions for conversation', error, { conversationId })
      return []
    }

    return (data ?? []) as PendingAction[]
  }

  /**
   * Get executed actions still within the undo window for a patient.
   */
  async getUndoableActions(patientId: string): Promise<PendingAction[]> {
    const supabase = await createTypedClient()

    const { data, error } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'executed')
      .gt('undo_deadline', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      dbLogger.error('Failed to get undoable actions for patient', error, { patientId })
      return []
    }

    return (data ?? []) as PendingAction[]
  }
}

export const pendingActionsService = new PendingActionsService()
