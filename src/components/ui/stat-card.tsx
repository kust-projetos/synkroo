import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: number; label?: string }
  className?: string
  invert?: boolean
}

export function StatCard({ label, value, icon, trend, className, invert }: StatCardProps) {
  if (invert) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 p-5", className)}>
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 20% 80%, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-white/70 font-medium">{label}</p>
              <p className="text-3xl font-extrabold text-white tracking-tight mt-1">{value}</p>
            </div>
            {icon && <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">{icon}</div>}
          </div>
          {trend && (
            <div className="mt-3 flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded">
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              {trend.label && <span className="text-xs text-white/60">{trend.label}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl bg-card shadow-sm overflow-hidden", className)}>
      <div className="h-[3px] bg-gradient-to-r from-teal-600 via-teal-500 to-teal-400" />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-br from-teal-600 to-teal-400" />
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          </div>
          {icon && (
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 flex items-center justify-center relative">
              {icon}
              {trend && trend.value > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center">
                  <span className="text-[6px] text-white font-bold">&#8593;</span>
                </div>
              )}
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex-1 bg-muted rounded h-1.5 overflow-hidden">
              <div className="h-full rounded bg-gradient-to-r from-teal-600 to-teal-400"
                style={{ width: `${Math.min(Math.abs(trend.value) * 3, 100)}%` }} />
            </div>
            <div className="flex items-center gap-1">
              <span className={cn("text-xs font-bold", trend.value >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400")}>
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              {trend.label && <span className="text-[10px] text-muted-foreground">{trend.label}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
