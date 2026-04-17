// EventTooltip — Radix tooltip showing event details on hover

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatTime } from '../utils/date-utils'
import { statusLabels, statusDotColors } from './event-styles'
import type { CalendarEvent } from '../utils/types'
import type { AppointmentStatus } from '@/lib/supabase/database.types'

interface EventTooltipProps {
  event: CalendarEvent
  children: React.ReactNode
}

export function EventTooltip({ event, children }: EventTooltipProps) {
  const statusKey = event.status as string

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1.5">
            <div className="font-semibold text-sm">{event.title}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
              <span className="text-muted-foreground/50">|</span>
              <span>{event.durationMinutes}min</span>
            </div>
            <div className="text-xs">{event.procedureName}</div>
            {event.dentistName && (
              <div className="text-xs text-muted-foreground">
                Dr(a). {event.dentistName}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${statusDotColors[statusKey] || 'bg-gray-400'}`} />
              <span>{statusLabels[statusKey] || statusKey}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
