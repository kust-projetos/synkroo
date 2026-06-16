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

/** Result of visible resource selection with overflow info */
export interface VisibleResourcesResult {
  visible: CalendarResource[]
  overflowCount: number
}

/**
 * Select which professionals to show based on total count and appointment load.
 * - ≤5 professionals: show all
 * - ≤10 professionals: show all
 * - >10 professionals: show max 6, prioritizing those with appointments today
 */
export function getVisibleResources(
  resources: CalendarResource[],
  eventsByColumn: Map<number, CalendarEvent[]>,
): VisibleResourcesResult {
  const total = resources.length

  // Prioritize: professionals with appointments today first
  const withAppointments: CalendarResource[] = []
  const withoutAppointments: CalendarResource[] = []

  resources.forEach((_resource, i) => {
    const colEvents = eventsByColumn.get(i)
    if (colEvents && colEvents.length > 0) {
      withAppointments.push(resources[i])
    } else {
      withoutAppointments.push(resources[i])
    }
  })

  const sorted = [...withAppointments, ...withoutAppointments]

  // Determine visible limit
  let visibleLimit = sorted.length
  if (total > 10) {
    visibleLimit = 6
  }

  const visible = sorted.slice(0, visibleLimit)
  const overflowCount = total - visible.length

  return { visible, overflowCount }
}

export function ProfessionalsView({ events, date, resources, onEventDrop, onEventClick }: ProfessionalsViewProps) {
  const scrollRef = useAutoScroll<HTMLDivElement>()
  const startHour = useCalendarStore((s) => s.startHour)
  const endHour = useCalendarStore((s) => s.endHour)

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

  // Apply overflow: limit visible professionals, prioritize those with appointments
  const { visible: visibleResources, overflowCount } = useMemo(
    () => getVisibleResources(resources, eventsByColumn),
    [resources, eventsByColumn],
  )

  const visibleColumnCount = visibleResources.length
  const visibleDentistIds = useMemo(() => visibleResources.map((r) => r.id), [visibleResources])

  // Per-column summaries
  const columnSummaries = useMemo(() => {
    return visibleResources.map((_resource, i) => {
      const colEvents = eventsByColumn.get(i) || []
      return computeProfessionalSummary(colEvents, startHour, endHour)
    })
  }, [visibleResources, eventsByColumn, startHour, endHour])

  // Column headers with dentist names and colors - defined before early return to maintain hook order
  const columnHeaders = (
    <>
      {visibleResources.map((resource, i) => {
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
  const dateKeys = useMemo(() => Array(visibleColumnCount).fill(dateKey), [dateKey, visibleColumnCount])

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
        columnCount={visibleColumnCount}
        columnHeaders={columnHeaders}
        dateKeys={dateKeys}
        onEventDrop={onEventDrop}
        onEventClick={onEventClick}
        eventContent={
          <EventLayer eventsByColumn={eventsByColumn} totalGridColumns={visibleColumnCount} />
        }
        slotsContent={
          <EmptySlots columnCount={visibleColumnCount} dates={dateKeys} columnDentistIds={visibleDentistIds} />
        }
        nowIndicator={<NowIndicator date={date} startHour={startHour} endHour={endHour} />}
      />
      {/* Overflow affordance */}
      {overflowCount > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-center">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            +{overflowCount} profissionais
          </button>
        </div>
      )}
    </div>
  )
}
