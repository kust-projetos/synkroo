import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError, ValidationError, DatabaseError } from '@/lib/errors'
import { createPatientSchema } from '@/lib/validations'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/patients
 * List patients with optional filters
 * Auth required — clinic_id derived from session
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

    const supabase = await createClient()

    // Build query
    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    // Search filter (escape special chars to prevent ILIKE injection)
    if (search) {
      const escaped = search.replace(/[%_\\]/g, '\\$&')
      query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    }

    const { data: patients, error, count } = await query

    if (error) {
      return handleApiError(new DatabaseError('Failed to fetch patients', error))
    }

    return NextResponse.json({
      patients,
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
 * POST /api/patients
 * Create a new patient
 * Auth required — clinic_id derived from session
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
    const body = createPatientSchema.parse(rawBody)
    const { name, phone, email, cpf, birth_date, notes, tags } = body

    const cleanPhone = phone.replace(/\D/g, '')

    const supabase = await createClient()

    // Check if patient with same phone already exists for this clinic
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('phone', cleanPhone)
      .single() as { data: { id: string } | null }

    if (existingPatient) {
      return NextResponse.json(
        { error: 'Patient with this phone number already exists', patient_id: existingPatient.id },
        { status: 409 }
      )
    }

    // Create patient — clinic_id from authenticated session
    const { data: patient, error } = await (supabase
      .from('patients') as any)
      .insert({
        clinic_id: clinicId,
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || null,
        cpf: cpf?.replace(/\D/g, '') || null,
        birth_date: birth_date || null,
        notes: notes?.trim() || null,
        tags: tags || [],
        risk_score: 0,
      })
      .select()
      .single()

    if (error) {
      return handleApiError(new DatabaseError('Failed to create patient', error))
    }

    return NextResponse.json({ patient }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}