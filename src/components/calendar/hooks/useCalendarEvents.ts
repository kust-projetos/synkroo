// useCalendarEvents — fetch appointments and transform to CalendarEvent[]

import { useMemo } from 'react'
import { subDays, addDays } from 'date-fns'
import { useCalendarEventsQuery, useDentists } from '@/lib/hooks/use-queries'
import { useAuth } from '@/lib/auth/context'
import { getWeekDays, formatDateKey } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'
import type { CalendarEvent, CalendarResource } from '../utils/types'

export interface AppointmentRow {
  id: string
  scheduledAt: string
  durationMinutes: number
  status: string
  notes: string | null
  patient?: { id: string; name: string; phone: string } | null
  dentist?: { id: string; name: string; specialty?: string } | null
  procedure?: { id: string; name: string; durationMinutes: number; category?: string } | null
}

export function toCalendarEvent(apt: AppointmentRow): CalendarEvent {
  const start = new Date(apt.scheduledAt)
  return {
    id: apt.id,
    title: apt.patient?.name || 'Paciente',
    start,
    end: new Date(start.getTime() + apt.durationMinutes * 60000),
    dentistId: apt.dentist?.id || '',
    dentistName: apt.dentist?.name || 'Sem dentista',
    dentistSpecialty: apt.dentist?.specialty,
    procedureName: apt.procedure?.name || '',
    procedureCategory: apt.procedure?.category,
    status: apt.status as CalendarEvent['status'],
    durationMinutes: apt.durationMinutes,
    notes: apt.notes,
    origin: undefined,
    changeSummary: undefined,
    changeImpact: undefined,
  }
}

interface DentistRow {
  id: string
  name: string
  specialty?: string
}

export function toCalendarResources(dentists: DentistRow[]): CalendarResource[] {
  return dentists.map((dentist) => ({
    id: dentist.id,
    name: dentist.name,
    color: '',
    specialty: dentist.specialty,
  }))
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
    return appointments.map(toCalendarEvent)
  }, [data])

  const resources = useMemo<CalendarResource[]>(() => {
    const dentists = Array.isArray(dentistsData) ? dentistsData : dentistsData?.dentists || []
    return toCalendarResources(dentists as DentistRow[])
  }, [dentistsData])

  return { events, resources, isLoading, error: error as Error | null }
}
