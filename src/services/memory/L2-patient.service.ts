/**
 * L2 Patient Memory Service
 * PostgreSQL-based patient data retrieval
 * Provides persistent patient information across sessions
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

// L2 Patient preferences structure
export interface L2PatientPreferences {
  preferredChannel?: string
  preferredTime?: string
  communicationLanguage?: string
  optOutMarketing?: boolean
  optOutReminders?: boolean
  [key: string]: unknown
}

// L2 Patient history entry
export interface L2PatientHistoryEntry {
  date: string
  procedure?: string
  dentist?: string
  status: string
  notes?: string
}

// L2 Patient interface
export interface L2Patient {
  patientId: string
  clinicId: string
  nome: string
  telefone: string
  email?: string
  cpf?: string
  preferencias: L2PatientPreferences
  historico: L2PatientHistoryEntry[]
  riskScore: number
  ultimaVisita?: Date
  inactiveDays: number
}

/**
 * L2 Patient Service
 * Retrieves patient data from PostgreSQL
 */
export class L2PatientService {
  /**
   * Get patient by ID
   */
  async getById(patientId: string): Promise<L2Patient | null> {
    try {
      const supabase = await createTypedClient()

      // Get patient data
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single() as any

      if (patientError || !patient) {
        dbLogger.debug('Patient not found by ID', { patientId })
        return null
      }

      // Get patient preferences
      const { data: preferences } = await supabase
        .from('patient_preferences')
        .select('key, value, category')
        .eq('patient_id', patientId) as any

      // Build preferences object
      const preferencias: L2PatientPreferences = {}
      if (preferences) {
        for (const pref of preferences) {
          try {
            preferencias[pref.key] = pref.value ? JSON.parse(pref.value) : null
          } catch {
            preferencias[pref.key] = pref.value
          }
        }
      }

      // Get patient risk score
      const { data: riskData } = await supabase
        .from('patient_risk_scores')
        .select('score, calculated_at')
        .eq('patient_id', patientId)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single() as any

      // Get recent appointments (history)
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          id,
          scheduled_at,
          status,
          notes,
          procedures:procedures(name),
          dentists:dentists(name)
        `)
        .eq('patient_id', patientId)
        .order('scheduled_at', { ascending: false })
        .limit(10) as any

      // Build history entries
      const historico: L2PatientHistoryEntry[] = (appointments || []).map((apt: any) => ({
        date: apt.scheduled_at,
        procedure: apt.procedures?.name,
        dentist: apt.dentists?.name,
        status: apt.status,
        notes: apt.notes,
      }))

      // Calculate inactive days
      let inactiveDays = 0
      if (patient.last_visit_at) {
        const lastVisit = new Date(patient.last_visit_at)
        inactiveDays = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Get opt-out settings
      if (patient.opt_out_marketing !== undefined) {
        preferencias.optOutMarketing = patient.opt_out_marketing
      }
      if (patient.opt_out_reminders !== undefined) {
        preferencias.optOutReminders = patient.opt_out_reminders
      }

      return {
        patientId: patient.id,
        clinicId: patient.clinic_id,
        nome: patient.name,
        telefone: patient.phone,
        email: patient.email,
        cpf: patient.cpf,
        preferencias,
        historico,
        riskScore: riskData?.score ?? patient.risk_score ?? 0,
        ultimaVisita: patient.last_visit_at ? new Date(patient.last_visit_at) : undefined,
        inactiveDays,
      }
    } catch (error) {
      dbLogger.error('Error fetching patient by ID', error, { patientId })
      return null
    }
  }

  /**
   * Get patient by phone number within a clinic
   */
  async getByPhone(telefone: string, clinicId: string): Promise<L2Patient | null> {
    try {
      const supabase = await createTypedClient()

      // Normalize phone number (remove non-digits)
      const normalizedPhone = telefone.replace(/\D/g, '')

      // Get patient by phone and clinic
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('phone', normalizedPhone)
        .single() as any

      if (patientError || !patient) {
        dbLogger.debug('Patient not found by phone', { telefone: normalizedPhone, clinicId })
        return null
      }

      // Use getById to get full patient data
      return this.getById(patient.id)
    } catch (error) {
      dbLogger.error('Error fetching patient by phone', error, { telefone, clinicId })
      return null
    }
  }
}

// Singleton instance
export const l2PatientService = new L2PatientService()
