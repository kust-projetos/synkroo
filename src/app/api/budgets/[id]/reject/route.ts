import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBudgetById, rejectBudget } from '@/services/budgets/budget.service'
import { handleApiError } from '@/lib/errors'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/budgets/[id]/reject
 * Reject a budget
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const budget = await getBudgetById(id)

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    // Verify user has access
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.clinic_id !== budget.clinic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if budget can be rejected
    if (!['pending', 'sent'].includes(budget.status)) {
      return NextResponse.json(
        { error: 'Budget cannot be rejected in current status' },
        { status: 400 }
      )
    }

    const updatedBudget = await rejectBudget(id)

    if (!updatedBudget) {
      return NextResponse.json({ error: 'Failed to reject budget' }, { status: 500 })
    }

    // Optionally store rejection reason
    const body = await request.json().catch(() => ({}))
    if (body.reason) {
      await (supabase as any)
        .from('budgets')
        .update({ notes: `Rejeitado: ${body.reason}` })
        .eq('id', id)
    }

    return NextResponse.json({
      budget: updatedBudget,
      message: 'Budget rejected',
    })
  } catch (error) {
    return handleApiError(error)
  }
}