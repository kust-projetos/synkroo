import { ReactNode } from "react"
import { BackLink } from "@/components/ui/back-link"
import { StatusBadge } from "@/components/ui/status-badge"

interface DetailPageProps {
  title: string
  backHref: string
  backLabel?: string
  status?: { type: "success" | "warning" | "error" | "info" | "teal" | "zinc"; label: string }
  actions?: ReactNode
  children: ReactNode
}

export function DetailPage({ title, backHref, backLabel = "Voltar", status, actions, children }: DetailPageProps) {
  return (
    <div className="p-4 lg:p-8">
      <BackLink href={backHref} label={backLabel} />
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {status && <StatusBadge status={status.type}>{status.label}</StatusBadge>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  )
}
