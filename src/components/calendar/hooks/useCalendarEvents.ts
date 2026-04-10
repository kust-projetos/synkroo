// src/components/calendar/hooks/useCalendarEvents.ts
'use client'

import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCalendarEventsQuery } from '@/lib/hooks/use-queries'
import { getDentistColor } from '../utils/dentist-colors'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  resourceId: string
  backgroundColor: string
  editable: boolean
  extendedProps: {
    patientName: string
    procedureName: string
    status: string
    dentistName: string
    notes: string | null
    patientPhone: string | null
  }
}

export interface CalendarResource {
  id: string
  title: string
  eventBackgroundColor: string
}

interface AppointmentResponse {
  appointments: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    notes: string | null
    patients?: { id: string; name: string; phone: string } | null
    dentists?: { id: string; name: string; specialty: string } | null
    procedures?: { id: string; name: string; duration_minutes: number } | null
  }>
}

const EDITABLE_STATUSES = new Set(['scheduled', 'confirmed', 'in_progress'])

function formatDateTime(dateStr: string): string {
  // API returns ISO with offset: "2026-04-10T09:00:00-03:00"
  // @event-calendar/core expects: "2026-04-10 09:00:00"
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

function addMinutes(dateStr: string, minutes: number): string {
  const d = new Date(dateStr)
  d.setMinutes(d.getMinutes() + minutes)
  return formatDateTime(d.toISOString())
}

export function useCalendarEvents(
  clinicId: string | undefined,
  startDate: string,
  endDate: string,
  dentistIds: string[],
  specialty: string
) {
  const queryClient = useQueryClient()

  // Build URL with repeated dentist_ids
  const queryUrl = useMemo(() => {
    if (!clinicId) return ''
    const urlParams = new URLSearchParams()
    urlParams.set('clinic_id', clinicId)
    urlParams.set('start_date', startDate)
    urlParams.set('end_date', endDate)
    dentistIds.forEach(id => urlParams.append('dentist_ids', id))
    if (specialty) urlParams.set('specialty', specialty)
    return urlParams.toString()
  }, [clinicId, startDate, endDate, dentistIds, specialty])

  const params = useMemo(() => {
    if (!queryUrl) return undefined
    return Object.fromEntries(new URLSearchParams(queryUrl))
  }, [queryUrl])

  const { data: rawData, isLoading, error, refetch } = useCalendarEventsQuery(params)
  const data = rawData as AppointmentResponse | undefined

  const events = useMemo((): CalendarEvent[] => {
    if (!data?.appointments) return []
    return (data.appointments as AppointmentResponse['appointments'])
      .filter((apt) => apt.dentists?.id)
      .map((apt, index) => ({
        id: apt.id,
        title: apt.patients?.name || 'Paciente',
        start: formatDateTime(apt.scheduled_at),
        end: addMinutes(apt.scheduled_at, apt.duration_minutes),
        resourceId: apt.dentists!.id,
        backgroundColor: getDentistColor(apt.dentists!.id, index),
        editable: EDITABLE_STATUSES.has(apt.status),
        extendedProps: {
          patientName: apt.patients?.name || 'Paciente',
          procedureName: apt.procedures?.name || '',
          status: apt.status,
          dentistName: apt.dentists?.name || '',
          notes: apt.notes,
          patientPhone: apt.patients?.phone || null,
        },
      }))
  }, [data])

  const resources = useMemo((): CalendarResource[] => {
    if (!data?.appointments) return []
    const seen = new Map<string, { name: string; color: string }>()
    ;(data.appointments as AppointmentResponse['appointments']).forEach((apt, index) => {
      if (apt.dentists?.id && !seen.has(apt.dentists.id)) {
        seen.set(apt.dentists.id, {
          name: apt.dentists.name,
          color: getDentistColor(apt.dentists.id, index),
        })
      }
    })
    return Array.from(seen.entries()).map(([id, info]) => ({
      id,
      title: info.name,
      eventBackgroundColor: info.color,
    }))
  }, [data])

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
  }

  return { events, resources, isLoading, error, refetch, invalidateCalendar }
}
