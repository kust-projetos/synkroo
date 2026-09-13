// MonthView — monthly grid with status-colored mini-event cards + drag-and-drop

import { useMemo, useState, useCallback, useRef } from 'react'
import { getMonthDays, isToday, isWeekend, formatDateKey, formatTime } from '../utils/date-utils'
import { useCalendarStore } from '../store/calendar-store'
import { statusLabels } from '../events/event-styles'
import { isDraggableStatus } from '../events/EventCard'
import { cn } from '@/lib/utils'
import { getDentistDotColor } from '../utils/dentist-colors'
import type { CalendarEvent } from '../utils/types'

interface MonthViewProps {
  events: CalendarEvent[]
  date: Date
  onEventDrop?: (result: { eventId: string; dateKey: string; hour: number; minute: number }) => void
  onEventClick?: (eventId: string) => void
}

const WEEKDAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const MAX_VISIBLE_EVENTS = 3

function getStatusDistribution(events: CalendarEvent[]): { status: string; count: number }[] {
  const counts = new Map<string, number>()
  events.forEach(e => counts.set(e.status, (counts.get(e.status) || 0) + 1))
  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

const STATUS_BAR_COLORS: Record<string, string> = {
  scheduled: 'bg-amber-400',
  confirmed: 'bg-blue-400',
  in_progress: 'bg-teal-400',
  completed: 'bg-green-400',
  cancelled: 'bg-red-400',
  no_show: 'bg-zinc-400',
}

const STATUS_BG: Record<string, string> = {
  scheduled: 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
  confirmed: 'bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200',
  in_progress: 'bg-teal-50 text-teal-900 dark:bg-teal-950/30 dark:text-teal-200',
  completed: 'bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200',
  cancelled: 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200 line-through opacity-60',
  no_show: 'bg-zinc-50 text-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400',
  blocked: 'bg-gray-50 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
  unavailable: 'bg-gray-50 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
}

export function MonthView({ events, date, onEventDrop, onEventClick }: MonthViewProps) {
  const weeks = useMemo(() => getMonthDays(date), [date])
  const { setView, setSelectedDate, openEditDialog, openCreateDialog } = useCalendarStore()
  const layoutMode = useCalendarStore((s) => s.layoutMode)

  const isProfessionalsMode = layoutMode === 'professionals'

  // Drag state
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const dragCountRef = useRef(0)
  const justDroppedRef = useRef(false)

  // Expanded week — expands all cells in the row
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

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
    if (onEventClick) {
      onEventClick(eventId)
    } else {
      openEditDialog(eventId)
    }
  }

  const handleDayContextMenu = useCallback((e: React.MouseEvent, day: Date) => {
    e.preventDefault()
    e.stopPropagation()
    openCreateDialog({ date: day, hour: 8, minute: 0 })
  }, [openCreateDialog])

  const handleDragStart = useCallback((e: React.DragEvent, event: CalendarEvent) => {
    e.stopPropagation()
    setDraggedEventId(event.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({
      eventId: event.id,
      hour: event.start.getHours(),
      minute: event.start.getMinutes(),
    }))
  }, [])

  const handleDragEnd = useCallback(() => {
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

  // Toggle expanded week
  const handleExpandToggle = (e: React.MouseEvent, weekIndex: number) => {
    e.stopPropagation()
    setExpandedWeek(prev => prev === weekIndex ? null : weekIndex)
  }

  // Compute grid row sizes — expanded row uses auto, others use fixed
  const rowSizes = useMemo(() => {
    return weeks.map((_, i) => i === expandedWeek ? 'auto' : 'minmax(150px, 1fr)')
  }, [weeks, expandedWeek])

  // Render a single event mini card — T9 a11y: role/button + teclado + aria-label
  const renderEventCard = (event: CalendarEvent, showDetails: boolean) => {
    const canDrag = isDraggableStatus(event.status)
    const isAiOrigin = event.origin === 'ai'
    const ariaLabel = `${formatTime(event.start)} ${event.title}${event.procedureName ? `, ${event.procedureName}` : ''}, ${statusLabels[event.status] || event.status}${isAiOrigin ? ', criado por IA' : ''}`
    return (
      <div
        key={event.id}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        draggable={canDrag}
        className={cn(
          'rounded px-1.5 select-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
          showDetails ? 'py-1 text-xs leading-4' : 'py-0.5 text-[12px] leading-4 font-medium',
          STATUS_BG[event.status] || 'bg-muted text-muted-foreground',
          canDrag ? 'cursor-grab' : 'cursor-default',
          draggedEventId === event.id && 'opacity-40',
        )}
        onClick={(e) => handleEventClick(e, event.id)}
        onDoubleClick={(e) => handleEventDoubleClick(e, event.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            if (onEventClick) onEventClick(event.id)
            else openEditDialog(event.id)
          }
        }}
        onDragStart={canDrag ? (e) => handleDragStart(e, event) : undefined}
        onDragEnd={canDrag ? handleDragEnd : undefined}
      >
        <span aria-hidden="true" className={cn(
          "w-[3px] rounded-full flex-shrink-0",
          showDetails ? "h-4" : "h-3",
          STATUS_BAR_COLORS[event.status] || 'bg-gray-400',
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 truncate font-medium">
            <span aria-hidden="true" className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getDentistDotColor(event.dentistId))} />
            <span className="truncate">{formatTime(event.start)} - {event.title}</span>
            {isAiOrigin && (
              <span aria-hidden="true" className="text-[8px] font-semibold px-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 flex-shrink-0 leading-relaxed">
                IA
              </span>
            )}
          </div>
          {showDetails && (
            <div className="text-[11px] opacity-80 truncate ml-2.5">
              {event.procedureName} &middot; {statusLabels[event.status] || event.status}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex-1 flex flex-col", draggedEventId && "cursor-grabbing")} role="grid" aria-label="Calendário mensal">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border" role="row">
        {WEEKDAY_HEADERS.map((name) => (
          <div key={name} role="columnheader" className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {name}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateRows: rowSizes.join(' ') }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border" role="row">
              {week.map((day) => {
                const key = formatDateKey(day)
                const dayEvents = eventsByDate.get(key) || []
                const isCurrentMonth = day.getMonth() === date.getMonth()
                const today = isToday(day)
                const isExpanded = expandedWeek === wi
                const visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, MAX_VISIBLE_EVENTS)
                const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS
                const isDropTarget = dropTargetKey === key
                const dayLabel = day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                const dayAriaLabel = `${dayLabel}${today ? ', hoje' : ''}${dayEvents.length ? `, ${dayEvents.length} agendamento${dayEvents.length > 1 ? 's' : ''}` : ', sem agendamentos'}${!isCurrentMonth ? ', fora do mês atual' : ''}`

                return (
                  <div
                    key={key}
                    role="gridcell"
                    tabIndex={0}
                    aria-label={dayAriaLabel}
                    aria-selected={today ? true : undefined}
                    className={cn(
                      'group border-r border-border last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset',
                      isExpanded ? '' : 'min-h-[150px]',
                      !isCurrentMonth && !isExpanded && 'opacity-40',
                      today && 'bg-teal-50/50 dark:bg-teal-950/20',
                      isWeekend(day) && !today && 'bg-muted/40',
                      isDropTarget && 'bg-primary/10 ring-2 ring-primary/40 ring-inset',
                    )}
                    onClick={() => handleDayClick(day)}
                    onDoubleClick={() => handleDayDoubleClick(day)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleDayClick(day)
                      } else if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault()
                        handleDayDoubleClick(day)
                      }
                    }}
                    onContextMenu={(e) => handleDayContextMenu(e, day)}
                    onDragEnter={(e) => handleDragEnter(e, key)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, key)}
                  >
                    <div className="flex items-start justify-between mb-1 flex-shrink-0">
                      <div className={cn(
                        'text-sm',
                        today
                          ? 'w-7 h-7 flex items-center justify-center rounded-full bg-teal-600 text-white font-bold text-xs'
                          : isWeekend(day)
                            ? 'text-muted-foreground'
                            : 'text-foreground',
                      )}>
                        {day.getDate()}
                      </div>
                      <div className="flex items-center gap-1">
                        {!isCurrentMonth && (
                          <span className="text-[10px] text-muted-foreground/60 leading-none mt-1.5">
                            {day.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                          </span>
                        )}
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity w-5 h-5 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary text-xs font-bold leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          onClick={(e) => { e.stopPropagation(); openCreateDialog({ date: day, hour: 8, minute: 0 }) }}
                          aria-label={`Novo agendamento em ${day.toLocaleDateString('pt-BR')}`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Event cards */}
                    <div className="flex-1 space-y-0.5">
                      {isProfessionalsMode ? (
                        // Professionals mode: group ALL dayEvents by dentist, per-group overflow
                        (() => {
                          const grouped = new Map<string, CalendarEvent[]>()
                          dayEvents.forEach((e) => {
                            const list = grouped.get(e.dentistId) || []
                            list.push(e)
                            grouped.set(e.dentistId, list)
                          })
                          return Array.from(grouped.entries()).map(([dentistId, groupEvents]) => {
                            const visibleGroup = isExpanded ? groupEvents : groupEvents.slice(0, MAX_VISIBLE_EVENTS)
                            const groupOverflow = groupEvents.length - MAX_VISIBLE_EVENTS
                            return (
                              <div key={dentistId} className="space-y-0.5">
                                <div className="text-[9px] font-semibold text-muted-foreground truncate px-1.5 pt-0.5">
                                  {groupEvents[0].dentistName}
                                </div>
                                {visibleGroup.map((event) => renderEventCard(event, isExpanded))}
                                {/* Per-group overflow */}
                                {groupOverflow > 0 && !isExpanded && (
                                  <button
                                    type="button"
                                    aria-label={`Expandir semana, mais ${groupOverflow} agendamentos`}
                                    aria-expanded={false}
                                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 text-left w-full"
                                    onClick={(e) => handleExpandToggle(e, wi)}
                                  >
                                    +{groupOverflow} mais
                                  </button>
                                )}
                              </div>
                            )
                          })
                        })()
                      ) : (
                        visibleEvents.map((event) => renderEventCard(event, isExpanded))
                      )}

                      {/* Expand/collapse toggle — agenda mode only (global overflow) */}
                      {!isProfessionalsMode && overflowCount > 0 && !isExpanded && (
                        <button
                          type="button"
                          aria-label={`Expandir semana, mais ${overflowCount} agendamentos`}
                          aria-expanded={false}
                          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 w-full text-left"
                          onClick={(e) => handleExpandToggle(e, wi)}
                        >
                          <div className="flex items-center gap-px" aria-hidden="true">
                            {getStatusDistribution(dayEvents.slice(MAX_VISIBLE_EVENTS)).map(({ status, count }) => (
                              <span
                                key={status}
                                className={cn(
                                  "h-1.5 rounded-full",
                                  STATUS_BAR_COLORS[status] || 'bg-gray-400',
                                )}
                                style={{ width: `${Math.min(count * 4, 16)}px` }}
                              />
                            ))}
                          </div>
                          <span>+{overflowCount} mais</span>
                        </button>
                      )}

                      {/* Collapse button when expanded */}
                      {isExpanded && dayEvents.length > MAX_VISIBLE_EVENTS && (
                        <button
                          type="button"
                          aria-label="Recolher semana"
                          aria-expanded={true}
                          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 px-1.5 py-0.5 rounded hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 w-full text-left"
                          onClick={(e) => handleExpandToggle(e, wi)}
                        >
                          <span>mostrar menos</span>
                        </button>
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
