/**
 * Budget Send API — legacy adapter.
 *
 * Thin wrapper over Financeiro budget service + WhatsApp stub.
 * Preserves { budget, whatsapp_sent } response shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget, markBudgetSent } from '@/modules/financeiro/services/budget-service';
import { handleApiError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    }

    const clinicId = authResult.profile!.clinic_id;
    const { id } = await params;
    const budget = await getBudget(id);
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    if (budget.clinicId !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const { send_whatsapp = false } = body;

    const updatedBudget = await markBudgetSent(id, clinicId);
    if (!updatedBudget) return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });

    // WhatsApp delegated through Atendimento — stub until integration
    let whatsappSent = false;
    if (send_whatsapp) {
      // TODO: delegate to Atendimento action for WhatsApp send
      whatsappSent = false;
    }

    return NextResponse.json({
      budget: updatedBudget,
      whatsapp_sent: whatsappSent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
