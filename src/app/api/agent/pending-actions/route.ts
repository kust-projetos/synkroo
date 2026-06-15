import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray, gt, desc } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { pendingActions, appointments } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export async function GET() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id; const db = getDb()
    const rows = await db.select().from(pendingActions).where(and(eq(pendingActions.clinicId, clinicId), inArray(pendingActions.status as any, ['pending', 'executed']), gt(pendingActions.undoDeadline, new Date()))).orderBy(desc(pendingActions.createdAt))
    const actions = rows.map(r => ({
      id: r.id, clinic_id: r.clinicId, conversation_id: r.conversationId, patient_id: r.patientId, appointment_id: r.appointmentId,
      action_type: r.actionType, risk_score: r.riskScore, risk_level: r.riskLevel, status: r.status,
      snapshot_before: r.snapshotBefore, snapshot_after: r.snapshotAfter, undo_payload: r.undoPayload,
      confirmation_count: r.confirmationCount, max_confirmations: r.maxConfirmations, confirmed_at: r.confirmedAt?.toISOString?.() ?? null,
      undo_deadline: r.undoDeadline?.toISOString?.() ?? r.undoDeadline ?? '', undone_at: r.undoneAt?.toISOString?.() ?? null,
      reasoning: r.reasoning, agent_intent: r.agentIntent, confidence: r.confidence ? Number(r.confidence) : null,
      created_at: r.createdAt?.toISOString?.() ?? '', updated_at: r.updatedAt?.toISOString?.() ?? '',
    }))
    return NextResponse.json({ actions })
  } catch (e) { dbLogger.error('Error in GET pending-actions', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id; const db = getDb()
    const body = await request.json() as Record<string,any>
    if (!body.action_id) return NextResponse.json({ error: 'action_id is required' }, { status: 400 })
    const [action] = await db.select().from(pendingActions).where(and(eq(pendingActions.id, body.action_id), eq(pendingActions.clinicId, clinicId), eq(pendingActions.status as any, 'executed')))
    if (!action) return NextResponse.json({ error: 'Action not found or not undoable' }, { status: 404 })
    if (!action.undoDeadline || new Date(action.undoDeadline) < new Date()) return NextResponse.json({ error: 'Undo window has expired' }, { status: 410 })

    let restored: Record<string,unknown> = {}
    switch (action.actionType) {
      case 'cancel_appointment': {
        const before = (action.snapshotBefore as any) || {}
        if (before.appointment_id && before.status) {
          await db.update(appointments).set({ status: before.status } as any).where(eq(appointments.id, before.appointment_id))
          restored = { appointment_id: before.appointment_id, status: before.status }
        }
        break
      }
      case 'book_appointment': {
        if (action.appointmentId) {
          await db.update(appointments).set({ status: 'cancelled' } as any).where(eq(appointments.id, action.appointmentId))
          restored = { appointment_id: action.appointmentId, status: 'cancelled' }
        }
        break
      }
      default: restored = (action.undoPayload as Record<string,unknown>) || {}
    }
    await db.update(pendingActions).set({ status: 'undone', undoneAt: new Date() } as any).where(eq(pendingActions.id, body.action_id))
    dbLogger.info('Action undone', { actionId: body.action_id, type: action.actionType })
    return NextResponse.json({ undone: true, restored, action_type: action.actionType })
  } catch (e) { dbLogger.error('Error in POST pending-actions', e); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}
