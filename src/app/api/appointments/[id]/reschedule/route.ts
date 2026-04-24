import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError, ValidationError } from '@/lib/errors'
import { rescheduleAppointment } from '@/services/appointments/appointment-actions.service'
import { rescheduleSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/appointments/[id]/reschedule
 * Reschedule an appointment to a new date/time
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    // Verify appointment belongs to user's clinic
    const supabase = await createTypedClient()
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const rawBody = await request.json()
    const { new_date, new_time, notify_patient, dentist_id } = rescheduleSchema.parse(rawBody)

    const result = await rescheduleAppointment(
      id,
      new_date,
      new_time,
      notify_patient !== false, // Default to true
      dentist_id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      new_scheduled_at: result.newScheduledAt?.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}