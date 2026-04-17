// useCalendarEvents — fetch appointments and transform to CalendarEvent[]

import { useEffect, useMemo, useState } from 'react'
import { useCalendarEventsQuery, useDentists, useProcedures } from '@/lib/hooks/use-queries'
import { useAuth } from '@/lib/auth/context'
import { getWeekDays, formatDateKey } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'
import { generateMockEvents, generateMockResources } from '../utils/mock-events'
import type { CalendarEvent, CalendarResource } from '../utils/types'

/** Client-only check — avoids hydration mismatch */
function useIsDevBypass(): boolean {
  const [isBypass, setIsBypass] = useState(false)
  useEffect(() => {
    const noSupabase =
      !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    setIsBypass(noSupabase)
  }, [])
  return isBypass
}

interface AppointmentRow {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  patients?: { id: string; name: string; phone: string } | null
  dentists?: { id: string; name: string; specialty?: string } | null
  procedures?: { id: string; name: string; duration_minutes: number } | null
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
  const isDevBypass = useIsDevBypass()
  const useMock = isDevBypass && !clinicId

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    if (view === 'month') {
      const y = selectedDate.getFullYear()
      const m = selectedDate.getMonth()
      return {
        startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
        endDate: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`,
      }
    }
    if (view === 'week') {
      const days = getWeekDays(selectedDate)
      return {
        startDate: formatDateKey(days[0]),
        endDate: formatDateKey(days[days.length - 1]),
      }
    }
    const key = formatDateKey(selectedDate)
    return { startDate: key, endDate: key }
  }, [view, selectedDate])

  // ── Mock data (dev bypass) ────────────────────────────────────
  const mockEvents = useMemo<CalendarEvent[]>(() => {
    if (!useMock) return []
    const start = new Date(dateRange.startDate + 'T00:00:00')
    const end = new Date(dateRange.endDate + 'T23:59:59')
    let events = generateMockEvents(start, end)
    if (dentistFilter.length > 0) {
      events = events.filter((e) => dentistFilter.includes(e.dentistId))
    }
    return events
  }, [useMock, dateRange, dentistFilter])

  const mockResources = useMemo<CalendarResource[]>(() => {
    if (!useMock) return []
    return generateMockResources()
  }, [useMock])

  // ── Supabase data (production) ────────────────────────────────
  // Hooks must always be called (Rules of Hooks)
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

  const supabaseEvents = useMemo<CalendarEvent[]>(() => {
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
        procedureName: apt.procedures?.name || '',
        status: apt.status as CalendarEvent['status'],
        durationMinutes: apt.duration_minutes,
        notes: apt.notes,
      }
    })
  }, [data])

  const supabaseResources = useMemo<CalendarResource[]>(() => {
    const dentists = (dentistsData?.dentists || []) as { id: string; name: string; specialty?: string }[]
    return dentists.map((d) => ({
      id: d.id,
      name: d.name,
      color: '',
      specialty: d.specialty,
    }))
  }, [dentistsData])

  // ── Return appropriate data source ────────────────────────────
  if (useMock) {
    return { events: mockEvents, resources: mockResources, isLoading: false, error: null }
  }

  return {
    events: supabaseEvents,
    resources: supabaseResources,
    isLoading,
    error: error as Error | null,
  }
}
