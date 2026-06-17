// DayView — single day calendar with time grid

import { useMemo } from 'react'
import { TimeGrid } from '../grid/TimeGrid'
import { EventLayer, groupEventsByDate, groupEventsByDentist } from '../grid/EventLayer'
import { EmptySlots } from '../grid/EmptySlots'
import { NowIndicator } from '../grid/NowIndicator'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useCalendarStore } from '../store/calendar-store'
import type { DragDropResult } from '../hooks/useDragEvent'
import { formatDateKey, getShortDayName, getDayNumber, isToday, isWeekend } from '../utils/date-utils'
import { getDentistPalette } from '../utils/dentist-colors'
import { computeProfessionalSummary } from './ProfessionalsView'
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
  const layoutMode = useCalendarStore((s) => s.layoutMode)

  const isProfessionalsMode = layoutMode === 'professionals'

  // Filter to selected date
  const dayEvents = useMemo(() => {
    const targetKey = formatDateKey(date)
    return events.filter((e) => formatDateKey(e.start) === targetKey)
  }, [events, date])

  // Derive unique dentists from day events (for professionals mode)
  const dayDentists = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>()
    dayEvents.forEach((e) => {
      if (!seen.has(e.dentistId)) {
        seen.set(e.dentistId, { id: e.dentistId, name: e.dentistName })
      }
    })
    return Array.from(seen.values())
  }, [dayEvents])

  // Group events: by date (agenda) or by dentist (professionals)
  const eventsByColumn = useMemo(() => {
    if (isProfessionalsMode) {
      const dentistIds = dayDentists.map((d) => d.id)
      return groupEventsByDentist(dayEvents, dentistIds)
    }
    const map = new Map<number, CalendarEvent[]>()
    if (dayEvents.length > 0) map.set(0, dayEvents)
    return map
  }, [dayEvents, isProfessionalsMode, dayDentists])

  const columnCount = isProfessionalsMode ? dayDentists.length || 1 : 1

  // Column headers
  const columnHeaders = isProfessionalsMode ? (
    <>
      {dayDentists.map((dentist, i) => {
        const palette = getDentistPalette(dentist.id)
        const colEvents = eventsByColumn.get(i) || []
        const summary = computeProfessionalSummary(colEvents, startHour, endHour)
        return (
          <div
            key={dentist.id}
            className={cn(
              'flex flex-col items-start gap-0.5 px-2 py-2 border-r border-border last:border-r-0',
              palette.headerBg,
            )}
          >
            <div className={cn('text-xs font-semibold truncate w-full', palette.headerText)}>
              {dentist.name}
            </div>
            <div className="text-[10px] text-muted-foreground truncate w-full">
              {summary.appointmentCount} ag. &middot; livre {summary.nextFreeSlot}
            </div>
          </div>
        )
      })}
    </>
  ) : (
    <div className="flex items-center justify-center py-2">
      <div className={cn(
        'text-center',
        isToday(date) && 'text-teal-600 dark:text-teal-400 font-bold',
        isWeekend(date) && !isToday(date) && 'text-muted-foreground',
      )}>
        <div className="text-xs font-medium capitalize">{getShortDayName(date)}</div>
        <div className="text-lg">{getDayNumber(date)}</div>
      </div>
    </div>
  )

  // Weekend shading for single column (agenda mode only)
  const weekendCols = !isProfessionalsMode && isWeekend(date) ? [0] : []

  const dateKey = formatDateKey(date)
  const dateKeys = useMemo(() => Array(columnCount).fill(dateKey), [dateKey, columnCount])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TimeGrid
        ref={scrollRef}
        columnCount={columnCount}
        columnHeaders={columnHeaders}
        dateKeys={dateKeys}
        weekendColumns={weekendCols}
        onEventDrop={onEventDrop}
        onEventClick={onEventClick}
        eventContent={<EventLayer eventsByColumn={eventsByColumn} totalGridColumns={columnCount} />}
        slotsContent={<EmptySlots columnCount={columnCount} dates={dateKeys} quiet={isProfessionalsMode} />}
        nowIndicator={<NowIndicator date={date} startHour={startHour} endHour={endHour} />}
      />
    </div>
  )
}
