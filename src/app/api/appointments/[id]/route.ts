import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

interface AppointmentData {
  id: string
  clinic_id: string
  patient_id: string
  dentist_id: string | null
  procedure_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: AppointmentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/appointments/[id]
 * Get a specific appointment by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const supabase = await createTypedClient()

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patients (id, name, phone, email),
        dentists (id, name, phone),
        procedures (id, name, duration_minutes, price)
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
      dbLogger.error('Error fetching appointment', error)
      return NextResponse.json({ error: 'Failed to fetch appointment' }, { status: 500 })
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    dbLogger.error('Error in GET /api/appointments/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/appointments/[id]
 * Update an appointment
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json()
    const {
      patient_id,
      dentist_id,
      procedure_id,
      scheduled_at,
      duration_minutes,
      status,
      notes,
    } = body

    const supabase = await createTypedClient()

    // Get current appointment (verify clinic ownership)
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    const currentAppointment = data as AppointmentData | null

    if (!currentAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      scheduled: ['confirmed', 'cancelled', 'in_progress'],
      confirmed: ['in_progress', 'cancelled', 'no_show'],
      in_progress: ['completed'],
      completed: [],
      cancelled: [],
      no_show: [],
    }

    if (status && !validTransitions[currentAppointment.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${currentAppointment.status} to ${status}` },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (patient_id !== undefined) updateData.patient_id = patient_id
    if (dentist_id !== undefined) updateData.dentist_id = dentist_id
    if (procedure_id !== undefined) updateData.procedure_id = procedure_id
    if (scheduled_at !== undefined) updateData.scheduled_at = scheduled_at
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    const { data: appointment, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select(`
        *,
        patients (id, name, phone),
        dentists (id, name),
        procedures (id, name)
      `)
      .single()

    if (error) {
      dbLogger.error('Error updating appointment', error)
      return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
    }

    // Update patient's last_visit if completed
    if (status === 'completed' && appointment) {
      await (supabase as any)
        .from('patients')
        .update({ last_visit: appointment.scheduled_at })
        .eq('id', appointment.patient_id)
    }

    return NextResponse.json({ appointment })
  } catch (error) {
    dbLogger.error('Error in PUT /api/appointments/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/appointments/[id]
 * Cancel an appointment (soft delete by setting status to cancelled)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const supabase = await createTypedClient()

    // Check if appointment exists and can be cancelled (verify clinic ownership)
    const { data } = await supabase
      .from('appointments')
      .select('id, status, scheduled_at')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    const appointment = data as { id: string; status: AppointmentStatus; scheduled_at: string } | null

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return NextResponse.json(
        { error: 'Only scheduled or confirmed appointments can be cancelled' },
        { status: 400 }
      )
    }

    // Cancel the appointment
    const { error } = await (supabase as any)
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      dbLogger.error('Error cancelling appointment', error)
      return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Appointment cancelled successfully' })
  } catch (error) {
    dbLogger.error('Error in DELETE /api/appointments/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}