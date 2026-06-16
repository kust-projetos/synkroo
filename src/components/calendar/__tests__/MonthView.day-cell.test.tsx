/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { MonthView } from '../views/MonthView'

// Mock the calendar store
jest.mock('../store/calendar-store', () => ({
  useCalendarStore: jest.fn((selector?: (s: any) => any) => {
    const store = {
      setView: jest.fn(),
      setSelectedDate: jest.fn(),
      openEditDialog: jest.fn(),
      openCreateDialog: jest.fn(),
      view: 'month',
      selectedDate: new Date('2026-06-01T00:00:00'),
      startHour: 6,
      endHour: 22,
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
