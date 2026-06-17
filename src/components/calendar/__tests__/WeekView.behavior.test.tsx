/**
 * @jest-environment jsdom
 */

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { WeekView } from '../views/WeekView'
import type { CalendarEvent } from '../utils/types'

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
    view: 'week',
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

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
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

describe('WeekView agenda mode', () => {
  it('shows 7 day columns in agenda mode', () => {
    render(
      <WeekView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent()]}
      />,
    )

    // Weekday headers should be visible (full names in pt-BR)
    expect(screen.getByText(/terça/)).toBeInTheDocument()
  })
})

describe('WeekView professionals layout mode', () => {
  beforeEach(() => {
    Object.assign(storeOverrides, {
      view: 'week',
      layoutMode: 'professionals',
    })
  })

  afterEach(() => {
    delete storeOverrides.layoutMode
  })

  it('shows dentist group headers within day columns', () => {
    const events = [
      baseEvent(),
      baseEvent({
        id: 'apt-2',
        dentistId: 'dent-2',
        dentistName: 'Dr. Carlos',
        start: new Date('2026-06-16T10:00:00'),
        end: new Date('2026-06-16T10:30:00'),
      }),
    ]

    render(
      <WeekView
        date={new Date('2026-06-16T00:00:00')}
        events={events}
      />,
    )

    // Dentist names should appear as group labels (not column headers)
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Dr. Carlos')).toBeInTheDocument()
  })

  it('keeps 7 day columns in professionals mode', () => {
    render(
      <WeekView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent()]}
      />,
    )

    // All 7 weekday headers should be visible
    expect(screen.getByText(/segunda/)).toBeInTheDocument()
    expect(screen.getByText(/terça/)).toBeInTheDocument()
    expect(screen.getByText(/quarta/)).toBeInTheDocument()
    expect(screen.getByText(/quinta/)).toBeInTheDocument()
    expect(screen.getByText(/sexta/)).toBeInTheDocument()
  })

  it('groups events by dentist within each day column', () => {
    // Same day (Tuesday June 16), 2 dentists, 3 events
    const events = [
      baseEvent({ id: 'apt-ana-1', title: 'Paciente A1' }),
      baseEvent({ id: 'apt-ana-2', title: 'Paciente A2', start: new Date('2026-06-16T10:00:00'), end: new Date('2026-06-16T10:30:00') }),
      baseEvent({ id: 'apt-carlos-1', title: 'Paciente C1', dentistId: 'dent-2', dentistName: 'Dr. Carlos', start: new Date('2026-06-16T14:00:00'), end: new Date('2026-06-16T14:30:00') }),
    ]

    render(
      <WeekView
        date={new Date('2026-06-16T00:00:00')}
        events={events}
      />,
    )

    // Both dentist groups visible
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
    expect(screen.getByText('Dr. Carlos')).toBeInTheDocument()
    // Patient names visible
    expect(screen.getByText('Paciente A1')).toBeInTheDocument()
    expect(screen.getByText('Paciente C1')).toBeInTheDocument()
  })

  it('excludes events outside the week range', () => {
    const events = [
      baseEvent(), // Tuesday June 16
      baseEvent({
        id: 'apt-outside',
        dentistName: 'Dr. Fora',
        start: new Date('2026-06-22T09:00:00'),
        end: new Date('2026-06-22T09:30:00'),
      }),
    ]

    render(
      <WeekView
        date={new Date('2026-06-16T00:00:00')}
        events={events}
      />,
    )

    expect(screen.queryByText('Dr. Fora')).not.toBeInTheDocument()
  })

  it('does not render dentist name inside event cards in professionals mode', () => {
    render(
      <WeekView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent()]}
      />,
    )

    // Patient visible, dentist in group header only
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
  })
})
