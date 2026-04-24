// Vertical lines — column dividers + weekend column shading at z-index 1

interface VerticalLinesProps {
  columnCount: number
  totalHeight: number
  weekendColumns?: number[]
}

export function VerticalLines({ columnCount, totalHeight, weekendColumns }: VerticalLinesProps) {
  const lines = []
  for (let i = 0; i <= columnCount; i++) {
    const isEdge = i === 0 || i === columnCount
    lines.push(
      <div
        key={`vline-${i}`}
        className={`absolute top-0 border-l ${isEdge ? 'border-border' : 'border-border'}`}
        style={{
          left: `${(i / columnCount) * 100}%`,
          height: totalHeight,
        }}
      />
    )
  }

  // Weekend column backgrounds
  const weekendOverlays = (weekendColumns || []).map((colIndex) => (
    <div
      key={`weekend-${colIndex}`}
      className="absolute top-0 bg-muted/30 dark:bg-muted/20 pointer-events-none"
      style={{
        left: `${(colIndex / columnCount) * 100}%`,
        width: `${100 / columnCount}%`,
        height: totalHeight,
      }}
    />
  ))

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      {weekendOverlays}
      {lines}
    </div>
  )
}
