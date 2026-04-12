// src/components/calendar/hooks/useCalendarState.ts
'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns'

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'resourceTimeGridDay'

export const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: 'Mês',
  timeGridWeek: 'Semana',
  timeGridDay: 'Dia',
  resourceTimeGridDay: 'Profissionais',
}

export const ALL_VIEWS: CalendarView[] = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay']

export const MOBILE_VIEWS: CalendarView[] = ['timeGridDay']

export interface CalendarState {
  view: CalendarView
  date: Date
  dentistIds: string[]
  specialty: string
  startDate: string
  endDate: string
}

export function useCalendarState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const state: CalendarState = useMemo(() => {
    const viewParam = searchParams.get('view') as CalendarView | null
    const view = (viewParam !== null && ALL_VIEWS.includes(viewParam)) ? viewParam : 'timeGridWeek'
    const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
    const date = new Date(dateStr + 'T12:00:00')
    const dentists = searchParams.get('dentists') || ''
    const dentistIds = dentists ? dentists.split(',').filter(Boolean) : []
    const specialty = searchParams.get('specialty') || ''

    // Compute date range based on view
    let startDate: string
    let endDate: string
    switch (view) {
      case 'dayGridMonth':
        startDate = format(startOfMonth(date), 'yyyy-MM-dd')
        endDate = format(endOfMonth(date), 'yyyy-MM-dd')
        break
      case 'resourceTimeGridDay':
      case 'timeGridDay':
        startDate = dateStr
        endDate = dateStr
        break
      case 'timeGridWeek':
      default:
        startDate = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        endDate = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
    }

    return { view, date, dentistIds, specialty, startDate, endDate }
  }, [searchParams])

  const updateState = useCallback((updates: Partial<{
    view: CalendarView
    date: Date
    dentistIds: string[]
    specialty: string
  }>) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.view) params.set('view', updates.view)
    if (updates.date) params.set('date', format(updates.date, 'yyyy-MM-dd'))
    if (updates.dentistIds) {
      if (updates.dentistIds.length > 0) {
        params.set('dentists', updates.dentistIds.join(','))
      } else {
        params.delete('dentists')
      }
    }
    if (updates.specialty !== undefined) {
      if (updates.specialty) {
        params.set('specialty', updates.specialty)
      } else {
        params.delete('specialty')
      }
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  return { state, updateState }
}
