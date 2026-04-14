'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Appointment } from '../../utils/appointment-utils'
import { AppointmentCard } from './AppointmentCard'
import { HOURS, SLOT_HEIGHT, SLOT_MINUTES, SLOTS_PER_HOUR } from '../../utils/date-utils'

interface TimeSlotProps {
  date: Date
  hour: number
  appointments: Appointment[]
  onAppointmentClick?: (id: string) => void
  onDrop?: (appointmentId: string, newHour: number, newMinute: number) => void
  isDropTarget?: boolean
  draggedAppointmentId?: string | null
  onDragStart?: (e: React.DragEvent, appointment: Appointment) => void
}

// 15-min slot grid: 4 slots of 20px each = 80px per hour
const HOUR_HEIGHT = SLOTS_PER_HOUR * SLOT_HEIGHT // 80px

export function TimeSlot({
  date,
  hour,
  appointments,
  onAppointmentClick,
  onDrop,
  isDropTarget = false,
  draggedAppointmentId,
  onDragStart,
}: TimeSlotProps) {
  const [localIsDropTarget, setLocalIsDropTarget] = useState(false)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const showDropTarget = isDropTarget || localIsDropTarget

  // Check if any appointment conflicts with a specific slot
  const hasConflict = (slotIndex: number): boolean => {
    if (!draggedAppointmentId) return false
    const slotMinutes = slotIndex * SLOT_MINUTES
    const dragged = appointments.find(apt => apt.id === draggedAppointmentId)
    if (!dragged) return false

    for (const apt of appointments) {
      if (apt.id === draggedAppointmentId) continue
      const aptStart = apt.startMinutes - hour * 60
      const aptEnd = aptStart + apt.durationMinutes
      if (slotMinutes < aptEnd && slotMinutes + SLOT_MINUTES > aptStart) {
        return true
      }
    }
    return false
  }

  // Sort appointments by start time
  const sortedAppointments = [...appointments].sort((a, b) => a.startMinutes - b.startMinutes)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // Calculate which slot based on Y position
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const slotIndex = Math.floor(y / SLOT_HEIGHT)
    setDragOverSlot(Math.min(Math.max(0, slotIndex), SLOTS_PER_HOUR - 1))
  }

  const handleDragEnter = () => {
    setLocalIsDropTarget(true)
  }

  const handleDragLeave = () => {
    setLocalIsDropTarget(false)
    setDragOverSlot(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setLocalIsDropTarget(false)
    setDragOverSlot(null)
    const appointmentId = e.dataTransfer.getData('appointmentId')
    // Calculate exact minute from drop position
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const slotIndex = Math.min(Math.max(0, Math.floor(y / SLOT_HEIGHT)), SLOTS_PER_HOUR - 1)
    const newMinute = slotIndex * SLOT_MINUTES
    onDrop?.(appointmentId, hour, newMinute)
  }

  // Render 4 slots of 20px each (15-min grid)
  return (
    <div
      className="relative border-b border-border"
      style={{ height: `${HOUR_HEIGHT}px` }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 15-min slot lines */}
      {[0, 1, 2, 3].map(slotIndex => (
        <div
          key={slotIndex}
          className={cn(
            "absolute left-0 right-0 border-b border-border/50 transition-colors duration-150",
            showDropTarget && slotIndex === dragOverSlot && hasConflict(slotIndex) && "bg-red-500/20",
            showDropTarget && slotIndex === dragOverSlot && !hasConflict(slotIndex) && "bg-green-500/20",
            showDropTarget && slotIndex === dragOverSlot && !draggedAppointmentId && "bg-primary/10"
          )}
          style={{
            top: `${slotIndex * SLOT_HEIGHT}px`,
            height: `${SLOT_HEIGHT}px`,
          }}
        />
      ))}

      {/* Appointments positioned by minute offset */}
      {sortedAppointments.map((apt, index) => {
        // Calculate position based on minutes within the hour
        const minutesInHour = apt.startMinutes - hour * 60
        const slotIndex = Math.floor(minutesInHour / SLOT_MINUTES)
        const cardTop = slotIndex * SLOT_HEIGHT + (minutesInHour % SLOT_MINUTES) * (SLOT_HEIGHT / SLOT_MINUTES)
        const cardHeight = Math.max(apt.durationMinutes * (SLOT_HEIGHT / SLOT_MINUTES), SLOT_HEIGHT / 2)

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

      {/* Current time indicator */}
      {showDropTarget && dragOverSlot !== null && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-primary z-50"
          style={{ top: `${dragOverSlot * SLOT_HEIGHT + SLOT_HEIGHT / 2}px` }}
        />
      )}
    </div>
  )
}
