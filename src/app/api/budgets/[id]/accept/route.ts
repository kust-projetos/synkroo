/**
 * Budget Accept API — legacy adapter.
 *
 * Thin wrapper over Financeiro budget service.
 * Preserves { budget, message } response shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget, acceptBudget } from '@/modules/financeiro/services/budget-service';
import { handleApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await validateApiAuth('financeiro:manage_budget');
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status });
    const clinicId = auth.profile!.clinic_id;
    const { id } = await params;

    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.status && !['pending', 'sent'].includes(budget.status)) {
      return NextResponse.json({ error: 'Budget cannot be accepted in current status' }, { status: 400 });
    }

    const updated = await acceptBudget(id, clinicId);
    return NextResponse.json({ budget: updated, message: 'Budget accepted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
