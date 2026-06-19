import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointments, patients, dentists, procedures } from '@/lib/db/schema'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    const db = getDb()
    const rows = await db
      .select({
        id: appointments.id,
        scheduledAt: appointments.scheduledAt,
        status: appointments.status,
        notes: appointments.notes,
        durationMinutes: appointments.durationMinutes,
        patientName: patients.name,
        dentistName: dentists.name,
        procedureName: procedures.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(dentists, eq(appointments.dentistId, dentists.id))
      .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
      .where(and(eq(appointments.patientId, id), eq(appointments.clinicId, clinicId)))
      .orderBy(desc(appointments.scheduledAt))

    const result = rows.map((apt) => ({
      id: apt.id,
      scheduledAt: apt.scheduledAt?.toISOString?.() ?? null,
      status: apt.status,
      notes: apt.notes,
      durationMinutes: apt.durationMinutes,
      patientName: apt.patientName || '',
      dentistName: apt.dentistName || '',
      procedureName: apt.procedureName || '',
    }))

    return NextResponse.json({ appointments: result })
  } catch (error) {
    return handleApiError(error)
  }
}
