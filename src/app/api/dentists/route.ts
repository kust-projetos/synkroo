import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import { createDentistSchema } from '@/lib/validations'
import { handleApiError, ValidationError, DatabaseError } from '@/lib/errors'
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
      .select('id, name, phone, email, specialty, cro, is_active, created_at')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return handleApiError(new DatabaseError('Failed to fetch dentists', error))
    }

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
    const { name, phone, email, specialty, cro_number } = createDentistSchema.parse(rawBody)

    const supabase = await createClient()

    const { data: dentist, error } = await (supabase
      .from('dentists') as any)
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
      return handleApiError(new DatabaseError('Failed to create dentist', error))
    }

    return NextResponse.json({ dentist }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}
