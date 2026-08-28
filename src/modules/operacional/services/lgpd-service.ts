import { ActionError } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import { patients } from '@/modules/operacional/schema/patients';
import { eq, and } from 'drizzle-orm';

/**
 * Minimal LGPD service for W4 — full matriz processing will be implemented in W4.2/W4.3.
 * Currently validates ownership and legalHold.
 */
export async function exportPatientData(clinicId: string, patientId: string) {
  const db = getDb();
  const [patient] = await db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId))).limit(1);
  if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');
  // TODO W4.2: percorrer matriz aprovada, incluindo payloads exportáveis
  return { patient, exportedAt: new Date().toISOString() };
}

export async function anonymizePatient(clinicId: string, patientId: string, actorUserId: string | null) {
  const db = getDb();
  const [patient] = await db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId))).limit(1);
  if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');
  if ((patient as any).legalHold) throw new ActionError('conflict', 'Paciente em legal hold não pode ser anonimizado.');
  // TODO W4.2/W4.3: executar todas as disposições da matriz + audit sem PII na mesma transaction
  // Placeholder: clear PII fields but preserve fatos obrigatórios
  await db.update(patients).set({
    name: 'Anonimizado',
    phone: `anon-${patientId.slice(0, 8)}`,
    email: null,
    cpf: null,
    birthDate: null,
    notes: null,
    updatedAt: new Date(),
  } as any).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)));
  return { anonymized: true, patientId };
}
