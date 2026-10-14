'use client'

import { useState } from 'react'
import {
  ArrowPathIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useAiQueue } from '@/lib/hooks/use-queries'
import {
  AI_QUEUE_APPROVAL_FILTERS,
  AI_QUEUE_EXCEPTION_FILTERS,
  aiQueueSourceLabel,
  type AiQueueItem,
  type AiQueueView,
} from '@/lib/dashboard/ai-queue'

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const FILTER_LABELS: Record<string, string> = {
  all: 'Todas',
  approval: 'Aprovação',
  confirm: 'Confirmação',
  reconcile: 'Reconciliar',
  failed: 'Falhas',
  terminal: 'Terminais',
}

function QueueItemRow({ item }: { item: AiQueueItem }) {
  const due = formatWhen(item.dueAt)
  const created = formatWhen(item.createdAt)
  return (
    <li className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm">
      {item.bucket === 'terminal' ? (
        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <CpuChipIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{item.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1 font-mono">{item.state}</span>
          {` · ${aiQueueSourceLabel(item.source)}`}
          {item.reason ? ` · ${item.reason}` : ''}
          {item.actionRef ? ` · ${item.actionRef}` : ''}
          {created ? ` · ${created}` : ''}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {item.eventRef ? <span className="rounded bg-muted px-1 font-mono">{item.eventRef}</span> : null}
          {item.policyVersion ? <span>política {item.policyVersion}</span> : null}
          {due ? (
            <span className={item.overdue ? 'font-bold text-amber-600 dark:text-amber-400' : ''}>
              <ClockIcon className="mr-0.5 inline h-3 w-3" />
              prazo {due}
              {item.overdue ? ' (vencido/próximo)' : ''}
            </span>
          ) : null}
        </p>
      </div>
    </li>
  )
}

/**
 * P8 Slice 2a — lista read-only da fila (`approvals` ou `exceptions`).
 *
 * Estados: loading (skeleton) / erro (com retry) / vazio / lista paginada.
 * Nenhum botão decide, aprova ou executa: a decisão e a execução ficam para
 * outro slice (nota explícita abaixo da lista).
 */
export function AiQueueList({ view }: { view: AiQueueView }) {
  const filters = view === 'approvals' ? AI_QUEUE_APPROVAL_FILTERS : AI_QUEUE_EXCEPTION_FILTERS
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useAiQueue(view, { filter, page })

  const pickFilter = (f: string) => {
    setFilter(f)
    setPage(1)
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-label="Carregando fila" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
        ))}
        <p className="text-xs text-muted-foreground">Carregando fila…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
          <ExclamationTriangleIcon className="h-4 w-4" />
          Não foi possível carregar a fila.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline dark:text-teal-400"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const hasMore = data?.hasMore ?? false

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtros da fila">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => pickFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              filter === f
                ? 'bg-teal-600 text-white dark:bg-teal-500'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {FILTER_LABELS[f] ?? f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
          {view === 'approvals'
            ? 'Nenhum item aguardando aprovação ou confirmação.'
            : 'Nenhuma exceção registrada neste filtro.'}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {total} {total === 1 ? 'item' : 'itens'} · página {data?.page ?? page}
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <QueueItemRow key={item.key} item={item} />
            ))}
          </ul>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-teal-600 disabled:opacity-40 dark:text-teal-400"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-teal-600 disabled:opacity-40 dark:text-teal-400"
            >
              Próxima
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Somente leitura: aprovar, confirmar ou executar ficam para outro slice — nada aqui decide ou executa.
      </p>
    </div>
  )
}
