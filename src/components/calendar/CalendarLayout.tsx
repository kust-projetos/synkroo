// src/components/calendar/CalendarLayout.tsx
'use client'

import { useCallback } from 'react'
import { ScheduleCalendar } from './ScheduleCalendar'
import { CalendarToolbar } from './CalendarToolbar'
import { CalendarSidebar } from './CalendarSidebar'
import { useCalendarState } from './hooks/useCalendarState'
import { useCalendarEvents } from './hooks/useCalendarEvents'

// TODO: Get clinicId from auth context
const CLINIC_ID = 'default-clinic'

export function CalendarLayout() {
  const { state, updateState } = useCalendarState()
  const { events, resources, isLoading, refetch, invalidateCalendar } = useCalendarEvents(
    CLINIC_ID,
    state.startDate,
    state.endDate,
    state.dentistIds,
    state.specialty
  )

  const handleViewChange = useCallback(
    (view: any) => {
      updateState({ view })
    },
    [updateState]
  )

  const handleDateChange = useCallback(
    (date: Date) => {
      updateState({ date })
    },
    [updateState]
  )

  const handleEventClick = useCallback((event: any) => {
    // TODO: open appointment dialog
    console.log('Event clicked:', event)
  }, [])

  const handleDateClick = useCallback((date: string, resourceId?: string) => {
    // TODO: open new appointment dialog
    console.log('Date clicked:', date, resourceId)
  }, [])

  const handleEventDrop = useCallback(
    async (eventId: string, newDate: Date, newHour: number) => {
      // TODO: call API to reschedule
      console.log('Event dropped:', eventId, newDate, newHour)
    },
    []
  )

  return (
    <div className="flex h-full">
      <CalendarSidebar />
      <div className="flex-1 flex flex-col">
        <CalendarToolbar
          view={state.view}
          date={state.date}
          onViewChange={handleViewChange}
          onDateChange={handleDateChange}
          onToday={() => handleDateChange(new Date())}
          onPrevious={() => {}}
          onNext={() => {}}
          isLoading={isLoading}
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
