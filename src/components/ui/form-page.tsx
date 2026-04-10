import { ReactNode } from "react"
import { BackLink } from "@/components/ui/back-link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface FormPageProps {
  title: string
  backHref: string
  backLabel?: string
  children: ReactNode
  onSubmit?: () => void
  submitLabel?: string
  cancelHref?: string
  loading?: boolean
  submitDisabled?: boolean
}

export function FormPage({ title, backHref, backLabel = "Voltar", children, onSubmit, submitLabel = "Salvar", cancelHref, loading = false, submitDisabled = false }: FormPageProps) {
  return (
    <div className="p-4 lg:p-8">
      <BackLink href={backHref} label={backLabel} />
      <h1 className="text-xl font-bold tracking-tight text-foreground mb-6">{title}</h1>
      <Card className="p-6">
        <div className="space-y-4">{children}</div>
        {(onSubmit || cancelHref) && (
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            {cancelHref && <BackLink href={cancelHref} label="Cancelar" />}
            {onSubmit && (
              <Button onClick={onSubmit} disabled={loading || submitDisabled} className="bg-teal-600 hover:bg-teal-700 text-white">
                {loading ? "Salvando..." : submitLabel}
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
