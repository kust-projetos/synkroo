import { NextRequest, NextResponse } from 'next/server'
import { createClient, validateApiAuth } from '@/lib/supabase/server'
import {
  updateSessionProgress,
  getTreatmentPlanProgress,
} from '@/services/treatment-plans/treatment-plan.service'
import { handleApiError } from '@/lib/errors'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/treatment-plans/[id]/sessions
 * Update session progress (mark session as completed)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id

    const { id: planId } = await params

    // Get the plan to verify clinic ownership
    const supabase = await createClient()

    const { data: plan } = await supabase
      .from('treatment_plans')
      .select('id, clinic_id')
      .eq('id', planId)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 })
    }

    if ((plan as any).clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get item_id from request body
    const body = await request.json()
    const { treatment_plan_item_id } = body

    if (!treatment_plan_item_id) {
      return NextResponse.json({ error: 'treatment_plan_item_id is required' }, { status: 400 })
    }

    const item = await updateSessionProgress(treatment_plan_item_id)

    if (!item) {
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return NextResponse.json({ treatment_plan_item: item })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/treatment-plans/[id]/progress
 * Get treatment plan progress aggregate
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

    const { id: planId } = await params

    // Verify clinic ownership
    const supabase = await createClient()

    const { data: plan } = await supabase
      .from('treatment_plans')
      .select('id, clinic_id')
      .eq('id', planId)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Treatment plan not found' }, { status: 404 })
    }

    if ((plan as any).clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const progress = await getTreatmentPlanProgress(planId)

    return NextResponse.json({ progress })
  } catch (error) {
    return handleApiError(error)
  }
}