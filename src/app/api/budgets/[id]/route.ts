import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import {
  getBudgetById,
  deleteBudget,
} from '@/services/budgets/budget.service'
import { updateBudgetSchema } from '@/lib/validations'
import { apiLogger } from '@/lib/logger'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/budgets/[id]
 * Get budget by ID
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

    const { id } = await params
    const budget = await getBudgetById(id)

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    if (budget.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ budget })
  } catch (error) {
    apiLogger.error('Error fetching budget', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/budgets/[id]
 * Update budget status or details
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params
    const budget = await getBudgetById(id)

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    if (budget.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rawBody = await request.json()
    const body = updateBudgetSchema.parse(rawBody)

    const supabase = await createTypedClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.valid_until !== undefined) updateData.valid_until = body.valid_until
    if (body.discount_percent !== undefined) {
      updateData.discount_percent = body.discount_percent
      const totalValue = budget.total_value || 0
      updateData.discount_value = totalValue * (body.discount_percent / 100)
      updateData.final_value = totalValue - (updateData.discount_value as number)
    }

    const { data: updatedBudget, error } = await supabase
      .from('budgets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      apiLogger.error('Error updating budget', error)
      return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })
    }

    return NextResponse.json({ budget: updatedBudget })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    apiLogger.error('Error updating budget', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/budgets/[id]
 * Delete or expire a budget
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }
    const profile = authResult.profile!

    const { id } = await params
    const budget = await getBudgetById(id)

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    if (budget.clinic_id !== profile.clinic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const canHardDelete = ['owner', 'admin'].includes(profile.role)
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true' && canHardDelete

    const success = await deleteBudget(id, hardDelete)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error deleting budget', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
