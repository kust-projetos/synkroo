import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, NotFoundError } from '@/lib/errors'
import * as dentistRepo from '@/repositories/dentists'
import * as appointmentRepo from '@/repositories/appointments'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/dentists/[id]
 * Get a specific dentist
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const dentist = await dentistRepo.findById(id)
    if (!dentist || dentist.clinicId !== clinicId) {
      return handleApiError(new NotFoundError('Dentist not found'))
    }

    return NextResponse.json({
      dentist: {
        id: dentist.id,
        name: dentist.name,
        phone: dentist.phone,
        email: dentist.email,
        specialty: dentist.specialty,
        cro: dentist.cro,
        is_active: dentist.isActive,
        working_hours: dentist.workingHours,
        created_at: dentist.createdAt,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/dentists/[id]
 * Update a dentist
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    // Verify ownership
    const existing = await dentistRepo.findById(id)
    if (!existing || existing.clinicId !== clinicId) {
      return handleApiError(new NotFoundError('Dentist not found'))
    }

    const body = await request.json()
    const dentist = await dentistRepo.update(id, body)

    return NextResponse.json({ dentist })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/dentists/[id]
 * Soft-delete a dentist
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const existing = await dentistRepo.findById(id)
    if (!existing || existing.clinicId !== clinicId) {
      return handleApiError(new NotFoundError('Dentist not found'))
    }

    await dentistRepo.remove(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
