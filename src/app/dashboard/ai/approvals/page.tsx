import Link from 'next/link'
import { AiQueueList } from '@/components/dashboard/ai-queue-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckBadgeIcon } from '@heroicons/react/24/outline'

/**
 * P8 Slice 2a — Approval Inbox SOMENTE LEITURA.
 *
 * "Aguarda aprovação" (APPROVAL com proposta) e "aguarda confirmação"
 * (CONFIRM / ação pendente): terminais (DENY, suspended sem retomada,
 * stopped/expired, failed_workflow/not_attributed) vivem SÓ na página de
 * exceções, nunca aqui como pendentes.
 */
export default function ApprovalsPage() {
  return (
    <div className="space-y-6 p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <CheckBadgeIcon className="w-6 h-6 text-teal-500" />
            Aprovações da IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Itens que aguardam aprovação ou confirmação humana. Somente leitura.
          </p>
        </div>
        <Link
          href="/dashboard/ai/exceptions"
          className="text-xs font-bold text-teal-600 hover:underline dark:text-teal-400"
        >
          Ver fila de exceções →
        </Link>
      </div>
      <Card className="glass-card">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold">Inbox de aprovações</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <AiQueueList view="approvals" />
        </CardContent>
      </Card>
    </div>
  )
}
