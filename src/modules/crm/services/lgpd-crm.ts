import { and, eq, inArray, sql } from 'drizzle-orm';
import { consents, customFieldValues } from '@/modules/crm/schema/contacts';

export async function exportCrmForPatient(clinicId: string, patientId: string, tx: any) {
  const patientConsents = await tx.select().from(consents).where(and(
    eq(consents.clinicId, clinicId),
    eq(consents.contactId, patientId),
    eq(consents.contactType, 'patient'),
  ));
  // Lead-linked consents (if any) via leads that belong to patient
  const leadRows = await tx.execute(sql`SELECT id FROM leads WHERE clinic_id = ${clinicId} AND patient_id = ${patientId}`);
  const leadIds = (leadRows.rows as any[]).map((r: any) => r.id);
  const leadConsents = leadIds.length
    ? await tx.select().from(consents).where(and(eq(consents.clinicId, clinicId), eq(consents.contactType, 'lead'), inArray(consents.contactId, leadIds)))
    : [];
  const consentRows = [...patientConsents, ...leadConsents];

  const patientFields = await tx.select().from(customFieldValues).where(and(
    eq(customFieldValues.clinicId, clinicId),
    eq(customFieldValues.contactId, patientId),
    eq(customFieldValues.contactType, 'patient'),
  ));
  const leadFields = leadIds.length
    ? await tx.select().from(customFieldValues).where(and(eq(customFieldValues.clinicId, clinicId), eq(customFieldValues.contactType, 'lead'), inArray(customFieldValues.contactId, leadIds)))
    : [];
  return { consents: consentRows, customFieldValues: [...patientFields, ...leadFields] };
}

export async function anonymizeCrmForPatient(clinicId: string, patientId: string, tx: any) {
  const now = new Date();
  await tx.update(customFieldValues).set({
    valueText: null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: null, updatedAt: now,
  }).where(and(eq(customFieldValues.clinicId, clinicId), eq(customFieldValues.contactId, patientId), eq(customFieldValues.contactType, 'patient')));
  const leadRows = await tx.execute(sql`SELECT id FROM leads WHERE clinic_id = ${clinicId} AND patient_id = ${patientId}`);
  const leadIds = (leadRows.rows as any[]).map((r: any) => r.id);
  if (leadIds.length) {
    await tx.update(customFieldValues).set({
      valueText: null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: null, updatedAt: now,
    }).where(and(eq(customFieldValues.clinicId, clinicId), eq(customFieldValues.contactType, 'lead'), inArray(customFieldValues.contactId, leadIds)));
  }
}
