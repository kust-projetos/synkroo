/**
 * Budget Installments API — legacy adapter.
 * Uses Drizzle-backed Financeiro repositories.
 * Preserves { installments, remaining_balance } shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import {
  listInstallments,
  calculateRemainingBalance,
  replaceInstallments,
} from '@/modules/financeiro/services/installment-service';
import {
  getBudgetForClinic,
  updateInstallmentForBudget,
  deleteInstallmentForBudget,
} from '@/modules/financeiro/services/budget-scope-service';
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

    const budget = await getBudgetForClinic(id, clinicId);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

    const installments = await listInstallments(clinicId, id);
    const remainingBalance = await calculateRemainingBalance(clinicId, id);

    return NextResponse.json({ installments, remaining_balance: remainingBalance });
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

    const budget = await getBudgetForClinic(id, clinicId);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

    const rawBody = await request.json();
    const body = createInstallmentsSchema.parse(rawBody);

    // Map legacy snake_case to Financeiro camelCase
    const installments = body.installments.map(i => ({
      amount: i.amount,
      dueDate: i.due_date,
    }));

    const saved = await replaceInstallments(clinicId, id, installments);

    return NextResponse.json({ installments: saved }, { status: 201 });
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
    const clinicId = authResult.profile!.clinic_id;
    const { id: budgetId } = await params;

    const { searchParams } = new URL(request.url);
    const installmentId = searchParams.get('installment_id');
    if (!installmentId) return NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });

    // Scope: budget must belong to caller's clinic
    const budget = await getBudgetForClinic(budgetId, clinicId);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

    const body = updateInstallmentSchema.parse(await request.json());

    const patch: Record<string, unknown> = {};
    if (body.amount !== undefined) patch.amount = String(body.amount);
    if (body.due_date !== undefined) patch.dueDate = body.due_date;

    const updated = await updateInstallmentForBudget(installmentId, budgetId, patch);

    if (!updated) return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
    return NextResponse.json({ installment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    const clinicId = authResult.profile!.clinic_id;
    const { id: budgetId } = await params;

    const { searchParams } = new URL(request.url);
    const installmentId = searchParams.get('installment_id');
    if (!installmentId) return NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });

    // Scope: budget must belong to caller's clinic
    const budget = await getBudgetForClinic(budgetId, clinicId);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });

    const deleted = await deleteInstallmentForBudget(installmentId, budgetId);

    if (!deleted) return NextResponse.json({ error: 'Installment not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
