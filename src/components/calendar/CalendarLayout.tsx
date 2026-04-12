// src/components/calendar/CalendarLayout.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useDentists } from '@/lib/hooks/use-queries'
import { CalendarSidebar } from './CalendarSidebar'
import { CalendarToolbar } from './CalendarToolbar'
import { AppointmentDialog } from './AppointmentDialog'
import { useCalendarState, ALL_VIEWS, MOBILE_VIEWS } from './hooks/useCalendarState'
import type { CalendarView } from './hooks/useCalendarState'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import type { CalendarEvent } from './hooks/useCalendarEvents'

// Dynamic import — calendar uses DOM, breaks in SSR
const ScheduleCalendar = dynamic(
  () => import('./ScheduleCalendar').then((m) => ({ default: m.ScheduleCalendar })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    ),
  }
)

export function CalendarLayout() {
  const { profile } = useAuth()
  const { state, updateState } = useCalendarState()
  const { data: dentistsData } = useDentists(profile?.clinic_id)
  const dentists = dentistsData?.dentists || []

  // Resolve dentist IDs: if empty in URL, default to all dentists
  const activeDentistIds = state.dentistIds.length > 0
    ? state.dentistIds
    : dentists.map((d: any) => d.id)

  const {
    events,
    resources,
    isLoading,
    invalidateCalendar,
  } = useCalendarEvents(
    profile?.clinic_id,
    state.startDate,
    state.endDate,
    activeDentistIds,
    state.specialty,
  )

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [prefillDate, setPrefillDate] = useState<string>('')
  const [prefillDentistId, setPrefillDentistId] = useState<string>('')

  // Responsive: determine available views based on viewport width
  // Uses state + useEffect to avoid SSR hydration mismatch
  const [availableViews, setAvailableViews] = useState<CalendarView[]>(ALL_VIEWS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = () => setAvailableViews(mq.matches ? MOBILE_VIEWS : ALL_VIEWS)
    handler() // initialize with current value
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setDialogMode('edit')
    setDialogOpen(true)
  }, [])

  const handleDateClick = useCallback((dateStr: string, resourceId?: string) => {
    setPrefillDate(dateStr)
    setPrefillDentistId(resourceId || '')
    setSelectedEvent(null)
    setDialogMode('create')
    setDialogOpen(true)
  }, [])

  const handleEventDrop = useCallback(async (info: any) => {
    const eventId = info.event.id
    const newStart = new Date(info.event.start)
    if (isNaN(newStart.getTime())) {
      console.error('Invalid date in event drop:', info.event.start)
      info.revert()
      return
    }
    const newDate = newStart.toISOString().split('T')[0]
    const newTime = newStart.toTimeString().slice(0, 5)

    try {
      const res = await fetch(`/api/appointments/${eventId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: newDate, new_time: newTime, notify_patient: true }),
      })
      if (!res.ok) {
        info.revert()
        const data = await res.json()
        throw new Error(data.error || 'Erro ao reagendar')
      }
      invalidateCalendar()
    } catch (err: any) {
      info.revert()
      console.error('Reschedule error:', err.message)
    }
  }, [invalidateCalendar])

  const handleEventResize = useCallback(async (info: any) => {
    const eventId = info.event.id
    const start = new Date(info.event.start)
    const end = new Date(info.event.end)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('Invalid date in event resize:', { start: info.event.start, end: info.event.end })
      info.revert()
      return
    }
    const newDuration = Math.round((end.getTime() - start.getTime()) / 60000)

    try {
      const res = await fetch(`/api/appointments/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_minutes: newDuration }),
      })
      if (!res.ok) {
        info.revert()
        throw new Error('Erro ao alterar duração')
      }
      invalidateCalendar()
    } catch {
      info.revert()
    }
  }, [invalidateCalendar])

  const handleDatesSet = useCallback((_start: string, _end: string, viewType: string) => {
    // Sync view if changed via calendar internals
    if (ALL_VIEWS.includes(viewType as CalendarView)) {
      updateState({ view: viewType as CalendarView })
    }
  }, [updateState])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <CalendarToolbar
        view={state.view}
        date={state.date}
        onViewChange={(v) => updateState({ view: v })}
        onDateChange={(d) => updateState({ date: d })}
        onToday={() => updateState({ date: new Date() })}
        onNewAppointment={() => {
          setSelectedEvent(null)
          setDialogMode('create')
          setPrefillDate('')
          setPrefillDentistId('')
          setDialogOpen(true)
        }}
        isLoading={isLoading}
        availableViews={availableViews}
      />

      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebar
          selectedDate={state.date}
          onSelectDate={(d) => updateState({ date: d })}
          dentists={dentists}
          selectedDentistIds={activeDentistIds}
          onDentistChange={(ids) => updateState({ dentistIds: ids })}
          specialty={state.specialty}
          onSpecialtyChange={(s) => updateState({ specialty: s })}
        />

        <div className="flex-1 overflow-hidden">
          <ScheduleCalendar
            events={events}
            resources={resources}
            view={state.view}
            date={state.date}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onDatesSet={handleDatesSet}
          />
        </div>
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        event={selectedEvent}
        prefillDate={prefillDate}
        prefillDentistId={prefillDentistId}
        onSuccess={invalidateCalendar}
      />
    </div>
  )
}
