import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'
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

    const { createTypedClient } = await import('@/lib/supabase/typed')
    const supabase = await createTypedClient()

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
      dbLogger.error('Error fetching lead', error)
      return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
    }

    return NextResponse.json({ lead })
  } catch (error) {
    dbLogger.error('Error in GET /api/leads/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    const { status, notes, hasBudget, hasTimeline, interest } = updateLeadSchema.parse(rawBody)

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
    const { createTypedClient } = await import('@/lib/supabase/typed')
    const supabase = await createTypedClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (notes !== undefined) updateData.notes = notes
    if (interest !== undefined) updateData.interest = interest

    const { data: lead, error } = await (supabase
      .from('leads') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      dbLogger.error('Error updating lead', error)
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    return NextResponse.json({ lead })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    dbLogger.error('Error in PUT /api/leads/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const { createTypedClient } = await import('@/lib/supabase/typed')
    const supabase = await createTypedClient()

    const { error } = await (supabase
      .from('leads') as any)
      .update({
        status: 'lost',
        lost_reason: 'Archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      dbLogger.error('Error deleting lead', error)
      return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    dbLogger.error('Error in DELETE /api/leads/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}