import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("glass-card rounded-3xl p-10 text-center relative overflow-hidden", className)}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      {icon && (
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200/50 dark:border-teal-800/40 text-teal-600 dark:text-teal-400 shadow-md">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
      {description && <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && (
        <Button onClick={action.onClick} variant="glow" className="mt-5">
          {action.label}
        </Button>
      )}
    </div>
  )
}
