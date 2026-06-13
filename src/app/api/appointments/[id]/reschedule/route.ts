import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { appointments } from '@/lib/db/schema'
import * as appointmentRepo from '@/repositories/appointments'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const db = getDb()
    const [appt] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
      .limit(1)
    if (!appt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const body = await request.json()
    const { scheduled_at, dentist_id, procedure_id, duration_minutes } = body
    if (!scheduled_at) {
      return NextResponse.json({ error: 'New scheduled_at is required' }, { status: 400 })
    }

    await appointmentRepo.update(id, {
      scheduledAt: new Date(scheduled_at),
      dentistId: dentist_id || null,
      procedureId: procedure_id || null,
      durationMinutes: duration_minutes || undefined,
      status: 'scheduled',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
