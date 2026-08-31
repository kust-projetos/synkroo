/**
 * Financeiro LGPD contribution — tenant-safe export/anonymize for patient-related
 * financeiro tables. Owned by Financeiro, registered at bootstrap, consumed by
 * Operacional LGPD orchestrator via registry (no direct schema cross-import in lgpd-service).
 */
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import {
  budgets,
  budgetItems,
  budgetInstallments,
  payments,
  paymentCharges,
  gatewayEvents,
  gatewayRoutingRules,
  collectionAttempts,
} from '@/modules/financeiro/schema';

function hasIds(ids: readonly string[]): ids is [string, ...string[]] {
  return ids.length > 0;
}
async function selectByIds(tx: any, table: any, column: any, ids: string[]) {
  if (!hasIds(ids)) return [];
  return tx.select().from(table).where(inArray(column as never, ids));
}

export async function exportFinanceiroForPatient(clinicId: string, patientId: string, tx: any) {
  // Budgets: patientId direct OR leadId where lead belongs to patient (via subquery, no schema import)
  const budgetRows = await tx.select().from(budgets).where(and(
    eq(budgets.clinicId, clinicId),
    or(
      eq(budgets.patientId, patientId),
      sql`${budgets.leadId} IN (SELECT id FROM leads WHERE clinic_id = ${clinicId} AND patient_id = ${patientId})`,
    ),
  ));
  const budgetIds = budgetRows.map((r: { id: string }) => r.id);
  const budgetItemRows = await selectByIds(tx, budgetItems, budgetItems.budgetId, budgetIds);
  const budgetInstallmentRows = await selectByIds(tx, budgetInstallments, budgetInstallments.budgetId, budgetIds);
  const paymentRows = await tx.select().from(payments).where(and(
    eq(payments.clinicId, clinicId),
    hasIds(budgetIds) ? or(eq(payments.patientId, patientId), inArray(payments.budgetId, budgetIds)) : eq(payments.patientId, patientId),
  ));
  const chargeRows = await selectByIds(tx, paymentCharges, paymentCharges.budgetId, budgetIds);
  const chargeIds = chargeRows.map((r: { id: string }) => r.id);
  const installmentIds = budgetInstallmentRows.map((r: { id: string }) => r.id);
  const gatewayEventRows = hasIds(chargeIds)
    ? await tx.select().from(gatewayEvents).where(and(eq(gatewayEvents.clinicId, clinicId), inArray(gatewayEvents.chargeId, chargeIds)))
    : [];
  const collectionAttemptRows = hasIds(chargeIds) || hasIds(installmentIds)
    ? await tx.select().from(collectionAttempts).where(and(
      eq(collectionAttempts.clinicId, clinicId),
      or(
        ...(hasIds(chargeIds) ? [inArray(collectionAttempts.chargeId, chargeIds)] : []),
        ...(hasIds(installmentIds) ? [inArray(collectionAttempts.installmentId, installmentIds)] : []),
      ),
    ))
    : [];
  const routingRuleRows = await tx.select().from(gatewayRoutingRules).where(and(
    eq(gatewayRoutingRules.clinicId, clinicId),
    or(
      eq(gatewayRoutingRules.patientId, patientId),
      sql`${gatewayRoutingRules.leadId} IN (SELECT id FROM leads WHERE clinic_id = ${clinicId} AND patient_id = ${patientId})`,
    ),
  ));
  return {
    budgets: budgetRows,
    budgetItems: budgetItemRows,
    budgetInstallments: budgetInstallmentRows,
    payments: paymentRows,
    paymentCharges: chargeRows,
    gatewayEvents: gatewayEventRows,
    collectionAttempts: collectionAttemptRows,
    gatewayRoutingRules: routingRuleRows,
  };
}

export async function anonymizeFinanceiroForPatient(clinicId: string, patientId: string, tx: any) {
  const now = new Date();
  // Reuse export logic to find budgetIds/chargeIds within same tx
  const { budgets: budgetRows, budgetInstallments, paymentCharges: chargeRows } = await exportFinanceiroForPatient(clinicId, patientId, tx);
  const budgetIds = (budgetRows as any[]).map((r: any) => r.id);
  const chargeIds = (chargeRows as any[]).map((r: any) => r.id);
  if (hasIds(budgetIds)) {
    await tx.update(budgets).set({ title: null, description: null, notes: null, updatedAt: now })
      .where(and(eq(budgets.clinicId, clinicId), inArray(budgets.id, budgetIds)));
    await tx.update(budgetItems).set({ notes: null }).where(inArray(budgetItems.budgetId, budgetIds));
    await tx.update(payments).set({ notes: null, updatedAt: now }).where(and(
      eq(payments.clinicId, clinicId),
      or(eq(payments.patientId, patientId), inArray(payments.budgetId, budgetIds)),
    ));
    await tx.update(paymentCharges).set({
      externalChargeId: `charge-${patientId.slice(0, 8)}`,
      paymentUrl: null, pixQrCode: null, updatedAt: now,
    }).where(and(eq(paymentCharges.clinicId, clinicId), inArray(paymentCharges.budgetId, budgetIds)));
    if (hasIds(chargeIds)) {
      await tx.update(gatewayEvents).set({ payload: null }).where(and(eq(gatewayEvents.clinicId, clinicId), inArray(gatewayEvents.chargeId, chargeIds)));
      await tx.update(collectionAttempts).set({ errorMessage: null }).where(and(eq(collectionAttempts.clinicId, clinicId), inArray(collectionAttempts.chargeId, chargeIds)));
    }
    // Also collectionAttempts via installmentIds
    const installmentIds = (budgetInstallments as any[]).map((r: any) => r.id);
    if (hasIds(installmentIds)) {
      await tx.update(collectionAttempts).set({ errorMessage: null }).where(and(eq(collectionAttempts.clinicId, clinicId), inArray(collectionAttempts.installmentId, installmentIds)));
    }
  }
  await tx.update(gatewayRoutingRules).set({ patientId: null })
    .where(and(eq(gatewayRoutingRules.clinicId, clinicId), eq(gatewayRoutingRules.patientId, patientId)));
  // Lead-linked routing rules: nullify leadId where lead belongs to patient
  await tx.execute(sql`UPDATE gateway_routing_rules SET lead_id = NULL, updated_at = ${now}
    WHERE clinic_id = ${clinicId} AND lead_id IN (SELECT id FROM leads WHERE clinic_id = ${clinicId} AND patient_id = ${patientId})`);
}
