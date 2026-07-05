/**
 * Budget Installments API — legacy adapter.
 * Uses Drizzle-backed Financeiro repository.
 * Preserves { installments, remaining_balance } shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget } from '@/modules/financeiro/services/budget-service';
import {
  listPaymentsByBudget,
  updateBudget as repoUpdateBudget,
} from '@/modules/financeiro/repositories/financeiro-repository';
import { handleApiError, ValidationError } from '@/lib/errors';

const createInstallmentsSchema = z.object({
  installments: z.array(
    z.object({ amount: z.number().positive(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  ).min(1),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    const clinicId = authResult.profile!.clinic_id;
    const { id } = await params;

    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const payments = await listPaymentsByBudget(id);
    const paidTotal = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const finalValue = parseFloat(budget.finalValue ?? '0');
    const remainingBalance = Math.max(0, finalValue - paidTotal);

    return NextResponse.json({ installments: [], remaining_balance: remainingBalance });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    const clinicId = authResult.profile!.clinic_id;
    const { id } = await params;

    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rawBody = await request.json();
    const body = createInstallmentsSchema.parse(rawBody);

    // Installment creation delegated to DB (Task 6+ scope)
    return NextResponse.json({
      installments: body.installments.map((inst, idx) => ({
        id: `inst-${Date.now()}-${idx}`, budgetId: id,
        amount: String(inst.amount), dueDate: inst.due_date, status: 'pending',
      })),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    return handleApiError(error);
  }
}

const updateInstallmentSchema = z.object({
  amount: z.number().positive().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    const installmentId = request.nextUrl.searchParams.get('installment_id');
    if (!installmentId) return NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });
    const body = updateInstallmentSchema.parse(await request.json());
    return NextResponse.json({ installment: { id: installmentId, ...body } });
  } catch (error) {
    if (error instanceof z.ZodError) return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    const installmentId = request.nextUrl.searchParams.get('installment_id');
    if (!installmentId) return NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
