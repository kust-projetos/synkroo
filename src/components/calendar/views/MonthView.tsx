// MonthView — monthly grid with mini-event cards

import { useMemo } from 'react'
import { getMonthDays, isToday, isWeekend, formatDateKey, formatTime } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'
import { statusDotColors } from '../events/event-styles'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../utils/types'

interface MonthViewProps {
  events: CalendarEvent[]
  date: Date
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

export function MonthView({ events, date }: MonthViewProps) {
  const weeks = useMemo(() => getMonthDays(date), [date])
  const { setView, setSelectedDate } = useCalendarStore()

  // Index events by date key
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const key = formatDateKey(event.start)
      const list = map.get(key) || []
      list.push(event)
      map.set(key, list)
    })
    map.forEach((list) => list.sort((a, b) => a.start.getTime() - b.start.getTime()))
    return map
  }, [events])

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
    setView('day')
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((name) => (
          <div key={name} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells — scrollable grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(140px, 1fr))` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border">
              {week.map((day) => {
                const key = formatDateKey(day)
                const dayEvents = eventsByDate.get(key) || []
                const isCurrentMonth = day.getMonth() === date.getMonth()
                const today = isToday(day)

                return (
                  <div
                    key={key}
                    className={cn(
                      'border-r border-border last:border-r-0 p-1.5 min-h-[140px] cursor-pointer hover:bg-muted/30 transition-colors flex flex-col',
                      !isCurrentMonth && 'opacity-40',
                      today && 'bg-teal-50/50 dark:bg-teal-950/20',
                    )}
                    onClick={() => handleDayClick(day)}
                  >
                    <div className={cn(
                      'text-sm mb-1 flex-shrink-0',
                      today
                        ? 'w-6 h-6 flex items-center justify-center rounded-full bg-teal-600 text-white font-bold'
                        : isWeekend(day)
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                    )}>
                      {day.getDate()}
                    </div>

                    {/* Scrollable event cards */}
                    <div className="flex-1 overflow-y-auto space-y-0.5 scrollbar-thin">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-1.5 text-[11px] leading-snug px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColors[event.status] || 'bg-gray-400'}`} />
                          <span className="truncate">
                            {formatTime(event.start)} {event.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
