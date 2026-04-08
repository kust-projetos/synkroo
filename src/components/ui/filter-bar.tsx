import { ReactNode } from "react"

interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return <div className={`flex items-center gap-3 flex-wrap ${className || ""}`}>{children}</div>
}
