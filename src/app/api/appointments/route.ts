import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'
import { createAppointmentSchema } from '@/lib/validations'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import { getDb } from '@/lib/db/client'
import { appointments } from '@/lib/db/schema'
import * as appointmentRepo from '@/repositories/appointments'
import * as procedureRepo from '@/repositories/procedures'

/** Shared appointment-to-API mapper — consistent contract across list and detail. */
export function appointmentToApi(
  row: NonNullable<Awaited<ReturnType<typeof appointmentRepo.findByIdWithJoins>>>
) {
  return {
    id: row.id,
    clinic_id: row.clinicId,
    patient_id: row.patientId,
    dentist_id: row.dentistId,
    procedure_id: row.procedureId,
    scheduled_at: row.scheduledAt,
    duration_minutes: row.durationMinutes,
    status: row.status,
    notes: row.notes,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    patients: row.patient
      ? { id: row.patient.id, name: row.patient.name, phone: row.patient.phone, email: row.patient.email ?? null }
      : null,
    dentists: row.dentist
      ? { id: row.dentist.id, name: row.dentist.name, phone: row.dentist.phone ?? null, specialty: row.dentist.specialty ?? null }
      : null,
    procedures: row.procedure
      ? { id: row.procedure.id, name: row.procedure.name, duration_minutes: row.procedure.durationMinutes, price: row.procedure.price, category: row.procedure.category }
      : null,
  }
}

/**
 * GET /api/appointments
 * List appointments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, rateLimitPresets.api)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const dentistId = searchParams.get('dentist_id')
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const dentistIds = searchParams.getAll('dentist_ids')
    const page = parseInt(searchParams.get('page') || '1')
    const isCalendarRange = startDate && endDate
    const defaultLimit = isCalendarRange ? '999' : '50'
    const limit = Math.min(parseInt(searchParams.get('limit') || defaultLimit), 999)
    const offset = (page - 1) * limit

    const repoOpts = {
      patientId: patientId || undefined,
      dentistId: dentistId || undefined,
      status: status || undefined,
      date: date || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      dentistIds: dentistIds.length > 0 ? dentistIds : undefined,
      limit,
      offset,
    }

    const rows = await appointmentRepo.findByClinicWithJoins(clinicId, repoOpts)

    // Real total: count-only query (no JOINs, same filter conditions)
    const total = await appointmentRepo.findByClinicWithJoins(clinicId, { ...repoOpts, count: true })

    const mapped = rows.map(appointmentToApi)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      appointments: mapped,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/appointments
 * Create a new appointment
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, rateLimitPresets.api)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const rawBody = await request.json()
    const {
      patient_id,
      dentist_id,
      procedure_id,
      scheduled_at,
      duration_minutes,
      notes,
    } = createAppointmentSchema.parse(rawBody)

    const scheduledDate = new Date(scheduled_at)
    if (scheduledDate <= new Date()) {
      return handleApiError(new ValidationError('Appointment must be scheduled for a future date'))
    }

    // Get procedure duration if not provided
    let duration = duration_minutes || 30
    if (procedure_id && !duration_minutes) {
      const proc = await procedureRepo.findById(procedure_id)
      if (proc) duration = proc.durationMinutes || 30
    }

    // Interval overlap check: existing.start < new.end AND existing.end > new.start.
    // This correctly blocks both "existing starts inside new" and "existing contains new" cases.
    const endTime = new Date(scheduledDate.getTime() + duration * 60000)
    const db = getDb()

    const conflictConditions: (ReturnType<typeof eq> | ReturnType<typeof inArray> | ReturnType<typeof sql>)[] = [
      eq(appointments.clinicId, clinicId),
      inArray(appointments.status, ['scheduled', 'confirmed', 'in_progress'] as any),
      // existing.start < new.end
      sql`${appointments.scheduledAt} < ${endTime.toISOString()}::timestamptz`,
      // existing.end > new.start  (COALESCE handles null duration as 0)
      sql`${appointments.scheduledAt} + (COALESCE(${appointments.durationMinutes}, 0) || ' minutes')::interval > ${scheduledDate.toISOString()}::timestamptz`,
      sql`${appointments.deletedAt} IS NULL`,
    ]
    if (dentist_id != null) {
      conflictConditions.push(eq(appointments.dentistId, dentist_id))
    }

    const conflicts = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(...conflictConditions))
      .limit(1)

    if (conflicts.length > 0) {
      return handleApiError(new ValidationError('Horário indisponível. Já existe um agendamento neste horário.'))
    }

    // Create the appointment
    const appointment = await appointmentRepo.create({
      clinicId,
      patientId: patient_id,
      dentistId: dentist_id ?? null,
      procedureId: procedure_id ?? null,
      scheduledAt: scheduledDate,
      durationMinutes: duration,
      notes: notes ?? null,
    })

    // Fetch full appointment with joins
    const created = await appointmentRepo.findByIdWithJoins(appointment.id, clinicId)
    if (!created) {
      return handleApiError(new Error('Failed to fetch created appointment'))
    }

    return NextResponse.json({ appointment: appointmentToApi(created) }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}
