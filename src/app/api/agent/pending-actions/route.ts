import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import type { PendingAction, AppointmentStatus } from '@/lib/supabase/database.types'

/**
 * GET /api/agent/pending-actions
 * List undoable actions for the clinic
 */
export async function GET(_request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const supabase = await createTypedClient()

    // Get executed actions still within undo window
    const { data: actions, error } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('clinic_id', clinicId)
      .in('status', ['pending', 'executed'])
      .gt('undo_deadline', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      dbLogger.error('Error fetching pending actions', error)
      return NextResponse.json({ error: 'Failed to fetch actions' }, { status: 500 })
    }

    return NextResponse.json({ actions: actions || [] })
  } catch (error) {
    dbLogger.error('Error in GET /api/agent/pending-actions', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/agent/pending-actions
 * Undo a pending action
 *
 * Body: { action_id: string }
 */
export async function POST(_request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const body = await _request.json()
    const { action_id } = body

    if (!action_id) {
      return NextResponse.json({ error: 'action_id is required' }, { status: 400 })
    }

    const supabase = await createTypedClient() as any

    // Verify action belongs to this clinic and is undoable
    const { data: action, error: fetchError } = await supabase
      .from('pending_actions')
      .select('*')
      .eq('id', action_id)
      .eq('clinic_id', clinicId)
      .eq('status', 'executed')
      .single() as { data: PendingAction | null; error: null }

    if (fetchError || !action) {
      return NextResponse.json(
        { error: 'Action not found or not undoable' },
        { status: 404 }
      )
    }

    // Check if still within undo window
    if (new Date(action.undo_deadline) < new Date()) {
      return NextResponse.json(
        { error: 'Undo window has expired' },
        { status: 410 }
      )
    }

    const undoPayload = action.undo_payload || {}
    let restored: Record<string, unknown> = {}

    // Execute undo based on action type
    switch (action.action_type) {
      case 'cancel_appointment': {
        // Restore appointment status
        const before = action.snapshot_before as { appointment_id: string; status: AppointmentStatus }
        if (before?.appointment_id && before?.status) {
          await (supabase
            .from('appointments') as any)
            .update({ status: before.status })
            .eq('id', before.appointment_id)
          restored = { appointment_id: before.appointment_id, status: before.status }
        }
        break
      }
      case 'book_appointment': {
        // Cancel the booked appointment
        if (action.appointment_id) {
          await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', action.appointment_id)
          restored = { appointment_id: action.appointment_id, status: 'cancelled' }
        }
        break
      }
      default:
        restored = (undoPayload || {}) as Record<string, unknown>
    }

    // Mark as undone
    await supabase
      .from('pending_actions')
      .update({
        status: 'undone',
        undone_at: new Date().toISOString(),
      })
      .eq('id', action_id)

    dbLogger.info('Action undone', { actionId: action_id, type: action.action_type })

    return NextResponse.json({
      undone: true,
      restored,
      action_type: action.action_type,
    })
  } catch (error) {
    dbLogger.error('Error in POST /api/agent/pending-actions', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
