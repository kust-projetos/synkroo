'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Appointment } from '../../utils/appointment-utils'
import { AppointmentCard } from './AppointmentCard'
import { SLOT_HEIGHT, MINUTES_PER_PIXEL } from '../../utils/date-utils'

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
        "h-20 border-b border-border relative transition-colors duration-200",
        showDropTarget && "bg-primary/10 border-primary"
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {appointments.map((apt, index) => {
        const cardTop = (apt.startMinutes - hour * 60) * MINUTES_PER_PIXEL
        const cardHeight = apt.durationMinutes * MINUTES_PER_PIXEL

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
