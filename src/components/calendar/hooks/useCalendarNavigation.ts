'use client'

import { useCallback } from 'react'
import { addWeeks, addMonths, addDays, subWeeks, subMonths, subDays } from '../utils/date-utils'
import type { CalendarView } from './useCalendarState'

interface UseCalendarNavigationProps {
  view: CalendarView
  date: Date
  onDateChange: (date: Date) => void
}

export function useCalendarNavigation({ view, date, onDateChange }: UseCalendarNavigationProps) {
  const goToToday = useCallback(() => {
    onDateChange(new Date())
  }, [onDateChange])

  const goToPrevious = useCallback(() => {
    switch (view) {
      case 'timeGridWeek':
      case 'resourceTimeGridDay':
        onDateChange(subWeeks(date, 1))
        break
      case 'timeGridDay':
        onDateChange(subDays(date, 1))
        break
      case 'dayGridMonth':
        onDateChange(subMonths(date, 1))
        break
      default:
        onDateChange(subWeeks(date, 1))
    }
  }, [view, date, onDateChange])

  const goToNext = useCallback(() => {
    switch (view) {
      case 'timeGridWeek':
      case 'resourceTimeGridDay':
        onDateChange(addWeeks(date, 1))
        break
      case 'timeGridDay':
        onDateChange(addDays(date, 1))
        break
      case 'dayGridMonth':
        onDateChange(addMonths(date, 1))
        break
      default:
        onDateChange(addWeeks(date, 1))
    }
  }, [view, date, onDateChange])

  return {
    goToToday,
    goToPrevious,
    goToNext,
  }
}
