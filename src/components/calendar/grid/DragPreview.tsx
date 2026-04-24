// DragPreview — ghost card rendered during drag at z-index 5

import type { DragState } from '../hooks/useDragEvent'
import { dragPreviewStatusStyles } from '../events/event-styles'
import { cn } from '@/lib/utils'

interface DragPreviewProps {
  dragState: DragState
}

export function DragPreview({ dragState }: DragPreviewProps) {
  const {
    event,
    ghostTop,
    ghostHeight,
    ghostLeftPercent,
    ghostWidthPercent,
    targetHour,
    targetMinute,
  } = dragState

  const showTitle = ghostHeight >= 30
  const showProcedure = ghostHeight >= 48
  const statusStyle = dragPreviewStatusStyles[event.status] || dragPreviewStatusStyles.scheduled

  return (
    <div
      className={cn(
        'absolute pointer-events-none rounded-md shadow-lg border-2 p-1 overflow-hidden',
        statusStyle,
      )}
      style={{
        top: ghostTop,
        height: ghostHeight,
        left: `${ghostLeftPercent}%`,
        width: `${ghostWidthPercent}%`,
        zIndex: 5,
      }}
    >
      <span className="block font-semibold text-[12px] leading-tight">
        {String(targetHour).padStart(2, '0')}:{String(targetMinute).padStart(2, '0')}
      </span>
      {showTitle && (
        <span className="block font-medium text-[12px] leading-tight text-foreground">
          {event.title}
        </span>
      )}
      {showProcedure && (
        <span className="block opacity-70 text-[11px] leading-tight">
          {event.procedureName}
        </span>
      )}
    </div>
  )
}
