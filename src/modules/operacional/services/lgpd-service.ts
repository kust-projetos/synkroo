import { createHash, createHmac } from 'node:crypto';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { ActionError } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import {
  appointments,
  appointmentReminders,
  waitlist,
  patients,
  patientObservations,
  patientPreferences,
  patientRiskScores,
  patientFeedback,
} from '@/modules/operacional/schema';
import { treatmentPlans, treatmentPlanItems } from '@/modules/operacional/schema/treatments';
import { auditLogs, outboxJobs } from '@/core/schema/infra';
import { actionLogs } from '@/lib/db/schema/audit';
import { getLGPDContributions } from './lgpd-registry';

// The transaction type differs from the shared database type. The service only
// needs the common Drizzle query surface, so keeping this boundary structural
// also makes the unit seam easy to exercise without exporting DB internals.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbExecutor = any;

const CONTACT_TYPES = ['patient', 'lead'] as const;

function pseudonym(prefix: string, value: string): string {
  return `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

function hasIds(ids: readonly string[]): ids is [string, ...string[]] {
  return ids.length > 0;
}

function containsAnyId(value: unknown, ids: ReadonlySet<string>): boolean {
  if (typeof value === 'string') return ids.has(value);
  if (Array.isArray(value)) return value.some((item) => containsAnyId(item, ids));
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some((item) => containsAnyId(item, ids));
}

function validUuid(value: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function auditFingerprint(clinicId: string, patient: Record<string, unknown>): string {
  const payload = JSON.stringify({
    clinicId,
    id: patient.id,
    name: patient.name,
    phone: patient.phone,
    email: patient.email,
    cpf: patient.cpf,
    birthDate: patient.birthDate,
  });
  const secret = process.env.LGPD_AUDIT_HMAC_SECRET ?? process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
  if (secret) return createHmac('sha256', secret).update(payload).digest('hex');
  return createHash('sha256').update(payload).digest('hex');
}

async function selectByIds(db: DbExecutor, table: unknown, column: unknown, ids: string[]) {
  if (!hasIds(ids)) return [];
  return db.select().from(table).where(inArray(column as never, ids));
}

/**
 * Loads every exportable relation from the approved W4 matrix. Tables without
 * clinic_id are reached through an already tenant-scoped parent relation.
 * External modules are loaded via LGPD contributions (no direct schema imports).
 */
async function loadPatientGraph(db: DbExecutor, clinicId: string, patientId: string) {
  const [patient] = await db.select().from(patients).where(and(
    eq(patients.id, patientId),
    eq(patients.clinicId, clinicId),
  )).limit(1);
  if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');

  const appointmentRows = await db.select().from(appointments).where(and(
    eq(appointments.clinicId, clinicId),
    eq(appointments.patientId, patientId),
  ));
  const appointmentIds = appointmentRows.map((row: { id: string }) => row.id);

  const waitlistRows = await db.select().from(waitlist).where(and(
    eq(waitlist.clinicId, clinicId),
    eq(waitlist.patientId, patientId),
  ));

  const observationRows = await db.select().from(patientObservations).where(and(
    eq(patientObservations.clinicId, clinicId),
    eq(patientObservations.patientId, patientId),
  ));
  const preferenceRows = await db.select().from(patientPreferences).where(and(
    eq(patientPreferences.clinicId, clinicId),
    eq(patientPreferences.patientId, patientId),
  ));
  const riskScoreRows = await db.select().from(patientRiskScores).where(eq(patientRiskScores.patientId, patientId));
  const feedbackRows = await db.select().from(patientFeedback).where(and(
    eq(patientFeedback.clinicId, clinicId),
    eq(patientFeedback.patientId, patientId),
  ));

  const treatmentPlanRows = await db.select().from(treatmentPlans).where(and(
    eq(treatmentPlans.clinicId, clinicId),
    eq(treatmentPlans.patientId, patientId),
  ));
  const treatmentPlanIds = treatmentPlanRows.map((row: { id: string }) => row.id);
  const treatmentPlanItemRows = await selectByIds(db, treatmentPlanItems, treatmentPlanItems.treatmentPlanId, treatmentPlanIds);

  // External modules via contributions (tenant-safe, injected at composition root)
  const contributions = getLGPDContributions();
  const externalData: Record<string, unknown[]> = {};
  for (const contrib of contributions) {
    try {
      const data = await contrib.exportData(clinicId, patientId, db);
      for (const [key, rows] of Object.entries(data)) {
        externalData[key] = (externalData[key] ?? []).concat(rows as unknown[]);
      }
    } catch {
      // Fail closed: contribution errors should not leak patient data; rethrow as not_found for tenant isolation
      throw new ActionError('not_found', 'Paciente não encontrado.');
    }
  }

  // Extract IDs for related audit redaction (aggregate from all sources)
  const conversationIds = ((externalData.conversations as any[]) ?? []).map((r: any) => r.id);
  const leadIds = ((externalData.leads as any[]) ?? []).map((r: any) => r.id);
  const budgetIds = ((externalData.budgets as any[]) ?? []).map((r: any) => r.id);
  const chargeIds = ((externalData.paymentCharges as any[]) ?? []).map((r: any) => r.id);
  const installmentIds = ((externalData.budgetInstallments as any[]) ?? []).map((r: any) => r.id);
  const campaignIds = ((externalData.campaigns as any[]) ?? []).map((r: any) => r.id);

  const relatedIds = [
    patientId,
    ...appointmentIds,
    ...conversationIds,
    ...leadIds,
    ...budgetIds,
    ...chargeIds,
    ...installmentIds,
    ...treatmentPlanIds,
    ...campaignIds,
  ];
  const relatedAuditRows = await db.select().from(auditLogs).where(and(
    eq(auditLogs.clinicId, clinicId),
    inArray(auditLogs.entityId, relatedIds),
  ));
  // T3: filter actionLogs by verifiable link to the patient; if no reliable link, omit (never export whole clinic).
  // Current schema has no direct FK to patient, so we check inputRedacted for any relatedId.
  // This prevents same-clinic leakage (export A must not contain B's actions).
  const allActionLogsForClinic = await db.select().from(actionLogs).where(eq(actionLogs.clinicId, clinicId));
  const relatedIdsSet = new Set(relatedIds);
  const clinicActionRows = allActionLogsForClinic.filter((row: any) => containsAnyId(row.inputRedacted, relatedIdsSet));

  return {
    patient,
    observations: observationRows,
    preferences: preferenceRows,
    riskScores: riskScoreRows,
    feedback: feedbackRows,
    appointments: appointmentRows,
    appointmentReminders: await selectByIds(db, appointmentReminders, appointmentReminders.appointmentId, appointmentIds),
    waitlist: waitlistRows,
    treatmentPlans: treatmentPlanRows,
    treatmentPlanItems: treatmentPlanItemRows,
    // External data via contributions
    conversations: (externalData.conversations as any[]) ?? [],
    messages: (externalData.messages as any[]) ?? [],
    conversationStates: (externalData.conversationStates as any[]) ?? [],
    conversationSessions: (externalData.conversationSessions as any[]) ?? [],
    conversationMemories: (externalData.conversationMemories as any[]) ?? [],
    budgets: (externalData.budgets as any[]) ?? [],
    budgetItems: (externalData.budgetItems as any[]) ?? [],
    budgetInstallments: (externalData.budgetInstallments as any[]) ?? [],
    payments: (externalData.payments as any[]) ?? [],
    paymentCharges: (externalData.paymentCharges as any[]) ?? [],
    gatewayEvents: (externalData.gatewayEvents as any[]) ?? [],
    collectionAttempts: (externalData.collectionAttempts as any[]) ?? [],
    gatewayRoutingRules: (externalData.gatewayRoutingRules as any[]) ?? [],
    leads: (externalData.leads as any[]) ?? [],
    leadActivities: (externalData.leadActivities as any[]) ?? [],
    tasks: (externalData.tasks as any[]) ?? [],
    campaignRecipients: (externalData.campaignRecipients as any[]) ?? [],
    followUps: (externalData.followUps as any[]) ?? [],
    consents: (externalData.consents as any[]) ?? [],
    customFieldValues: (externalData.customFieldValues as any[]) ?? [],
    pendingActions: (externalData.pendingActions as any[]) ?? [],
    decisionLogs: (externalData.decisionLogs as any[]) ?? [],
    smartTriggerLog: (externalData.smartTriggerLog as any[]) ?? [],
    agentLogs: (externalData.agentLogs as any[]) ?? [],
    auditLogs: relatedAuditRows,
    actionLogs: clinicActionRows,
    relatedIds,
  };
}

function sanitizeAuditRecord(row: Record<string, unknown>) {
  const oldValues = row.oldValues;
  const newValues = row.newValues;
  return {
    ...row,
    oldValues: oldValues && typeof oldValues === 'object'
      ? {
        fieldsPresent: Array.isArray((oldValues as Record<string, unknown>).fieldsPresent)
          ? (oldValues as Record<string, unknown>).fieldsPresent
          : [],
        legalHold: Boolean((oldValues as Record<string, unknown>).legalHold),
        fingerprint: typeof (oldValues as Record<string, unknown>).fingerprint === 'string'
          ? (oldValues as Record<string, unknown>).fingerprint
          : undefined,
      }
      : { fieldsPresent: [], legalHold: false },
    newValues: newValues && typeof newValues === 'object'
      ? {
        anonymized: Boolean((newValues as Record<string, unknown>).anonymized),
        fieldsCleared: Array.isArray((newValues as Record<string, unknown>).fieldsCleared)
          ? (newValues as Record<string, unknown>).fieldsCleared
          : [],
      }
      : { anonymized: false, fieldsCleared: [] },
  };
}

export async function exportPatientData(clinicId: string, patientId: string) {
  const graph = await getDb().transaction((tx) => loadPatientGraph(tx, clinicId, patientId));
  return {
    patient: graph.patient,
    observations: graph.observations,
    preferences: graph.preferences,
    riskScores: graph.riskScores.map((row: Record<string, unknown>) => ({ ...row, factors: {} })),
    feedback: graph.feedback,
    appointments: graph.appointments,
    waitlist: graph.waitlist,
    treatmentPlans: graph.treatmentPlans,
    treatmentPlanItems: graph.treatmentPlanItems,
    conversations: graph.conversations,
    messages: graph.messages,
    conversationStates: graph.conversationStates,
    conversationSessions: graph.conversationSessions,
    conversationMemories: graph.conversationMemories,
    budgets: graph.budgets,
    budgetItems: graph.budgetItems,
    budgetInstallments: graph.budgetInstallments,
    payments: graph.payments,
    leads: graph.leads,
    leadActivities: graph.leadActivities,
    tasks: graph.tasks,
    campaignRecipients: graph.campaignRecipients,
    followUps: graph.followUps,
    consents: graph.consents,
    customFieldValues: graph.customFieldValues,
    auditLogs: graph.auditLogs.map((row: Record<string, unknown>) => sanitizeAuditRecord(row)),
    actionLogs: graph.actionLogs,
    exportedAt: new Date().toISOString(),
  };
}

async function redactOutbox(db: DbExecutor, clinicId: string, relatedIds: readonly string[]) {
  const jobs = await db.select({
    id: outboxJobs.id,
    payload: outboxJobs.payload,
    businessKey: outboxJobs.businessKey,
    status: outboxJobs.status,
  }).from(outboxJobs).where(eq(outboxJobs.clinicId, clinicId));
  const ids = new Set(relatedIds);
  for (const job of jobs) {
    const matches = ids.has(job.businessKey) || containsAnyId(job.payload, ids);
    if (!matches) continue;
    await db.update(outboxJobs).set({
      status: job.status === 'pending' || job.status === 'processing' ? 'cancelled' : job.status,
      payload: { redacted: true, reason: 'patient_anonymized' },
      lastErrorCode: 'lgpd_patient_anonymized',
      updatedAt: new Date(),
    }).where(eq(outboxJobs.id, job.id));
  }
}

async function redactAgentQueues(db: DbExecutor, relatedIds: readonly string[]) {
  const ids = new Set(relatedIds);
  // IA queue redaction is handled via IA LGPD contribution (tenant-safe, owner-controlled).
  // Operational only handles outbox redaction above; queue/dlq redaction via SQL without schema import to avoid cross-module dependency.
  try {
    const queueRows = await db.execute(sql`SELECT id, payload, status FROM agent_queue`);
    for (const row of (queueRows.rows as any[])) {
      if (!containsAnyId(row.payload, ids)) continue;
      await db.execute(sql`UPDATE agent_queue SET status = ${row.status === 'pending' ? 'cancelled' : row.status}, payload = ${JSON.stringify({ redacted: true, reason: 'patient_anonymized' })}::jsonb WHERE id = ${row.id}`);
    }
    const dlqRows = await db.execute(sql`SELECT id, payload FROM agent_dlq`);
    for (const row of (dlqRows.rows as any[])) {
      if (!containsAnyId(row.payload, ids)) continue;
      await db.execute(sql`UPDATE agent_dlq SET payload = ${JSON.stringify({ redacted: true, reason: 'patient_anonymized' })}::jsonb WHERE id = ${row.id}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Safe omission when tables don't exist (unit tests without DB); otherwise fail closed so unredacted content is never returned.
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('undefined_table') || msg.includes('no such table')) {
      return;
    }
    throw new ActionError('internal', `Falha ao redigir filas do agente: ${msg}`);
  }
}

