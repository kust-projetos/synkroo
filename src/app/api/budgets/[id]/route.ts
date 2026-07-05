/**
 * Budget Detail API — legacy adapter.
 * Uses Drizzle-backed Financeiro repository.
 * Preserves { budget } response shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget } from '@/modules/financeiro/services/budget-service';
import { updateBudget, deleteBudgetDb, type BudgetRow } from '@/modules/financeiro/repositories/financeiro-repository';
import { handleApiError, ValidationError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth();
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status });
    const clinicId = auth.profile!.clinic_id;
    const { id } = await params;
    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ budget });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateBudgetSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional(),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth();
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status });
    const clinicId = auth.profile!.clinic_id;
    const { id } = await params;
    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = updateBudgetSchema.parse(await request.json());
    const patch: Partial<BudgetRow> = {};
    if (body.status) patch.status = body.status;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.valid_until !== undefined) patch.validUntil = body.valid_until;
    if (body.discount_percent !== undefined) {
      patch.discountPercent = String(body.discount_percent);
      const tv = Number(budget.totalValue);
      const dv = tv * (body.discount_percent / 100);
      patch.discountValue = String(dv);
      patch.finalValue = String(tv - dv);
    }

    const updated = await updateBudget(id, patch);
    if (!updated) return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
    return NextResponse.json({ budget: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return handleApiError(new ValidationError('Validation failed', { issues: error.issues }));
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth();
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status });
    const clinicId = auth.profile!.clinic_id;
    const { id } = await params;
    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await deleteBudgetDb(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
