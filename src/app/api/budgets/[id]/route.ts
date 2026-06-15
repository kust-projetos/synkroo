import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgets } from '@/lib/db/schema'
import { validateApiAuth } from '@/lib/auth/session'
import { getBudgetById, deleteBudget } from '@/services/budgets/budget.service'
import { updateBudgetSchema } from '@/lib/validations'
import { handleApiError, ValidationError } from '@/lib/errors'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const { id } = await params
    const budget = await getBudgetById(id)
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    if (budget.clinic_id !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ budget })
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const { id } = await params
    const budget = await getBudgetById(id)
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    if (budget.clinic_id !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = updateBudgetSchema.parse(await request.json())
    const db = getDb()
    const set: any = { updatedAt: new Date() }
    if (body.status) set.status = body.status
    if (body.notes !== undefined) set.notes = body.notes
    if (body.valid_until !== undefined) set.validUntil = new Date(body.valid_until)
    if (body.treatment_plan_id !== undefined) set.treatmentPlanId = body.treatment_plan_id
    if (body.discount_percent !== undefined) {
      set.discountPercent = body.discount_percent
      const tv = Number(budget.total_value ?? 0)
      set.discountValue = String(tv * (body.discount_percent / 100))
      set.finalValue = String(tv - Number(set.discountValue))
    }

    const [updated] = await db.update(budgets).set(set).where(eq(budgets.id, id)).returning()
    const toSnake = (r: any) => ({
      id: r.id, clinic_id: r.clinicId, patient_id: r.patientId, title: r.title,
      status: r.status, total_value: r.totalValue, final_value: r.finalValue,
      discount_value: r.discountValue, created_at: r.createdAt?.toISOString?.() ?? null,
      updated_at: r.updatedAt?.toISOString?.() ?? null,
    })
    return NextResponse.json({ budget: toSnake(updated) })
  } catch (error) {
    if (error instanceof z.ZodError) return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const profile = auth.profile!
    const { id } = await params
    const budget = await getBudgetById(id)
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    if (budget.clinic_id !== profile.clinic_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const canHardDelete = ['owner', 'admin'].includes(profile.role)
    const hardDelete = request.nextUrl.searchParams.get('hard') === 'true' && canHardDelete
    const success = await deleteBudget(id, hardDelete)
    if (!success) return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error) }
}