export async function anonymizePatient(clinicId: string, patientId: string, actorUserId: string | null) {
  return getDb().transaction(async (tx) => {
    const [lockedPatient] = await tx.select().from(patients).where(and(
      eq(patients.id, patientId),
      eq(patients.clinicId, clinicId),
    )).limit(1).for('update');
    if (!lockedPatient) throw new ActionError('not_found', 'Paciente não encontrado.');
    if (lockedPatient.legalHold) throw new ActionError('conflict', 'Paciente em legal hold não pode ser anonimizado.');

    const graph = await loadPatientGraph(tx, clinicId, patientId);
    const now = new Date();
    const fieldsCleared = [
      'patients.name', 'patients.phone', 'patients.email', 'patients.cpf',
      'patients.birthDate', 'patients.gender', 'patients.address', 'patients.notes',
    ];
    const fieldsPresent = fieldsCleared.filter((field) => {
      const key = field.slice(field.indexOf('.') + 1) as keyof typeof lockedPatient;
      return lockedPatient[key] !== null && lockedPatient[key] !== undefined;
    });

    await tx.update(patients).set({
      name: 'Anonimizado',
      phone: pseudonym('anon', patientId).slice(0, 20),
      email: null,
      cpf: null,
      birthDate: null,
      gender: null,
      address: {},
      notes: null,
      updatedAt: now,
    }).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)));

    await tx.update(patientObservations).set({ content: '', updatedAt: now })
      .where(and(eq(patientObservations.patientId, patientId), eq(patientObservations.clinicId, clinicId)));
    await tx.update(patientPreferences).set({ value: '', updatedAt: now })
      .where(and(eq(patientPreferences.patientId, patientId), eq(patientPreferences.clinicId, clinicId)));
    await tx.update(patientRiskScores).set({ factors: {} })
      .where(eq(patientRiskScores.patientId, patientId));
    await tx.update(patientFeedback).set({ comments: null, improvements: [] })
      .where(and(eq(patientFeedback.patientId, patientId), eq(patientFeedback.clinicId, clinicId)));
    await tx.update(appointments).set({ notes: null, cancellationReason: null, rescheduleReason: null, updatedAt: now })
      .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicId, clinicId)));
    const appointmentIds = graph.appointments.map((row: { id: string }) => row.id);
    if (hasIds(appointmentIds)) {
      await tx.delete(appointmentReminders).where(and(
        inArray(appointmentReminders.appointmentId, appointmentIds),
        eq(appointmentReminders.status, 'pending'),
      ));
    }
    await tx.update(waitlist).set({ notes: null, updatedAt: now })
      .where(and(eq(waitlist.patientId, patientId), eq(waitlist.clinicId, clinicId)));
    await tx.update(treatmentPlans).set({ description: null, notes: null, updatedAt: now })
      .where(and(eq(treatmentPlans.patientId, patientId), eq(treatmentPlans.clinicId, clinicId)));
    const treatmentPlanIds = graph.treatmentPlans.map((row: { id: string }) => row.id);
    if (hasIds(treatmentPlanIds)) {
      await tx.update(treatmentPlanItems).set({ notes: null })
        .where(inArray(treatmentPlanItems.treatmentPlanId, treatmentPlanIds));
    }

    // Operacional handles its own tables above; external modules via contributions
    const contributions = getLGPDContributions();
    for (const contrib of contributions) {
      try {
        await contrib.anonymizeData(clinicId, patientId, tx);
      } catch (e) {
        // Fail closed: propagate anonymization errors
        throw e;
      }
    }

    await redactOutbox(tx, clinicId, graph.relatedIds);
    await redactAgentQueues(tx, graph.relatedIds);

    const oldValues = {
      fieldsPresent,
      legalHold: false,
      fingerprint: auditFingerprint(clinicId, lockedPatient as unknown as Record<string, unknown>),
    };
    const [audit] = await tx.insert(auditLogs).values({
      clinicId,
      userId: validUuid(actorUserId),
      action: 'lgpd.patient_anonymized',
      entityType: 'patient',
      entityId: patientId,
      oldValues,
      newValues: { anonymized: true, fieldsCleared },
    }).returning({ id: auditLogs.id });

    return { anonymized: true, patientId, auditId: audit.id };
  });
}

export { CONTACT_TYPES };
