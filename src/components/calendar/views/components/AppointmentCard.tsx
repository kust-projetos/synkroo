import { cn } from '@/lib/utils'
import type { Appointment } from '../../utils/appointment-utils'

interface AppointmentCardProps {
  appointment: Appointment
  style?: React.CSSProperties
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  className?: string
}

export function AppointmentCard({
  appointment,
  style,
  onClick,
  onDragStart,
  className,
}: AppointmentCardProps) {
  const isBlocked = appointment.isBlocked

  // Blocked appointments render as subtle background blocks
  if (isBlocked) {
    return (
      <div
        className={cn(
          "absolute left-1 right-1 rounded-lg bg-muted/40 border border-dashed border-muted-foreground/30",
          className
        )}
        style={{
          ...style,
        }}
      />
    )
  }

  const colors = getStatusColors(appointment.status)
  const icon = getStatusIcon(appointment.status)
  const isCancelled = isCancelledStatus(appointment.status)

  return (
    <div
      className={cn(
        "absolute left-1 right-1 rounded-lg p-2 shadow-sm",
        "transition-transform duration-200 hover:scale-[1.01]",
        isCancelled && "opacity-70",
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${colors.bg}, ${colors.bgEnd})`,
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

// Helper functions that should be imported or duplicated
function getStatusColors(status: string): { bg: string; bgEnd: string } {
  const colors: Record<string, { bg: string; bgEnd: string }> = {
    scheduled: { bg: '#F59E0B', bgEnd: '#D97706' },
    confirmed: { bg: '#14B8A6', bgEnd: '#0D9488' },
    in_progress: { bg: '#22C55E', bgEnd: '#16A34A' },
    completed: { bg: '#6B7280', bgEnd: '#4B5563' },
    cancelled: { bg: '#EF4444', bgEnd: '#DC2626' },
    no_show: { bg: '#EF4444', bgEnd: '#DC2626' },
  }
  return colors[status] || colors.scheduled
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    scheduled: '⏳',
    confirmed: '✓',
    in_progress: '▶',
    completed: '✓',
    cancelled: '✕',
    no_show: '✕',
  }
  return icons[status] || '⏳'
}

function isCancelledStatus(status: string): boolean {
  return ['cancelled', 'no_show'].includes(status)
}