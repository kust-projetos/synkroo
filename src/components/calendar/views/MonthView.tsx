'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getMonthDays, isToday, format, formatDateKey } from '../utils/date-utils'
import { getStatusColors, type AppointmentStatus } from '../utils/appointment-utils'
import type { CalendarEvent } from '../hooks/useCalendarEvents'

interface MonthViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick?: (eventId: string) => void
  onDayClick?: (date: Date) => void
}

export function MonthView({ date, events, onEventClick, onDayClick }: MonthViewProps) {
  const monthDays = useMemo(() => getMonthDays(date), [date])
  const weeks: Date[][] = []

  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7))
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach(event => {
      // Format from useCalendarEvents is "YYYY-MM-DD HH:MM:SS" (space separator)
      const dayStr = event.start.split(' ')[0]
      const existing = map.get(dayStr) || []
      map.set(dayStr, [...existing, event])
    })
    return map
  }, [events])

  const getDotStatus = (event: CalendarEvent): AppointmentStatus => {
    return (event.extendedProps.status || 'scheduled') as AppointmentStatus
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="grid grid-cols-7 border-b border-border">
        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((day) => (
          <div
            key={day}
            className="h-10 px-2 text-xs font-semibold text-muted-foreground flex items-center justify-center border-r last:border-r-0 border-border"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-5">
        {weeks.slice(0, 5).map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const dayStr = formatDateKey(day)
            const dayEvents = eventsByDay.get(dayStr) || []
            const isCurrentMonth = day.getMonth() === date.getMonth()
            const isWeekend = dayIndex >= 5

            return (
              <div
                key={dayStr}
                className={cn(
                  "border-r border-b border-border p-1 min-h-[100px] cursor-pointer",
                  "hover:bg-muted/30 transition-colors",
                  !isCurrentMonth && "bg-muted/20",
                  isWeekend && "bg-muted/10"
                )}
                onClick={() => onDayClick?.(day)}
              >
                <div className="flex items-center justify-center mb-1">
                  <span
                    className={cn(
                      "w-6 h-6 text-xs font-medium rounded-full flex items-center justify-center",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => {
                    const status = getDotStatus(event)
                    const colors = getStatusColors(status)
                    return (
                      <div
                        key={event.id}
                        className="h-1.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: colors.bg }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick?.(event.id)
                        }}
                      />
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] text-muted-foreground text-center">
                      +{dayEvents.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
