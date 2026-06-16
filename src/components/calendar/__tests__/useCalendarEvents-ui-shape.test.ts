import { describe, expect, it } from '@jest/globals'
import type { CalendarEvent } from '../utils/types'

describe('calendar event UI shape', () => {
  it('supports safe optional origin/change metadata', () => {
    const event: CalendarEvent = {
      id: 'apt-1',
      title: 'Maria',
      start: new Date('2026-06-16T09:00:00'),
      end: new Date('2026-06-16T09:30:00'),
      dentistId: 'dent-1',
      dentistName: 'Dra. Ana',
      procedureName: 'Avaliação',
      status: 'scheduled',
      durationMinutes: 30,
      origin: 'ai',
      changeSummary: 'Remarcado pela IA há 12 min',
      changeImpact: 'Abriu lacuna às 09:00',
    }

    expect(event.origin).toBe('ai')
    expect(event.changeSummary).toContain('IA')
    expect(event.changeImpact).toContain('lacuna')
  })

  it('accepts undefined optional fields', () => {
    const event: CalendarEvent = {
      id: 'apt-2',
      title: 'João',
      start: new Date('2026-06-16T10:00:00'),
      end: new Date('2026-06-16T10:30:00'),
      dentistId: 'dent-2',
      dentistName: 'Dr. Carlos',
      procedureName: 'Limpeza',
      status: 'confirmed',
      durationMinutes: 30,
    }

    expect(event.origin).toBeUndefined()
    expect(event.changeSummary).toBeUndefined()
    expect(event.changeImpact).toBeUndefined()
  })
})
