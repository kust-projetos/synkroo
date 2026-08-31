import { and, eq, inArray, sql } from 'drizzle-orm';
import { pendingActions, decisionLogs, smartTriggerLog, agentLogs, agentQueue, agentDlq } from '@/modules/ia/schema/agent';

export async function exportIaForPatient(clinicId: string, patientId: string, tx: any) {
  const pendingActionRows = await tx.select().from(pendingActions).where(and(eq(pendingActions.clinicId, clinicId), eq(pendingActions.patientId, patientId)));
  const decisionLogRows = await tx.select().from(decisionLogs).where(and(eq(decisionLogs.clinicId, clinicId), eq(decisionLogs.patientId, patientId)));
  const smartTriggerRows = await tx.select().from(smartTriggerLog).where(and(eq(smartTriggerLog.clinicId, clinicId), eq(smartTriggerLog.patientId, patientId)));
  // agentLogs linked via conversationId -> need conversationIds for patient
  const convRows = await tx.execute(sql`SELECT id FROM conversations WHERE clinic_id = ${clinicId} AND patient_id = ${patientId}`);
  const convIds = (convRows.rows as any[]).map((r: any) => r.id);
  const agentLogRows = convIds.length
    ? await tx.select().from(agentLogs).where(and(eq(agentLogs.clinicId, clinicId), inArray(agentLogs.conversationId, convIds)))
    : [];
  return { pendingActions: pendingActionRows, decisionLogs: decisionLogRows, smartTriggerLog: smartTriggerRows, agentLogs: agentLogRows };
}

export async function anonymizeIaForPatient(clinicId: string, patientId: string, tx: any) {
  const now = new Date();
  await tx.delete(pendingActions).where(and(eq(pendingActions.clinicId, clinicId), eq(pendingActions.patientId, patientId), eq(pendingActions.status, 'pending')));
  await tx.update(pendingActions).set({ snapshotBefore: {}, snapshotAfter: {}, undoPayload: {}, reasoning: null, agentIntent: null, updatedAt: now })
    .where(and(eq(pendingActions.clinicId, clinicId), eq(pendingActions.patientId, patientId)));
  await tx.update(decisionLogs).set({ reasoning: '[redacted]', messageSummary: null, entitiesExtracted: {}, ragSources: [] })
    .where(and(eq(decisionLogs.clinicId, clinicId), eq(decisionLogs.patientId, patientId)));
  await tx.update(smartTriggerLog).set({ messageSent: null, patientResponse: null })
    .where(and(eq(smartTriggerLog.clinicId, clinicId), eq(smartTriggerLog.patientId, patientId)));
  const convRows = await tx.execute(sql`SELECT id FROM conversations WHERE clinic_id = ${clinicId} AND patient_id = ${patientId}`);
  const convIds = (convRows.rows as any[]).map((r: any) => r.id);
  if (convIds.length) {
    await tx.update(agentLogs).set({ conversationId: null }).where(and(eq(agentLogs.clinicId, clinicId), inArray(agentLogs.conversationId, convIds)));
  }
  // Redact agentQueue/dlq payloads that contain patientId (via generic JSON search, keep simple: check businessKey or payload)
  // For simplicity, iterate and redact similar to original lgpd-service but scoped to clinic
  const ids = [patientId, ...convIds];
  // Use existing redact helpers via direct queries: we will handle generic redaction in operacional service for agentQueue/dlq
}
