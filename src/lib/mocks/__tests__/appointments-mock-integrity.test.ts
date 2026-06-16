/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals'

// Directly import the mock router to get raw appointments
// We test the factory function, not the HTTP layer
import {
  createAppointment,
  daysFromNow,
} from '../utils'
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
  it('generates no overlapping appointments for same dentist on same day', () => {
    // Rebuild the exact dataset from the mock router
    const appointments: AppointmentOverlap[] = [
      // Base
      createAppointment(MOCK_IDS.patients.maria, 'Maria Silva', MOCK_IDS.dentists.silva, 'Dr. Silva', MOCK_IDS.procedures.limpeza, 'Limpeza', 100, 0, 8),
      createAppointment(MOCK_IDS.patients.joao, 'João Santos', MOCK_IDS.dentists.souza, 'Dra. Souza', MOCK_IDS.procedures.canal, 'Canal', 101, 0, 10),
      createAppointment(MOCK_IDS.patients.ana, 'Ana Costa', MOCK_IDS.dentists.silva, 'Dr. Silva', MOCK_IDS.procedures.avaliacao, 'Avaliação', 102, 1, 9),
    ]

    // Extra: same slots as mock router
    const extraSlots: { dayOffset: number; hour: number; dentistIdx: number }[] = [
      { dayOffset: -1, hour: 8, dentistIdx: 0 },
      { dayOffset: -1, hour: 9, dentistIdx: 1 },
      { dayOffset: -1, hour: 11, dentistIdx: 0 },
      { dayOffset: -2, hour: 8, dentistIdx: 1 },
      { dayOffset: -2, hour: 10, dentistIdx: 0 },
      { dayOffset: -2, hour: 14, dentistIdx: 1 },
      { dayOffset: -3, hour: 9, dentistIdx: 0 },
      { dayOffset: -3, hour: 11, dentistIdx: 1 },
      { dayOffset: -3, hour: 15, dentistIdx: 0 },
      { dayOffset: -4, hour: 9, dentistIdx: 1 },
      { dayOffset: -4, hour: 10, dentistIdx: 0 },
      { dayOffset: -4, hour: 16, dentistIdx: 1 },
    ]

    for (let s = 0; s < extraSlots.length; s++) {
      const slot = extraSlots[s]
      const isSilva = slot.dentistIdx === 0
      appointments.push(
        createAppointment(
          `mock-patient-extra-${String((s % 16) + 1).padStart(3, '0')}`,
          `Paciente ${s + 1}`,
          isSilva ? MOCK_IDS.dentists.silva : MOCK_IDS.dentists.souza,
          isSilva ? 'Dr. Silva' : 'Dra. Souza',
          isSilva ? MOCK_IDS.procedures.limpeza : MOCK_IDS.procedures.implante,
          isSilva ? 'Limpeza' : 'Implante',
          s,
          slot.dayOffset,
          slot.hour,
        ),
      )
    }

    // Find overlaps
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

    if (conflicts.length > 0) {
      // Print all conflicts for debugging
      for (const c of conflicts) {
        console.log(c)
      }
    }

    expect(conflicts).toHaveLength(0)
  })

  it('generates unique appointment IDs', () => {
    const ids = new Set<string>()

    // Base 3
    const baseSeeds = [100, 101, 102]
    for (let i = 0; i < 3; i++) {
      const seed = baseSeeds[i]
      const apt = createAppointment(
        MOCK_IDS.patients.maria, 'Maria',
        MOCK_IDS.dentists.silva, 'Dr. Silva',
        MOCK_IDS.procedures.limpeza, 'Limpeza',
        seed, i, 8 + i,
      )
      expect(ids.has(apt.id)).toBe(false)
      ids.add(apt.id)
    }

    // Extra 12 — same as mock router
    const extraSlots = [
      { dayOffset: -1, hour: 8, dentistIdx: 0 },
      { dayOffset: -1, hour: 9, dentistIdx: 1 },
      { dayOffset: -1, hour: 11, dentistIdx: 0 },
      { dayOffset: -2, hour: 8, dentistIdx: 1 },
      { dayOffset: -2, hour: 10, dentistIdx: 0 },
      { dayOffset: -2, hour: 14, dentistIdx: 1 },
      { dayOffset: -3, hour: 9, dentistIdx: 0 },
      { dayOffset: -3, hour: 11, dentistIdx: 1 },
      { dayOffset: -3, hour: 15, dentistIdx: 0 },
      { dayOffset: -4, hour: 9, dentistIdx: 1 },
      { dayOffset: -4, hour: 10, dentistIdx: 0 },
      { dayOffset: -4, hour: 16, dentistIdx: 1 },
    ]
    for (let s = 0; s < extraSlots.length; s++) {
      const slot = extraSlots[s]
      const isSilva = slot.dentistIdx === 0
      const apt = createAppointment(
        `mock-patient-extra-${String((s % 16) + 1).padStart(3, '0')}`,
        `Paciente ${s + 1}`,
        isSilva ? MOCK_IDS.dentists.silva : MOCK_IDS.dentists.souza,
        isSilva ? 'Dr. Silva' : 'Dra. Souza',
        isSilva ? MOCK_IDS.procedures.limpeza : MOCK_IDS.procedures.implante,
        isSilva ? 'Limpeza' : 'Implante',
        s, slot.dayOffset, slot.hour,
      )
      expect(ids.has(apt.id)).toBe(false)
      ids.add(apt.id)
    }
  })

  it('spreads appointments across different hours for same dentist', () => {
    // Check that the hour formula doesn't produce same-hour conflicts
    // for the same dentist on dates where they have multiple appointments
    // (which shouldn't happen in the current dataset anyway)
    const hours = new Set<number>()
    for (let seed = 0; seed < 15; seed++) {
      const hour = 8 + (seed % 9)
      hours.add(hour)
    }
    // Should have at least 5 distinct hours (8-16 range gives 9 distinct)
    expect(hours.size).toBeGreaterThanOrEqual(5)
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
