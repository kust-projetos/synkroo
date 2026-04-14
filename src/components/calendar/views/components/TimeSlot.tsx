'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Appointment } from '../../utils/appointment-utils'
import { AppointmentCard } from './AppointmentCard'

interface TimeSlotProps {
  date: Date
  hour: number
  appointments: Appointment[]
  onAppointmentClick?: (id: string) => void
  onDrop?: (appointmentId: string, newHour: number) => void
  isDropTarget?: boolean
  onDragStart?: (e: React.DragEvent, appointment: Appointment) => void
}

export function TimeSlot({
  date,
  hour,
  appointments,
  onAppointmentClick,
  onDrop,
  isDropTarget = false,
  onDragStart,
}: TimeSlotProps) {
  const [localIsDropTarget, setLocalIsDropTarget] = useState(false)
  const showDropTarget = isDropTarget || localIsDropTarget

  // Sort appointments by start time for consistent stacking
  const sortedAppointments = [...appointments].sort((a, b) => a.startMinutes - b.startMinutes)

  // Calculate total height needed for all appointments in this slot
  // Find the appointment that ends last
  const lastEndMinutes = sortedAppointments.reduce((max, apt) => {
    const endMinutes = apt.startMinutes + apt.durationMinutes
    return endMinutes > max ? endMinutes : max
  }, 0)

  const slotHeight = Math.max(80, ((lastEndMinutes - hour * 60) / 60) * 80)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = () => {
    setLocalIsDropTarget(true)
  }

  const handleDragLeave = () => {
    setLocalIsDropTarget(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setLocalIsDropTarget(false)
    const appointmentId = e.dataTransfer.getData('appointmentId')
    onDrop?.(appointmentId, hour)
  }

  return (
    <div
      className={cn(
        "border-b border-border relative transition-colors duration-200",
        showDropTarget && "bg-primary/10 border-primary"
      )}
      style={{ height: `${slotHeight}px` }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {sortedAppointments.map((apt, index) => {
        const cardTop = apt.startMinutes - hour * 60
        const cardHeight = apt.durationMinutes

        return (
          <AppointmentCard
            key={apt.id}
            appointment={apt}
            style={{
              top: `${cardTop}px`,
              height: `${cardHeight}px`,
              zIndex: 20 + index,
            }}
            onClick={() => onAppointmentClick?.(apt.id)}
            onDragStart={(e) => onDragStart?.(e, apt)}
          />
        )
      })}
    </div>
  )
}
