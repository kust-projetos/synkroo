// CalendarLayout — main calendar container, wires store + views + data + drag

'use client'

import { useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useCalendarStore } from './store/calendar-store'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { CalendarToolbar } from './CalendarToolbar'
import { AppointmentDialog } from './AppointmentDialog'
import { DayView } from './views/DayView'
import { WeekView } from './views/WeekView'
import { MonthView } from './views/MonthView'
import { ProfessionalsView } from './views/ProfessionalsView'
import type { DragDropResult } from './hooks/useDragEvent'
import { queryKeys } from '@/lib/hooks/use-queries'

interface CalendarLayoutProps {
  ListComponent?: React.ComponentType
}

export function CalendarLayout({ ListComponent }: CalendarLayoutProps) {
  const { view, selectedDate, syncFromURL, toSearchParams, openEditDialog } = useCalendarStore()
  const { events, resources, isLoading } = useCalendarEvents()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  // Sync state from URL on mount
  useEffect(() => {
    syncFromURL(searchParams)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state to URL on changes
  useEffect(() => {
    const params = toSearchParams()
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [view, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle event drop — call reschedule API
  const handleEventDrop = useCallback(async (result: DragDropResult) => {
    const { eventId, dateKey, hour, minute } = result
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

    try {
      const res = await fetch(`/api/appointments/${eventId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: dateKey, new_time: timeStr, notify_patient: false }),
      })

      if (!res.ok) throw new Error('Reschedule failed')

      // Invalidate calendar events cache
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents() })
    } catch (err) {
      // Rollback — refetch to restore original positions
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents() })
    }
  }, [queryClient])

  // Handle event click (forwarded from drag hook when no drag occurred)
  const handleEventClick = useCallback((eventId: string) => {
    openEditDialog(eventId)
  }, [openEditDialog])

  // Render current view
  const renderView = () => {
    if (view === 'list' && ListComponent) {
      return (
        <div className="flex-1 min-h-0 overflow-auto">
          <ListComponent />
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      )
    }

    const dragProps = { onEventDrop: handleEventDrop, onEventClick: handleEventClick }

    switch (view) {
      case 'day':
        return <DayView events={events} date={selectedDate} {...dragProps} />
      case 'week':
        return <WeekView events={events} date={selectedDate} {...dragProps} />
      case 'month':
        return <MonthView events={events} date={selectedDate} />
      case 'professionals':
        return (
          <ProfessionalsView
            events={events}
            date={selectedDate}
            resources={resources}
            {...dragProps}
          />
        )
      default:
        return <WeekView events={events} date={selectedDate} {...dragProps} />
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <CalendarToolbar />
      <div className="flex-1 min-h-0 overflow-auto">
        {renderView()}
      </div>
      <AppointmentDialog />
    </div>
  )
}
