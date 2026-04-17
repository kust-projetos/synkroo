// Vertical lines — column dividers at z-index 1

interface VerticalLinesProps {
  columnCount: number
  totalHeight: number
}

export function VerticalLines({ columnCount, totalHeight }: VerticalLinesProps) {
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

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      {lines}
    </div>
  )
}
