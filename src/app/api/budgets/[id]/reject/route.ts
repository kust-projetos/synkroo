import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgets } from '@/lib/db/schema'
import { validateApiAuth } from '@/lib/auth/session'
import { getBudgetById, rejectBudget } from '@/services/budgets/budget.service'
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
    if (!['pending', 'sent'].includes(budget.status)) return NextResponse.json({ error: 'Budget cannot be rejected in current status' }, { status: 400 })

    const updated = await rejectBudget(id)
    if (!updated) return NextResponse.json({ error: 'Failed to reject budget' }, { status: 500 })

    // Optional rejection reason
    const body = await request.json().catch(() => ({}))
    if (body.reason) {
      const db = getDb()
      await db.update(budgets).set({ notes: `Rejeitado: ${body.reason}`, updatedAt: new Date() }).where(eq(budgets.id, id))
    }

    return NextResponse.json({ budget: updated, message: 'Budget rejected' })
  } catch (error) { return handleApiError(error) }
}
