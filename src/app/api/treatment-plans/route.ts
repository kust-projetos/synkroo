import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  getTreatmentPlansByPatient,
  createTreatmentPlan,
} from '@/services/treatment-plans/treatment-plan.service'
import { createTreatmentPlanSchema } from '@/lib/validations/treatment-plan'

/**
 * GET /api/treatment-plans
 * List treatment-plans for a patient
 */
async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get('patient_id')

    if (!patientId) {
      return apiFailure('INVALID_INPUT', 'patient_id is required', requestId, 400)
    }

    const plans = await getTreatmentPlansByPatient(patientId, clinicId)

    return apiSuccess({ treatment_plans: plans })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * POST /api/treatment-plans
 * Create a new treatment-plan
 */
async function handlePOST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id
    const userId = authResult.profile!.id

    const rawBody = await request.json()
    const parsed = createTreatmentPlanSchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    const body = parsed.data

    const plan = await createTreatmentPlan({
      clinic_id: clinicId,
      patient_id: body.patient_id,
      title: body.title,
      description: body.description,
      total_sessions: body.total_sessions,
      started_at: body.started_at,
      expected_completion_at: body.expected_completion_at,
      notes: body.notes,
      created_by: userId,
      items: body.items.map((item, index) => ({
        ...item,
        session_number: item.session_number ?? index + 1,
        status: 'pending',
      })),
    })

    return apiSuccess({ treatment_plan: plan }, undefined, 201)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const GET = withModuleRoute('operacional')(handleGET)
export const POST = withModuleRoute('operacional')(handlePOST)
