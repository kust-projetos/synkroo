import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError, DatabaseError, NotFoundError } from '@/lib/errors'
import { updatePatientSchema } from '@/lib/validations'
import * as patientRepo from '@/repositories/patients'
import * as appointmentRepo from '@/repositories/appointments'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Map patient repo row to API snake_case shape */
function toApiShape(patient: NonNullable<Awaited<ReturnType<typeof patientRepo.findByIdWithAppointments>>>) {
  const { appointments: apts, ...rest } = patient
  return {
    ...rest,
    clinic_id: rest.clinicId,
    birth_date: rest.birthDate,
    last_visit_at: rest.lastVisitAt,
    created_at: rest.createdAt,
    risk_score: rest.riskScore,
    tags: rest.tags || [],
    appointments: (apts || []).map(a => ({
      id: a.id,
      scheduled_at: a.scheduledAt,
      duration_minutes: a.durationMinutes,
      status: a.status,
      notes: a.notes,
      procedures: null,
      dentists: null,
    })),
  }
}

/**
 * GET /api/patients/[id]
 * Get a specific patient by ID with appointment history
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
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const patient = await patientRepo.findByIdWithAppointments(id, clinicId)

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ patient: toApiShape(patient) })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/patients/[id]
 * Update a patient
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
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const rawBody = await request.json()
    const { name, phone, email, cpf, birth_date, notes, tags } = updatePatientSchema.parse(rawBody)

    // Verify patient belongs to user's clinic before updating
    const existing = await patientRepo.findByIdScoped(id, clinicId)
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) {
      const cleanPhone = phone.replace(/\D/g, '')
      updateData.phone = cleanPhone
    }
    if (email !== undefined) updateData.email = email?.trim() || null
    if (cpf !== undefined) updateData.cpf = cpf?.replace(/\D/g, '') || null
    if (birth_date !== undefined) updateData.birthDate = birth_date || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (tags !== undefined) updateData.tags = tags

    const updated = await patientRepo.update(id, updateData as Parameters<typeof patientRepo.update>[1])
    if (!updated) {
      return handleApiError(new NotFoundError('Patient'))
    }

    // Return snake_case shape matching original contract
    return NextResponse.json({
      patient: {
        id: updated.id,
        clinic_id: updated.clinicId,
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        cpf: updated.cpf,
        birth_date: updated.birthDate,
        gender: updated.gender,
        notes: updated.notes,
        tags: updated.tags || [],
        risk_score: updated.riskScore,
        last_visit_at: updated.lastVisitAt,
        created_at: updated.createdAt,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/patients/[id]
 * Soft delete a patient (anonymize sensitive data)
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
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    // Verify patient belongs to user's clinic before deleting
    const existing = await patientRepo.findByIdScoped(id, clinicId)
    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Check if patient has active appointments
    const activeApts = await appointmentRepo.findByPatient(clinicId, id, { limit: 1 })
    const hasActive = activeApts.some(a => ['scheduled', 'confirmed', 'in_progress'].includes(a.status))
    if (hasActive) {
      return NextResponse.json(
        { error: 'Cannot delete patient with active appointments. Cancel appointments first.' },
        { status: 400 }
      )
    }

    // Soft delete by anonymizing sensitive data
    await patientRepo.softDelete(id)

    return NextResponse.json({ success: true, message: 'Patient deleted successfully' })
  } catch (error) {
    return handleApiError(error)
  }
}