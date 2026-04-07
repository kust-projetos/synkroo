import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import {
  formatReminderMessage,
  sendWhatsAppReminder,
  recordReminderSent,
} from '@/services/reminders/reminder.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/appointments/[id]/remind
 * Send a manual reminder for a specific appointment
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

    const body = await request.json().catch(() => ({}))
    const { hoursBefore = 2 } = body

    const supabase = await createClient()

    // Get appointment details (verify clinic ownership)
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        status,
        patients!inner (id, name, phone),
        dentists (name),
        procedures (name),
        clinics!inner (id, name, phone)
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const appointment = data as {
      id: string
      scheduled_at: string
      status: string
      patients: { id: string; name: string; phone: string } | null
      dentists: { name: string } | null
      procedures: { name: string } | null
      clinics: { id: string; name: string; phone: string }
    }

    // Check appointment status
    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return NextResponse.json(
        { error: 'Cannot send reminder for this appointment status' },
        { status: 400 }
      )
    }

    // Format and send reminder
    const reminder = {
      appointmentId: appointment.id,
      patientId: appointment.patients?.id || '',
      patientName: appointment.patients?.name || '',
      patientPhone: appointment.patients?.phone || '',
      scheduledAt: new Date(appointment.scheduled_at),
      dentistName: appointment.dentists?.name,
      procedureName: appointment.procedures?.name,
      clinicName: appointment.clinics?.name || '',
      clinicPhone: appointment.clinics?.phone || '',
    }

    const message = formatReminderMessage(reminder, hoursBefore)
    const result = await sendWhatsAppReminder(reminder.patientPhone, message)

    // Record the reminder
    await recordReminderSent(
      appointment.id,
      `${hoursBefore}h`,
      'whatsapp',
      result.success,
      result.messageId,
      result.error
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send reminder' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Reminder sent successfully',
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('Error sending manual reminder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}