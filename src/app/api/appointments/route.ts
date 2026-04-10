import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError, ValidationError } from '@/lib/errors'
import { createAppointmentSchema } from '@/lib/validations'

/**
 * GET /api/appointments
 * List appointments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const dentistId = searchParams.get('dentist_id')
    const status = searchParams.get('status')
    const date = searchParams.get('date') // YYYY-MM-DD
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const dentistIds = searchParams.getAll('dentist_ids')  // repeated param: ?dentist_ids=a&dentist_ids=b
    const specialty = searchParams.get('specialty')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const supabase = await createTypedClient()

    // Build query
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patients (id, name, phone),
        dentists (id, name, specialty),
        procedures (id, name, duration_minutes, price)
      `, { count: 'exact' })
      .eq('clinic_id', clinicId)
      .order('scheduled_at', { ascending: true })

    // Apply filters
    if (patientId) query = query.eq('patient_id', patientId)
    if (dentistId) query = query.eq('dentist_id', dentistId)
    if (status) query = query.eq('status', status)

    // Multi-dentist filter (repeated params)
    if (dentistIds.length > 0) {
      query = query.in('dentist_id', dentistIds)
    }

    // Specialty filter — join on dentists table
    if (specialty) {
      query = query.eq('dentists.specialty', specialty)
    }

    // Date filters
    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      query = query.gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
    } else if (startDate && endDate) {
      query = query.gte('scheduled_at', startDate).lte('scheduled_at', endDate)
    }

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: appointments, error, count } = await query

    if (error) {
      return handleApiError(error)
    }

    return NextResponse.json({
      appointments,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
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

    // Validate scheduled_at is in the future
    const scheduledDate = new Date(scheduled_at)
    if (scheduledDate <= new Date()) {
      return handleApiError(new ValidationError('Appointment must be scheduled for a future date'))
    }

    const supabase = await createTypedClient()

    // Get procedure duration if not provided
    let duration = duration_minutes || 30
    if (procedure_id && !duration_minutes) {
      const { data: procedure } = await supabase
        .from('procedures')
        .select('duration_minutes')
        .eq('id', procedure_id)
        .single() as { data: { duration_minutes: number } | null }
      if (procedure) duration = procedure.duration_minutes
    }

    // Check for conflicts
    const endTime = new Date(scheduledDate.getTime() + duration * 60000)
    const { data: conflicts } = await (supabase
      .from('appointments') as any)
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('dentist_id', dentist_id)
      .in('status', ['scheduled', 'confirmed', 'in_progress'])
      .or(`scheduled_at.lt.${endTime.toISOString()},and(scheduled_at.gte.${scheduledDate.toISOString()})`)

    if (conflicts && conflicts.length > 0) {
      return handleApiError(new ValidationError('Horário indisponível. Já existe um agendamento neste horário.'))
    }

    // Create appointment
    const { data: appointment, error } = await (supabase
      .from('appointments') as any)
      .insert({
        clinic_id: clinicId,
        patient_id,
        dentist_id,
        procedure_id,
        scheduled_at,
        duration_minutes: duration,
        notes,
        status: 'scheduled',
      })
      .select(`
        *,
        patients (id, name, phone),
        dentists (id, name, specialty),
        procedures (id, name)
      `)
      .single()

    if (error) {
      return handleApiError(error)
    }

    return NextResponse.json({ appointment }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}