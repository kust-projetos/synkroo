/**
 * Budget Send API — legacy adapter.
 * Preserves { budget, whatsapp_sent } response shape.
 * Delegates WhatsApp send to Atendimento action when requested.
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

    let whatsappSent = false;
    let whatsappError: string | null = null;

    if (send_whatsapp) {
      try {
        // Delegate to Atendimento action for WhatsApp send
        const { enviarMensagemDireta } = await import('@/modules/atendimento/actions/enviar-mensagem-direta');
        const { runAction } = await import('@/core/actions/run');
        const { buildSystemContext } = await import('@/core/actions/context');

        const patientPhone = null; // Would need patient phone resolution
        if (patientPhone) {
          const ctx = await buildSystemContext(clinicId);
          const result = await runAction(enviarMensagemDireta, {
            channel: 'whatsapp',
            externalId: patientPhone,
            message: `Olá! Seu orçamento foi enviado.`,
          }, ctx);
          whatsappSent = result.ok;
          if (!result.ok) whatsappError = result.error.message;
        } else {
          whatsappError = 'whatsapp_integration_pending';
        }
      } catch (err) {
        whatsappError = err instanceof Error ? err.message : 'unknown_error';
      }
    }

    return NextResponse.json({
      budget: updatedBudget,
      whatsapp_sent: whatsappSent,
      whatsapp_error: whatsappError,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
