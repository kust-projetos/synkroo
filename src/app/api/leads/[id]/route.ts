import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError, ValidationError } from '@/lib/errors'
import { updateLeadStatus, qualifyLead, LeadStatus } from '@/services/leads/leads.service'
import * as leadRepo from '@/repositories/leads'
import { updateLeadSchema } from '@/lib/validations'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { leads, patients } from '@/lib/db/schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/leads/[id]
 * Get a specific lead with patient info
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
    const db = getDb()

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.clinicId, clinicId)))
      .limit(1)

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Fetch patient info if linked
    let patient = null
    if (lead.patientId) {
      const [patientRow] = await db
        .select({ id: patients.id, name: patients.name, phone: patients.phone, email: patients.email })
        .from(patients)
        .where(eq(patients.id, lead.patientId))
        .limit(1)
      patient = patientRow ?? null
    }

    return NextResponse.json({
      lead: {
        ...lead,
        patients: patient,
      },
    })
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

    // General update via repository
    const updated = await leadRepo.updateLead(id, {
      notes: notes ?? undefined,
      interest: interest ?? undefined,
      dealValue: deal_value !== undefined ? String(deal_value) : undefined,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
    }

    return NextResponse.json({ lead: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/leads/[id]
 * Archive/delete a lead (mark as lost)
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

    const updated = await leadRepo.updateLead(id, {
      status: 'lost',
      lostReason: 'Archived',
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}