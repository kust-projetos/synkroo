/**
 * L2 Patient Memory Service
 * PostgreSQL-based patient data retrieval
 * Provides persistent patient information across sessions
 * Migrated from Supabase to Drizzle repositories
 */

import { dbLogger } from '@/lib/logger'
import * as patientRepo from '@/repositories/patients'

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
      // Get patient data
      const patient = await patientRepo.findPatientById(patientId)
      if (!patient) {
        dbLogger.debug('Patient not found by ID', { patientId })
        return null
      }

      // Get patient preferences
      const prefs = await patientRepo.getPatientPreferences(patientId)

      // Build preferences object
      const preferencias: L2PatientPreferences = {}
      for (const pref of prefs) {
        try {
          preferencias[pref.key] = pref.value ? JSON.parse(pref.value) : null
        } catch {
          preferencias[pref.key] = pref.value
        }
      }

      // Get patient risk score
      const riskData = await patientRepo.getLatestRiskScore(patientId)

      // Get recent appointments (history)
      const appts = await patientRepo.getRecentAppointments(patientId, 10)

      // Build history entries
      const historico: L2PatientHistoryEntry[] = appts.map(apt => ({
        date: apt.scheduledAt instanceof Date ? apt.scheduledAt.toISOString() : String(apt.scheduledAt),
        procedure: apt.procedureName ?? undefined,
        dentist: apt.dentistName ?? undefined,
        status: apt.status,
        notes: apt.notes ?? undefined,
      }))

      // Calculate inactive days
      let inactiveDays = 0
      if (patient.lastVisitAt) {
        inactiveDays = Math.floor((Date.now() - patient.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Get opt-out settings
      if (patient.optOutMarketing !== undefined && patient.optOutMarketing !== null) {
        preferencias.optOutMarketing = patient.optOutMarketing
      }
      if (patient.optOutReminders !== undefined && patient.optOutReminders !== null) {
        preferencias.optOutReminders = patient.optOutReminders
      }

      return {
        patientId: patient.id,
        clinicId: patient.clinicId,
        nome: patient.name,
        telefone: patient.phone,
        email: patient.email ?? undefined,
        cpf: patient.cpf ?? undefined,
        preferencias,
        historico,
        riskScore: riskData?.score ? Number(riskData.score) : (patient.riskScore ?? 0),
        ultimaVisita: patient.lastVisitAt ?? undefined,
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
      // Normalize phone number (remove non-digits)
      const normalizedPhone = telefone.replace(/\D/g, '')

      // Get patient by phone and clinic
      const patient = await patientRepo.findPatientByPhone(normalizedPhone, clinicId)
      if (!patient) {
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