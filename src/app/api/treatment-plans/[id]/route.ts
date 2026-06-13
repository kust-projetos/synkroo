import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import {
  getTreatmentPlanById,
  updateTreatmentPlan,
  deleteTreatmentPlan,
} from '@/services/treatment-plans/treatment-plan.service'
import { handleApiError, ValidationError } from '@/lib/errors'

type RouteParams = {
  params: Promise<{ id: string }>
}

const updateTreatmentPlanSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'cancelled', 'paused']).optional(),
  total_sessions: z.number().int().positive().optional(),
  expected_completion_at: z.string().datetime().optional(),
  notes: z.string().optional(),
})

/**
 * GET /api/treatment-plans/[id]
 * Get treatment plan by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const plan = await getTreatmentPlanById(id)

    if (!plan) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 })
    }

    if (plan.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ treatment_plan: plan })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/treatment-plans/[id]
 * Update treatment plan
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const plan = await getTreatmentPlanById(id)

    if (!plan) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 })
    }

    if (plan.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rawBody = await request.json()
    const body = updateTreatmentPlanSchema.parse(rawBody)

    const updatedPlan = await updateTreatmentPlan(id, body)

    if (!updatedPlan) {
      return NextResponse.json({ error: 'Failed to update treatment plan' }, { status: 500 })
    }

    return NextResponse.json({ treatment_plan: updatedPlan })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/treatment-plans/[id]
 * Delete treatment plan
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const plan = await getTreatmentPlanById(id)

    if (!plan) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 })
    }

    if (plan.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const success = await deleteTreatmentPlan(id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete treatment plan' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}