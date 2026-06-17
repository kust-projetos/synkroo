// WeekView — 7-column week calendar

import { useMemo } from 'react'
import { TimeGrid } from '../grid/TimeGrid'
import { EventLayer, groupEventsByDate } from '../grid/EventLayer'
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
  formatTime,
} from '../utils/date-utils'
import { cn } from '@/lib/utils'
import { getDentistDotColor } from '../utils/dentist-colors'
import type { CalendarEvent } from '../utils/types'

// ── Mini event card (inline, no drag) — used only in professionals grouped week ──
function MiniEventCard({ event }: { event: CalendarEvent }) {
  const isAiOrigin = event.origin === 'ai'
  return (
    <div className="rounded px-1 py-0.5 text-[10px] leading-tight bg-muted/30 text-foreground truncate flex items-center gap-1">
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getDentistDotColor(event.dentistId))} />
      <span className="font-medium">{formatTime(event.start)}</span>
      <span className="truncate">{event.title}</span>
      {isAiOrigin && (
        <span className="text-[8px] font-semibold px-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 flex-shrink-0">IA</span>
      )}
    </div>
  )
}

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

  // ── All hooks declared unconditionally ──────

  // Professionals mode: grouped data per day
  const daysWithGroups = useMemo(() => {
    if (!isProfessionalsMode) return null
    return days.map((day) => {
      const dateKey = formatDateKey(day)
      const dayEvents = events.filter((e) => formatDateKey(e.start) === dateKey)

      const grouped = new Map<string, CalendarEvent[]>()
      dayEvents.forEach((e) => {
        const list = grouped.get(e.dentistId) || []
        list.push(e)
        grouped.set(e.dentistId, list)
      })

      return { day, groups: Array.from(grouped.entries()) }
    })
  }, [isProfessionalsMode, days, events])

  // Agenda mode: events by day column, column headers, etc.
  const eventsByColumn = useMemo(
    () => groupEventsByDate(events, days),
    [events, days],
  )

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

  const todayIndex = days.findIndex((d) => isToday(d))

  const weekendColumns = useMemo(
    () => days.reduce<number[]>((acc, day, i) => isWeekend(day) ? [...acc, i] : acc, []),
    [days],
  )

  // ── Render ───────────────────────────────────

  // Professionals mode: 7 day columns with dentist groups within each day
  if (isProfessionalsMode && daysWithGroups) {
    return (
      <div className="flex-1 flex flex-col min-h-0" ref={scrollRef}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-background sticky top-0 z-10">
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
        </div>

        {/* Day columns with dentist groups */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 min-h-full">
            {daysWithGroups.map(({ day, groups }) => (
              <div
                key={formatDateKey(day)}
                className={cn(
                  'border-r border-border last:border-r-0 p-1.5 space-y-2',
                  isWeekend(day) && !isToday(day) && 'bg-muted/20',
                )}
              >
                {groups.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/50 text-center py-4">
                    Sem agendamentos
                  </div>
                )}
                {groups.map(([dentistId, groupEvents]) => (
                  <div key={dentistId} className="space-y-0.5">
                    <div className="text-[9px] font-semibold text-muted-foreground truncate px-1">
                      {groupEvents[0].dentistName}
                    </div>
                    {groupEvents.map((event) => (
                      <MiniEventCard key={event.id} event={event} />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Agenda mode
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TimeGrid
        ref={scrollRef}
        columnCount={7}
        columnHeaders={columnHeaders}
        dateKeys={days.map(formatDateKey)}
        weekendColumns={weekendColumns}
        onEventDrop={onEventDrop}
        onEventClick={onEventClick}
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
