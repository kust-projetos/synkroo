import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError, DatabaseError } from '@/lib/errors'
import { createPatientSchema } from '@/lib/validations'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import * as patientRepo from '@/repositories/patients'

/**
 * GET /api/patients
 * List patients with optional search
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
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = (page - 1) * limit

    const patients_ = await patientRepo.findByClinic(clinicId, { search: search || undefined, limit, offset })

    const mapped = patients_.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      cpf: p.cpf,
      birth_date: p.birthDate,
      gender: p.gender,
      notes: p.notes,
      tags: p.tags,
      risk_score: p.riskScore,
      last_visit_at: p.lastVisitAt,
      created_at: p.createdAt,
    }))

    return NextResponse.json({ patients: mapped, pagination: { page, limit, offset } })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients
 * Create a new patient
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
    const data = createPatientSchema.parse(rawBody)

    const patient = await patientRepo.create({
      clinicId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      cpf: data.cpf || null,
      birthDate: data.birth_date || null,
      gender: (data as any).gender || null,
      notes: data.notes || null,
    })

    return NextResponse.json({
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        created_at: patient.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}
