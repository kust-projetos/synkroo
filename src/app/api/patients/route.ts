import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'
import { createPatientSchema } from '@/lib/validations'

/**
 * GET /api/patients
 * List patients with optional filters
 * Auth required — clinic_id derived from session
 */
export async function GET(request: NextRequest) {
  try {
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

    const supabase = await createTypedClient()

    // Build query
    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    // Search filter (sanitized — special chars in search won't break filter)
    if (search) {
      const sanitized = search.replace(/[%,()]/g, '')
      query = query.or(`name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%,email.ilike.%${sanitized}%`)
    }

    const { data: patients, error, count } = await query

    if (error) {
      dbLogger.error('Error fetching patients', error)
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 })
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
    dbLogger.error('Error in GET /api/patients', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/patients
 * Create a new patient
 * Auth required — clinic_id derived from session
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const rawBody = await request.json()
    const body = createPatientSchema.parse(rawBody)
    const { name, phone, email, cpf, birth_date, notes, tags } = body

    const cleanPhone = phone.replace(/\D/g, '')

    const supabase = await createTypedClient()

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
      dbLogger.error('Error creating patient', error)
      return NextResponse.json({ error: 'Failed to create patient' }, { status: 500 })
    }

    return NextResponse.json({ patient }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    dbLogger.error('Error in POST /api/patients', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}