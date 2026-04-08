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
    <div className={cn("rounded-2xl bg-card shadow-sm p-8 text-center", className)}>
      {icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-foreground mb-1.5">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 shadow-md shadow-teal-600/20">
          {action.label}
        </Button>
      )}
    </div>
  )
}
