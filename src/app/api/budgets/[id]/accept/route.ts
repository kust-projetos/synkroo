import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getBudgetById, acceptBudget } from '@/services/budgets/budget.service'
import { handleApiError } from '@/lib/errors'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id

    const { id } = await params
    const budget = await getBudgetById(id)
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    if (budget.clinic_id !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!['pending', 'sent'].includes(budget.status)) return NextResponse.json({ error: 'Budget cannot be accepted in current status' }, { status: 400 })
    if (budget.valid_until && new Date(budget.valid_until) < new Date()) return NextResponse.json({ error: 'Budget has expired' }, { status: 400 })

    const updated = await acceptBudget(id)
    if (!updated) return NextResponse.json({ error: 'Failed to accept budget' }, { status: 500 })
    return NextResponse.json({ budget: updated, message: 'Budget accepted successfully' })
  } catch (error) { return handleApiError(error) }
}
