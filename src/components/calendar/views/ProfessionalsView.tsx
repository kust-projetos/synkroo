'use client'

import { useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { TimeColumn } from './components/TimeColumn'
import { TimeSlot } from './components/TimeSlot'
import { ProfessionalHeader } from './components/ProfessionalHeader'
import { HOURS, formatDateHeader } from '../utils/date-utils'
import { eventToAppointment, groupAppointmentsByDentist } from '../utils/appointment-utils'
import type { CalendarEvent, CalendarResource } from '../hooks/useCalendarEvents'
import { getDentistColor } from '../utils/dentist-colors'

interface ProfessionalsViewProps {
  date: Date
  events: CalendarEvent[]
  resources: CalendarResource[]
  onEventClick?: (eventId: string) => void
  onEventDrop?: (eventId: string, newDate: Date, newHour: number, newMinute: number) => void
}

export function ProfessionalsView({
  date,
  events,
  resources,
  onEventClick,
  onEventDrop,
}: ProfessionalsViewProps) {
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)

  const dayStr = date.toISOString().split('T')[0]
  const dayEvents = useMemo(
    () => events.filter(e => e.start.startsWith(dayStr)).map(e => eventToAppointment(e, date)),
    [events, dayStr, date]
  )
  const appointmentsByDentist = useMemo(() => groupAppointmentsByDentist(dayEvents), [dayEvents])

  const handleDragStart = useCallback((e: React.DragEvent, appointment: any) => {
    e.dataTransfer.setData('appointmentId', appointment.id)
    setDraggedEventId(appointment.id)
  }, [])

  const handleDrop = useCallback((appointmentId: string, newHour: number, newMinute: number) => {
    setDraggedEventId(null)
    onEventDrop?.(appointmentId, date, newHour, newMinute)
  }, [date, onEventDrop])

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-12 px-4 border-b border-border flex items-center">
        <h2 className="text-sm font-semibold">{formatDateHeader(date)}</h2>
      </div>

      <div className="flex flex-1 overflow-auto">
        <TimeColumn />
        <div className="flex flex-1 min-w-0">
          {resources.map((resource, index) => {
            const dentistAppointments = appointmentsByDentist.get(resource.id) || []
            const color = getDentistColor(resource.id, index)
            const initials = resource.title.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

            return (
              <div
                key={resource.id}
                className={cn(
                  "flex-1 min-w-[120px] border-r border-border last:border-r-0",
                  index >= 2 && "bg-muted/10"
                )}
              >
                <ProfessionalHeader
                  name={resource.title}
                  specialty=""
                  initials={initials}
                  color={color}
                />
                {HOURS.map((hour) => {
                  const hourAppointments = dentistAppointments.filter(
                    a => Math.floor(a.startMinutes / 60) === hour
                  )

                  return (
                    <TimeSlot
                      key={`${resource.id}-${hour}`}
                      date={date}
                      hour={hour}
                      appointments={hourAppointments}
                      onAppointmentClick={onEventClick}
                      onDrop={handleDrop}
                      isDropTarget={draggedEventId !== null}
                      draggedAppointmentId={draggedEventId}
                      onDragStart={handleDragStart}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
