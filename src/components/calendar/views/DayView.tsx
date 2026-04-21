// DayView — single day calendar with time grid

import { useMemo } from 'react'
import { TimeGrid } from '../grid/TimeGrid'
import { EventLayer, groupEventsByDate } from '../grid/EventLayer'
import { EmptySlots } from '../grid/EmptySlots'
import { NowIndicator } from '../grid/NowIndicator'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useCalendarStore } from '../store/calendar-store'
import type { DragDropResult } from '../hooks/useDragEvent'
import { formatDateKey, getShortDayName, getDayNumber, isToday, isWeekend } from '../utils/date-utils'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../utils/types'

interface DayViewProps {
  events: CalendarEvent[]
  date: Date
  onEventDrop?: (result: DragDropResult) => void
  onEventClick?: (eventId: string) => void
}

export function DayView({ events, date, onEventDrop, onEventClick }: DayViewProps) {
  const scrollRef = useAutoScroll<HTMLDivElement>()
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)

  // Group events into column 0 (single day = single column)
  const eventsByColumn = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    const targetKey = formatDateKey(date)
    const dayEvents = events.filter((e) => formatDateKey(e.start) === targetKey)
    if (dayEvents.length > 0) map.set(0, dayEvents)
    return map
  }, [events, date])

  // Column header
  const columnHeaders = (
    <div className="flex items-center justify-center py-2">
      <div className={cn(
        'text-center',
        isToday(date) && 'text-teal-600 dark:text-teal-400 font-bold',
        isWeekend(date) && !isToday(date) && 'text-muted-foreground',
      )}>
        <div className="text-xs uppercase">{getShortDayName(date)}</div>
        <div className="text-lg">{getDayNumber(date)}</div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TimeGrid
        ref={scrollRef}
        columnCount={1}
        columnHeaders={columnHeaders}
        dateKeys={[formatDateKey(date)]}
        onEventDrop={onEventDrop}
        onEventClick={onEventClick}
        eventContent={<EventLayer eventsByColumn={eventsByColumn} totalGridColumns={1} />}
        slotsContent={<EmptySlots columnCount={1} dates={[formatDateKey(date)]} />}
        nowIndicator={<NowIndicator date={date} startHour={startHour} endHour={endHour} />}
      />
    </div>
  )
}
