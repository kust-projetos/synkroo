// TimeGrid — core CSS Grid container with stacked layers + drag & drop
//
// z-index 0: HorizontalLines (hour grid)
// z-index 1: VerticalLines (column dividers)
// z-index 2: EmptySlots (click-to-create)
// z-index 3: EventLayer (positioned events)
// z-index 5: DragPreview (ghost during drag)

import { forwardRef, useRef } from 'react'
import { useCalendarStore } from '../store/calendar-store'
import { getHoursRange, HOUR_SIZE } from '../utils/date-utils'
import { HourLabels } from './HourLabels'
import { HorizontalLines } from './HorizontalLines'
import { VerticalLines } from './VerticalLines'
import { DragPreview } from './DragPreview'
import { useDragEvent, CalendarDragContext } from '../hooks/useDragEvent'
import type { DragDropResult } from '../hooks/useDragEvent'

interface TimeGridProps {
  /** Number of columns (1 for day, 7 for week, N for professionals) */
  columnCount: number
  /** Column headers rendered above the grid */
  columnHeaders?: React.ReactNode
  /** Content for the event layer (z-index 3) */
  eventContent: React.ReactNode
  /** Content for the empty slots layer (z-index 2) */
  slotsContent: React.ReactNode
  /** Current time indicator */
  nowIndicator?: React.ReactNode
  /** Date keys for each column (YYYY-MM-DD) */
  dateKeys?: string[]
  /** Drag drop callback */
  onEventDrop?: (result: DragDropResult) => void
  /** Event click callback (when drag hook manages clicks) */
  onEventClick?: (eventId: string) => void
}

export const TimeGrid = forwardRef<HTMLDivElement, TimeGridProps>(
  ({ columnCount, columnHeaders, eventContent, slotsContent, nowIndicator, dateKeys, onEventDrop, onEventClick }, ref) => {
    const startHour = useCalendarStore((s) => s.startHour)
    const endHour = useCalendarStore((s) => s.endHour)
    const hours = getHoursRange(startHour, endHour)
    const totalHeight = hours.length * HOUR_SIZE

    // Ref to the main grid content area (for drag coordinate computation)
    const gridContentRef = useRef<HTMLDivElement>(null)

    const { dragState, draggingEventId, initiateDrag } = useDragEvent({
      startHour,
      endHour,
      columnCount,
      dateKeys: dateKeys || [''],
      gridContentRef,
      onDrop: onEventDrop || (() => {}),
      onClick: onEventClick,
    })

    const handleDragStart = (_e: React.PointerEvent, event: any, offsetY: number) => {
      initiateDrag(event, offsetY, _e.clientX, _e.clientY)
    }

    // Context value for EventLayer → EventCard
    const dragContextValue = {
      onDragStart: handleDragStart,
      gridContentRef: gridContentRef as React.RefObject<HTMLDivElement | null>,
      draggingEventId,
    }

    return (
      <CalendarDragContext.Provider value={dragContextValue}>
        <div className="flex flex-col flex-1 min-h-0">
          {/* Column headers */}
          {columnHeaders && (
            <div className="flex border-b border-border bg-background sticky top-0 z-10">
              <div className="w-16 flex-shrink-0 border-r border-border" />
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${columnCount}, 1fr)` }}>
                {columnHeaders}
              </div>
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex flex-1 min-h-0 overflow-y-auto" ref={ref}>
            {/* Hour labels */}
            <div className="sticky left-0 z-10 bg-background border-r border-border">
              <HourLabels hours={hours} />
            </div>

            {/* Main grid area */}
            <div
              ref={gridContentRef}
              className="flex-1 relative"
              style={{
                height: totalHeight,
                '--hour-size': `${HOUR_SIZE}px`,
                '--one-minute-height': `${HOUR_SIZE / 60}px`,
              } as React.CSSProperties}
            >
              {/* Layer 0: Horizontal lines */}
              <HorizontalLines hours={hours} totalHeight={totalHeight} />

              {/* Layer 1: Vertical lines */}
              <VerticalLines columnCount={columnCount} totalHeight={totalHeight} />

              {/* Layer 2: Empty slots (click-to-create) */}
              <div className="absolute inset-0" style={{ zIndex: 2 }}>
                {slotsContent}
              </div>

              {/* Layer 3: Events */}
              <div className="absolute inset-0" style={{ zIndex: 3 }}>
                {eventContent}
              </div>

              {/* Layer 5: Drag preview ghost */}
              {dragState && <DragPreview dragState={dragState} />}

              {/* Now indicator (current time red line) */}
              {nowIndicator}
            </div>
          </div>
        </div>
      </CalendarDragContext.Provider>
    )
  }
)

TimeGrid.displayName = 'TimeGrid'
