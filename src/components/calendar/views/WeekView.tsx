// WeekView — 7-column week calendar

import { useMemo } from 'react'
import { TimeGrid } from '../grid/TimeGrid'
import { EventLayer, groupEventsByDate } from '../grid/EventLayer'
import { EmptySlots } from '../grid/EmptySlots'
import { NowIndicator } from '../grid/NowIndicator'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useCalendarStore } from '../store/calendar-store'
import {
  getWeekDays,
  getShortDayName,
  getDayNumber,
  isToday,
  isWeekend,
  formatDateKey,
} from '../utils/date-utils'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../utils/types'

interface WeekViewProps {
  events: CalendarEvent[]
  date: Date
}

export function WeekView({ events, date }: WeekViewProps) {
  const scrollRef = useAutoScroll<HTMLDivElement>()
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)
  const days = useMemo(() => getWeekDays(date), [date])

  // Group events by day column
  const eventsByColumn = useMemo(
    () => groupEventsByDate(events, days),
    [events, days],
  )

  // Column headers for each day
  const columnHeaders = (
    <>
      {days.map((day) => (
        <div
          key={formatDateKey(day)}
          className={cn(
            'flex flex-col items-center py-2 border-r border-border last:border-r-0',
            isToday(day) && 'bg-teal-50/50 dark:bg-teal-950/20',
          )}
        >
          <div className={cn(
            'text-xs uppercase',
            isToday(day) ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-muted-foreground',
            isWeekend(day) && !isToday(day) && 'text-muted-foreground/70',
          )}>
            {getShortDayName(day)}
          </div>
          <div className={cn(
            'text-lg mt-0.5 w-8 h-8 flex items-center justify-center rounded-full',
            isToday(day) && 'bg-teal-600 text-white font-bold',
          )}>
            {getDayNumber(day)}
          </div>
        </div>
      ))}
    </>
  )

  // Find which day is today for the now indicator
  const todayIndex = days.findIndex((d) => isToday(d))

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TimeGrid
        ref={scrollRef}
        columnCount={7}
        columnHeaders={columnHeaders}
        eventContent={
          <EventLayer eventsByColumn={eventsByColumn} totalGridColumns={7} />
        }
        slotsContent={<EmptySlots columnCount={7} dates={days.map(formatDateKey)} />}
        nowIndicator={
          todayIndex >= 0 ? <NowIndicator date={days[todayIndex]} startHour={startHour} endHour={endHour} /> : undefined
        }
      />
    </div>
  )
}
