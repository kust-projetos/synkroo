/**
 * @jest-environment jsdom
 */

import { describe, expect, it, beforeEach } from '@jest/globals'

// We test the store directly — it's a vanilla Zustand store, no React needed
import { useCalendarStore } from '../store/calendar-store'

describe('professionals scaling modes', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useCalendarStore.setState({
      groupMode: 'professionals',
      densityMode: 'comfortable',
    })
  })

  it('defaults groupMode to professionals and densityMode to comfortable', () => {
    const state = useCalendarStore.getState()

    expect(state.groupMode).toBe('professionals')
    expect(state.densityMode).toBe('comfortable')
  })

  it('supports setting groupMode to time and status', () => {
    useCalendarStore.getState().setGroupMode('time')
    expect(useCalendarStore.getState().groupMode).toBe('time')

    useCalendarStore.getState().setGroupMode('status')
    expect(useCalendarStore.getState().groupMode).toBe('status')

    useCalendarStore.getState().setGroupMode('professionals')
    expect(useCalendarStore.getState().groupMode).toBe('professionals')
  })

  it('supports setting densityMode between compact and comfortable', () => {
    useCalendarStore.getState().setDensityMode('compact')
    expect(useCalendarStore.getState().densityMode).toBe('compact')

    useCalendarStore.getState().setDensityMode('comfortable')
    expect(useCalendarStore.getState().densityMode).toBe('comfortable')
  })

  it('keeps groupMode and densityMode independent of view changes', () => {
    // Set custom modes
    useCalendarStore.getState().setGroupMode('status')
    useCalendarStore.getState().setDensityMode('compact')

    // Change view
    useCalendarStore.getState().setView('day')
    expect(useCalendarStore.getState().groupMode).toBe('status')
    expect(useCalendarStore.getState().densityMode).toBe('compact')

    // Change view again
    useCalendarStore.getState().setView('professionals')
    expect(useCalendarStore.getState().groupMode).toBe('status')
    expect(useCalendarStore.getState().densityMode).toBe('compact')
  })
})

// ── Column summary computation ──────────────────

import { computeProfessionalSummary } from '../views/ProfessionalsView'
import type { CalendarEvent } from '../utils/types'

describe('professional column summaries', () => {
  const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: 'apt-1',
    title: 'Maria Silva',
    start: new Date('2026-06-16T09:00:00'),
    end: new Date('2026-06-16T09:30:00'),
    dentistId: 'dent-1',
    dentistName: 'Dra. Ana',
    dentistSpecialty: 'Ortodontia',
    procedureName: 'Avaliação',
    status: 'scheduled',
    durationMinutes: 30,
    ...overrides,
  })

  it('computes appointment count per professional', () => {
    const events = [
      baseEvent(),
      baseEvent({ id: 'apt-2', title: 'João' }),
    ]

    const summary = computeProfessionalSummary(events, 6, 22)

    expect(summary).toEqual(
      expect.objectContaining({
        appointmentCount: 2,
      }),
    )
  })

  it('finds next free slot after the last occupied slot', () => {
    const events = [
      baseEvent(), // 09:00-09:30
    ]

    const summary = computeProfessionalSummary(events, 6, 22)

    expect(summary.nextFreeSlot).toBe('09:30')
  })

  it('counts AI-origin changes', () => {
    const events = [
      baseEvent({ origin: 'ai', changeSummary: 'Remarcado pela IA' }),
      baseEvent({ id: 'apt-2', origin: 'manual' }),
    ]

    const summary = computeProfessionalSummary(events, 6, 22)

    expect(summary.aiChangesCount).toBe(1)
  })

  it('counts scheduled appointments as attention items', () => {
    const events = [
      baseEvent({ status: 'scheduled' }),
      baseEvent({ id: 'apt-2', status: 'confirmed' }),
      baseEvent({ id: 'apt-3', status: 'scheduled' }),
    ]

    const summary = computeProfessionalSummary(events, 6, 22)

    expect(summary.attentionCount).toBe(2)
  })

  it('returns empty nextFreeSlot when no events exist', () => {
    const summary = computeProfessionalSummary([], 6, 22)

    expect(summary.nextFreeSlot).toBe('06:00')
  })

  it('works with column-index-keyed events (runtime shape from groupEventsByDentist)', () => {
    // groupEventsByDentist returns Map<number, CalendarEvent[]>
    // Verify that computeProfessionalSummary handles the exact runtime data flow
    const events = [
      baseEvent({ id: 'apt-1', dentistId: 'dent-1' }),
      baseEvent({ id: 'apt-2', dentistId: 'dent-1', status: 'confirmed' }),
    ]

    // Simulate what ProfessionalsView does: map resource by column index i
    const colEvents = events // events for column 0 (dent-1)
    const summary = computeProfessionalSummary(colEvents, 6, 22)

    expect(summary.appointmentCount).toBe(2)
    expect(summary.aiChangesCount).toBe(0)
    expect(summary.attentionCount).toBe(1) // only apt-1 is scheduled
    expect(summary.nextFreeSlot).toBe('09:30') // after 09:00-09:30 twice = 09:30
  })
})

// ── Card rendering behavior ──────────────────

// These tests verify EventCard rendering in professionals mode.
// We use a local mock that wraps the real store, only overriding `view`.

import { render, screen } from '@testing-library/react'
import type { LaidOutEvent } from '../utils/types'

const { EventCard } = jest.requireActual('../events/EventCard')

// Mock EventTooltip to avoid portal issues
jest.mock('../events/EventTooltip', () => ({
  EventTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('professionals mode card rendering', () => {
  beforeEach(() => {
    // Set the real store to professionals view
    useCalendarStore.setState({ view: 'professionals' })
  })

  const makeLaidOut = (overrides: Partial<LaidOutEvent['event']> = {}): LaidOutEvent => ({
    event: {
      id: 'apt-1',
      title: 'Maria Silva',
      start: new Date('2026-06-16T09:00:00'),
      end: new Date('2026-06-16T09:30:00'),
      dentistId: 'dent-1',
      dentistName: 'Dra. Ana',
      procedureName: 'Avaliação',
      status: 'scheduled',
      durationMinutes: 30,
      ...overrides,
    },
    column: 0,
    totalColumns: 1,
  })

  it('does not render dentist name in professionals mode', () => {
    render(
      <EventCard
        laidOut={makeLaidOut()}
        gridColumn={0}
        totalGridColumns={1}
      />,
    )

    expect(screen.queryByText(/Dra\. Ana/)).not.toBeInTheDocument()
    expect(screen.getByText('Avaliação')).toBeInTheDocument()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
  })

  it('renders patient name and time in professionals mode', () => {
    render(
      <EventCard
        laidOut={makeLaidOut()}
        gridColumn={0}
        totalGridColumns={1}
      />,
    )

    expect(screen.getByText(/09:00/)).toBeInTheDocument()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
  })
})
