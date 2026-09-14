/**
 * Budget Send API — legacy adapter.
 * Delegates WhatsApp send to Atendimento action when requested.
 * Resolves patient phone from budget → patient DB.
 */

import { NextRequest } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { getBudget, markBudgetSent } from '@/modules/financeiro';
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId);
    }

    const clinicId = authResult.profile!.clinic_id;
    const { id } = await params;
    const budget = await getBudget(id);
    if (!budget) return apiFailure('NOT_FOUND', 'Budget not found', requestId, 404);
    if (budget.clinicId !== clinicId) return apiFailure('FORBIDDEN', 'Forbidden', requestId, 403);

    const body = await request.json().catch(() => ({}));
    const { send_whatsapp = false } = body;

    const updatedBudget = await markBudgetSent(id, clinicId);
    if (!updatedBudget) return apiFailure('INTERNAL_ERROR', 'Failed to update budget', requestId, 500);

    let whatsappSent = false;
    let whatsappError: string | null = null;

    if (send_whatsapp) {
      try {
        // Resolve patient phone via DB
        const { getDb } = await import('@/lib/db/client');
        const { eq } = await import('drizzle-orm');
        const { patients } = await import('@/lib/db/schema');

        let patientPhone: string | null = null;

        if (budget.patientId) {
          const db = getDb();
          const [patient] = await db
            .select({ phone: patients.phone })
            .from(patients)
            .where(eq(patients.id, budget.patientId))
            .limit(1);

          if (patient) {
            patientPhone = patient.phone || null;
          }
        }

        if (!patientPhone) {
          whatsappError = 'missing_patient_phone';
        } else {
          const { enviarMensagemDireta } = await import('@/modules/atendimento');
          const { runAction } = await import('@/core/actions/run');
          const { buildSystemContext } = await import('@/core/actions/context');

          const ctx = await buildSystemContext(clinicId);
          const result = await runAction(enviarMensagemDireta, {
            channel: 'whatsapp',
            externalId: patientPhone,
            message: `Olá! Seu orçamento foi enviado.`,
          }, ctx);

          whatsappSent = result.ok;
          if (!result.ok) whatsappError = result.error.message;
        }
      } catch (err) {
        whatsappError = err instanceof Error ? err.message : 'unknown_error';
      }
    }

    return apiSuccess({
      budget: updatedBudget,
      whatsapp_sent: whatsappSent,
      whatsapp_error: whatsappError,
    });
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500);
  }
}
