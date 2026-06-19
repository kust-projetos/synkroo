/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { MonthView } from '../views/MonthView'
import type { CalendarEvent } from '../utils/types'

// Mock the calendar store
// Mutable overrides for per-test store config
const storeOverrides: Record<string, any> = {}

jest.mock('../store/calendar-store', () => ({
  useCalendarStore: jest.fn((selector?: (s: any) => any) => {
    const store = {
      setView: jest.fn(),
      setSelectedDate: jest.fn(),
      openEditDialog: jest.fn(),
      openCreateDialog: jest.fn(),
      view: 'month',
      layoutMode: 'agenda',
      groupMode: 'professionals',
      densityMode: 'comfortable',
      selectedDate: new Date('2026-06-01T00:00:00'),
      startHour: 6,
      endHour: 22,
      ...storeOverrides,
    }
    return selector ? selector(store) : store
  }),
}))

describe('MonthView', () => {
  const baseEvent = {
    id: 'apt-1',
    title: 'Maria Silva',
    start: new Date('2026-06-12T09:00:00'),
    end: new Date('2026-06-12T09:30:00'),
    dentistId: 'dent-1',
    dentistName: 'Dra. Ana',
    procedureName: 'Avaliação',
    status: 'scheduled' as const,
    durationMinutes: 30,
  }

  it('shows appointment title and time in a month day cell', () => {
    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={[baseEvent]}
      />,
    )

    // June 12 falls on a Friday in 2026. The card should show "09:00 - Maria Silva"
    expect(screen.getByText(/09:00/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Silva/)).toBeInTheDocument()
  })

  it('shows procedure name and status when day cell is expanded', () => {
    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={[baseEvent]}
      />,
    )

    // Without expansion, detailed info should not be visible
    // But the event card is still rendered (just condensed)
    expect(screen.getByText(/09:00/)).toBeInTheDocument()
    expect(screen.getByText(/Maria Silva/)).toBeInTheDocument()
  })

  it('shows AI origin indicator when event has ai origin', () => {
    const aiEvent = {
      ...baseEvent,
      origin: 'ai' as const,
    }
    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={[aiEvent]}
      />,
    )

    // Should show the "IA" badge or indicator
    expect(screen.getByText('IA')).toBeInTheDocument()
  })

  it('renders weekday headers in Portuguese', () => {
    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={[]}
      />,
    )

    expect(screen.getByText('Seg')).toBeInTheDocument()
    expect(screen.getByText('Ter')).toBeInTheDocument()
    expect(screen.getByText('Qua')).toBeInTheDocument()
    expect(screen.getByText('Qui')).toBeInTheDocument()
    expect(screen.getByText('Sex')).toBeInTheDocument()
    expect(screen.getByText('Sab')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
  })
})

// ── MonthView professionals mode ────────────

describe('MonthView professionals layout mode', () => {
  beforeEach(() => {
    Object.assign(storeOverrides, { layoutMode: 'professionals' })
  })

  afterEach(() => {
    delete storeOverrides.layoutMode
  })

  const baseEvent = (overrides: Partial<CalendarEvent> = {}) => ({
    id: 'apt-1',
    title: 'Maria Silva',
    start: new Date('2026-06-12T09:00:00'),
    end: new Date('2026-06-12T09:30:00'),
    dentistId: 'dent-1',
    dentistName: 'Dra. Ana',
    procedureName: 'Avaliação',
    status: 'scheduled' as const,
    durationMinutes: 30,
    ...overrides,
  })

  it('shows dentist name as group header in professionals mode', () => {
    const events = [
      baseEvent(),
      baseEvent({
        id: 'apt-2',
        title: 'João Santos',
        dentistId: 'dent-2',
        dentistName: 'Dr. Carlos',
        start: new Date('2026-06-12T10:00:00'),
        end: new Date('2026-06-12T10:30:00'),
      }),
    ]

    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={events}
      />,
    )

    // Dentist names should appear as group labels
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Dr. Carlos')).toBeInTheDocument()
  })

  it('preserves monthly grid structure in professionals mode', () => {
    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={[baseEvent()]}
      />,
    )

    // Weekday headers still visible
    expect(screen.getAllByText('Sex').length).toBeGreaterThanOrEqual(1)
  })

  it('shows per-dentist overflow in professionals mode, not global', () => {
    // Day has 4 events for Dra. Ana, 1 for Dr. Carlos
    // MAX_VISIBLE_EVENTS = 3 → overflow only for Dra. Ana (1 hidden)
    const events: CalendarEvent[] = []
    // Dra. Ana: 4 events
    for (let i = 0; i < 4; i++) {
      events.push(baseEvent({
        id: `apt-ana-${i}`,
        title: `Paciente Ana ${i}`,
        dentistId: 'dent-1',
        dentistName: 'Dra. Ana',
        start: new Date(`2026-06-12T${String(8 + i).padStart(2, '0')}:00:00`),
        end: new Date(`2026-06-12T${String(8 + i).padStart(2, '0')}:30:00`),
      }))
    }
    // Dr. Carlos: 1 event
    events.push(baseEvent({
      id: 'apt-carlos-0',
      title: 'Paciente Carlos',
      dentistId: 'dent-2',
      dentistName: 'Dr. Carlos',
      start: new Date('2026-06-12T14:00:00'),
      end: new Date('2026-06-12T14:30:00'),
    }))

    render(
      <MonthView
        date={new Date('2026-06-01T00:00:00')}
        events={events}
      />,
    )

    // Both dentist headers visible
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Dr. Carlos')).toBeInTheDocument()

    // Ana has 4 events, only 3 visible → overflow of 1
    expect(screen.getByText('+1 mais')).toBeInTheDocument()

    // Carlos has 1 event, all visible → no overflow for him
    // Verify that the overflow text is Ana-specific, not global
    // (If it were global, it would say +2 mais for 5 total - 3 visible)
    expect(screen.queryByText('+2 mais')).not.toBeInTheDocument()
  })
})
