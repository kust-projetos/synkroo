import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusType = "success" | "warning" | "error" | "info" | "teal" | "zinc"

const statusStyles: Record<StatusType, string> = {
  success: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  error: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  info: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800",
  zinc: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
}

interface StatusBadgeProps {
  status: StatusType
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export function StatusBadge({ status, children, className, dot = true }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-medium text-xs border px-2.5 py-0.5 rounded-md", statusStyles[status], className)}>
      {dot && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  )
}
