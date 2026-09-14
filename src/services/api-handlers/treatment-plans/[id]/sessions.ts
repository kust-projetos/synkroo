import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import { treatmentPlans } from '@/lib/db/schema'
import { updateSessionProgress, getTreatmentPlanProgress } from '@/services/treatment-plans/treatment-plan.service'

type RouteParams = { params: Promise<{ id: string }> }

async function verifyOwnership(planId: string, clinicId: string) {
  const db = getDb()
  const [plan] = await db.select({ id: treatmentPlans.id, clinicId: treatmentPlans.clinicId }).from(treatmentPlans).where(eq(treatmentPlans.id, planId))
  if (!plan) return { status: 404, error: 'Treatment plan not found' }
  if (plan.clinicId !== clinicId) return { status: 403, error: 'Forbidden' }
  return null
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const { id: planId } = await params

    const ownerError = await verifyOwnership(planId, clinicId)
    if (ownerError) return apiFailure(ownerError.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', ownerError.error, requestId, ownerError.status)

    const body = await request.json() as Record<string, any>
    if (!body.treatment_plan_item_id) return apiFailure('INVALID_INPUT', 'treatment_plan_item_id is required', requestId, 400)

    const item = await updateSessionProgress(body.treatment_plan_item_id, planId, clinicId)
    if (!item) return apiFailure('INTERNAL_ERROR', 'Failed to update session', requestId, 500)
    return apiSuccess({ treatment_plan_item: item })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const { id: planId } = await params

    const ownerError = await verifyOwnership(planId, clinicId)
    if (ownerError) return apiFailure(ownerError.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', ownerError.error, requestId, ownerError.status)

    const progress = await getTreatmentPlanProgress(planId, clinicId)
    return apiSuccess({ progress })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
