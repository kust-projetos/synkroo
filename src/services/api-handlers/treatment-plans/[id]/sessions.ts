import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { treatmentPlans } from '@/lib/db/schema'
import { updateSessionProgress, getTreatmentPlanProgress } from '@/services/treatment-plans/treatment-plan.service'
import { handleApiError } from '@/lib/errors'

type RouteParams = { params: Promise<{ id: string }> }

async function verifyOwnership(planId: string, clinicId: string) {
  const db = getDb()
  const [plan] = await db.select({ id: treatmentPlans.id, clinicId: treatmentPlans.clinicId }).from(treatmentPlans).where(eq(treatmentPlans.id, planId))
  if (!plan) return { status: 404, error: 'Treatment plan not found' }
  if (plan.clinicId !== clinicId) return { status: 403, error: 'Forbidden' }
  return null
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id: planId } = await params

    const ownerError = await verifyOwnership(planId, clinicId)
    if (ownerError) return NextResponse.json({ error: ownerError.error }, { status: ownerError.status })

    const body = await request.json() as Record<string,any>
    if (!body.treatment_plan_item_id) return NextResponse.json({ error: 'treatment_plan_item_id is required' }, { status: 400 })

    const item = await updateSessionProgress(body.treatment_plan_item_id, planId, clinicId)
    if (!item) return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    return NextResponse.json({ treatment_plan_item: item })
  } catch (error) { return handleApiError(error) }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id: planId } = await params

    const ownerError = await verifyOwnership(planId, clinicId)
    if (ownerError) return NextResponse.json({ error: ownerError.error }, { status: ownerError.status })

    const progress = await getTreatmentPlanProgress(planId, clinicId)
    return NextResponse.json({ progress })
  } catch (error) { return handleApiError(error) }
}
