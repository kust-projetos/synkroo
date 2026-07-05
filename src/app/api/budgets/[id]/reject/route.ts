/**
 * Budget Reject API — legacy adapter.
 * Uses Drizzle-backed Financeiro repository.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget } from '@/modules/financeiro/services/budget-service';
import { rejectBudget } from '@/modules/financeiro/services/budget-service';
import { updateBudget as repoUpdateBudget } from '@/modules/financeiro/repositories/financeiro-repository';
import { handleApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth();
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status });
    const clinicId = auth.profile!.clinic_id;
    const { id } = await params;

    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (budget.status && !['pending', 'sent'].includes(budget.status)) {
      return NextResponse.json({ error: 'Budget cannot be rejected in current status' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.reason) {
      await repoUpdateBudget(id, { notes: `Rejeitado: ${body.reason}` } as any);
    }

    const updated = await rejectBudget(id, clinicId);
    return NextResponse.json({ budget: updated, message: 'Budget rejected' });
  } catch (error) {
    return handleApiError(error);
  }
}
