import { cn } from '@/lib/utils'
import type { Appointment } from '../../utils/appointment-utils'
import { getStatusColors, getStatusIcon, isCancelledStatus } from '../../utils/appointment-utils'

interface AppointmentCardProps {
  appointment: Appointment
  style?: React.CSSProperties
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  className?: string
  /** Column layout for overlapping appointments */
  columnIndex?: number
  totalColumns?: number
}

export function AppointmentCard({
  appointment,
  style,
  onClick,
  onDragStart,
  className,
  columnIndex = 0,
  totalColumns = 1,
}: AppointmentCardProps) {
  const colors = getStatusColors(appointment.status)
  const icon = getStatusIcon(appointment.status)
  const isCancelled = isCancelledStatus(appointment.status)

  // Calculate column width and offset
  const columnWidth = totalColumns > 1 ? 100 / totalColumns : 100
  const leftOffset = totalColumns > 1 ? columnIndex * columnWidth : 0

  return (
    <div
      className={cn(
        "absolute top-1 rounded-lg p-2 shadow-sm",
        "transition-transform duration-200 hover:scale-[1.02]",
        isCancelled && "opacity-70",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${colors.bg}, ${colors.bgEnd})`,
        left: `${leftOffset}%`,
        width: totalColumns > 1 ? `calc(${columnWidth}% - 4px)` : 'calc(100% - 8px)',
        ...style,
      }}
      onClick={onClick}
      draggable={!isCancelled}
      onDragStart={onDragStart}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-xs font-semibold text-white truncate",
              isCancelled && "line-through"
            )}
          >
            {appointment.title}
          </div>
          <div
            className={cn(
              "text-[10px] text-white/85 mt-0.5 truncate",
              isCancelled && "line-through"
            )}
          >
            {appointment.procedureName}
          </div>
        </div>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-full text-[9px] text-white shrink-0",
            isCancelled ? "bg-white/15" : "bg-white/20"
          )}
        >
          {icon} {appointment.durationMinutes}m
        </span>
      </div>
    </div>
  )
}
