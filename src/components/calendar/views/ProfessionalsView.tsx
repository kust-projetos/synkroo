// ProfessionalsView — columns by dentist with time grid

import { useMemo } from 'react'
import { TimeGrid } from '../grid/TimeGrid'
import { EventLayer, groupEventsByDentist } from '../grid/EventLayer'
import { EmptySlots } from '../grid/EmptySlots'
import { NowIndicator } from '../grid/NowIndicator'
import { useAutoScroll } from '../hooks/useAutoScroll'
import { useCalendarStore } from '../store/calendar-store'
import type { DragDropResult } from '../hooks/useDragEvent'
import { getDentistPalette } from '../utils/dentist-colors'
import { formatDateKey } from '../utils/date-utils'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarResource } from '../utils/types'

interface ProfessionalsViewProps {
  events: CalendarEvent[]
  date: Date
  resources: CalendarResource[]
  onEventDrop?: (result: DragDropResult) => void
  onEventClick?: (eventId: string) => void
}

export function ProfessionalsView({ events, date, resources, onEventDrop, onEventClick }: ProfessionalsViewProps) {
  const scrollRef = useAutoScroll<HTMLDivElement>()
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)
  const columnCount = resources.length || 1

  // Filter events to selected date
  const dayEvents = useMemo(() => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return events.filter((e) => {
      const key = `${e.start.getFullYear()}-${String(e.start.getMonth() + 1).padStart(2, '0')}-${String(e.start.getDate()).padStart(2, '0')}`
      return key === dateKey
    })
  }, [events, date])

  // Group events by dentist
  const dentistIds = useMemo(() => resources.map((r) => r.id), [resources])
  const eventsByColumn = useMemo(
    () => groupEventsByDentist(dayEvents, dentistIds),
    [dayEvents, dentistIds],
  )

  // Column headers with dentist names and colors
  const columnHeaders = (
    <>
      {resources.map((resource) => {
        const palette = getDentistPalette(resource.id)
        return (
          <div
            key={resource.id}
            className={cn(
              'flex flex-col items-center py-2 px-2 border-r border-border last:border-r-0',
              palette.headerBg,
            )}
          >
            <div className={cn('text-xs font-medium truncate', palette.headerText)}>
              {resource.name}
            </div>
            {resource.specialty && (
              <div className="text-[10px] text-muted-foreground truncate">
                {resource.specialty}
              </div>
            )}
          </div>
        )
      })}
    </>
  )

  if (resources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Nenhum profissional cadastrado
      </div>
    )
  }

  const dateKey = formatDateKey(date)
  const dateKeys = useMemo(() => Array(columnCount).fill(dateKey), [dateKey, columnCount])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TimeGrid
        ref={scrollRef}
        columnCount={columnCount}
        columnHeaders={columnHeaders}
        dateKeys={dateKeys}
        onEventDrop={onEventDrop}
        onEventClick={onEventClick}
        eventContent={
          <EventLayer eventsByColumn={eventsByColumn} totalGridColumns={columnCount} />
        }
        slotsContent={
          <EmptySlots columnCount={columnCount} dates={dateKeys} columnDentistIds={dentistIds} />
        }
        nowIndicator={<NowIndicator date={date} startHour={startHour} endHour={endHour} />}
      />
    </div>
  )
}
