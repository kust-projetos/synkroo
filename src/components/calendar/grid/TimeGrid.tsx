// TimeGrid — core CSS Grid container with 4 stacked layers (Cal.com architecture)
//
// z-index 0: HorizontalLines (hour grid)
// z-index 1: VerticalLines (column dividers)
// z-index 2: EmptySlots (click-to-create)
// z-index 3: EventLayer (positioned events)

import { forwardRef } from 'react'
import { useCalendarStore } from '../store/calendar-store'
import { getHoursRange, HOUR_SIZE } from '../utils/date-utils'
import { HourLabels } from './HourLabels'
import { HorizontalLines } from './HorizontalLines'
import { VerticalLines } from './VerticalLines'

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
}

export const TimeGrid = forwardRef<HTMLDivElement, TimeGridProps>(
  ({ columnCount, columnHeaders, eventContent, slotsContent, nowIndicator }, ref) => {
    const startHour = useCalendarStore((s) => s.startHour)
    const endHour = useCalendarStore((s) => s.endHour)
    const hours = getHoursRange(startHour, endHour)
    const totalHeight = hours.length * HOUR_SIZE

    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Column headers */}
        {columnHeaders && (
          <div className="flex border-b border-border bg-background sticky top-0 z-10">
            {/* Space for hour labels */}
            <div className="w-16 flex-shrink-0 border-r border-border" />
            {/* Column headers */}
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
            className="flex-1 relative"
            style={{
              height: totalHeight,
              // CSS variables for minute-based positioning
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

            {/* Now indicator (current time red line) */}
            {nowIndicator}
          </div>
        </div>
      </div>
    )
  }
)

TimeGrid.displayName = 'TimeGrid'
