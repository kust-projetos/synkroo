// MonthView — monthly grid with status-colored mini-event cards + drag-and-drop

import { useMemo, useState, useCallback, useRef } from 'react'
import { getMonthDays, isToday, isWeekend, formatDateKey, formatTime } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'
import { eventCardVariants, statusLabels, type EventCardVariantProps } from '../events/event-styles'
import { isDraggableStatus } from '../events/EventCard'
import { EventTooltip } from '../events/EventTooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '../utils/types'

interface MonthViewProps {
  events: CalendarEvent[]
  date: Date
  onEventDrop?: (result: { eventId: string; dateKey: string; hour: number; minute: number }) => void
  onEventClick?: (eventId: string) => void
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const MAX_VISIBLE_EVENTS = 3

export function MonthView({ events, date, onEventDrop, onEventClick }: MonthViewProps) {
  const weeks = useMemo(() => getMonthDays(date), [date])
  const { setView, setSelectedDate, openEditDialog } = useCalendarStore()

  // Drag state
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const dragCountRef = useRef(0)
  const justDroppedRef = useRef(false)
  const [openPopoverDay, setOpenPopoverDay] = useState<string | null>(null)

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const key = formatDateKey(event.start)
      const list = map.get(key) || []
      list.push(event)
      map.set(key, list)
    })
    map.forEach((list) => list.sort((a, b) => a.start.getTime() - b.start.getTime()))
    return map
  }, [events])

  const handleDayClick = (day: Date) => {
    if (justDroppedRef.current) {
      justDroppedRef.current = false
      return
    }
    setSelectedDate(day)
  }

  const handleDayDoubleClick = (day: Date) => {
    setSelectedDate(day)
    setView('day')
  }

  const handleEventClick = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation()
  }

  const handleEventDoubleClick = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation()
    onEventClick ? onEventClick(eventId) : openEditDialog(eventId)
  }

  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    e.stopPropagation()
    setDraggedEventId(event.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({
      eventId: event.id,
      hour: event.start.getHours(),
      minute: event.start.getMinutes(),
    }))
    // Transparent drag image so we can style the ghost via CSS
    const ghost = e.currentTarget.cloneNode(true) as HTMLElement
    ghost.style.position = 'absolute'
    ghost.style.top = '-1000px'
    ghost.style.opacity = '0.7'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }, [])

  const handleDragEnd = useCallback(() => {
    setOpenPopoverDay(null)
    setDraggedEventId(null)
    setDropTargetKey(null)
    dragCountRef.current = 0
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    dragCountRef.current++
    setDropTargetKey(dateKey)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragLeave = useCallback(() => {
    dragCountRef.current--
    if (dragCountRef.current <= 0) {
      setDropTargetKey(null)
      dragCountRef.current = 0
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    justDroppedRef.current = true
    setDropTargetKey(null)
    dragCountRef.current = 0
    setOpenPopoverDay(null)

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (data.eventId && onEventDrop) {
        onEventDrop({
          eventId: data.eventId,
          dateKey,
          hour: data.hour,
          minute: data.minute,
        })
      }
    } catch {
      // Invalid drag data — ignore
    }

    setDraggedEventId(null)
  }, [onEventDrop])

  return (
    <div className={cn("flex-1 flex flex-col", draggedEventId && "cursor-grabbing")}>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_HEADERS.map((name) => (
          <div key={name} className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(150px, 1fr))` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border">
              {week.map((day) => {
                const key = formatDateKey(day)
                const dayEvents = eventsByDate.get(key) || []
                const isCurrentMonth = day.getMonth() === date.getMonth()
                const today = isToday(day)
                const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS)
                const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS
                const isDropTarget = dropTargetKey === key

                return (
                  <div
                    key={key}
                    className={cn(
                      'border-r border-border last:border-r-0 p-1.5 min-h-[150px] cursor-pointer hover:bg-muted/30 transition-colors flex flex-col',
                      !isCurrentMonth && 'opacity-40',
                      today && 'bg-teal-50/50 dark:bg-teal-950/20',
                      isDropTarget && 'bg-primary/10 ring-2 ring-primary/40 ring-inset',
                    )}
                    onClick={() => handleDayClick(day)}
                    onDoubleClick={() => handleDayDoubleClick(day)}
                    onDragEnter={(e) => handleDragEnter(e, key)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, key)}
                  >
                    <div className={cn(
                      'text-sm mb-1 flex-shrink-0',
                      today
                        ? 'w-6 h-6 flex items-center justify-center rounded-full bg-teal-600 text-white font-bold'
                        : isWeekend(day)
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                    )}>
                      {day.getDate()}
                    </div>

                    {/* Event cards */}
                    <div className="flex-1 space-y-1">
                      {visibleEvents.map((event) => {
                        const canDrag = isDraggableStatus(event.status)
                        return (
                        <div
                          key={event.id}
                          draggable={canDrag}
                          className={cn(
                            eventCardVariants({ status: event.status as EventCardVariantProps['status'] }),
                            '!text-xs !leading-4 !py-1 truncate select-none',
                            canDrag ? 'cursor-grab' : 'cursor-default',
                            draggedEventId === event.id && 'opacity-40',
                          )}
                          onClick={(e) => handleEventClick(e, event.id)}
                          onDoubleClick={(e) => handleEventDoubleClick(e, event.id)}
                          onDragStart={canDrag ? (e) => handleDragStart(e, event) : undefined}
                          onDragEnd={canDrag ? handleDragEnd : undefined}
                        >
                          <EventTooltip event={event}>
                            <span>{formatTime(event.start)} {event.title}</span>
                          </EventTooltip>
                        </div>
                        )
                      })}

                      {overflowCount > 0 && (
                        <Popover
                          open={openPopoverDay === key}
                          onOpenChange={(open) => {
                            setOpenPopoverDay(open ? key : null)
                          }}
                        >
                          <PopoverTrigger asChild>
                            <div
                              className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              +{overflowCount} mais
                            </div>
                          </PopoverTrigger>
                          <PopoverContent
                            className={cn(
                              "w-72 p-0",
                              draggedEventId && "pointer-events-none",
                            )}
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onInteractOutside={() => {
                              if (!draggedEventId) setOpenPopoverDay(null)
                            }}
                          >
                            <div className="p-3 border-b border-border">
                              <p className="text-sm font-semibold">
                                {day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {dayEvents.length} agendamento{dayEvents.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                              {dayEvents.map((event) => {
                                const canDrag = isDraggableStatus(event.status)
                                return (
                                <div
                                  key={event.id}
                                  draggable={canDrag}
                                  className={cn(
                                    eventCardVariants({ status: event.status as EventCardVariantProps['status'] }),
                                    '!text-xs !leading-4 !py-1.5 rounded select-none',
                                    canDrag ? 'cursor-grab' : 'cursor-default',
                                    draggedEventId === event.id && 'opacity-40',
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    openEditDialog(event.id)
                                  }}
                                  onDragStart={canDrag ? (e) => {
                                    handleDragStart(e, event)
                                  } : undefined}
                                  onDragEnd={canDrag ? handleDragEnd : undefined}
                                >
                                  <div className="font-medium truncate">{formatTime(event.start)} - {event.title}</div>
                                  <div className="text-[10px] opacity-80 truncate">
                                    {event.procedureName} &middot; {statusLabels[event.status] || event.status}
                                  </div>
                                </div>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
