'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { TimeColumn } from './components/TimeColumn'
import { DayHeader } from './components/DayHeader'
import { TimeSlot } from './components/TimeSlot'
import { ManyAppointmentsSlot } from './components/ManyAppointmentsSlot'
import { CurrentTimeIndicator } from './components/CurrentTimeIndicator'
import { getWeekDays, HOURS, SLOT_HEIGHT, formatDateKey } from '../utils/date-utils'
import { eventToAppointment, groupAppointmentsByHour } from '../utils/appointment-utils'
import type { CalendarEvent } from '../hooks/useCalendarEvents'

const MAX_VISIBLE_PER_SLOT = 3

interface WeekViewProps {
  date: Date
  events: CalendarEvent[]
  onEventClick?: (eventId: string) => void
  onEventDrop?: (eventId: string, newDate: Date, newHour: number) => void
}

export function WeekView({ date, events, onEventClick, onEventDrop }: WeekViewProps) {
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)

  const weekDays = useMemo(() => getWeekDays(date), [date])

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    weekDays.forEach(day => {
      const dayStr = formatDateKey(day)
      const dayAppointments = events.filter(e => e.start.startsWith(dayStr))
      map.set(dayStr, dayAppointments)
    })
    return map
  }, [weekDays, events])

  const handleDragStart = useCallback((e: React.DragEvent, appointment: any) => {
    e.dataTransfer.setData('appointmentId', appointment.id)
    setDraggedEventId(appointment.id)
  }, [])

  const handleDrop = useCallback((appointmentId: string, targetDay: Date, targetHour: number) => {
    setDraggedEventId(null)
    onEventDrop?.(appointmentId, targetDay, targetHour)
  }, [onEventDrop])

  return (
    <div className="flex gap-0 bg-background h-full overflow-auto">
      <TimeColumn />
      <div className="flex flex-1">
        {weekDays.map((day, dayIndex) => {
          const dayStr = formatDateKey(day)
          const dayEvents = appointmentsByDay.get(dayStr) || []
          const isWeekend = dayIndex >= 5

          return (
            <div key={dayStr} className={cn("flex-1 border-r border-border", isWeekend && "bg-muted/30")}>
              <DayHeader date={day} isWeekend={isWeekend} />
              {HOURS.map(hour => {
                const hourEvents = dayEvents.filter(e => {
                  const eventDate = new Date(e.start)
                  return eventDate.getHours() === hour
                })
                const appointments = hourEvents.map(e => eventToAppointment(e, day))
                const isManyAppointments = appointments.length > MAX_VISIBLE_PER_SLOT

                if (isManyAppointments) {
                  return (
                    <ManyAppointmentsSlot
                      key={`${dayStr}-${hour}`}
                      appointments={appointments}
                      maxVisible={MAX_VISIBLE_PER_SLOT}
                      onAppointmentClick={onEventClick}
                      onExpand={() => {}}
                    />
                  )
                }

                return (
                  <TimeSlot
                    key={`${dayStr}-${hour}`}
                    date={day}
                    hour={hour}
                    appointments={appointments}
                    onAppointmentClick={onEventClick}
                    onDrop={(id, h) => handleDrop(id, day, h)}
                    isDropTarget={draggedEventId !== null}
                    onDragStart={handleDragStart}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <CurrentTimeIndicator slotHeight={SLOT_HEIGHT} />
    </div>
  )
}
