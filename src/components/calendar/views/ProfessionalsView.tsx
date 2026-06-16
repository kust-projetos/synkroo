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

export interface ProfessionalSummary {
  appointmentCount: number
  aiChangesCount: number
  attentionCount: number
  nextFreeSlot: string
}

/**
 * Compute per-professional summary from a list of events.
 * Pure function — testable in isolation.
 */
export function computeProfessionalSummary(
  events: CalendarEvent[],
  startHour: number,
  endHour: number,
): ProfessionalSummary {
  const slotMinutes = new Set<number>()
  let aiChangesCount = 0
  let attentionCount = 0

  for (const event of events) {
    // Mark occupied time slots
    const startMins = event.start.getHours() * 60 + event.start.getMinutes()
    const endMins = startMins + event.durationMinutes
    for (let m = startMins; m < endMins; m += 15) {
      slotMinutes.add(m)
    }

    if (event.origin === 'ai') aiChangesCount++
    if (event.status === 'scheduled') attentionCount++
  }

  // Find next free slot: first available slot after the last occupied slot
  let nextFreeSlot = ''
  const sortedSlots = Array.from(slotMinutes).sort((a, b) => a - b)
  const lastOccupied = sortedSlots.length > 0 ? sortedSlots[sortedSlots.length - 1] + 15 : startHour * 60

  for (let m = lastOccupied; m < endHour * 60; m += 15) {
    if (!slotMinutes.has(m)) {
      const h = Math.floor(m / 60)
      const min = m % 60
      nextFreeSlot = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      break
    }
  }

  // If no slot found after last occupied, fall back to start of day
  if (!nextFreeSlot) {
    const h = Math.floor(startHour)
    nextFreeSlot = `${String(h).padStart(2, '0')}:00`
  }

  return {
    appointmentCount: events.length,
    aiChangesCount,
    attentionCount,
    nextFreeSlot,
  }
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

  // Per-column summaries
  const columnSummaries = useMemo(() => {
    return resources.map((resource) => {
      const colEvents = eventsByColumn.get(resource.id) || []
      return computeProfessionalSummary(colEvents, startHour, endHour)
    })
  }, [resources, eventsByColumn, startHour, endHour])

  // Column headers with dentist names and colors - defined before early return to maintain hook order
  const columnHeaders = (
    <>
      {resources.map((resource, i) => {
        const palette = getDentistPalette(resource.id)
        const summary = columnSummaries[i]
        return (
          <div
            key={resource.id}
            className={cn(
              'flex flex-col items-start gap-0.5 px-2 py-2 border-r border-border last:border-r-0',
              palette.headerBg,
            )}
          >
            <div className={cn('text-xs font-semibold truncate w-full', palette.headerText)}>
              {resource.name}
            </div>
            {resource.specialty && (
              <div className="text-[10px] text-muted-foreground truncate w-full">
                {resource.specialty}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground truncate w-full">
              {summary.appointmentCount} ag. &middot; livre {summary.nextFreeSlot}
            </div>
            {(summary.aiChangesCount > 0 || summary.attentionCount > 0) && (
              <div className="text-[10px] text-muted-foreground truncate w-full">
                {summary.aiChangesCount > 0 && `IA ${summary.aiChangesCount}`}
                {summary.aiChangesCount > 0 && summary.attentionCount > 0 && ' · '}
                {summary.attentionCount > 0 && `atenção ${summary.attentionCount}`}
              </div>
            )}
          </div>
        )
      })}
    </>
  )

  const dateKey = formatDateKey(date)
  const dateKeys = useMemo(() => Array(columnCount).fill(dateKey), [dateKey, columnCount])

  if (resources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Nenhum profissional cadastrado
      </div>
    )
  }

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
