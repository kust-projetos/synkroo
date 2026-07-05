/**
 * Budget Installments API — legacy adapter.
 *
 * Thin wrapper over Financeiro services.
 * Preserves { installments, remaining_balance } response shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget } from '@/modules/financeiro/services/budget-service';
import { handleApiError, ValidationError } from '@/lib/errors';

const createInstallmentsSchema = z.object({
  installments: z.array(
    z.object({
      amount: z.number().positive(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ).min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/budgets/[id]/installments
 * Returns installments + remaining_balance for a budget.
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

    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Compute remaining balance from final value minus settled payments
    const { storeListPayments } = await import('@/modules/financeiro/repositories/financeiro-store');
    const payments = storeListPayments(id);
    const paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const finalValue = parseFloat(budget.finalValue);
    const remainingBalance = Math.max(0, finalValue - paidTotal);

    // Installments from store (empty until Task 6)
    const installments: Array<{ id: string; amount: string; due_date: string; status: string; paid_at: string | null }> = [];

    return NextResponse.json({ installments, remaining_balance: remainingBalance });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/budgets/[id]/installments
 * Create installments for a budget.
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
    const { id } = await params;

    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rawBody = await request.json();
    const body = createInstallmentsSchema.parse(rawBody);

    // Installment creation delegated to Financeiro store (stub — Task 6)
    const { storeCreatePayment } = await import('@/modules/financeiro/repositories/financeiro-store');

    const installments = body.installments.map((inst, idx) => ({
      id: `inst-${Date.now()}-${idx}`,
      budgetId: id,
      amount: String(inst.amount),
      dueDate: inst.due_date,
      status: 'pending',
    }));

    return NextResponse.json({ installments }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    }
    return handleApiError(error);
  }
}

const updateInstallmentSchema = z.object({
  amount: z.number().positive().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * PATCH /api/budgets/[id]/installments
 * Update a specific installment.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const installmentId = searchParams.get('installment_id');
    if (!installmentId) {
      return NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });
    }

    const rawBody = await request.json();
    const body = updateInstallmentSchema.parse(rawBody);

    // TODO: implement installment update via Financeiro service (Task 6)
    return NextResponse.json({
      installment: { id: installmentId, ...body },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    }
    return handleApiError(error);
  }
}

/**
 * DELETE /api/budgets/[id]/installments
 * Delete an unpaid installment.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const installmentId = searchParams.get('installment_id');
    if (!installmentId) {
      return NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });
    }

    // TODO: implement installment delete via Financeiro service (Task 6)
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
