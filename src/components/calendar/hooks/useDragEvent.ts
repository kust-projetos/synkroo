// useDragEvent — pointer-based drag & drop for calendar events
//
// Uses global document listeners (pointermove/pointerup) to track drag
// regardless of where the cursor moves. Converts pointer position to
// grid coordinates using the inverse of getPixelOffsetFor().

'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { MINUTE_HEIGHT, SLOT_MINUTES } from '../utils/date-utils'
import type { CalendarEvent } from '../utils/types'

// Context for sharing drag state between TimeGrid → EventLayer → EventCard
interface DragContextValue {
  onDragStart: (e: React.PointerEvent, event: CalendarEvent, offsetY: number) => void
  gridContentRef: React.RefObject<HTMLDivElement | null>
  draggingEventId: string | null
}

export const CalendarDragContext = createContext<DragContextValue | null>(null)

export function useCalendarDrag() {
  return useContext(CalendarDragContext)
}

export interface DragState {
  event: CalendarEvent
  // Ghost visual position (relative to grid content area)
  ghostTop: number
  ghostHeight: number
  ghostLeftPercent: number
  ghostWidthPercent: number
  // Snapped target slot
  targetColumn: number
  targetDateKey: string
  targetHour: number
  targetMinute: number
}

export interface DragDropResult {
  eventId: string
  event: CalendarEvent
  dateKey: string
  hour: number
  minute: number
  column: number
}

interface UseDragEventConfig {
  startHour: number
  endHour: number
  columnCount: number
  dateKeys: string[]
  gridContentRef: React.RefObject<HTMLDivElement | null>
  onDrop: (result: DragDropResult) => void
  onClick?: (eventId: string) => void
}

interface PendingDrag {
  event: CalendarEvent
  offsetY: number
  startX: number
  startY: number
}

const DRAG_THRESHOLD = 5

export function useDragEvent(config: UseDragEventConfig) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const latestRef = useRef<DragState | null>(null)
  const pendingRef = useRef<PendingDrag | null>(null)
  const isDraggingRef = useRef(false)
  const configRef = useRef(config)
  configRef.current = config

  const initiateDrag = useCallback((
    event: CalendarEvent,
    offsetY: number,
    clientX: number,
    clientY: number,
  ) => {
    pendingRef.current = { event, offsetY, startX: clientX, startY: clientY }
    isDraggingRef.current = false

    const onPointerMove = (e: PointerEvent) => {
      const pending = pendingRef.current
      if (!pending) return

      const cfg = configRef.current
      const gridContent = cfg.gridContentRef.current
      if (!gridContent) return

      // Check threshold before starting drag
      if (!isDraggingRef.current) {
        const dx = e.clientX - pending.startX
        const dy = e.clientY - pending.startY
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        isDraggingRef.current = true
        setDraggingEventId(pending.event.id)
      }

      const rect = gridContent.getBoundingClientRect()
      const pointerY = e.clientY - rect.top
      const pointerX = e.clientX - rect.left

      const { startHour, endHour, columnCount, dateKeys } = cfg

      // Convert pointer Y to minutes, snap to slot
      const rawMinutes = (pointerY - pending.offsetY) / MINUTE_HEIGHT + startHour * 60
      const snapped = Math.max(
        startHour * 60,
        Math.min(
          Math.round(rawMinutes / SLOT_MINUTES) * SLOT_MINUTES,
          endHour * 60 - pending.event.durationMinutes,
        ),
      )

      const ghostTop = (snapped - startHour * 60) * MINUTE_HEIGHT
      const ghostHeight = pending.event.durationMinutes * MINUTE_HEIGHT

      // Convert pointer X to column
      const targetColumn = Math.max(0, Math.min(
        Math.floor((pointerX / rect.width) * columnCount),
        columnCount - 1,
      ))

      const colPercent = 100 / columnCount

      const state: DragState = {
        event: pending.event,
        ghostTop,
        ghostHeight,
        ghostLeftPercent: targetColumn * colPercent,
        ghostWidthPercent: colPercent - 0.5,
        targetColumn,
        targetDateKey: dateKeys[targetColumn] || '',
        targetHour: Math.floor(snapped / 60),
        targetMinute: snapped % 60,
      }

      latestRef.current = state
      setDragState(state)
    }

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)

      const wasDragging = isDraggingRef.current
      const pending = pendingRef.current
      pendingRef.current = null
      isDraggingRef.current = false

      if (wasDragging) {
        const current = latestRef.current
        if (current) {
          configRef.current.onDrop({
            eventId: current.event.id,
            event: current.event,
            dateKey: current.targetDateKey,
            hour: current.targetHour,
            minute: current.targetMinute,
            column: current.targetColumn,
          })
        }
        latestRef.current = null
        setDragState(null)
        setDraggingEventId(null)
      } else if (pending) {
        // Click — not a drag
        configRef.current.onClick?.(pending.event.id)
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }, [])

  const cancelDrag = useCallback(() => {
    pendingRef.current = null
    isDraggingRef.current = false
    latestRef.current = null
    setDragState(null)
    setDraggingEventId(null)
  }, [])

  return {
    dragState,
    draggingEventId,
    initiateDrag,
    cancelDrag,
  }
}
