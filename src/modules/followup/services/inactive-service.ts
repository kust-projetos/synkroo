import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { clinics } from '@/lib/db/schema/core';
import { appointments, patients, procedures } from '@/modules/operacional/schema';
import { dbLogger } from '@/lib/logger';
import { ActionError } from '@/core/actions/types';

export interface InactivePatient {
  patientId: string;
  patientName: string;
  patientPhone: string;
  lastVisit: Date | null;
  daysSinceLastVisit: number;
  inactivitySegment: 'inactive_30' | 'inactive_60' | 'inactive_90' | 'inactive_180';
  clinicId: string;
  clinicName: string;
  totalVisits: number;
  lastProcedure?: string;
  riskScore: number;
}

export interface InactivitySegment {
  segment: string;
  minDays: number;
  maxDays: number;
  label: string;
  priority: number;
}

export const INACTIVITY_SEGMENTS: InactivitySegment[] = [
  { segment: 'inactive_30', minDays: 30, maxDays: 59, label: 'Inativo 30 dias', priority: 1 },
  { segment: 'inactive_60', minDays: 60, maxDays: 89, label: 'Inativo 60 dias', priority: 2 },
  { segment: 'inactive_90', minDays: 90, maxDays: 179, label: 'Inativo 90 dias', priority: 3 },
  { segment: 'inactive_180', minDays: 180, maxDays: 9999, label: 'Inativo 6 meses', priority: 4 },
];

export function calculateDaysSinceLastVisit(lastVisit: Date | null): number {
  if (!lastVisit) return 999;
  return Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86_400_000);
}

export function getInactivitySegment(daysSinceLastVisit: number): InactivitySegment | null {
  return INACTIVITY_SEGMENTS.find((segment) =>
    daysSinceLastVisit >= segment.minDays && daysSinceLastVisit <= segment.maxDays,
  ) ?? null;
}

export async function findInactivePatients(clinicId: string, minDays = 30): Promise<InactivePatient[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - minDays * 86_400_000);
  try {
    const patientRows = await db.select({
      id: patients.id,
      name: patients.name,
      phone: patients.phone,
      lastVisitAt: patients.lastVisitAt,
      riskScore: patients.riskScore,
      clinicId: patients.clinicId,
    }).from(patients).where(and(
      eq(patients.clinicId, clinicId),
      or(isNull(patients.lastVisitAt), lt(patients.lastVisitAt, cutoff)),
    ));
    if (!patientRows.length) return [];

    const [clinic] = await db.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, clinicId));
    const patientIds = patientRows.map((patient) => patient.id);
    const appointmentRows = await db.select({
      patientId: appointments.patientId,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      procedureName: procedures.name,
    }).from(appointments)
      .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
      .where(and(
        eq(appointments.clinicId, clinicId),
        inArray(appointments.patientId, patientIds),
        inArray(appointments.status as any, ['completed', 'confirmed']),
      ))
      .orderBy(desc(appointments.scheduledAt));

    const byPatient = new Map<string, typeof appointmentRows>();
    for (const appointment of appointmentRows) {
      const list = byPatient.get(appointment.patientId) ?? [];
      list.push(appointment);
      byPatient.set(appointment.patientId, list);
    }

    return patientRows.flatMap((patient) => {
      const visits = byPatient.get(patient.id) ?? [];
      const daysSinceLastVisit = calculateDaysSinceLastVisit(patient.lastVisitAt);
      const segment = getInactivitySegment(daysSinceLastVisit);
      if (!segment) return [];
      const completed = visits.filter((visit) => visit.status === 'completed');
      return [{
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        lastVisit: patient.lastVisitAt,
        daysSinceLastVisit,
        inactivitySegment: segment.segment as InactivePatient['inactivitySegment'],
        clinicId: patient.clinicId,
        clinicName: clinic?.name ?? '',
        totalVisits: visits.length,
        lastProcedure: completed[0]?.procedureName ?? undefined,
        riskScore: Number(patient.riskScore ?? 0),
      }];
    }).sort((a, b) => {
      const aPriority = INACTIVITY_SEGMENTS.find((segment) => segment.segment === a.inactivitySegment)?.priority ?? 0;
      const bPriority = INACTIVITY_SEGMENTS.find((segment) => segment.segment === b.inactivitySegment)?.priority ?? 0;
      return bPriority - aPriority || b.riskScore - a.riskScore;
    });
  } catch (error) {
    dbLogger.error('Error identifying inactive patients', error);
    return [];
  }
}

async function updateInactivePatientTags(clinicId: string): Promise<{ updated: number; errors: number }> {
  const db = getDb();
  const inactivePatients = await findInactivePatients(clinicId, 30);
  let updated = 0;
  let errors = 0;
  for (const patient of inactivePatients) {
    const segment = INACTIVITY_SEGMENTS.find((item) => item.segment === patient.inactivitySegment);
    if (!segment) continue;
    try {
      const [row] = await db.select({ tags: patients.tags }).from(patients).where(and(
        eq(patients.id, patient.patientId),
        eq(patients.clinicId, clinicId),
      ));
      const tags = ((row?.tags as string[] | null) ?? []).filter((tag) =>
        !tag.startsWith('Inativo') && !tag.startsWith('inativo'),
      );
      await db.update(patients).set({ tags: [...tags, segment.label] as any, updatedAt: new Date() })
        .where(and(eq(patients.id, patient.patientId), eq(patients.clinicId, clinicId)));
      updated += 1;
    } catch (error) {
      dbLogger.error(`Error updating tags for ${patient.patientName}`, error);
      errors += 1;
    }
  }
  return { updated, errors };
}

export async function runInactivityDetection(clinicId: string): Promise<{ processed: number }> {
  const result = await updateInactivePatientTags(clinicId);
  return { processed: result.updated };
}

export async function reactivatePatient(clinicId: string, patientId: string): Promise<{ success: boolean }> {
  const db = getDb();
  const [row] = await db.select({ id: patients.id, tags: patients.tags }).from(patients).where(and(
    eq(patients.id, patientId),
    eq(patients.clinicId, clinicId),
  ));
  if (!row) throw new ActionError('not_found', 'Paciente não encontrado.');
  const tags = ((row.tags as string[] | null) ?? []).filter((tag) =>
    !tag.startsWith('Inativo') && !tag.startsWith('inativo'),
  );
  const [updated] = await db.update(patients).set({
    status: 'active',
    tags: tags as any,
    riskScore: '0.00',
    updatedAt: new Date(),
  }).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId))).returning({ id: patients.id });
  if (!updated) throw new ActionError('not_found', 'Paciente não encontrado.');
  return { success: true };
}
