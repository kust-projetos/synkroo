// Horizontal lines — hour grid lines at z-index 0

import { HOUR_SIZE, SLOTS_PER_HOUR } from '../utils/date-utils'

interface HorizontalLinesProps {
  hours: number[]
  totalHeight: number
}

export function HorizontalLines({ hours, totalHeight }: HorizontalLinesProps) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      {/* Full hour lines */}
      {hours.map((hour, i) => (
        <div
          key={`hour-${hour}`}
          className="absolute left-0 right-0 border-t border-border"
          style={{ top: i * HOUR_SIZE }}
        />
      ))}

      {/* 15-minute sub-lines */}
      {hours.map((hour, hourIndex) =>
        Array.from({ length: SLOTS_PER_HOUR - 1 }, (_, slotIndex) => {
          const offset = hourIndex * HOUR_SIZE + (slotIndex + 1) * (HOUR_SIZE / SLOTS_PER_HOUR)
          return (
            <div
              key={`sub-${hour}-${slotIndex}`}
              className="absolute left-0 right-0 border-t border-dashed border-border/50"
              style={{ top: offset }}
            />
          )
        })
      )}

      {/* Bottom border */}
      <div
        className="absolute left-0 right-0 border-t border-border"
        style={{ top: totalHeight }}
      />
    </div>
  )
}
