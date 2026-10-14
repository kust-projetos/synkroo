import Link from 'next/link'
import { AiQueueList } from '@/components/dashboard/ai-queue-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

/**
 * P8 Slice 2a — fila de exceções SOMENTE LEITURA (diagnóstico).
 *
 * Efeito-desconhecido-a-reconciliar primeiro, depois prazos, depois falhas
 * operacionais; terminais (DENY, failed_workflow/not_attributed,
 * stopped/expired) em filtro separado — nunca como pendentes.
 */
export default function ExceptionsPage() {
  return (
    <div className="space-y-6 p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
            Exceções da IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Falhas, reconciliações pendentes e terminais para diagnóstico. Somente leitura.
          </p>
        </div>
        <Link
          href="/dashboard/ai/approvals"
          className="text-xs font-bold text-teal-600 hover:underline dark:text-teal-400"
        >
          ← Voltar às aprovações
        </Link>
      </div>
      <Card className="glass-card">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold">Fila de exceções</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <AiQueueList view="exceptions" />
        </CardContent>
      </Card>
    </div>
  )
}
