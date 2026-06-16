// EventCard — positioned event card with drag initiation

import { getPixelOffsetFor, getPixelHeight, formatTime } from '../utils/date-utils'
import { eventCardVariants } from './event-styles'
import { EventTooltip } from './EventTooltip'
import { useCalendarStore } from '../store/calendar-store'
import { getDentistColors } from '../utils/dentist-colors'
import { AppointmentOriginBadge } from '../AppointmentOriginBadge'
import { AppointmentChangeSummary } from '../AppointmentChangeSummary'
import { cn } from '@/lib/utils'
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

export const DRAGGABLE_STATUSES: readonly AppointmentStatus[] = ['scheduled', 'confirmed', 'in_progress'] as const

export function isDraggableStatus(status: AppointmentStatus): boolean {
  return (DRAGGABLE_STATUSES as readonly string[]).includes(status)
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
  const canDrag = isDraggableStatus(event.status)
  const dentistColors = getDentistColors(event.dentistId)

  const columnWidth = 100 / totalGridColumns
  const baseLeft = gridColumn * columnWidth
  const subWidth = columnWidth / totalColumns
  const left = baseLeft + column * subWidth + 0.15

  const top = getPixelOffsetFor(event.start, startHour)
  const height = getPixelHeight(event.durationMinutes)

  const showTime = height >= 18
  const showTitle = height >= 30
  const showDentist = height >= 38
  const showProcedure = height >= 48
  const showOrigin = height >= 30
  const showChangeSummary = showProcedure && !!event.changeSummary

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
    if (onPointerDown) return
    e.stopPropagation()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openEditDialog(event.id)
  }

  return (
    <EventTooltip event={event}>
      <div
        className={cn(
          eventCardVariants({ status: event.status as AppointmentStatus }),
          dentistColors.border,
        )}
        style={{
          position: 'absolute',
          top,
          height: Math.max(height, 18),
          left: `${left}%`,
          width: `${subWidth - 0.3}%`,
          zIndex: 10,
          opacity: isDraggingThis ? 0.3 : 1,
          cursor: canDrag && onPointerDown ? 'grab' : 'pointer',
          transition: isDraggingThis ? 'opacity 0.15s' : undefined,
        }}
        onPointerDown={canDrag && onPointerDown ? handlePointerDown : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        role="button"
        tabIndex={0}
        aria-label={`${event.title} - ${formatTime(event.start)}`}
      >
        {showTime && (
          <span className="font-semibold block text-[11px] leading-tight whitespace-nowrap flex items-center gap-1">
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dentistColors.dot)} />
            {formatTime(event.start)}{showTitle ? '' : ` ${event.title}`}
            {showOrigin && event.origin && !showTitle && (
              <AppointmentOriginBadge origin={event.origin} />
            )}
          </span>
        )}
        {showTitle && (
          <span className="block font-semibold text-[11px] leading-tight truncate flex items-center gap-1">
            <span className="truncate">{event.title}</span>
            {showOrigin && event.origin && (
              <AppointmentOriginBadge origin={event.origin} />
            )}
          </span>
        )}
        {showDentist && (
          <span className="block text-[10px] leading-tight truncate text-muted-foreground">
            {event.dentistName}{showProcedure ? ` · ${event.procedureName}` : ''}
          </span>
        )}
        {showProcedure && !showDentist && (
          <span className="block text-[10px] leading-tight truncate text-muted-foreground">
            {event.procedureName}
          </span>
        )}
        {showChangeSummary && event.changeSummary && (
          <AppointmentChangeSummary summary={event.changeSummary} />
        )}
      </div>
    </EventTooltip>
  )
}
