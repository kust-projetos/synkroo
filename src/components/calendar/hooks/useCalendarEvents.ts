// useCalendarEvents — fetch appointments and transform to CalendarEvent[]

import { useMemo } from 'react'
import { subDays, addDays } from 'date-fns'
import { useCalendarEventsQuery, useDentists } from '@/lib/hooks/use-queries'
import { useAuth } from '@/lib/auth/context'
import { getWeekDays, formatDateKey } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'
import type { CalendarEvent, CalendarResource } from '../utils/types'

interface AppointmentRow {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  patients?: { id: string; name: string; phone: string } | null
  dentists?: { id: string; name: string; specialty?: string } | null
  procedures?: { id: string; name: string; duration_minutes: number; category?: string } | null
}

interface UseCalendarEventsResult {
  events: CalendarEvent[]
  resources: CalendarResource[]
  isLoading: boolean
  error: Error | null
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const { profile } = useAuth()
  const clinicId = profile?.clinic_id
  const { view, selectedDate, dentistFilter } = useCalendarStore()

  // Calculate date range based on view — expanded by ±1 day to account for timezone
  // offset between local dates and UTC boundaries used by the API
  const dateRange = useMemo(() => {
    if (view === 'month') {
      const y = selectedDate.getFullYear()
      const m = selectedDate.getMonth()
      const firstDay = new Date(y, m, 1)
      const lastDay = new Date(y, m + 1, 0)
      return {
        startDate: formatDateKey(subDays(firstDay, 1)),
        endDate: formatDateKey(addDays(lastDay, 1)),
      }
    }
    if (view === 'week') {
      const days = getWeekDays(selectedDate)
      return {
        startDate: formatDateKey(subDays(days[0], 1)),
        endDate: formatDateKey(addDays(days[days.length - 1], 1)),
      }
    }
    return {
      startDate: formatDateKey(subDays(selectedDate, 1)),
      endDate: formatDateKey(addDays(selectedDate, 1)),
    }
  }, [view, selectedDate])

  const queryString = useMemo(() => {
    if (!clinicId) return ''
    const params = new URLSearchParams({
      clinic_id: clinicId,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    })
    dentistFilter.forEach((id) => params.append('dentist_ids', id))
    return params.toString()
  }, [clinicId, dateRange, dentistFilter])

  const { data, isLoading, error } = useCalendarEventsQuery(queryString || undefined)
  const { data: dentistsData } = useDentists(clinicId)

  const events = useMemo<CalendarEvent[]>(() => {
    const appointments = (data?.appointments || []) as AppointmentRow[]
    return appointments.map((apt) => {
      const start = new Date(apt.scheduled_at)
      const end = new Date(start.getTime() + apt.duration_minutes * 60000)

      return {
        id: apt.id,
        title: apt.patients?.name || 'Paciente',
        start,
        end,
        dentistId: apt.dentists?.id || '',
        dentistName: apt.dentists?.name || 'Sem dentista',
        dentistSpecialty: apt.dentists?.specialty || undefined,
        procedureName: apt.procedures?.name || '',
        procedureCategory: apt.procedures?.category || undefined,
        status: apt.status as CalendarEvent['status'],
        durationMinutes: apt.duration_minutes,
        notes: apt.notes,
        origin: undefined,
        changeSummary: undefined,
        changeImpact: undefined,
      }
    })
  }, [data])

  const resources = useMemo<CalendarResource[]>(() => {
    const dentists = (dentistsData?.dentists || []) as { id: string; name: string; specialty?: string }[]
    return dentists.map((d) => ({
      id: d.id,
      name: d.name,
      color: '',
      specialty: d.specialty,
    }))
  }, [dentistsData])

  return { events, resources, isLoading, error: error as Error | null }
}
