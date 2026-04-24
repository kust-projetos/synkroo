// Hour labels — left column showing time markers with 15-min sub-labels

import { HOUR_SIZE, formatHourLabel } from '../utils/date-utils'

interface HourLabelsProps {
  hours: number[]
}

const QUARTER_MINUTES = [15, 30, 45]
const QUARTER_OFFSET = HOUR_SIZE / 4 // 25px per 15-min slot

export function HourLabels({ hours }: HourLabelsProps) {
  return (
    <div className="w-[68px] flex-shrink-0 relative" style={{ height: hours.length * HOUR_SIZE }}>
      {hours.map((hour, i) => {
        const baseTop = i * HOUR_SIZE
        return (
          <div key={hour}>
            {/* Full hour label */}
            <div
              className="absolute right-3 -translate-y-1/2 text-[11px] font-medium text-muted-foreground select-none tabular-nums"
              style={{ top: baseTop }}
            >
              {formatHourLabel(hour)}
            </div>
            {/* Quarter-hour sub-labels */}
            {QUARTER_MINUTES.map((min, mi) => (
              <div
                key={min}
                className="absolute right-3 -translate-y-1/2 text-[9px] text-muted-foreground/70 select-none tabular-nums"
                style={{ top: baseTop + (mi + 1) * QUARTER_OFFSET }}
              >
                {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
