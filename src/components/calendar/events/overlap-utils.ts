// Overlap algorithm — sweep + greedy column assignment (Cal.com approach)
//
// Given a list of events, computes column and totalColumns for each event
// so that overlapping events appear side-by-side instead of on top of each other.

import type { CalendarEvent, LaidOutEvent } from '../utils/types'

/**
 * Check if two events overlap in time
 */
function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * Layout events using sweep + greedy column assignment.
 *
 * Algorithm:
 * 1. Sort events by start time (earliest first)
 * 2. For each event, find all events it overlaps with (its "group")
 * 3. Within each group, assign columns greedily (smallest available column)
 * 4. Calculate total columns per group for width calculation
 */
export function layoutEvents(events: CalendarEvent[]): LaidOutEvent[] {
  if (events.length === 0) return []

  // Sort by start time, then by duration (longer events first for stability)
  const sorted = [...events].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime()
    if (startDiff !== 0) return startDiff
    return b.end.getTime() - b.end.getTime() // longer events first
  })

  // Find overlapping groups using connected components
  const groups: CalendarEvent[][] = []
  const assigned = new Set<number>()

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue

    const group: CalendarEvent[] = [sorted[i]]
    assigned.add(i)

    // Expand group: find all events overlapping with any event in the group
    let expanded = true
    while (expanded) {
      expanded = false
      for (let j = 0; j < sorted.length; j++) {
        if (assigned.has(j)) continue

        const candidate = sorted[j]
        // Check if candidate overlaps with ANY event in the current group
        const overlaps = group.some((e) => eventsOverlap(e, candidate))
        if (overlaps) {
          group.push(candidate)
          assigned.add(j)
          expanded = true
        }
      }
    }

    groups.push(group)
  }

  // For each group, assign columns greedily
  const result: LaidOutEvent[] = []

  for (const group of groups) {
    // Sort group by start time
    group.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Track which columns are occupied at each point in time
    const columnAssignments = new Map<CalendarEvent, number>()
    // For each event, track when its column becomes free
    const columnEndTimes: number[] = [] // index = column, value = end time

    for (const event of group) {
      // Find the first available column
      let assignedCol = -1
      for (let col = 0; col < columnEndTimes.length; col++) {
        if (columnEndTimes[col] <= event.start.getTime()) {
          assignedCol = col
          break
        }
      }

      // If no available column, add a new one
      if (assignedCol === -1) {
        assignedCol = columnEndTimes.length
        columnEndTimes.push(0)
      }

      columnAssignments.set(event, assignedCol)
      columnEndTimes[assignedCol] = event.end.getTime()
    }

    const totalColumns = columnEndTimes.length

    for (const event of group) {
      result.push({
        event,
        column: columnAssignments.get(event)!,
        totalColumns,
      })
    }
  }

  return result
}
