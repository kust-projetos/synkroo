// WeekView — 7-column week calendar

import { useMemo } from 'react'
import { TimeGrid } from '../grid/TimeGrid'
import { EventLayer, groupEventsByDate, groupEventsByDentist } from '../grid/EventLayer'
import { EmptySlots } from '../grid/EmptySlots'
import { NowIndicator } from '../grid/NowIndicator'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useCalendarStore } from '../store/calendar-store'
import type { DragDropResult } from '../hooks/useDragEvent'
import {
  getWeekDays,
  getShortDayName,
  getDayNumber,
  isToday,
  isWeekend,
  formatDateKey,
} from '../utils/date-utils'
import { getDentistPalette } from '../utils/dentist-colors'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../utils/types'

interface WeekViewProps {
  events: CalendarEvent[]
  date: Date
  onEventDrop?: (result: DragDropResult) => void
  onEventClick?: (eventId: string) => void
}

export function WeekView({ events, date, onEventDrop, onEventClick }: WeekViewProps) {
  const scrollRef = useAutoScroll<HTMLDivElement>()
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)
  const layoutMode = useCalendarStore((s) => s.layoutMode)
  const days = useMemo(() => getWeekDays(date), [date])

  const isProfessionalsMode = layoutMode === 'professionals'

  // In professionals mode: build (day, dentist) columns
  // Each column = one day + one dentist, preserving weekly context
  const professionalsColumns = useMemo(() => {
    if (!isProfessionalsMode) return null

    interface ColumnDef {
      dayIndex: number
      day: Date
      dentistId: string
      dentistName: string
    }
    const columns: ColumnDef[] = []

    days.forEach((day, dayIndex) => {
      const dateKey = formatDateKey(day)
      const dayEvents = events.filter((e) => formatDateKey(e.start) === dateKey)

      const seen = new Map<string, string>()
      dayEvents.forEach((e) => {
        if (!seen.has(e.dentistId)) {
          seen.set(e.dentistId, e.dentistName)
        }
      })

      seen.forEach((name, id) => {
        columns.push({ dayIndex, day, dentistId: id, dentistName: name })
      })
    })

    return columns
  }, [isProfessionalsMode, days, events])

  // Group events by column
  const eventsByColumn = useMemo(() => {
    if (isProfessionalsMode && professionalsColumns) {
      // Build a map keyed by column index
      const map = new Map<number, CalendarEvent[]>()
      professionalsColumns.forEach((col, colIndex) => {
        const dateKey = formatDateKey(col.day)
        const colEvents = events.filter(
          (e) => formatDateKey(e.start) === dateKey && e.dentistId === col.dentistId,
        )
        if (colEvents.length > 0) map.set(colIndex, colEvents)
      })
      return map
    }
    return groupEventsByDate(events, days)
  }, [events, days, isProfessionalsMode, professionalsColumns])

  const columnCount = isProfessionalsMode && professionalsColumns
    ? professionalsColumns.length || 1
    : 7

  // Column headers
  const columnHeaders = isProfessionalsMode && professionalsColumns ? (
    <>
      {professionalsColumns.map((col, i) => {
        const palette = getDentistPalette(col.dentistId)
        return (
          <div
            key={`${formatDateKey(col.day)}-${col.dentistId}`}
            className={cn(
              'flex flex-col items-center py-2 px-1 border-r border-border last:border-r-0',
              palette.headerBg,
              isToday(col.day) && 'bg-teal-50/50 dark:bg-teal-950/20',
            )}
          >
            <div className={cn(
              'text-[10px] font-medium capitalize',
              isToday(col.day) ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-muted-foreground',
            )}>
              {getShortDayName(col.day)} {getDayNumber(col.day)}
            </div>
            <div className={cn('text-xs font-semibold truncate max-w-full', palette.headerText)}>
              {col.dentistName}
            </div>
          </div>
        )
      })}
    </>
  ) : (
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
            'text-xs font-medium capitalize',
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

  // Compute date keys for each column
  const dateKeys = useMemo(() => {
    if (isProfessionalsMode && professionalsColumns) {
      return professionalsColumns.map((col) => formatDateKey(col.day))
    }
    return days.map(formatDateKey)
  }, [isProfessionalsMode, professionalsColumns, days])

  // Find which day is today for the now indicator
  const todayIndex = days.findIndex((d) => isToday(d))

  // Compute weekend column indices (Saturday=5, Sunday=6 in Mon-start week)
  const weekendColumns = useMemo(
    () => days.reduce<number[]>((acc, day, i) => isWeekend(day) ? [...acc, i] : acc, []),
    [days],
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TimeGrid
        ref={scrollRef}
        columnCount={columnCount}
        columnHeaders={columnHeaders}
        dateKeys={dateKeys}
        weekendColumns={isProfessionalsMode ? [] : weekendColumns}
        onEventDrop={onEventDrop}
        onEventClick={onEventClick}
        eventContent={
          <EventLayer eventsByColumn={eventsByColumn} totalGridColumns={columnCount} />
        }
        slotsContent={<EmptySlots columnCount={columnCount} dates={dateKeys} />}
        nowIndicator={
          todayIndex >= 0 ? <NowIndicator date={days[todayIndex]} startHour={startHour} endHour={endHour} /> : undefined
        }
      />
    </div>
  )
}
