'use client'

import { useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { TimeColumn } from './components/TimeColumn'
import { TimeSlot } from './components/TimeSlot'
import { CurrentTimeIndicator } from './components/CurrentTimeIndicator'
import { HOURS, SLOT_HEIGHT, formatDateHeader } from '../utils/date-utils'
import { eventToAppointment, groupAppointmentsByHour } from '../utils/appointment-utils'
import type { CalendarEvent } from '../hooks/useCalendarEvents'

interface DayViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick?: (eventId: string) => void
  onEventDrop?: (eventId: string, newDate: Date, newHour: number) => void
}

export function DayView({ date, events, onEventClick, onEventDrop }: DayViewProps) {
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)

  const dayStr = date.toISOString().split('T')[0]
  const dayEvents = useMemo(
    () => events.filter(e => e.start.startsWith(dayStr)).map(e => eventToAppointment(e, date)),
    [events, dayStr, date]
  )
  const appointmentsByHour = useMemo(() => groupAppointmentsByHour(dayEvents), [dayEvents])

  const handleDragStart = useCallback((e: React.DragEvent, appointment: any) => {
    e.dataTransfer.setData('appointmentId', appointment.id)
    setDraggedEventId(appointment.id)
  }, [])

  const handleDrop = useCallback((appointmentId: string, newHour: number) => {
    setDraggedEventId(null)
    onEventDrop?.(appointmentId, date, newHour)
  }, [date, onEventDrop])

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-12 px-4 border-b border-border flex items-center">
        <h2 className="text-sm font-semibold">{formatDateHeader(date)}</h2>
      </div>

      <div className="flex flex-1 overflow-auto">
        <TimeColumn />
        <div className="flex-1 relative">
          {HOURS.map((hour) => {
            const hourAppointments = appointmentsByHour.get(hour) || []

            return (
              <TimeSlot
                key={hour}
                date={date}
                hour={hour}
                appointments={hourAppointments}
                onAppointmentClick={onEventClick}
                onDrop={handleDrop}
                isDropTarget={draggedEventId !== null}
                onDragStart={handleDragStart}
              />
            )
          })}
          <CurrentTimeIndicator slotHeight={SLOT_HEIGHT} />
        </div>
      </div>
    </div>
  )
}
