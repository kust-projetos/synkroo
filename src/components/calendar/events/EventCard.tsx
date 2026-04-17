// EventCard — positioned event card using minute-based calculations

import { getPixelOffsetFor, getPixelHeight, formatTime } from '../utils/date-utils'
import { eventCardVariants } from './event-styles'
import { EventTooltip } from './EventTooltip'
import { useCalendarStore } from '../store/calendar-store'
import type { LaidOutEvent } from '../utils/types'
import type { AppointmentStatus } from '@/lib/supabase/database.types'

interface EventCardProps {
  laidOut: LaidOutEvent
  /** Column index in the grid (0 for day view, 0-6 for week, 0-N for professionals) */
  gridColumn: number
  /** Total columns in the grid */
  totalGridColumns: number
}

export function EventCard({ laidOut, gridColumn, totalGridColumns }: EventCardProps) {
  const { event, column, totalColumns } = laidOut
  const openEditDialog = useCalendarStore((s) => s.openEditDialog)
  const startHour = useCalendarStore((s) => s.startHour)

  // Calculate position within the grid column
  const columnWidth = 100 / totalGridColumns
  const baseLeft = gridColumn * columnWidth

  // Within the overlapping group, calculate sub-position
  const subWidth = columnWidth / totalColumns
  const left = baseLeft + column * subWidth

  // Vertical position based on time (uses dynamic startHour)
  const top = getPixelOffsetFor(event.start, startHour)
  const height = getPixelHeight(event.durationMinutes)

  // Determine what text fits based on available height
  const showTime = height >= 16
  const showTitle = height >= 28
  const showProcedure = height >= 48

  return (
    <EventTooltip event={event}>
      <div
        className={eventCardVariants({ status: event.status as AppointmentStatus })}
        style={{
          position: 'absolute',
          top,
          height: Math.max(height, 18),
          left: `${left}%`,
          width: `${subWidth - 0.5}%`,
          zIndex: 10,
        }}
        onClick={(e) => {
          e.stopPropagation()
          openEditDialog(event.id)
        }}
        role="button"
        tabIndex={0}
        aria-label={`${event.title} - ${formatTime(event.start)}`}
      >
        {showTime && (
          <span className="font-semibold block text-[10px] leading-tight">
            {formatTime(event.start)}{showTitle ? '' : ` ${event.title}`}
          </span>
        )}
        {showTitle && (
          <span className="block font-medium text-[10px] leading-tight">
            {event.title}
          </span>
        )}
        {showProcedure && (
          <span className="block opacity-70 text-[9px] leading-tight">
            {event.procedureName}
          </span>
        )}
      </div>
    </EventTooltip>
  )
}
