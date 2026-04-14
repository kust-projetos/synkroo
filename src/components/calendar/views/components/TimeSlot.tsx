'use client'

import { useState, useMemo } from 'react'
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

/**
 * Detects overlapping appointments and assigns column positions.
 * Returns a map of appointment id -> { columnIndex, totalColumns }
 */
function calculateColumns(appointments: Appointment[]): Map<string, { columnIndex: number; totalColumns: number }> {
  if (appointments.length <= 1) {
    return new Map(appointments.map(apt => [apt.id, { columnIndex: 0, totalColumns: 1 }]))
  }

  // Sort by start time
  const sorted = [...appointments].sort((a, b) => a.startMinutes - b.startMinutes)
  const columns: { apt: Appointment; endMinutes: number }[] = []

  sorted.forEach(apt => {
    // Find first column that doesn't overlap
    let assigned = false
    for (let i = 0; i < columns.length; i++) {
      if (apt.startMinutes >= columns[i].endMinutes) {
        columns[i] = { apt, endMinutes: apt.startMinutes + apt.durationMinutes }
        assigned = true
        break
      }
    }
    if (!assigned) {
      columns.push({ apt, endMinutes: apt.startMinutes + apt.durationMinutes })
    }
  })

  // Now assign actual column indices
  // For simplicity: if N appointments overlap, give each equal column
  const totalColumns = columns.length
  const result = new Map<string, { columnIndex: number; totalColumns: number }>()

  sorted.forEach((apt, idx) => {
    result.set(apt.id, { columnIndex: idx, totalColumns })
  })

  return result
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

  // Calculate column positions for overlapping appointments
  const columnMap = useMemo(() => calculateColumns(appointments), [appointments])

  // Calculate slot height: base + extra per overlapping appointment
  const maxColumns = Math.max(1, columnMap.size)
  const baseHeight = 80 // 1 hour = 80px
  const extraHeightPerColumn = 24 // extra height per overlapping column
  const slotHeight = maxColumns > 1 ? baseHeight + (maxColumns - 1) * extraHeightPerColumn : baseHeight

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
      {appointments.map((apt) => {
        const cardTop = (apt.startMinutes - hour * 60) * MINUTES_PER_PIXEL
        const cardHeight = apt.durationMinutes * MINUTES_PER_PIXEL
        const { columnIndex, totalColumns } = columnMap.get(apt.id) || { columnIndex: 0, totalColumns: 1 }

        return (
          <AppointmentCard
            key={apt.id}
            appointment={apt}
            style={{
              top: `${cardTop}px`,
              height: `${cardHeight}px`,
              zIndex: 20,
            }}
            columnIndex={columnIndex}
            totalColumns={totalColumns}
            onClick={() => onAppointmentClick?.(apt.id)}
            onDragStart={(e) => onDragStart?.(e, apt)}
          />
        )
      })}
    </div>
  )
}
