import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { budgets } from '@/modules/financeiro/schema';
import { patients } from '@/modules/operacional/schema/patients';
import { dbLogger } from '@/lib/logger';
import { detectIncompleteTreatments, getIncompleteTreatmentAlerts } from '@/modules/operacional/public';
import type { IncompleteTreatment } from '@/modules/operacional/public';

export interface UnconvertedBudget {
  id: string;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  clinic_id: string;
  total_value: number;
  created_at: string;
  days_since_created: number;
  followup_stage: number;
  status: string;
}

export type { IncompleteTreatment };

const FOLLOWUP_STAGES = [
  { day: 7, message: 'Olá! Tudo bem? Gostaria de saber se teve oportunidade de avaliar o orçamento que enviamos. Podemos ajustar se necessário!' },
  { day: 14, message: 'Oi! Estamos passando para saber se ainda tem interesse no tratamento. Temos condições especiais de pagamento que podem ajudar!' },
];

export async function listarOrcamentosPendentes(clinicId: string): Promise<{ budgets: UnconvertedBudget[]; total: number }> {
  try {
    const rows = await getDb().select().from(budgets)
      .leftJoin(patients, eq(budgets.patientId, patients.id))
      .where(and(eq(budgets.clinicId, clinicId), inArray(budgets.status as any, ['sent', 'pending'])))
      .orderBy(asc(budgets.createdAt));
    const now = Date.now();
    const result = rows.flatMap(({ budgets: budget, patients: patient }) => {
      const createdAt = budget.createdAt ?? new Date();
      const days = Math.floor((now - createdAt.getTime()) / 86_400_000);
      const stage = Number(budget.notes?.match(/\[followup-stage-(\d+)-date/)?.[1] ?? 0);
      if (days < FOLLOWUP_STAGES[0].day) return [];
      return [{
        id: budget.id,
        patient_id: budget.patientId,
        patient_name: patient?.name ?? 'Desconhecido',
        patient_phone: patient?.phone ?? null,
        clinic_id: budget.clinicId,
        total_value: Number(budget.totalValue ?? 0),
        created_at: createdAt.toISOString(),
        days_since_created: days,
        followup_stage: stage,
        status: budget.status ?? '',
      }];
    }).sort((a, b) => b.days_since_created - a.days_since_created);
    return { budgets: result, total: result.length };
  } catch (error) {
    dbLogger.error('Error finding unconverted budgets', error);
    return { budgets: [], total: 0 };
  }
}

export async function executarFollowupOrcamentos(clinicId: string): Promise<{ processed: number; errors: number }> {
  const { budgets: pending } = await listarOrcamentosPendentes(clinicId);
  let processed = 0;
  let errors = 0;
  for (const budget of pending) {
    const stage = budget.followup_stage + 1;
    if (stage > FOLLOWUP_STAGES.length || budget.days_since_created < FOLLOWUP_STAGES[stage - 1].day) continue;
    try {
      const marker = `[followup-stage-${stage}-date: ${new Date().toISOString().split('T')[0]}]`;
      const notes = budget.status ? marker : marker;
      const current = await getDb().select({ notes: budgets.notes }).from(budgets).where(and(
        eq(budgets.id, budget.id),
        eq(budgets.clinicId, clinicId),
      )).limit(1);
      await getDb().update(budgets).set({ notes: current[0]?.notes ? `${current[0].notes}\n${notes}` : notes, updatedAt: new Date() })
        .where(and(eq(budgets.id, budget.id), eq(budgets.clinicId, clinicId)));
      processed += 1;
    } catch (error) {
      dbLogger.error('Error sending budget follow-up', error, { budgetId: budget.id });
      errors += 1;
    }
  }
  return { processed, errors };
}

export async function listarTratamentosIncompletos(
  clinicId: string,
  alertsOnly?: boolean,
): Promise<{ treatments?: IncompleteTreatment[]; alerts?: { total: number; highRisk: number; mediumRisk: number; treatments: IncompleteTreatment[] } }> {
  if (alertsOnly) return { alerts: await getIncompleteTreatmentAlerts(clinicId) };
  return { treatments: await detectIncompleteTreatments(clinicId) };
}
