/**
 * Budget follow-up + incomplete treatments — service bridge.
 *
 * Wraps legacy:
 *   @/services/followup/budget-followup.service.ts
 *   @/services/appointments/incomplete-treatment.service.ts
 */

import * as budgetLegacy from '@/services/followup/budget-followup.service';
import {
  detectIncompleteTreatments,
  getIncompleteTreatmentAlerts,
} from '@/services/appointments/incomplete-treatment.service';
import type { UnconvertedBudget } from '@/services/followup/budget-followup.service';
import type { IncompleteTreatment } from '@/services/appointments/incomplete-treatment.service';

export type { UnconvertedBudget };
export type { IncompleteTreatment };

// ─── Budget follow-up ───────────────────────────────────────────────────────────

export async function listarOrcamentosPendentes(
  clinicId: string
): Promise<{ budgets: UnconvertedBudget[]; total: number }> {
  const budgets = await budgetLegacy.findUnconvertedBudgets(clinicId);
  return { budgets, total: budgets.length };
}

export async function executarFollowupOrcamentos(
  clinicId: string
): Promise<{ processed: number; errors: number }> {
  return budgetLegacy.processBudgetFollowups(clinicId);
}

// ─── Incomplete treatments ──────────────────────────────────────────────────────

export async function listarTratamentosIncompletos(
  clinicId: string,
  alertsOnly?: boolean
): Promise<{ treatments?: IncompleteTreatment[]; alerts?: { total: number; highRisk: number; mediumRisk: number; treatments: IncompleteTreatment[] } }> {
  if (alertsOnly) {
    const alerts = await getIncompleteTreatmentAlerts(clinicId);
    return { alerts };
  }
  const treatments = await detectIncompleteTreatments(clinicId);
  return { treatments };
}
