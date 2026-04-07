/**
 * Incomplete Treatment Detection Service
 * Detects multi-session treatments that haven't been completed within expected timeframe
 */

import { createTypedClient } from '@/lib/supabase/typed'
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
 * Detect incomplete treatments for a clinic
 */
export async function detectIncompleteTreatments(
  clinicId: string
): Promise<IncompleteTreatment[]> {
  const supabase = await createTypedClient()

  try {
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, patient_id, procedure_id, status, scheduled_at, procedures (name)')
      .eq('clinic_id', clinicId)
      .in('status', ['completed', 'confirmed'])
      .order('scheduled_at', { ascending: true }) as any

    if (error) throw error

    const treatmentMap = new Map<string, {
      patient_id: string
      procedure_name: string
      appointments: { date: string; status: string }[]
    }>()

    for (const apt of (appointments as any[]) || []) {
      const procedureName = (apt as any).procedures?.name
      if (!procedureName) continue

      const isMultiSession = Object.keys(MULTI_SESSION_PROCEDURES).some(
        (key) => procedureName.toLowerCase().includes(key.toLowerCase())
      )
      if (!isMultiSession) continue

      const key = `${apt.patient_id}_${procedureName}`
      if (!treatmentMap.has(key)) {
        treatmentMap.set(key, {
          patient_id: apt.patient_id,
          procedure_name: procedureName,
          appointments: [],
        })
      }

      treatmentMap.get(key)!.appointments.push({
        date: apt.scheduled_at,
        status: apt.status,
      })
    }

    const patientIds = [...new Set([...treatmentMap.values()].map((t) => t.patient_id))]
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, phone')
      .in('id', patientIds)

    const patientMap = new Map(
      (patients || []).map((p: any) => [p.id, p])
    )

    const now = new Date()
    const results: IncompleteTreatment[] = []

    for (const [, treatment] of treatmentMap) {
      const patient = patientMap.get(treatment.patient_id) as any
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
          patient_name: patient.name,
          patient_phone: patient.phone,
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
