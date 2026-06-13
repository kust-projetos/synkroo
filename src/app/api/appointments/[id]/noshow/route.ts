import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { appointments } from '@/lib/db/schema'
import { markNoShow } from '@/services/appointments/appointment-actions.service'

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

    const result = await markNoShow(id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
