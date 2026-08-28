/**
 * Budget Payments API — legacy adapter.
 *
 * Thin wrapper over Financeiro actions.
 * Preserves the { payments } response shape for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { listPayments } from '@/modules/financeiro/services/payment-service';
import { registerManualPayment } from '@/modules/financeiro/services/payment-service';
import { handleApiError, ValidationError } from '@/lib/errors';

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.string().min(1),
  notes: z.string().optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/budgets/[id]/payments
 *
 * Returns { payments } shape for backward compatibility.
 * Delegates to financeiro payment-service.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      );
    }

    const clinicId = authResult.profile!.clinic_id;
    const { id } = await params;
    const payments = await listPayments(clinicId, id);

    return NextResponse.json({ payments });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/budgets/[id]/payments
 *
 * Delegates to financeiro payment-service.
 * Returns 201 with payment details.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      );
    }

    const clinicId = authResult.profile!.clinic_id;
    const userId = authResult.profile!.id;
    const { id } = await params;

    const rawBody = await request.json();
    const body = recordPaymentSchema.parse(rawBody);

    const payment = await registerManualPayment({
      clinicId,
      budgetId: id,
      amount: body.amount,
      paymentMethod: body.payment_method,
      notes: body.notes,
      actorUserId: userId ?? null,
    });

    return NextResponse.json({ payment, remaining_balance: null }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    }
    return handleApiError(error);
  }
}
