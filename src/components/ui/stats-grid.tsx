import { cn } from "@/lib/utils"
import { StatCard } from "@/components/ui/stat-card"

interface StatItem {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; label?: string }
  invert?: boolean
}

interface StatsGridProps {
  stats: StatItem[]
  columns?: 2 | 3 | 4 | 5
  className?: string
}

export function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {stats.map((stat, i) => (
        <StatCard key={i} {...stat} />
      ))}
    </div>
  )
}
