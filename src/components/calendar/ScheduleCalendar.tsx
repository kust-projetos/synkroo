// src/components/calendar/ScheduleCalendar.tsx
'use client'

import { useEffect, useRef, useMemo } from 'react'
import {
  createCalendar,
  destroyCalendar,
  DayGrid,
  TimeGrid,
  ResourceTimeGrid,
  Interaction,
} from '@event-calendar/core'
import '@event-calendar/core/index.css'
import './calendar-styles.css'

import { eventContent, eventClassNames } from './EventCard'
import type { CalendarEvent, CalendarResource } from './hooks/useCalendarEvents'
import type { CalendarView } from './hooks/useCalendarState'

const PLUGINS = [DayGrid, TimeGrid, ResourceTimeGrid, Interaction]

interface ScheduleCalendarProps {
  events: CalendarEvent[]
  resources: CalendarResource[]
  view: CalendarView
  date: Date
  onEventClick: (event: CalendarEvent) => void
  onDateClick: (date: string, resourceId?: string) => void
  onEventDrop: (info: any) => void
  onEventResize: (info: any) => void
  onDatesSet: (startDate: string, endDate: string, viewType: string) => void
}

export function ScheduleCalendar({
  events,
  resources,
  view,
  date,
  onEventClick,
  onDateClick,
  onEventDrop,
  onEventResize,
  onDatesSet,
}: ScheduleCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Serialize to detect actual data changes (avoid re-create on reference change)
  const eventsKey = useMemo(() => JSON.stringify(events), [events])
  const resourcesKey = useMemo(() => JSON.stringify(resources), [resources])
  const dateStr = useMemo(() => date.toISOString().split('T')[0], [date])

  useEffect(() => {
    if (!containerRef.current) return

    // Destroy existing calendar BEFORE clearing DOM to prevent orphaned instances
    if (containerRef.current.__calendar) {
      destroyCalendar(containerRef.current.__calendar)
      containerRef.current.__calendar = undefined
    }

    // Clear any residual DOM from previous instance
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild)
    }

    // Create new calendar and store reference for cleanup
    const calendar = createCalendar(containerRef.current, PLUGINS, {
      view,
      date: dateStr,
      events,
      resources,
      editable: true,
      selectable: true,
      nowIndicator: true,
      firstDay: 1,
      locale: 'pt-BR',
      slotDuration: '00:30:00',
      slotMinTime: '07:00:00',
      slotMaxTime: '20:00:00',
      scrollTime: '08:00:00',
      snapDuration: '00:15:00',
      headerToolbar: false,
      dayMaxEvents: 3,
      height: '100%',
      eventContent,
      eventClassNames,
      eventClick: (info: any) => {
        const e = info.event
        onEventClick({
          id: e.id,
          title: e.title,
          start: e.startStr || e.start,
          end: e.endStr || e.end,
          resourceId: e.resource?.id || '',
          backgroundColor: e.backgroundColor,
          editable: true,
          extendedProps: e.extendedProps || {},
        })
      },
      dateClick: (info: any) => {
        onDateClick(info.dateStr, info.resource?.id)
      },
      eventDrop: (info: any) => {
        onEventDrop(info)
      },
      eventResize: (info: any) => {
        onEventResize(info)
      },
      datesSet: (info: any) => {
        onDatesSet(info.startStr, info.endStr, info.view.type)
      },
    })

    // Store calendar reference for cleanup
    containerRef.current.__calendar = calendar

    return () => {
      if (containerRef.current) {
        if (containerRef.current.__calendar) {
          destroyCalendar(containerRef.current.__calendar)
          containerRef.current.__calendar = undefined
        }
      }
    }
  }, [eventsKey, resourcesKey, view, dateStr])

  return <div ref={containerRef} className="ec" style={{ height: '100%' }} />
}
