// EventCard — positioned event card with drag initiation

import { getPixelOffsetFor, getPixelHeight, formatTime } from '../utils/date-utils'
import { eventCardVariants } from './event-styles'
import { EventTooltip } from './EventTooltip'
import { useCalendarStore } from '../store/calendar-store'
import type { LaidOutEvent } from '../utils/types'
import type { AppointmentStatus } from '@/lib/supabase/database.types'

interface EventCardProps {
  laidOut: LaidOutEvent
  gridColumn: number
  totalGridColumns: number
  isDraggingThis?: boolean
  onPointerDown?: (
    e: React.PointerEvent,
    event: LaidOutEvent['event'],
    offsetY: number,
  ) => void
  gridContentRef?: React.RefObject<HTMLDivElement | null>
}

export function EventCard({
  laidOut,
  gridColumn,
  totalGridColumns,
  isDraggingThis,
  onPointerDown,
  gridContentRef,
}: EventCardProps) {
  const { event, column, totalColumns } = laidOut
  const openEditDialog = useCalendarStore((s) => s.openEditDialog)
  const startHour = useCalendarStore((s) => s.startHour)

  const columnWidth = 100 / totalGridColumns
  const baseLeft = gridColumn * columnWidth
  const subWidth = columnWidth / totalColumns
  const left = baseLeft + column * subWidth

  const top = getPixelOffsetFor(event.start, startHour)
  const height = getPixelHeight(event.durationMinutes)

  const showTime = height >= 16
  const showTitle = height >= 28
  const showProcedure = height >= 48

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onPointerDown || !gridContentRef) return
    e.preventDefault()

    const cardEl = e.currentTarget as HTMLElement
    const gridContent = gridContentRef.current
    if (!gridContent) return

    const cardRect = cardEl.getBoundingClientRect()
    const offsetY = e.clientY - cardRect.top

    onPointerDown(e, event, offsetY)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only handle click when drag is not active (no onPointerDown provided)
    if (onPointerDown) return
    e.stopPropagation()
    openEditDialog(event.id)
  }

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
          opacity: isDraggingThis ? 0.3 : 1,
          cursor: onPointerDown ? 'grab' : 'pointer',
          transition: isDraggingThis ? 'opacity 0.15s' : undefined,
        }}
        onPointerDown={onPointerDown ? handlePointerDown : undefined}
        onClick={handleClick}
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
