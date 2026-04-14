'use client'

import { cn } from '@/lib/utils'
import type { Appointment } from '../../utils/appointment-utils'
import { AppointmentCard } from './AppointmentCard'

interface ManyAppointmentsSlotProps {
  appointments: Appointment[]
  maxVisible?: number
  onAppointmentClick?: (id: string) => void
  onExpand?: () => void
}

export function ManyAppointmentsSlot({
  appointments,
  maxVisible = 3,
  onAppointmentClick,
  onExpand,
}: ManyAppointmentsSlotProps) {
  const visibleAppointments = appointments.slice(0, maxVisible)
  const overflowCount = appointments.length - maxVisible
  const hasOverflow = overflowCount > 0

  return (
    <div className="h-[120px] border-b border-border slot-scroll overflow-y-auto">
      {visibleAppointments.map((apt) => (
        <AppointmentCard
          key={apt.id}
          appointment={apt}
          className="relative flex-shrink-0 mb-1"
          onClick={() => onAppointmentClick?.(apt.id)}
        />
      ))}
      {hasOverflow && (
        <button
          className="w-full text-center text-[10px] text-muted-foreground py-1 hover:text-primary transition-colors"
          onClick={onExpand}
        >
          +{overflowCount} mais
        </button>
      )}
    </div>
  )
}
