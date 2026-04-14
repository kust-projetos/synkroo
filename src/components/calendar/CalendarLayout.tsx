// src/components/calendar/CalendarLayout.tsx
'use client'

import { useCallback, useMemo } from 'react'
import { ScheduleCalendar } from './ScheduleCalendar'
import { CalendarToolbar } from './CalendarToolbar'
import { CalendarSidebar } from './CalendarSidebar'
import { useCalendarState } from './hooks/useCalendarState'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useCalendarNavigation } from './hooks/useCalendarNavigation'
import type { CalendarView } from './hooks/useCalendarState'

// TODO: Get clinicId from auth context
const CLINIC_ID = 'default-clinic'

interface Dentist {
  id: string
  name: string
  specialty: string | null
}

export function CalendarLayout() {
  const { state, updateState } = useCalendarState()
  const { events, resources, isLoading, refetch, invalidateCalendar } = useCalendarEvents(
    CLINIC_ID,
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

  // Handle event click - TODO: open dialog
  const handleEventClick = useCallback((event: any) => {
    console.log('Event clicked:', event)
    // TODO: open appointment dialog
  }, [])

  // Handle date click - TODO: open new appointment dialog
  const handleDateClick = useCallback((date: string, resourceId?: string) => {
    console.log('Date clicked:', date, resourceId)
    // TODO: open new appointment dialog
  }, [])

  // Handle new appointment button
  const handleNewAppointment = useCallback(() => {
    // TODO: open new appointment dialog
    console.log('New appointment')
  }, [])

  // Handle event drop - TODO: call API
  const handleEventDrop = useCallback(
    async (eventId: string, newDate: Date, newHour: number) => {
      console.log('Event dropped:', eventId, newDate, newHour)
      // TODO: call API to reschedule
    },
    []
  )

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
    </div>
  )
}
