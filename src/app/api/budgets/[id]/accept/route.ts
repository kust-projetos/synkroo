import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBudgetById, acceptBudget } from '@/services/budgets/budget.service'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/budgets/[id]/accept
 * Accept a budget (patient or staff)
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

    if (!userData || (userData as any)?.clinic_id !== budget.clinic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if budget can be accepted
    if (!['pending', 'sent'].includes(budget.status)) {
      return NextResponse.json(
        { error: 'Budget cannot be accepted in current status' },
        { status: 400 }
      )
    }

    // Check if budget has expired
    if (budget.valid_until && new Date(budget.valid_until) < new Date()) {
      return NextResponse.json(
        { error: 'Budget has expired' },
        { status: 400 }
      )
    }

    const updatedBudget = await acceptBudget(id)

    if (!updatedBudget) {
      return NextResponse.json({ error: 'Failed to accept budget' }, { status: 500 })
    }

    return NextResponse.json({
      budget: updatedBudget,
      message: 'Budget accepted successfully',
    })
  } catch (error) {
    console.error('Error accepting budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}