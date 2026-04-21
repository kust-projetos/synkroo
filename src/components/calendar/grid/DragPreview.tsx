// DragPreview — ghost card rendered during drag at z-index 5

import type { DragState } from '../hooks/useDragEvent'

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

  const showTitle = ghostHeight >= 28
  const showProcedure = ghostHeight >= 48

  return (
    <div
      className="absolute pointer-events-none rounded-md shadow-lg border-2 border-teal-500 bg-teal-50/90 dark:bg-teal-950/70 p-1 overflow-hidden"
      style={{
        top: ghostTop,
        height: ghostHeight,
        left: `${ghostLeftPercent}%`,
        width: `${ghostWidthPercent}%`,
        zIndex: 5,
      }}
    >
      <span className="block font-semibold text-[10px] leading-tight text-teal-700 dark:text-teal-300">
        {String(targetHour).padStart(2, '0')}:{String(targetMinute).padStart(2, '0')}
      </span>
      {showTitle && (
        <span className="block font-medium text-[10px] leading-tight text-foreground">
          {event.title}
        </span>
      )}
      {showProcedure && (
        <span className="block opacity-70 text-[9px] leading-tight">
          {event.procedureName}
        </span>
      )}
    </div>
  )
}
