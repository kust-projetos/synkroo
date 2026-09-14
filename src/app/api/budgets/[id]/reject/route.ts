/**
 * Budget Reject API — contrato canônico (D2 lote 3/5).
 * Uses Drizzle-backed Financeiro repository.
 * Resposta canônica: { data: { budget, message } }.
 */

import { NextRequest } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response';
import { withModuleRoute } from '@/core/modules/gates';
import { getBudget } from '@/modules/financeiro/services/budget-service';
import { rejectBudget } from '@/modules/financeiro/services/budget-service';
import { updateBudget as repoUpdateBudget, type BudgetRow } from '@/modules/financeiro/repositories/financeiro-repository';

type RouteParams = { params: Promise<{ id: string }> };

async function handlePOST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  try {
    const auth = await validateApiAuth('financeiro:manage_budget');
    if (!auth.success) return apiAuthFailure(auth.error, requestId);
    const clinicId = auth.profile!.clinic_id;
    const { id } = await params;

    const budget = await getBudget(id);
    if (!budget) return apiFailure('NOT_FOUND', 'Budget not found', requestId, 404);
    if (budget.clinicId !== clinicId) return apiFailure('NOT_FOUND', 'Budget not found', requestId, 404);
    if (budget.status && !['pending', 'sent'].includes(budget.status)) {
      return apiFailure('BAD_REQUEST', 'Budget cannot be rejected in current status', requestId, 400);
    }

    const body = await request.json().catch(() => ({}));
    if (body.reason) {
      const patch: Partial<BudgetRow> = { notes: `Rejeitado: ${body.reason}` };
      await repoUpdateBudget(id, patch);
    }

    const updated = await rejectBudget(id, clinicId);
    return apiSuccess({ budget: updated, message: 'Budget rejected' });
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500);
  }
}

export const POST = withModuleRoute('financeiro')(handlePOST);
