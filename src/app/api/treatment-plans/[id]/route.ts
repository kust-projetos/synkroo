import { NextRequest } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  getTreatmentPlanById,
  updateTreatmentPlan,
  deleteTreatmentPlan,
} from '@/services/treatment-plans/treatment-plan.service'

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
async function handleGET(_request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const plan = await getTreatmentPlanById(id, clinicId)

    if (!plan) {
      return apiFailure('NOT_FOUND', 'Treatment plan not found', requestId, 404)
    }

    return apiSuccess({ treatment_plan: plan })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * PATCH /api/treatment-plans/[id]
 * Update treatment plan
 */
async function handlePATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const plan = await getTreatmentPlanById(id, clinicId)

    if (!plan) {
      return apiFailure('NOT_FOUND', 'Treatment plan not found', requestId, 404)
    }

    const rawBody = await request.json()
    const parsed = updateTreatmentPlanSchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }

    const updatedPlan = await updateTreatmentPlan(id, clinicId, parsed.data)

    if (!updatedPlan) {
      return apiFailure('INTERNAL_ERROR', 'Failed to update treatment plan', requestId, 500)
    }

    return apiSuccess({ treatment_plan: updatedPlan })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * DELETE /api/treatment-plans/[id]
 * Delete treatment plan
 */
async function handleDELETE(_request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const plan = await getTreatmentPlanById(id, clinicId)

    if (!plan) {
      return apiFailure('NOT_FOUND', 'Treatment plan not found', requestId, 404)
    }

    const success = await deleteTreatmentPlan(id, clinicId)

    if (!success) {
      return apiFailure('INTERNAL_ERROR', 'Failed to delete treatment plan', requestId, 500)
    }

    return apiSuccess({ success: true })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const GET = withModuleRoute('operacional')(handleGET)
export const PATCH = withModuleRoute('operacional')(handlePATCH)
export const DELETE = withModuleRoute('operacional')(handleDELETE)
