// Mock events generator — realistic demo data for development
// Generates deterministic appointments for the current week

import type { CalendarEvent, CalendarResource } from './types'
import type { AppointmentStatus } from '@/lib/supabase/database.types'

// ── Demo entities ──────────────────────────────────────────────

const DEMO_DENTISTS = [
  { id: 'dent-1', name: 'Dr. Carlos Mendes', specialty: 'Ortodontia' },
  { id: 'dent-2', name: 'Dra. Ana Ribeiro', specialty: 'Endodontia' },
  { id: 'dent-3', name: 'Dr. Pedro Santos', specialty: 'Implantodontia' },
  { id: 'dent-4', name: 'Dra. Mariana Costa', specialty: 'Pediatria' },
]

const DEMO_PATIENTS = [
  'Maria Silva', 'João Oliveira', 'Ana Souza', 'Pedro Lima',
  'Carla Ferreira', 'Lucas Almeida', 'Beatriz Rocha', 'Rafael Martins',
  'Isabela Gomes', 'Thiago Barbosa', 'Camila Dias', 'Bruno Nascimento',
  'Fernanda Araujo', 'Gabriel Costa', 'Juliana Pereira', 'Diego Ramos',
  'Patricia Teixeira', 'Rodrigo Moura', 'Aline Cordeiro', 'Marcos Vieira',
]

const DEMO_PROCEDURES = [
  { name: 'Limpeza', duration: 30 },
  { name: 'Clareamento', duration: 60 },
  { name: 'Extração', duration: 45 },
  { name: 'Restauração', duration: 60 },
  { name: 'Canal', duration: 90 },
  { name: 'Avaliação', duration: 30 },
  { name: 'Profilaxia', duration: 30 },
  { name: 'Aparelho - Ajuste', duration: 30 },
  { name: 'Aparelho - Instalação', duration: 60 },
  { name: 'Implante - Avaliação', duration: 45 },
  { name: 'Raio-X', duration: 15 },
  { name: 'Coroa', duration: 60 },
]

const STATUS_DISTRIBUTION: AppointmentStatus[] = [
  'scheduled', 'scheduled', 'scheduled',
  'confirmed', 'confirmed', 'confirmed', 'confirmed',
  'in_progress',
  'completed', 'completed',
  'cancelled',
  'no_show',
]

// ── Seeded random ──────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff
    return (state >>> 0) / 0xffffffff
  }
}

function hashDate(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

// ── Event generation ───────────────────────────────────────────

export function generateMockResources(): CalendarResource[] {
  return DEMO_DENTISTS.map((d) => ({
    id: d.id,
    name: d.name,
    color: '', // Colors come from getDentistPalette()
    specialty: d.specialty,
  }))
}

export function generateMockEvents(startDate: Date, endDate: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  let dayCursor = new Date(start)
  let eventId = 1

  while (dayCursor <= end) {
    const dow = dayCursor.getDay()
    // Skip Sundays
    if (dow === 0) {
      dayCursor.setDate(dayCursor.getDate() + 1)
      continue
    }

    const seed = hashDate(dayCursor)
    const rand = seededRandom(seed)

    // Number of appointments per day: 6-12 on weekdays, 3-6 on Saturday
    const isSaturday = dow === 6
    const count = isSaturday
      ? Math.floor(rand() * 4) + 3
      : Math.floor(rand() * 7) + 6

    for (let i = 0; i < count; i++) {
      // Pick entities
      const patientIdx = Math.floor(rand() * DEMO_PATIENTS.length)
      const dentistIdx = Math.floor(rand() * DEMO_DENTISTS.length)
      const procIdx = Math.floor(rand() * DEMO_PROCEDURES.length)
      const statusIdx = Math.floor(rand() * STATUS_DISTRIBUTION.length)

      const patient = DEMO_PATIENTS[patientIdx]
      const dentist = DEMO_DENTISTS[dentistIdx]
      const procedure = DEMO_PROCEDURES[procIdx]
      const status = STATUS_DISTRIBUTION[statusIdx]

      // Time: 07:00 - 21:00 with 15-minute granularity
      const startHour = 7 + Math.floor(rand() * 13) // 7-19
      const startMinute = Math.floor(rand() * 4) * 15 // 0, 15, 30, 45

      const eventStart = new Date(dayCursor)
      eventStart.setHours(startHour, startMinute, 0, 0)

      const eventEnd = new Date(eventStart.getTime() + procedure.duration * 60000)

      // Skip if extends past 22:00
      if (eventEnd.getHours() >= 22) continue

      events.push({
        id: `mock-${eventId++}`,
        title: patient,
        start: eventStart,
        end: eventEnd,
        dentistId: dentist.id,
        dentistName: dentist.name,
        procedureName: procedure.name,
        status,
        durationMinutes: procedure.duration,
        notes: status === 'no_show' ? 'Paciente não compareceu' : null,
      })
    }

    dayCursor.setDate(dayCursor.getDate() + 1)
  }

  return events
}
