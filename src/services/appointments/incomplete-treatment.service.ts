/**
 * Incomplete Treatment Detection Service
 * Detects multi-session treatments that haven't been completed within expected timeframe
 */

import { eq, inArray, asc, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { appointments, procedures, patients } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface IncompleteTreatment {
  patient_id: string
  patient_name: string
  patient_phone: string | null
  procedure_name: string
  first_appointment_date: string
  last_appointment_date: string
  expected_sessions: number
  completed_sessions: number
  days_since_last: number
  clinic_id: string
  risk_level: 'low' | 'medium' | 'high'
}

// Procedures that typically require multiple sessions
const MULTI_SESSION_PROCEDURES: Record<string, { sessions: number; daysToComplete: number }> = {
  'Tratamento de Canal': { sessions: 3, daysToComplete: 45 },
  'Implante Dentário': { sessions: 4, daysToComplete: 180 },
  'Ortodontia': { sessions: 20, daysToComplete: 730 },
  'Prótese': { sessions: 4, daysToComplete: 60 },
  'Clareamento': { sessions: 3, daysToComplete: 30 },
  'Periodontia': { sessions: 4, daysToComplete: 60 },
  'Cirurgia': { sessions: 2, daysToComplete: 30 },
}

/**
 * Detect incomplete treatments for a clinic — migrated to Drizzle.
 */
export async function detectIncompleteTreatments(
  clinicId: string
): Promise<IncompleteTreatment[]> {
  const db = getDb()

  try {
    const rows = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        procedureId: appointments.procedureId,
        status: appointments.status,
        scheduledAt: appointments.scheduledAt,
        procedureName: procedures.name,
      })
      .from(appointments)
      .leftJoin(procedures, eq(appointments.procedureId, procedures.id))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          inArray(appointments.status, ['completed', 'confirmed']),
        ),
      )
      .orderBy(asc(appointments.scheduledAt))

    const treatmentMap = new Map<string, {
      patient_id: string
      procedure_name: string
      appointments: { date: string; status: string }[]
    }>()

    for (const apt of rows) {
      const procedureName = apt.procedureName
      if (!procedureName) continue

      const isMultiSession = Object.keys(MULTI_SESSION_PROCEDURES).some(
        (key) => procedureName.toLowerCase().includes(key.toLowerCase())
      )
      if (!isMultiSession) continue

      const key = `${apt.patientId}_${procedureName}`
      if (!treatmentMap.has(key)) {
        treatmentMap.set(key, {
          patient_id: apt.patientId,
          procedure_name: procedureName,
          appointments: [],
        })
      }

      treatmentMap.get(key)!.appointments.push({
        date: (apt.scheduledAt ?? new Date()).toISOString(),
        status: apt.status,
      })
    }

    const patientIds = [...new Set([...treatmentMap.values()].map((t) => t.patient_id))]
    const patientRows = await db
      .select({ id: patients.id, name: patients.name, phone: patients.phone })
      .from(patients)
      .where(inArray(patients.id, patientIds.length ? patientIds : ['__none__' as any]))

    const patientMap = new Map(patientRows.map((p) => [p.id, p]))

    const now = new Date()
    const results: IncompleteTreatment[] = []

    for (const [, treatment] of treatmentMap) {
      const patient = patientMap.get(treatment.patient_id)
      if (!patient) continue

      const procedureConfig = Object.entries(MULTI_SESSION_PROCEDURES).find(
        ([key]) => treatment.procedure_name.toLowerCase().includes(key.toLowerCase())
      )
      if (!procedureConfig) continue

      const { sessions: expectedSessions, daysToComplete } = procedureConfig[1]
      const lastDate = new Date(treatment.appointments[treatment.appointments.length - 1].date)
      const daysSinceLast = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      const completionThreshold = daysToComplete * 0.5
      const completedSessions = treatment.appointments.length

      if (daysSinceLast > completionThreshold && completedSessions < expectedSessions) {
        let riskLevel: IncompleteTreatment['risk_level'] = 'low'
        if (daysSinceLast > daysToComplete) riskLevel = 'high'
        else if (daysSinceLast > daysToComplete * 0.75) riskLevel = 'medium'

        results.push({
          patient_id: treatment.patient_id,
          patient_name: patient.name ?? 'Desconhecido',
          patient_phone: patient.phone ?? null,
          procedure_name: treatment.procedure_name,
          first_appointment_date: treatment.appointments[0].date,
          last_appointment_date: treatment.appointments[treatment.appointments.length - 1].date,
          expected_sessions: expectedSessions,
          completed_sessions: completedSessions,
          days_since_last: daysSinceLast,
          clinic_id: clinicId,
          risk_level: riskLevel,
        })
      }
    }

    return results.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 }
      return riskOrder[a.risk_level] - riskOrder[b.risk_level]
    })
  } catch (error) {
    dbLogger.error('Error detecting incomplete treatments', error)
    return []
  }
}

/**
 * Get incomplete treatment summary for dashboard alerts
 */
export async function getIncompleteTreatmentAlerts(clinicId: string): Promise<{
  total: number
  highRisk: number
  mediumRisk: number
  treatments: IncompleteTreatment[]
}> {
  const treatments = await detectIncompleteTreatments(clinicId)

  return {
    total: treatments.length,
    highRisk: treatments.filter((t) => t.risk_level === 'high').length,
    mediumRisk: treatments.filter((t) => t.risk_level === 'medium').length,
    treatments,
  }
}
