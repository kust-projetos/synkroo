/** @jest-environment node */

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';

jest.unmock('@/lib/db/client');

import { Pool } from 'pg';
import { and, eq } from 'drizzle-orm';
import { seedAuditTenants, cleanupAuditTenants } from '@/__tests__/security/audit-remediation-fixtures';
import { anonymizePatient, exportPatientData } from '../../services/lgpd-service';
import { getDb, closeDb } from '@/lib/db/client';
import { patients } from '../../schema/patients';
import { consents, outboxJobs, auditLogs } from '@/lib/db/schema/infra';
import { replaceLGPDContributions, clearLGPDContributionsForTests } from '../../services/lgpd-registry';
import { exportFinanceiroForPatient, anonymizeFinanceiroForPatient } from '@/modules/financeiro/services/lgpd-financeiro';
import { exportComercialForPatient, anonymizeComercialForPatient } from '@/modules/comercial/services/lgpd-comercial';
import { exportFollowupForPatient, anonymizeFollowupForPatient } from '@/modules/followup/services/lgpd-followup';
import { exportCrmForPatient, anonymizeCrmForPatient } from '@/modules/crm/services/lgpd-crm';
import { exportIaForPatient, anonymizeIaForPatient } from '@/modules/ia/services/lgpd-ia';
import { exportAtendimentoForPatient, anonymizeAtendimentoForPatient } from '@/modules/atendimento/services/lgpd-atendimento';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

describeOrSkip('LGPD patient data lifecycle (DB real)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let fixture: Awaited<ReturnType<typeof seedAuditTenants>>;

  beforeAll(async () => {
    replaceLGPDContributions([
      { moduleId: 'financeiro', exportData: exportFinanceiroForPatient, anonymizeData: anonymizeFinanceiroForPatient },
      { moduleId: 'comercial', exportData: exportComercialForPatient, anonymizeData: anonymizeComercialForPatient },
      { moduleId: 'followup', exportData: exportFollowupForPatient, anonymizeData: anonymizeFollowupForPatient },
      { moduleId: 'crm', exportData: exportCrmForPatient, anonymizeData: anonymizeCrmForPatient },
      { moduleId: 'ia', exportData: exportIaForPatient, anonymizeData: anonymizeIaForPatient },
      { moduleId: 'atendimento', exportData: exportAtendimentoForPatient, anonymizeData: anonymizeAtendimentoForPatient },
    ]);
    fixture = await seedAuditTenants(pool);
  });

  afterAll(async () => {
    await cleanupAuditTenants(pool);
    await closeDb();
    await pool.end();
    clearLGPDContributionsForTests();
  });

  it('exports only the requested tenant graph, including consents', async () => {
    const db = getDb();
    await db.insert(consents).values({
      clinicId: fixture.attacker.clinicId,
      contactId: fixture.attacker.patientId,
      contactType: 'patient',
      purpose: 'marketing',
      granted: true,
    }).onConflictDoUpdate({
      target: [consents.clinicId, consents.contactId, consents.contactType, consents.purpose],
      set: { granted: true },
    });

    const data = await exportPatientData(fixture.attacker.clinicId, fixture.attacker.patientId);
    expect(data.patient.id).toBe(fixture.attacker.patientId);
    expect(data.appointments.every((row: { clinicId: string }) => row.clinicId === fixture.attacker.clinicId)).toBe(true);
    expect(data.budgets.every((row: { clinicId: string }) => row.clinicId === fixture.attacker.clinicId)).toBe(true);
    expect(data.consents).toHaveLength(1);
    expect(data.consents[0].contactId).toBe(fixture.attacker.patientId);
    expect(JSON.stringify(data)).not.toContain(fixture.victim.patientId);
  });

  it('returns not_found for a patient from another clinic', async () => {
    await expect(exportPatientData(fixture.attacker.clinicId, fixture.victim.patientId))
      .rejects.toMatchObject({ code: 'not_found' });
  });

  it('fails closed on legal hold without changing the patient', async () => {
    const db = getDb();
    const sentinel = 'legal-hold-sentinel';
    await db.update(patients).set({ legalHold: true, name: sentinel })
      .where(and(eq(patients.id, fixture.attacker.patientId), eq(patients.clinicId, fixture.attacker.clinicId)));

    await expect(anonymizePatient(fixture.attacker.clinicId, fixture.attacker.patientId, fixture.attacker.userId))
      .rejects.toMatchObject({ code: 'conflict' });

    const [row] = await db.select({ name: patients.name, legalHold: patients.legalHold })
      .from(patients).where(eq(patients.id, fixture.attacker.patientId));
    expect(row).toEqual({ name: sentinel, legalHold: true });
    await db.update(patients).set({ legalHold: false, name: 'Audit Attacker Patient' })
      .where(eq(patients.id, fixture.attacker.patientId));
  });

  it('anonymizes relations atomically and stores only allowlisted audit data', async () => {
    const db = getDb();
    const pii = 'anonymize-pii-sentinel';
    await db.update(patients).set({
      name: pii,
      phone: '+5500000000399',
      email: `${pii}@test.local`,
      cpf: '999.999.999-99',
      notes: pii,
      legalHold: false,
    }).where(eq(patients.id, fixture.attacker.patientId));
    await db.insert(outboxJobs).values({
      clinicId: fixture.attacker.clinicId,
      operation: 'lgpd-test',
      businessKey: fixture.attacker.patientId,
      payload: { patientId: fixture.attacker.patientId, notes: pii },
      status: 'pending',
    }).onConflictDoNothing();

    const result = await anonymizePatient(fixture.attacker.clinicId, fixture.attacker.patientId, fixture.attacker.userId);
    expect(result.anonymized).toBe(true);
    expect(result.auditId).toBeTruthy();

    const [patient] = await db.select().from(patients).where(eq(patients.id, fixture.attacker.patientId));
    expect(patient.name).toBe('Anonimizado');
    expect(patient.email).toBeNull();
    expect(patient.cpf).toBeNull();
    expect(patient.notes).toBeNull();
    expect(JSON.stringify(patient)).not.toContain(pii);

    const [job] = await db.select({ status: outboxJobs.status, payload: outboxJobs.payload })
      .from(outboxJobs).where(and(eq(outboxJobs.clinicId, fixture.attacker.clinicId), eq(outboxJobs.businessKey, fixture.attacker.patientId)));
    expect(job.status).toBe('cancelled');
    expect(JSON.stringify(job.payload)).not.toContain(pii);

    const [audit] = await db.select({ oldValues: auditLogs.oldValues, newValues: auditLogs.newValues })
      .from(auditLogs).where(and(eq(auditLogs.id, result.auditId), eq(auditLogs.clinicId, fixture.attacker.clinicId)));
    expect(audit.oldValues).toEqual(expect.objectContaining({ fieldsPresent: expect.any(Array), fingerprint: expect.any(String) }));
    expect(audit.newValues).toEqual(expect.objectContaining({ anonymized: true, fieldsCleared: expect.any(Array) }));
    expect(JSON.stringify(audit)).not.toContain(pii);
  });
});
