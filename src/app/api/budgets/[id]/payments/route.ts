/**
 * Budget Payments API
 * Endpoints for recording and listing payments
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { recordPayment, getPaymentsByBudget } from '@/services/payments/payment.service'
import { handleApiError, ValidationError } from '@/lib/errors'

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.string().min(1),
  notes: z.string().optional(),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/budgets/[id]/payments
 * List payments for a budget
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

    const { id } = await params

    const payments = await getPaymentsByBudget(id)

    return NextResponse.json({ payments })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/budgets/[id]/payments
 * Record a payment (triggers D-09 auto-complete and D-11 budget status)
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

    const userId = authResult.profile!.id
    const { id } = await params

    const rawBody = await request.json()
    const body = recordPaymentSchema.parse(rawBody)

    const result = await recordPayment({
      budget_id: id,
      amount: body.amount,
      payment_method: body.payment_method,
      notes: body.notes,
      created_by: userId,
    })

    return NextResponse.json({
      payment: result.payment,
      sessions_completed: result.sessions_completed,
      remaining_balance: result.remaining_balance,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    if (error instanceof Error && error.message.includes('exceeds')) {
      return handleApiError(new ValidationError(error.message))
    }
    return handleApiError(error)
  }
}
