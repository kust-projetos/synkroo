import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients, conversationStates } from '@/lib/db/schema'
import { handleApiError } from '@/lib/errors'
import {
  processSchedulingRequest,
  createAppointmentFromContext,
  getAvailableSlots,
  SchedulerContext,
} from '@/services/scheduler/scheduler.service'

/**
 * POST /api/scheduler/chat
 * Handle scheduling conversation
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const body = await request.json()
    const { patientId, conversationId, message, confirmAppointment } = body

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Get or create conversation context
    let context: SchedulerContext = {
      clinicId,
      patientId,
      conversationId,
    }

    // Get patient info if patientId provided
    if (patientId) {
      const patientRows = await db
        .select({ id: patients.id, name: patients.name, phone: patients.phone, email: patients.email })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1)

      const patient = patientRows[0]
      if (patient) {
        context.patientInfo = {
          name: patient.name,
          phone: patient.phone,
          email: patient.email || undefined,
        }
      }
    }

    // Get conversation state if exists
    if (conversationId) {
      const stateRows = await db
        .select({ state: conversationStates.state })
        .from(conversationStates)
        .where(eq(conversationStates.conversationId, conversationId))
        .limit(1)

      const conversationState = stateRows[0]
      if (conversationState?.state) {
        context = { ...context, ...(conversationState.state as any) }
      }
    }

    // Handle appointment confirmation
    if (confirmAppointment && context.appointmentRequest) {
      const result = await createAppointmentFromContext(context)
      return NextResponse.json(result)
    }

    // Process the message
    const result = await processSchedulingRequest(message, context)

    // Save conversation state
    if (conversationId) {
      // Check if state entry exists
      const existingRows = await db
        .select({ id: conversationStates.id })
        .from(conversationStates)
        .where(eq(conversationStates.conversationId, conversationId))
        .limit(1)

      if (existingRows[0]) {
        await db
          .update(conversationStates)
          .set({
            state: {
              ...context,
              lastMessage: message,
              lastResult: result,
            } as any,
            updatedAt: new Date(),
          } as any)
          .where(eq(conversationStates.conversationId, conversationId))
      } else {
        await db
          .insert(conversationStates)
          .values({
            conversationId,
            state: {
              ...context,
              lastMessage: message,
              lastResult: result,
            } as any,
          } as any)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/scheduler/slots
 * Get available time slots for a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const duration = parseInt(searchParams.get('duration') || '30')
    const dentistId = searchParams.get('dentist_id') || undefined

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400 }
      )
    }

    const slots = await getAvailableSlots(clinicId, date, duration, dentistId)

    return NextResponse.json({
      date,
      slots,
      availableCount: slots.filter(s => s.available).length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}