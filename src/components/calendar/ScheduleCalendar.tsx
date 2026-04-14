// src/components/calendar/ScheduleCalendar.tsx
'use client'

import { useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { WeekView } from './views/WeekView'
import { MonthView } from './views/MonthView'
import { DayView } from './views/DayView'
import { ProfessionalsView } from './views/ProfessionalsView'
import { useCalendarNavigation } from './hooks/useCalendarNavigation'
import type { CalendarEvent, CalendarResource } from './hooks/useCalendarEvents'
import type { CalendarView } from './hooks/useCalendarState'

interface ScheduleCalendarProps {
  events: CalendarEvent[]
  resources: CalendarResource[]
  view: CalendarView
  date: Date
  onDateChange: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onDateClick: (date: string, resourceId?: string) => void
  onEventDrop: (eventId: string, newDate: Date, newHour: number) => void
  onEventResize: (info: any) => void
  onDatesSet: (startDate: string, endDate: string, viewType: string) => void
}

export function ScheduleCalendar({
  events,
  resources,
  view,
  date,
  onDateChange,
  onEventClick,
  onDateClick,
  onEventDrop,
}: ScheduleCalendarProps) {
  const { toast } = useToast()

  const handleEventDrop = useCallback(
    async (eventId: string, newDate: Date, newHour: number) => {
      try {
        await onEventDrop(eventId, newDate, newHour)
        toast({
          title: 'Sucesso',
          description: 'Agendamento reagendado',
        })
      } catch (error) {
        toast({
          title: 'Erro',
          description: 'Falha ao reagendar. Tente novamente.',
          variant: 'destructive',
        })
      }
    },
    [onEventDrop, toast]
  )

  const renderView = () => {
    switch (view) {
      case 'dayGridMonth':
        return (
          <MonthView
            date={date}
            events={events}
            onEventClick={(id) => {
              const event = events.find((e) => e.id === id)
              if (event) onEventClick(event)
            }}
            onDayClick={onDateChange}
          />
        )
      case 'timeGridDay':
        return (
          <DayView
            date={date}
            events={events}
            onEventClick={(id) => {
              const event = events.find((e) => e.id === id)
              if (event) onEventClick(event)
            }}
            onEventDrop={handleEventDrop}
          />
        )
      case 'resourceTimeGridDay':
        return (
          <ProfessionalsView
            date={date}
            events={events}
            resources={resources}
            onEventClick={(id) => {
              const event = events.find((e) => e.id === id)
              if (event) onEventClick(event)
            }}
            onEventDrop={handleEventDrop}
          />
        )
      case 'timeGridWeek':
      default:
        return (
          <WeekView
            date={date}
            events={events}
            onEventClick={(id) => {
              const event = events.find((e) => e.id === id)
              if (event) onEventClick(event)
            }}
            onEventDrop={handleEventDrop}
          />
        )
    }
  }

  return <div className="h-full w-full">{renderView()}</div>
}
