/**
 * Budget Installments API
 * Endpoints for managing budget installments
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import {
  createInstallments,
  getInstallmentsByBudget,
  updateInstallment,
  deleteInstallment,
  markInstallmentPaid,
  getRemainingBalance,
} from '@/services/installments/installment.service'
import { handleApiError, ValidationError } from '@/lib/errors'

const createInstallmentsSchema = z.object({
  installments: z.array(
    z.object({
      amount: z.number().positive(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
  ).min(1),
})

const updateInstallmentSchema = z.object({
  amount: z.number().positive().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/budgets/[id]/installments
 * Get installments for a budget
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

    const installments = await getInstallmentsByBudget(id)
    const remainingBalance = await getRemainingBalance(id)

    return NextResponse.json({ installments, remaining_balance: remainingBalance })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/budgets/[id]/installments
 * Create multiple installments for a budget
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

    const { id } = await params
    const rawBody = await request.json()
    const body = createInstallmentsSchema.parse(rawBody)

    const installments = await createInstallments(id, body.installments.map(i => ({ ...i, budget_id: id })))

    return NextResponse.json({ installments }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * PATCH /api/budgets/[id]/installments
 * Update a specific installment
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const installmentId = searchParams.get('installment_id')

    if (!installmentId) {
      return NextResponse.json(
        { error: 'installment_id query parameter is required' },
        { status: 400 }
      )
    }

    const rawBody = await request.json()
    const body = updateInstallmentSchema.parse(rawBody)

    const installment = await updateInstallment(installmentId, body)

    if (!installment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    return NextResponse.json({ installment })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    if (error instanceof Error && error.message.includes('paid')) {
      return handleApiError(new ValidationError(error.message))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/budgets/[id]/installments
 * Delete an unpaid installment
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

    const searchParams = request.nextUrl.searchParams
    const installmentId = searchParams.get('installment_id')

    if (!installmentId) {
      return NextResponse.json(
        { error: 'installment_id query parameter is required' },
        { status: 400 }
      )
    }

    const success = await deleteInstallment(installmentId)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete installment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('paid')) {
      return handleApiError(new ValidationError(error.message))
    }
    return handleApiError(error)
  }
}
