import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointments, patients, procedures } from '@/modules/operacional/schema';
import { dbLogger } from '@/lib/logger';

export interface IncompleteTreatment {
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  procedure_name: string;
  first_appointment_date: string;
  last_appointment_date: string;
  expected_sessions: number;
  completed_sessions: number;
  days_since_last: number;
  clinic_id: string;
  risk_level: 'low' | 'medium' | 'high';
}

const MULTI_SESSION_PROCEDURES: Record<string, { sessions: number; daysToComplete: number }> = {
  'Tratamento de Canal': { sessions: 3, daysToComplete: 45 },
  'Implante Dentário': { sessions: 4, daysToComplete: 180 },
  Ortodontia: { sessions: 20, daysToComplete: 730 },
  Prótese: { sessions: 4, daysToComplete: 60 },
  Clareamento: { sessions: 3, daysToComplete: 30 },
  Periodontia: { sessions: 4, daysToComplete: 60 },
  Cirurgia: { sessions: 2, daysToComplete: 30 },
};

export async function detectIncompleteTreatments(clinicId: string): Promise<IncompleteTreatment[]> {
  try {
    const rows = await getDb().select({
      patientId: appointments.patientId,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      procedureName: procedures.name,
    }).from(appointments)
      .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
      .where(and(eq(appointments.clinicId, clinicId), inArray(appointments.status, ['completed', 'confirmed'])))
      .orderBy(asc(appointments.scheduledAt));
    const byTreatment = new Map<string, { patientId: string; procedureName: string; appointments: { date: string; status: string }[] }>();
    for (const row of rows) {
      if (!row.procedureName || !Object.keys(MULTI_SESSION_PROCEDURES).some((key) => row.procedureName!.toLowerCase().includes(key.toLowerCase()))) continue;
      const key = `${row.patientId}_${row.procedureName}`;
      const treatment = byTreatment.get(key) ?? { patientId: row.patientId, procedureName: row.procedureName, appointments: [] };
      treatment.appointments.push({ date: (row.scheduledAt ?? new Date()).toISOString(), status: row.status });
      byTreatment.set(key, treatment);
    }
    const patientIds = [...new Set([...byTreatment.values()].map((treatment) => treatment.patientId))];
    if (!patientIds.length) return [];
    const patientRows = await getDb().select({ id: patients.id, name: patients.name, phone: patients.phone })
      .from(patients).where(inArray(patients.id, patientIds));
    const patientMap = new Map(patientRows.map((patient) => [patient.id, patient]));
    const result: IncompleteTreatment[] = [];
    for (const treatment of byTreatment.values()) {
      const patient = patientMap.get(treatment.patientId);
      const config = Object.entries(MULTI_SESSION_PROCEDURES).find(([key]) => treatment.procedureName.toLowerCase().includes(key.toLowerCase()))?.[1];
      if (!patient || !config) continue;
      const first = treatment.appointments[0];
      const last = treatment.appointments[treatment.appointments.length - 1];
      const daysSinceLast = Math.floor((Date.now() - new Date(last.date).getTime()) / 86_400_000);
      if (daysSinceLast <= config.daysToComplete * 0.5 || treatment.appointments.length >= config.sessions) continue;
      result.push({
        patient_id: treatment.patientId,
        patient_name: patient.name,
        patient_phone: patient.phone ?? null,
        procedure_name: treatment.procedureName,
        first_appointment_date: first.date,
        last_appointment_date: last.date,
        expected_sessions: config.sessions,
        completed_sessions: treatment.appointments.length,
        days_since_last: daysSinceLast,
        clinic_id: clinicId,
        risk_level: daysSinceLast > config.daysToComplete ? 'high' : daysSinceLast > config.daysToComplete * 0.75 ? 'medium' : 'low',
      });
    }
    const riskOrder = { high: 0, medium: 1, low: 2 };
    return result.sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level]);
  } catch (error) {
    dbLogger.error('Error detecting incomplete treatments', error);
    return [];
  }
}

export async function getIncompleteTreatmentAlerts(clinicId: string) {
  const treatments = await detectIncompleteTreatments(clinicId);
  return {
    total: treatments.length,
    highRisk: treatments.filter((treatment) => treatment.risk_level === 'high').length,
    mediumRisk: treatments.filter((treatment) => treatment.risk_level === 'medium').length,
    treatments,
  };
}
