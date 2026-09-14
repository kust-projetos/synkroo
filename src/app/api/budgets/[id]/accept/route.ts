/**
 * Budget Accept API — contrato canônico (D2 lote 3/5).
 *
 * Thin wrapper over Financeiro budget service.
 * Resposta canônica: { data: { budget, message } }.
 */

import { NextRequest } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response';
import { withModuleRoute } from '@/core/modules/gates';
import { getBudget, acceptBudget } from '@/modules/financeiro/services/budget-service';

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
    // Pré-condição espelha o service (acceptBudget só aceita 'pending'):
    // estado não-aceitável → 409 canônico em vez de 500 do throw interno.
    if (budget.status !== 'pending') {
      return apiFailure('CONFLICT', 'Budget cannot be accepted in current status', requestId, 409);
    }

    const updated = await acceptBudget(id, clinicId);
    return apiSuccess({ budget: updated, message: 'Budget accepted successfully' });
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500);
  }
}

export const POST = withModuleRoute('financeiro')(handlePOST);
