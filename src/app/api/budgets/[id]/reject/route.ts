/**
 * Budget Reject API — legacy adapter.
 *
 * Thin wrapper over Financeiro budget service.
 * Preserves { budget, message } response shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget } from '@/modules/financeiro/services/budget-service';
import { rejectBudget } from '@/modules/financeiro/services/budget-service';
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
    if (!['pending', 'sent'].includes(budget.status)) {
      return NextResponse.json({ error: 'Budget cannot be rejected in current status' }, { status: 400 });
    }

    // Handle rejection reason via the store
    const body = await request.json().catch(() => ({}));
    if (body.reason) {
      const { storeUpdateBudget } = await import('@/modules/financeiro/repositories/financeiro-store');
      storeUpdateBudget(id, { notes: `Rejeitado: ${body.reason}` });
    }

    const updated = await rejectBudget(id, clinicId);
    return NextResponse.json({ budget: updated, message: 'Budget rejected' });
  } catch (error) {
    return handleApiError(error);
  }
}
