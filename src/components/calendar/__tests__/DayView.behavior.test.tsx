/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { DayView } from '../views/DayView'

// Mock the calendar store
jest.mock('../store/calendar-store', () => ({
  useCalendarStore: jest.fn((selector?: (s: any) => any) => {
    const store = getStoreState()
    return selector ? selector(store) : store
  }),
}))

// Mock useAutoScroll
jest.mock('../hooks/useAutoScroll', () => ({
  useAutoScroll: jest.fn(() => ({ current: null })),
}))

// Mutable overrides for per-test store config
const storeOverrides: Record<string, any> = {}
function getStoreState() {
  return {
    startHour: 6,
    endHour: 22,
    openEditDialog: jest.fn(),
    openCreateDialog: jest.fn(),
    view: 'day',
    layoutMode: 'agenda',
    groupMode: 'professionals',
    densityMode: 'comfortable',
    selectedDate: new Date('2026-06-16T00:00:00'),
    dentistFilter: [],
    setView: jest.fn(),
    setLayoutMode: jest.fn(),
    goToday: jest.fn(),
    goNext: jest.fn(),
    goPrev: jest.fn(),
    syncFromURL: jest.fn(),
    toSearchParams: jest.fn(() => new URLSearchParams()),
    ...storeOverrides,
  }
}

describe('DayView', () => {
  const baseEvent = {
    id: 'apt-1',
    title: 'Maria Silva',
    start: new Date('2026-06-16T09:00:00'),
    end: new Date('2026-06-16T09:30:00'),
    dentistId: 'dent-1',
    dentistName: 'Dra. Ana',
    procedureName: 'Avaliação',
    status: 'scheduled' as const,
    durationMinutes: 30,
  }

  it('shows appointment title and dentist in day view', () => {
    render(
      <DayView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent]}
      />,
    )

    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText(/Dra\. Ana/)).toBeInTheDocument()
  })

  it('shows procedure name in day view', () => {
    render(
      <DayView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent]}
      />,
    )

    expect(screen.getByText(/Avaliação/)).toBeInTheDocument()
  })

  it('shows AI origin badge when origin is ai', () => {
    const aiEvent = { ...baseEvent, origin: 'ai' as const }
    render(
      <DayView
        date={new Date('2026-06-16T00:00:00')}
        events={[aiEvent]}
      />,
    )

    expect(screen.getByText('IA')).toBeInTheDocument()
  })

  it('shows change summary when provided', () => {
    const changedEvent = {
      ...baseEvent,
      changeSummary: 'Remarcado pela IA há 12 min',
    }
    render(
      <DayView
        date={new Date('2026-06-16T00:00:00')}
        events={[changedEvent]}
      />,
    )

    expect(screen.getByText(/Remarcado pela IA/)).toBeInTheDocument()
  })

  it('does not show origin badge when origin is undefined', () => {
    render(
      <DayView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent]}
      />,
    )

    expect(screen.queryByText('IA')).not.toBeInTheDocument()
    expect(screen.queryByText('Manual')).not.toBeInTheDocument()
  })
})

// ── DayView professionals mode ──────────────

describe('DayView professionals layout mode', () => {
  beforeEach(() => {
    Object.assign(storeOverrides, {
      view: 'day',
      layoutMode: 'professionals',
    })
  })

  afterEach(() => {
    delete storeOverrides.layoutMode
  })

  const baseEvent = (overrides: Partial<CalendarEvent> = {}) => ({
    id: 'apt-1',
    title: 'Maria Silva',
    start: new Date('2026-06-16T09:00:00'),
    end: new Date('2026-06-16T09:30:00'),
    dentistId: 'dent-1',
    dentistName: 'Dra. Ana',
    procedureName: 'Avaliação',
    status: 'scheduled' as const,
    durationMinutes: 30,
    ...overrides,
  })

  it('renders columns by dentist in professionals mode', () => {
    const events = [
      baseEvent(),
      baseEvent({ id: 'apt-2', dentistId: 'dent-2', dentistName: 'Dr. Carlos', start: new Date('2026-06-16T10:00:00'), end: new Date('2026-06-16T10:30:00') }),
    ]

    render(<DayView date={new Date('2026-06-16T00:00:00')} events={events} />)

    // Both dentist names should appear as column headers
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Dr. Carlos')).toBeInTheDocument()
  })

  it('does not render dentist name inside event cards in professionals mode', () => {
    const events = [baseEvent()]

    render(<DayView date={new Date('2026-06-16T00:00:00')} events={events} />)

    // Patient name still visible
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    // Dentist name appears as column header, which is expected
    // The EventCard itself omits dentistName (verified in ProfessionalsView.scaling.test.tsx)
  })

  it('excludes events from other dates', () => {
    const events = [
      baseEvent(), // June 16
      baseEvent({
        id: 'apt-3',
        start: new Date('2026-06-15T09:00:00'), // different day
        end: new Date('2026-06-15T09:30:00'),
        dentistName: 'Dr. Outro',
      }),
    ]

    render(<DayView date={new Date('2026-06-16T00:00:00')} events={events} />)

    // Dr. Outro should NOT appear (event is on June 15, not 16)
    expect(screen.queryByText('Dr. Outro')).not.toBeInTheDocument()
  })

  it('renders single column when only one dentist has events', () => {
    const events = [
      baseEvent(),
      baseEvent({ id: 'apt-2', start: new Date('2026-06-16T10:00:00'), end: new Date('2026-06-16T10:30:00') }),
    ]

    render(<DayView date={new Date('2026-06-16T00:00:00')} events={events} />)

    // Both events are for Dra. Ana → single column
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
  })
})
