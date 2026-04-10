import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import { createProcedureSchema } from '@/lib/validations'
import { handleApiError, ValidationError, DatabaseError } from '@/lib/errors'
import { PAGINATION } from '@/lib/config'

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

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(PAGINATION.defaultLimit)),
      PAGINATION.maxLimit
    )
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = await createClient()

    const { data: procedures, error } = await supabase
      .from('procedures')
      .select('id, name, description, duration_minutes, price, is_active, category, created_at')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return handleApiError(new DatabaseError('Failed to fetch procedures', error))
    }

    return NextResponse.json({ procedures, pagination: { limit, offset } })
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

    const rawBody = await request.json()
    const { name, description, duration_minutes, price } = createProcedureSchema.parse(rawBody)

    const supabase = await createClient()

    const { data: procedure, error } = await (supabase
      .from('procedures') as any)
      .insert({
        clinic_id: clinicId,
        name,
        description,
        duration_minutes: duration_minutes || 30,
        price: price || 0,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return handleApiError(new DatabaseError('Failed to create procedure', error))
    }

    return NextResponse.json({ procedure }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}
