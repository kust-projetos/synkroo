// CalendarLayout — main calendar container, wires store + views + data

'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCalendarStore } from './store/calendar-store'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { CalendarToolbar } from './CalendarToolbar'
import { AppointmentDialog } from './AppointmentDialog'
import { DayView } from './views/DayView'
import { WeekView } from './views/WeekView'
import { MonthView } from './views/MonthView'
import { ProfessionalsView } from './views/ProfessionalsView'

interface CalendarLayoutProps {
  ListComponent?: React.ComponentType
}

export function CalendarLayout({ ListComponent }: CalendarLayoutProps) {
  const { view, selectedDate, syncFromURL, toSearchParams } = useCalendarStore()
  const { events, resources, isLoading } = useCalendarEvents()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

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

    switch (view) {
      case 'day':
        return <DayView events={events} date={selectedDate} />
      case 'week':
        return <WeekView events={events} date={selectedDate} />
      case 'month':
        return <MonthView events={events} date={selectedDate} />
      case 'professionals':
        return (
          <ProfessionalsView
            events={events}
            date={selectedDate}
            resources={resources}
          />
        )
      default:
        return <WeekView events={events} date={selectedDate} />
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <CalendarToolbar />
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderView()}
      </div>
      <AppointmentDialog />
    </div>
  )
}
