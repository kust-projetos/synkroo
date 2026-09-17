import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import { treatmentPlans } from '@/lib/db/schema'
import { updateSessionProgress, getTreatmentPlanProgress } from '@/services/treatment-plans/treatment-plan.service'

type RouteParams = { params: Promise<{ id: string }> }

type Ownership = { ok: true; patientId: string } | { ok: false; status: number; error: string }

async function verifyOwnership(planId: string, clinicId: string): Promise<Ownership> {
  const db = getDb()
  const [plan] = await db.select({ id: treatmentPlans.id, clinicId: treatmentPlans.clinicId, patientId: treatmentPlans.patientId }).from(treatmentPlans).where(eq(treatmentPlans.id, planId))
  if (!plan) return { ok: false, status: 404, error: 'Treatment plan not found' }
  if (plan.clinicId !== clinicId) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true, patientId: plan.patientId }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const { id: planId } = await params

    const ownership = await verifyOwnership(planId, clinicId)
    if (!ownership.ok) return apiFailure(ownership.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', ownership.error, requestId, ownership.status)

    const body = await request.json() as Record<string, any>
    if (!body.treatment_plan_item_id) return apiFailure('INVALID_INPUT', 'treatment_plan_item_id is required', requestId, 400)

    const item = await updateSessionProgress(body.treatment_plan_item_id, planId, clinicId)
    if (!item) return apiFailure('INTERNAL_ERROR', 'Failed to update session', requestId, 500)
    return apiSuccess({ treatment_plan_item: item, patient_id: ownership.patientId })
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

    const ownership = await verifyOwnership(planId, clinicId)
    if (!ownership.ok) return apiFailure(ownership.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN', ownership.error, requestId, ownership.status)

    const progress = await getTreatmentPlanProgress(planId, clinicId)
    return apiSuccess({ progress })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
