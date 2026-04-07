import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import { updateProcedureSchema } from '@/lib/validations'
import { handleApiError, ValidationError } from '@/lib/errors'

/**
 * GET /api/procedures/[id]
 * Get a specific procedure
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id: procedureId } = await params

    const supabase = await createClient()

    const { data: procedure, error } = await supabase
      .from('procedures')
      .select('*')
      .eq('id', procedureId)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Procedure not found' }, { status: 404 })
    }

    return NextResponse.json({ procedure })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/procedures/[id]
 * Update a procedure
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id: procedureId } = await params

    const rawBody = await request.json()
    const body = updateProcedureSchema.parse(rawBody)

    const supabase = await createClient()

    const { data: procedure, error } = await (supabase
      .from('procedures') as any)
      .update({
        name: body.name,
        description: body.description,
        duration_minutes: body.duration_minutes,
        price: body.price,
      })
      .eq('id', procedureId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update procedure' }, { status: 500 })
    }

    return NextResponse.json({ procedure })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/procedures/[id]
 * Soft delete a procedure (set is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id: procedureId } = await params

    const supabase = await createClient()

    const { error } = await (supabase
      .from('procedures') as any)
      .update({ is_active: false })
      .eq('id', procedureId)
      .eq('clinic_id', clinicId)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete procedure' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
