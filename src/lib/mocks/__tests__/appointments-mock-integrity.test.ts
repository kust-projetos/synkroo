/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals'

// Directly import the mock router to get raw appointments
// We test the factory function, not the HTTP layer
import { getMockForUrl } from '@/lib/mocks'
import { createAppointment, daysFromNow } from '../utils'
import { MOCK_IDS } from '../types'

interface AppointmentOverlap {
  id: string
  scheduled_at: string
  dentist_id: string
  duration_minutes: number
}

function overlaps(a: AppointmentOverlap, b: AppointmentOverlap): boolean {
  if (a.dentist_id !== b.dentist_id) return false

  const aDate = a.scheduled_at.slice(0, 10)
  const bDate = b.scheduled_at.slice(0, 10)
  if (aDate !== bDate) return false

  const aStart = new Date(a.scheduled_at).getTime()
  const bStart = new Date(b.scheduled_at).getTime()
  const aEnd = aStart + a.duration_minutes * 60000
  const bEnd = bStart + b.duration_minutes * 60000

  return aStart < bEnd && bStart < aEnd
}

describe('appointments mock dataset integrity', () => {
  function getAppointmentsFromRoute(): AppointmentOverlap[] {
    const result = getMockForUrl('/api/appointments?clinic_id=mock-clinic&page=1&limit=20') as {
      appointments?: AppointmentOverlap[]
    } | null

    expect(result).not.toBeNull()
    expect(Array.isArray(result?.appointments)).toBe(true)

    return result?.appointments ?? []
  }

  it('returns no overlapping appointments for same dentist on same day from the real mock route', () => {
    const appointments = getAppointmentsFromRoute()

    const conflicts: string[] = []
    for (let i = 0; i < appointments.length; i++) {
      for (let j = i + 1; j < appointments.length; j++) {
        if (overlaps(appointments[i], appointments[j])) {
          const a = appointments[i]
          const b = appointments[j]
          conflicts.push(
            `CONFLICT: ${a.dentist_id} on ${a.scheduled_at.slice(0, 10)} — ` +
            `"${a.id}" (${a.scheduled_at.slice(11, 16)}, ${a.duration_minutes}min) vs ` +
            `"${b.id}" (${b.scheduled_at.slice(11, 16)}, ${b.duration_minutes}min)`,
          )
        }
      }
    }

    expect(conflicts).toHaveLength(0)
  })

  it('returns unique appointment IDs from the real mock route', () => {
    const appointments = getAppointmentsFromRoute()
    const ids = appointments.map((appointment) => appointment.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps availability mock consistent with occupied appointment slots for a dentist/day', () => {
    const routeResult = getMockForUrl('/api/appointments/availability?clinic_id=mock-clinic&date=2026-06-16&dentist_id=mock-dentist-silva-001&duration_minutes=30') as {
      slots?: Array<{ time: string; available: boolean }>
    } | null

    expect(routeResult).not.toBeNull()
    // Base appointment at 08:00 (30min) → 08:00 occupied
    expect(routeResult?.slots?.find((slot) => slot.time === '08:00')?.available).toBe(false)
    // 08:30 should be free (08:00 appt ends at 08:30)
    expect(routeResult?.slots?.find((slot) => slot.time === '08:30')?.available).toBe(true)
    // 09:00 should be free
    expect(routeResult?.slots?.find((slot) => slot.time === '09:00')?.available).toBe(true)
  })

  it('exposes a purposefully distributed real route dataset across recent days', () => {
    const appointments = getAppointmentsFromRoute()
    const dayKeys = new Set(appointments.map((appointment) => appointment.scheduled_at.slice(0, 10)))

    expect(appointments.length).toBe(15)
    expect(dayKeys.size).toBeGreaterThanOrEqual(5)
  })

  it('returns future appointments for low seeds and past for high seeds', () => {
    // Verify the dayOffset logic with explicit overrides
    const today = daysFromNow(0).slice(0, 10)

    // Future: dayOffset 0, 1, 2
    const future = createAppointment(
      MOCK_IDS.patients.maria, 'Maria',
      MOCK_IDS.dentists.silva, 'Dr. Silva',
      MOCK_IDS.procedures.limpeza, 'Limpeza',
      0, 1, 8,
    )
    expect(future.scheduled_at.slice(0, 10) >= today).toBe(true)

    // Past: dayOffset -1
    const past = createAppointment(
      MOCK_IDS.patients.maria, 'Maria',
      MOCK_IDS.dentists.silva, 'Dr. Silva',
      MOCK_IDS.procedures.limpeza, 'Limpeza',
      0, -1, 8,
    )
    expect(past.scheduled_at.slice(0, 10) < today).toBe(true)
  })

  it('respects explicit dayOffset and hour overrides', () => {
    const apt = createAppointment(
      MOCK_IDS.patients.maria, 'Maria',
      MOCK_IDS.dentists.silva, 'Dr. Silva',
      MOCK_IDS.procedures.limpeza, 'Limpeza',
      99, -5, 14,
    )
    // -5 days from now should be in the past
    const aptDate = apt.scheduled_at.slice(0, 10)
    const today = daysFromNow(0).slice(0, 10)
    expect(aptDate < today).toBe(true)
    // Hour should be 14
    expect(apt.scheduled_at.slice(11, 13)).toBe('14')
  })
})
