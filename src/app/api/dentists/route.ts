import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { createDentistSchema } from '@/lib/validations'
import { handleApiError, ValidationError, DatabaseError } from '@/lib/errors'
import { PAGINATION } from '@/lib/config'
import * as dentistRepo from '@/repositories/dentists'

/**
 * GET /api/dentists
 * List dentists for a clinic
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(PAGINATION.defaultLimit)),
      PAGINATION.maxLimit,
    )
    const offset = parseInt(searchParams.get('offset') || '0')

    const list = await dentistRepo.findByClinic(clinicId, { activeOnly: true })

    // Slice after fetch for efficient query
    const dentists = list.slice(offset, offset + limit).map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      email: d.email,
      specialty: d.specialty,
      cro: d.cro,
      is_active: d.isActive,
      created_at: d.createdAt,
    }))

    return NextResponse.json({ dentists, pagination: { limit, offset } })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/dentists
 * Create a new dentist
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const rawBody = await request.json()
    const data = createDentistSchema.parse(rawBody)

    const dentist = await dentistRepo.create({
      clinicId,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      specialty: data.specialty || null,
      cro: (data as any).cro || null,
    })

    return NextResponse.json({ dentist }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}
