import { HOURS, formatTime } from '../../utils/date-utils'

// HOUR_HEIGHT = SLOTS_PER_HOUR * SLOT_HEIGHT = 4 * 20 = 80px
const HOUR_HEIGHT = 80

interface TimeColumnProps {
  hours?: readonly number[]
}

export function TimeColumn({ hours = HOURS }: TimeColumnProps) {
  return (
    <div className="w-14 shrink-0 bg-muted border-r border-border">
      <div className="h-14 border-b border-border" />
      {hours.map((hour) => (
        <div
          key={hour}
          className="h-20 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border text-right flex items-start justify-end"
          style={{ height: `${HOUR_HEIGHT}px` }}
        >
          {formatTime(hour)}
        </div>
      ))}
    </div>
  )
}
