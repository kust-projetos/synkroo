import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import { updateDentistSchema } from '@/lib/validations'

/**
 * GET /api/dentists/[id]
 * Get a specific dentist
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
    const { id: dentistId } = await params

    const supabase = await createClient()

    const { data: dentist, error } = await supabase
      .from('dentists')
      .select('*')
      .eq('id', dentistId)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Dentist not found' }, { status: 404 })
    }

    return NextResponse.json({ dentist })
  } catch (error) {
    console.error('Error in GET /api/dentists/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/dentists/[id]
 * Update a dentist
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
    const { id: dentistId } = await params
    const rawBody = await request.json()
    const body = updateDentistSchema.parse(rawBody)

    const supabase = await createClient()

    const { data: dentist, error } = await supabase
      .from('dentists')
      .update({
        name: body.name,
        phone: body.phone,
        email: body.email,
        specialty: body.specialty,
        cro_number: body.cro_number,
      })
      .eq('id', dentistId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update dentist' }, { status: 500 })
    }

    return NextResponse.json({ dentist })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error in PUT /api/dentists/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/dentists/[id]
 * Soft delete a dentist (set is_active = false)
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
    const { id: dentistId } = await params

    const supabase = await createClient()

    const { error } = await supabase
      .from('dentists')
      .update({ is_active: false })
      .eq('id', dentistId)
      .eq('clinic_id', clinicId)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete dentist' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/dentists/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
