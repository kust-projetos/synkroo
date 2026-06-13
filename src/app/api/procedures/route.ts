import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'
import * as procedureRepo from '@/repositories/procedures'

/**
 * GET /api/procedures
 * List procedures for a clinic
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const procedures_ = await procedureRepo.findByClinic(clinicId, { activeOnly: true })

    const mapped = procedures_.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      duration_minutes: p.durationMinutes,
      price: p.price,
      category: p.category,
      is_active: p.isActive,
      created_at: p.createdAt,
    }))

    return NextResponse.json({ procedures: mapped })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/procedures
 * Create a new procedure
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const body = await request.json()
    const { name, description, duration_minutes, price, category } = body

    const procedure = await procedureRepo.create({
      clinicId,
      name,
      description: description || null,
      durationMinutes: duration_minutes || 30,
      price: price ? String(price) : undefined,
      category: category || null,
    })

    return NextResponse.json({ procedure }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
