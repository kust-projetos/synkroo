/**
 * Patient History Service
 * Provides comprehensive patient attendance history using Drizzle
 */

import { eq, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients, clinics, appointments, procedures, dentists } from '@/lib/db/schema'
import * as patientRepo from '@/repositories/patients'
import * as appointmentRepo from '@/repositories/appointments'
import { dbLogger } from '@/lib/logger'

export interface PatientHistoryEntry {
  id: string
  scheduledAt: Date
  durationMinutes: number | null
  status: string
  procedureName?: string
  dentistName?: string
  notes?: string | null
  clinicName?: string
}

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
  try {
    const db = getDb()

    // Get patient with clinic (without specifying clinicId here — caller should verify)
    const patientRows = await db
      .select({ patient: patients, clinic: { name: clinics.name } })
      .from(patients)
      .leftJoin(clinics, eq(clinics.id, patients.clinicId))
      .where(eq(patients.id, patientId))
      .limit(1)

    const patientRow = patientRows[0]
    if (!patientRow) {
      return { success: false, error: 'Patient not found' }
    }

    const patient = patientRow.patient
    const clinicName = patientRow.clinic?.name

    // Get all appointments for patient with joins
    const aptRows = await db
      .select({
        id: appointments.id,
        scheduledAt: appointments.scheduledAt,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        notes: appointments.notes,
        procedure: { name: procedures.name },
        dentist: { name: dentists.name },
      })
      .from(appointments)
      .leftJoin(procedures, eq(procedures.id, appointments.procedureId))
      .leftJoin(dentists, eq(dentists.id, appointments.dentistId))
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.scheduledAt))

    const totalVisits = aptRows.length
    const completedVisits = aptRows.filter(a => a.status === 'completed').length
    const cancelledVisits = aptRows.filter(a => a.status === 'cancelled').length
    const noShowCount = aptRows.filter(a => a.status === 'no_show').length

    // Last completed visit
    const lastCompleted = aptRows.find(a => a.status === 'completed')
    const lastVisit = lastCompleted?.scheduledAt

    // Next appointment (scheduled/confirmed in the future)
    const now = new Date()
    const nextApt = aptRows.find(a =>
      ['scheduled', 'confirmed'].includes(a.status) && a.scheduledAt > now
    )
    const nextAppointment = nextApt?.scheduledAt

    // Procedure frequency
    const procedureCounts: Record<string, number> = {}
    for (const a of aptRows) {
      if (a.status === 'completed' && a.procedure?.name) {
        procedureCounts[a.procedure.name] = (procedureCounts[a.procedure.name] || 0) + 1
      }
    }
    const procedureSummary = Object.entries(procedureCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Format appointment history
    const historyEntries: PatientHistoryEntry[] = aptRows.map(a => ({
      id: a.id,
      scheduledAt: a.scheduledAt,
      durationMinutes: a.durationMinutes,
      status: a.status,
      procedureName: a.procedure?.name,
      dentistName: a.dentist?.name,
      notes: a.notes,
      clinicName,
    }))

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
        procedures: procedureSummary,
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
  const db = getDb()

  const rows = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
    })
    .from(appointments)
    .where(eq(appointments.patientId, patientId))

  const total = rows.length
  const noShows = rows.filter(a => a.status === 'no_show').length

  const lastCompleted = rows
    .filter(a => a.status === 'completed')
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0]

  const now = new Date()
  const nextApt = rows
    .filter(a => ['scheduled', 'confirmed'].includes(a.status) && a.scheduledAt > now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0]

  return {
    totalVisits: total,
    lastVisit: lastCompleted?.scheduledAt,
    nextAppointment: nextApt?.scheduledAt,
    noShowRate: total > 0 ? noShows / total : 0,
  }
}