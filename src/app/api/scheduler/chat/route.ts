import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
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

    const supabase = await createClient()

    // Get or create conversation context
    let context: SchedulerContext = {
      clinicId,
      patientId,
      conversationId,
    }

    // Get patient info if patientId provided
    if (patientId) {
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name, phone, email')
        .eq('id', patientId)
        .single() as { data: { id: string; name: string; phone: string; email: string | null } | null }

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
      const { data: conversationState } = await supabase
        .from('conversation_states')
        .select('state')
        .eq('conversation_id', conversationId)
        .single() as { data: { state: Record<string, any> } | null }

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
      await (supabase
        .from('conversation_states') as any)
        .upsert({
          conversation_id: conversationId,
          state: {
            ...context,
            lastMessage: message,
            lastResult: result,
          },
          updated_at: new Date().toISOString(),
        })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in scheduler chat:', error)
    return NextResponse.json(
      { error: 'Failed to process scheduling request' },
      { status: 500 }
    )
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
    console.error('Error getting available slots:', error)
    return NextResponse.json(
      { error: 'Failed to get available slots' },
      { status: 500 }
    )
  }
}