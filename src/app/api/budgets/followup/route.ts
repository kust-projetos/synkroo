import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { processBudgetFollowups, findUnconvertedBudgets } from '@/services/followup/budget-followup.service'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/budgets/followup
 * List unconverted budgets needing follow-up
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const budgets = await findUnconvertedBudgets(clinicId)

    return NextResponse.json({ budgets, total: budgets.length })
  } catch (error) {
    console.error('Error fetching budget follow-ups:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/budgets/followup
 * Process all pending budget follow-ups
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const result = await processBudgetFollowups(clinicId)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
