import { HOURS, formatTime } from '../../utils/date-utils'

interface TimeColumnProps {
  hours?: readonly number[]
}

export function TimeColumn({ hours = HOURS }: TimeColumnProps) {
  return (
    <div className="w-14 shrink-0 bg-muted border-r border-border">
      <div className="h-12 border-b border-border" />
      {hours.map((hour) => (
        <div
          key={hour}
          className="h-20 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border text-right flex items-start justify-end"
        >
          {formatTime(hour)}
        </div>
      ))}
    </div>
  )
}
