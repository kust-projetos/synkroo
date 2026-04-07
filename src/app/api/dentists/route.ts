import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import { createDentistSchema } from '@/lib/validations'
import { apiLogger } from '@/lib/logger'
import { PAGINATION } from '@/lib/config'

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
      PAGINATION.maxLimit
    )
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    const { data: dentists, error } = await supabase
      .from('dentists')
      .select('id, name, phone, email, specialty, created_at')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      apiLogger.error('Error fetching dentists', error)
      return NextResponse.json({ error: 'Failed to fetch dentists' }, { status: 500 })
    }

    return NextResponse.json({ dentists, pagination: { limit, offset } })
  } catch (error) {
    apiLogger.error('Error in GET /api/dentists', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    const { name, phone, email, specialty, cro_number } = createDentistSchema.parse(rawBody)

    const supabase = await createClient()

    const { data: dentist, error } = await supabase
      .from('dentists')
      .insert({
        clinic_id: clinicId,
        name,
        phone,
        email,
        specialty,
        cro_number,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      apiLogger.error('Error creating dentist', error)
      return NextResponse.json({ error: 'Failed to create dentist' }, { status: 500 })
    }

    return NextResponse.json({ dentist }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    apiLogger.error('Error in POST /api/dentists', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
