import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, NotFoundError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { patients } from '@/lib/db/schema'
import * as appointmentRepo from '@/repositories/appointments'
import { appointmentToApi } from '../route'

interface RouteParams {
  params: Promise<{ id: string }>
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

    const appointment = await appointmentRepo.findByIdWithJoins(id, clinicId)

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json({ appointment: appointmentToApi(appointment) })
  } catch (error) {
    return handleApiError(error)
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

    // Verify ownership
    const current = await appointmentRepo.findByIdWithJoins(id, clinicId)
    if (!current) {
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

    if (status && !validTransitions[current.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${current.status} to ${status}` },
        { status: 400 }
      )
    }

    // Build update object (camelCase for Drizzle)
    const updateData: Record<string, unknown> = {}
    if (patient_id !== undefined) updateData.patientId = patient_id
    if (dentist_id !== undefined) updateData.dentistId = dentist_id
    if (procedure_id !== undefined) updateData.procedureId = procedure_id
    if (scheduled_at !== undefined) updateData.scheduledAt = new Date(scheduled_at)
    if (duration_minutes !== undefined) updateData.durationMinutes = duration_minutes
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    const updated = await appointmentRepo.update(id, updateData)

    // Update patient's last_visit if completed
    if (status === 'completed' && patient_id) {
      const db = getDb()
      await db
        .update(patients)
        .set({ lastVisitAt: new Date(scheduled_at) })
        .where(eq(patients.id, patient_id))
    } else if (status === 'completed' && current.patientId) {
      const db = getDb()
      await db
        .update(patients)
        .set({ lastVisitAt: current.scheduledAt })
        .where(eq(patients.id, current.patientId))
    }

    // Fetch updated with joins
    const refreshed = await appointmentRepo.findByIdWithJoins(id, clinicId)
    if (!refreshed) {
      return handleApiError(new NotFoundError('Appointment'))
    }

    return NextResponse.json({ appointment: appointmentToApi(refreshed) })
  } catch (error) {
    return handleApiError(error)
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

    // Check if appointment exists and can be cancelled (verify clinic ownership)
    const appointment = await appointmentRepo.findById(id)

    if (!appointment || appointment.clinicId !== clinicId) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    if (!['scheduled', 'confirmed'].includes(appointment.status)) {
      return NextResponse.json(
        { error: 'Only scheduled or confirmed appointments can be cancelled' },
        { status: 400 }
      )
    }

    // Cancel the appointment
    await appointmentRepo.updateStatus(id, 'cancelled')

    return NextResponse.json({ success: true, message: 'Appointment cancelled successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}