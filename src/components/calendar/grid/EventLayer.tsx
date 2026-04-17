// EventLayer — z-index 3 layer that renders laid-out events for a set of columns

import { useMemo } from 'react'
import { layoutEvents } from '../events/overlap-utils'
import { EventCard } from '../events/EventCard'
import type { CalendarEvent } from '../utils/types'

interface EventLayerProps {
  /** Events grouped by column index */
  eventsByColumn: Map<number, CalendarEvent[]>
  /** Total number of grid columns */
  totalGridColumns: number
}

export function EventLayer({ eventsByColumn, totalGridColumns }: EventLayerProps) {
  // Layout events per column using the overlap algorithm
  const laidOutByColumn = useMemo(() => {
    const result = new Map<number, ReturnType<typeof layoutEvents>>()
    eventsByColumn.forEach((events, colIndex) => {
      result.set(colIndex, layoutEvents(events))
    })
    return result
  }, [eventsByColumn])

  const cards: React.ReactNode[] = []

  laidOutByColumn.forEach((laidOut, colIndex) => {
    laidOut.forEach((laid) => {
      cards.push(
        <EventCard
          key={laid.event.id}
          laidOut={laid}
          gridColumn={colIndex}
          totalGridColumns={totalGridColumns}
        />
      )
    })
  })

  return <>{cards}</>
}

/**
 * Helper: group events by column based on date (for week view)
 * or by dentist ID (for professionals view)
 */
export function groupEventsByDate(
  events: CalendarEvent[],
  dates: Date[],
): Map<number, CalendarEvent[]> {
  const map = new Map<number, CalendarEvent[]>()
  const dateKeys = dates.map((d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })

  events.forEach((event) => {
    const eventDate = event.start
    const key = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
    const colIndex = dateKeys.indexOf(key)
    if (colIndex >= 0) {
      const list = map.get(colIndex) || []
      list.push(event)
      map.set(colIndex, list)
    }
  })

  return map
}

/**
 * Helper: group events by dentist ID (for professionals view)
 */
export function groupEventsByDentist(
  events: CalendarEvent[],
  dentistIds: string[],
): Map<number, CalendarEvent[]> {
  const map = new Map<number, CalendarEvent[]>()

  events.forEach((event) => {
    const colIndex = dentistIds.indexOf(event.dentistId)
    if (colIndex >= 0) {
      const list = map.get(colIndex) || []
      list.push(event)
      map.set(colIndex, list)
    } else {
      // Events without matching dentist go to last column
      const fallback = map.get(dentistIds.length - 1) || []
      fallback.push(event)
      map.set(dentistIds.length - 1, fallback)
    }
  })

  return map
}
