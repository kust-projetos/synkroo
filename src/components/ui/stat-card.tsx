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
      <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-5 shadow-lg shadow-teal-900/20 text-white transition-all duration-300 hover:scale-[1.01]", className)}>
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-teal-100/80 font-medium uppercase tracking-wider">{label}</p>
              <p className="text-3xl font-extrabold text-white tracking-tight mt-1 tabular-nums">{value}</p>
            </div>
            {icon && <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">{icon}</div>}
          </div>
          {trend && (
            <div className="mt-4 flex items-center gap-2">
              <span className="bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-full border border-white/20">
                {trend.value > 0 ? "+" : ""}{trend.value}%
              </span>
              {trend.label && <span className="text-xs text-teal-100/70">{trend.label}</span>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("group rounded-2xl bg-card border border-border/80 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-teal-500/30 hover:-translate-y-0.5 relative overflow-hidden", className)}>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">{value}</p>
        </div>
        {icon && (
          <div className="h-11 w-11 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/50 dark:border-teal-800/40 text-teal-600 dark:text-teal-400 flex items-center justify-center relative group-hover:scale-105 transition-transform">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "font-bold px-2 py-0.5 rounded-full text-[11px]",
              trend.value >= 0 
                ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/50" 
                : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200/50 dark:border-red-800/50"
            )}>
              {trend.value > 0 ? "+" : ""}{trend.value}%
            </span>
            {trend.label && <span className="text-muted-foreground text-[11px] truncate">{trend.label}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
