/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { DayView } from '../views/DayView'

// Mock the calendar store
jest.mock('../store/calendar-store', () => ({
  useCalendarStore: jest.fn((selector?: (s: any) => any) => {
    const store = {
      startHour: 6,
      endHour: 22,
      openEditDialog: jest.fn(),
      openCreateDialog: jest.fn(),
      view: 'day',
      selectedDate: new Date('2026-06-16T00:00:00'),
      dentistFilter: [],
      setView: jest.fn(),
      goToday: jest.fn(),
      goNext: jest.fn(),
      goPrev: jest.fn(),
      syncFromURL: jest.fn(),
      toSearchParams: jest.fn(() => new URLSearchParams()),
    }
    return selector ? selector(store) : store
  }),
}))

// Mock useAutoScroll
jest.mock('../hooks/useAutoScroll', () => ({
  useAutoScroll: jest.fn(() => ({ current: null })),
}))

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
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()
  })

  it('shows procedure name in day view', () => {
    render(
      <DayView
        date={new Date('2026-06-16T00:00:00')}
        events={[baseEvent]}
      />,
    )

    expect(screen.getByText('Avaliação')).toBeInTheDocument()
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
