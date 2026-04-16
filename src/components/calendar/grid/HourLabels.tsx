// Hour labels — left column showing time markers (08:00, 09:00, ...)

import { HOUR_SIZE, formatHourLabel } from '../utils/date-utils'

interface HourLabelsProps {
  hours: number[]
}

export function HourLabels({ hours }: HourLabelsProps) {
  return (
    <div className="w-16 flex-shrink-0 relative" style={{ height: hours.length * HOUR_SIZE }}>
      {hours.map((hour, i) => (
        <div
          key={hour}
          className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground select-none"
          style={{ top: i * HOUR_SIZE }}
        >
          {formatHourLabel(hour)}
        </div>
      ))}
    </div>
  )
}
