import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError, ValidationError, DatabaseError } from '@/lib/errors'
import { updateLeadStatus, qualifyLead, LeadStatus } from '@/services/leads/leads.service'
import { updateLeadSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/leads/[id]
 * Get a specific lead
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id

    const supabase = await createClient()

    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        patients (id, name, phone, email)
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
      }
      return handleApiError(new DatabaseError('Failed to fetch lead', error))
    }

    return NextResponse.json({ lead })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/leads/[id]
 * Update a lead
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const rawBody = await request.json()
    const { status, notes, hasBudget, hasTimeline, interest, deal_value } = updateLeadSchema.parse(rawBody)

    // Handle qualification
    if (hasBudget !== undefined || hasTimeline !== undefined) {
      const qualification = await qualifyLead(id, {
        hasBudget,
        hasTimeline,
        interest: interest ?? undefined,
        notes: notes ?? undefined,
      })

      if (!qualification) {
        return NextResponse.json({ error: 'Failed to qualify lead' }, { status: 500 })
      }

      return NextResponse.json({ qualification })
    }

    // Handle status update
    if (status) {
      const lead = await updateLeadStatus(id, status as LeadStatus, notes ?? undefined)
      if (!lead) {
        return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
      }
      return NextResponse.json({ lead })
    }

    // General update
    const supabase = await createClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (notes !== undefined) updateData.notes = notes
    if (interest !== undefined) updateData.interest = interest
    if (deal_value !== undefined) updateData.deal_value = deal_value

    const { data: lead, error } = await (supabase
      .from('leads') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return handleApiError(new DatabaseError('Failed to update lead', error))
    }

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/leads/[id]
 * Archive/delete a lead
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const supabase = await createClient()

    const { error } = await (supabase
      .from('leads') as any)
      .update({
        status: 'lost',
        lost_reason: 'Archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return handleApiError(new DatabaseError('Failed to delete lead', error))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}