import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

/**
 * Patient History Service
 * Provides comprehensive patient attendance history
 */

export interface PatientHistoryEntry {
  id: string
  scheduledAt: Date
  durationMinutes: number
  status: string
  procedureName?: string
  dentistName?: string
  notes?: string
  clinicName?: string
}

/** Appointment row returned by Supabase query with joins */
type AppointmentWithJoins = {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  procedures: { name: string } | null
  dentists: { name: string } | null
}

/** Minimal appointment row for status queries */
type AppointmentStatusRow = {
  scheduled_at: string
  status: string
}

/** Clinic data from Supabase join (can be array or single object) */
type ClinicJoin = { name: string }

export interface PatientHistory {
  patientId: string
  patientName: string
  patientPhone: string
  totalVisits: number
  completedVisits: number
  cancelledVisits: number
  noShowCount: number
  lastVisit?: Date
  nextAppointment?: Date
  procedures: { name: string; count: number }[]
  appointments: PatientHistoryEntry[]
  clinicName?: string
}

/**
 * Get complete patient history
 */
export async function getPatientHistory(
  patientId: string
): Promise<{ success: boolean; history?: PatientHistory; error?: string }> {
  const supabase = await createTypedClient()

  try {
    // Get patient info
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select(`
        id,
        name,
        phone,
        last_visit,
        clinics (name)
      `)
      .eq('id', patientId)
      .single()

    if (patientError || !patient) {
      return { success: false, error: 'Patient not found' }
    }

    // Get all appointments
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        status,
        notes,
        procedures (name),
        dentists (name)
      `)
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: false })

    if (appointmentsError) {
      dbLogger.error('Error fetching patient appointments', appointmentsError)
      return { success: false, error: 'Failed to fetch appointments' }
    }

    // Calculate statistics
    const totalVisits = appointments?.length || 0
    const completedVisits = appointments?.filter((a: AppointmentWithJoins) => a.status === 'completed').length || 0
    const cancelledVisits = appointments?.filter((a: AppointmentWithJoins) => a.status === 'cancelled').length || 0
    const noShowCount = appointments?.filter((a: AppointmentWithJoins) => a.status === 'no_show').length || 0

    // Last completed visit
    const lastCompleted = appointments?.find((a: AppointmentWithJoins) => a.status === 'completed')
    const lastVisit = lastCompleted ? new Date(lastCompleted.scheduled_at) : undefined

    // Next appointment
    const now = new Date()
    const nextApt = appointments
      ?.filter((a: AppointmentWithJoins) => ['scheduled', 'confirmed'].includes(a.status))
      .find((a: AppointmentWithJoins) => new Date(a.scheduled_at) > now)
    const nextAppointment = nextApt ? new Date(nextApt.scheduled_at) : undefined

    // Procedure frequency
    const procedureCounts: Record<string, number> = {}
    appointments
      ?.filter((a: AppointmentWithJoins) => a.status === 'completed')
      .forEach((a: AppointmentWithJoins) => {
        const procName = a.procedures?.name
        if (procName) {
          procedureCounts[procName] = (procedureCounts[procName] || 0) + 1
        }
      })

    const procedures = Object.entries(procedureCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Format appointment history
    const historyEntries: PatientHistoryEntry[] = (appointments || []).map((a: AppointmentWithJoins) => ({
      id: a.id,
      scheduledAt: new Date(a.scheduled_at),
      durationMinutes: a.duration_minutes,
      status: a.status,
      procedureName: a.procedures?.name,
      dentistName: a.dentists?.name,
      notes: a.notes,
    }))

    // Extract clinic name - handle both array and object from join
    const clinicData = patient.clinics as ClinicJoin | ClinicJoin[] | null
    const clinicName = Array.isArray(clinicData) ? clinicData[0]?.name : clinicData?.name

    return {
      success: true,
      history: {
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        totalVisits,
        completedVisits,
        cancelledVisits,
        noShowCount,
        lastVisit,
        nextAppointment,
        procedures,
        appointments: historyEntries,
        clinicName,
      },
    }
  } catch (error) {
    dbLogger.error('Error in getPatientHistory', error)
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Get patient visit summary (for dashboard)
 */
export async function getPatientVisitSummary(
  patientId: string
): Promise<{
  totalVisits: number
  lastVisit?: Date
  nextAppointment?: Date
  noShowRate: number
}> {
  const supabase = await createTypedClient()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('scheduled_at, status')
    .eq('patient_id', patientId)

  const total = appointments?.length || 0
  const noShows = appointments?.filter((a: AppointmentStatusRow) => a.status === 'no_show').length || 0

  const lastCompleted = appointments
    ?.filter((a: AppointmentStatusRow) => a.status === 'completed')
    .sort((a: AppointmentStatusRow, b: AppointmentStatusRow) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0]

  const now = new Date()
  const nextApt = appointments
    ?.filter((a: AppointmentStatusRow) => ['scheduled', 'confirmed'].includes(a.status))
    .filter((a: AppointmentStatusRow) => new Date(a.scheduled_at) > now)
    .sort((a: AppointmentStatusRow, b: AppointmentStatusRow) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]

  return {
    totalVisits: total,
    lastVisit: lastCompleted ? new Date(lastCompleted.scheduled_at) : undefined,
    nextAppointment: nextApt ? new Date(nextApt.scheduled_at) : undefined,
    noShowRate: total > 0 ? noShows / total : 0,
  }
}