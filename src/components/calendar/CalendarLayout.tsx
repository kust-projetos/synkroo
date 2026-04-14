// src/components/calendar/CalendarLayout.tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { ScheduleCalendar } from './ScheduleCalendar'
import { CalendarToolbar } from './CalendarToolbar'
import { CalendarSidebar } from './CalendarSidebar'
import { AppointmentDialog } from './AppointmentDialog'
import { useCalendarState } from './hooks/useCalendarState'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useCalendarNavigation } from './hooks/useCalendarNavigation'
import { useAuth } from '@/lib/auth/context'
import type { CalendarView } from './hooks/useCalendarState'
import type { CalendarEvent } from './hooks/useCalendarEvents'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Dentist {
  id: string
  name: string
  specialty: string | null
}

export function CalendarLayout() {
  const { profile } = useAuth()
  const clinicId = profile?.clinic_id || 'default-clinic'

  const [dialogState, setDialogState] = useState<{
    open: boolean
    mode: 'create' | 'edit' | 'reschedule'
    event?: CalendarEvent | null
    prefillDate?: string
    prefillTime?: string
    prefillDentistId?: string
  }>({
    open: false,
    mode: 'create',
  })

  const { state, updateState } = useCalendarState()
  const { events, resources, isLoading, refetch, invalidateCalendar } = useCalendarEvents(
    clinicId,
    state.startDate,
    state.endDate,
    state.dentistIds,
    state.specialty
  )

  // Navigation hook
  const { goToToday, goToPrevious, goToNext } = useCalendarNavigation({
    view: state.view,
    date: state.date,
    onDateChange: (date) => updateState({ date }),
  })

  // Convert resources to dentists for sidebar
  const dentists = useMemo((): Dentist[] => {
    return resources.map(r => ({
      id: r.id,
      name: r.title,
      specialty: null, // TODO: get specialty from API
    }))
  }, [resources])

  // Handle view change - need to cast since our views differ from old
  const handleViewChange = useCallback(
    (view: CalendarView) => {
      updateState({ view })
    },
    [updateState]
  )

  // Handle date change from navigation
  const handleDateChange = useCallback(
    (date: Date) => {
      updateState({ date })
    },
    [updateState]
  )

  // Handle event click - open edit dialog
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setDialogState({
      open: true,
      mode: 'edit',
      event,
    })
  }, [])

  // Handle date click - open new appointment dialog
  const handleDateClick = useCallback((date: string, resourceId?: string) => {
    setDialogState({
      open: true,
      mode: 'create',
      prefillDate: date,
      prefillDentistId: resourceId,
    })
  }, [])

  // Handle new appointment button
  const handleNewAppointment = useCallback(() => {
    setDialogState({
      open: true,
      mode: 'create',
      prefillDate: format(state.date, 'yyyy-MM-dd', { locale: ptBR }),
    })
  }, [state.date])

  // Handle event drop - call API to reschedule
  const handleEventDrop = useCallback(
    async (eventId: string, newDate: Date, newHour: number, newMinute: number) => {
      const formattedTime = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}:00`
      const response = await fetch(`/api/appointments/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: format(newDate, 'yyyy-MM-dd'),
          time: formattedTime,
        }),
      })
      if (!response.ok) throw new Error('Failed to reschedule')
      invalidateCalendar()
    },
    [invalidateCalendar]
  )

  // Handle dialog success
  const handleDialogSuccess = useCallback(() => {
    setDialogState(prev => ({ ...prev, open: false }))
    invalidateCalendar()
  }, [invalidateCalendar])

  // Handle dentist filter change
  const handleDentistChange = useCallback(
    (ids: string[]) => {
      updateState({ dentistIds: ids })
    },
    [updateState]
  )

  // Handle specialty filter change
  const handleSpecialtyChange = useCallback(
    (specialty: string) => {
      updateState({ specialty })
    },
    [updateState]
  )

  return (
    <div className="flex h-full">
      <CalendarSidebar
        selectedDate={state.date}
        onSelectDate={handleDateChange}
        dentists={dentists}
        selectedDentistIds={state.dentistIds}
        onDentistChange={handleDentistChange}
        specialty={state.specialty}
        onSpecialtyChange={handleSpecialtyChange}
      />
      <div className="flex-1 flex flex-col">
        <CalendarToolbar
          view={state.view}
          date={state.date}
          onViewChange={handleViewChange}
          onDateChange={handleDateChange}
          onToday={goToToday}
          onNewAppointment={handleNewAppointment}
          isLoading={isLoading}
          availableViews={['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay']}
        />
        <div className="flex-1 overflow-hidden">
          <ScheduleCalendar
            events={events}
            resources={resources}
            view={state.view}
            date={state.date}
            onDateChange={handleDateChange}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onEventDrop={handleEventDrop}
            onEventResize={() => {}}
            onDatesSet={() => {}}
          />
        </div>
      </div>
      <AppointmentDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}
        mode={dialogState.mode}
        event={dialogState.event}
        prefillDate={dialogState.prefillDate}
        prefillTime={dialogState.prefillTime}
        prefillDentistId={dialogState.prefillDentistId}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}
