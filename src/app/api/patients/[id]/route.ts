import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import { updatePatientSchema } from '@/lib/validations'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patients/[id]
 * Get a specific patient by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const supabase = await createTypedClient()

    // Get patient with appointment history (scoped to user's clinic)
    const { data: patient, error } = await supabase
      .from('patients')
      .select(`
        *,
        appointments (
          id,
          scheduled_at,
          duration_minutes,
          status,
          notes,
          procedures (name),
          dentists (name)
        )
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
      dbLogger.error('Error fetching patient', error)
      return NextResponse.json({ error: 'Failed to fetch patient' }, { status: 500 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    dbLogger.error('Error in GET /api/patients/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/patients/[id]
 * Update a patient
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const rawBody = await request.json()
    const { name, phone, email, cpf, birth_date, notes, tags } = updatePatientSchema.parse(rawBody)

    const supabase = await createTypedClient()

    // Verify patient belongs to user's clinic before updating
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) {
      const cleanPhone = phone.replace(/\D/g, '')
      updateData.phone = cleanPhone
    }
    if (email !== undefined) updateData.email = email?.trim() || null
    if (cpf !== undefined) updateData.cpf = cpf?.replace(/\D/g, '') || null
    if (birth_date !== undefined) updateData.birth_date = birth_date || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (tags !== undefined) updateData.tags = tags

    const { data: patient, error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
      }
      dbLogger.error('Error updating patient', error)
      return NextResponse.json({ error: 'Failed to update patient' }, { status: 500 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    dbLogger.error('Error in PUT /api/patients/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/patients/[id]
 * Soft delete a patient (set is_active = false or similar)
 * Note: For this implementation, we'll archive by clearing sensitive data
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    const supabase = await createTypedClient()

    // Verify patient belongs to user's clinic before deleting
    const { data: existing } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // Check if patient has active appointments
    const { data: activeAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('patient_id', id)
      .in('status', ['scheduled', 'confirmed', 'in_progress'])
      .limit(1)

    if (activeAppointments && activeAppointments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete patient with active appointments. Cancel appointments first.' },
        { status: 400 }
      )
    }

    // Soft delete by anonymizing sensitive data
    const { error } = await supabase
      .from('patients')
      .update({
        name: '[Deleted Patient]',
        phone: '00000000000',
        email: null,
        cpf: null,
        notes: null,
      })
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      dbLogger.error('Error deleting patient', error)
      return NextResponse.json({ error: 'Failed to delete patient' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Patient deleted successfully' })
  } catch (error) {
    dbLogger.error('Error in DELETE /api/patients/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}