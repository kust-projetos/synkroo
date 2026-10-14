'use client'

import { ArrowPathIcon, CpuChipIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useIaActivity } from '@/lib/hooks/use-queries'
import { journeyStateLabel, runStatusLabel } from '@/lib/dashboard/ia-activity'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/**
 * R12: contadores separados por entidade/status — nunca somar entidades
 * distintas como "eventos". Cada segmento usa o substantivo da entidade +
 * rótulo pt-BR + literal do banco (ex.: "1 run em observação (queued)").
 * Runs e goals compartilham o vocabulário P4 OBSERVE (`runStatusLabel`);
 * journeys usam `journeyStateLabel` (P7 S1).
 */
function summarizeEntityCounts(
  counts: Record<string, number>,
  singular: string,
  plural: string,
  labelFn: (status: string) => string,
): string | null {
  const entries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  if (entries.length === 0) return null
  return entries
    .map(([status, n]) => `${n} ${n === 1 ? singular : plural} ${labelFn(status)} (${status})`)
    .join(', ')
}

/**
 * P8 Slice 1 — painel aditivo read-only de atividade IA real
 * (runs/goals P4 + journeys/outcomes P7).
 *
 * Estados: loading (skeleton) / erro (com retry) / vazio (texto herdado do
 * placeholder anterior) / sucesso (contadores + "Atualizações recentes").
 * Nunca dispara mutação: só consome `useIaActivity` (GET).
 */
export function IaActivityPanel() {
  const { data, isLoading, error, refetch } = useIaActivity()

  if (isLoading) {
    return (
      <div className="space-y-2" aria-label="Carregando atividade da IA" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/50" />
        ))}
        <p className="text-xs text-muted-foreground">Carregando atividade da IA…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
          <ExclamationTriangleIcon className="h-4 w-4" />
          Não foi possível carregar a atividade da IA.
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

  if (!data || data.recent.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
        Nenhuma atividade real disponível.
      </div>
    )
  }

  const summaries = [
    summarizeEntityCounts(data.counts.runs, 'run', 'runs', runStatusLabel),
    summarizeEntityCounts(data.counts.goals, 'meta', 'metas', runStatusLabel),
    summarizeEntityCounts(data.counts.journeys, 'jornada', 'jornadas', journeyStateLabel),
  ].filter((s): s is string => s !== null)

  return (
    <div className="space-y-3">
      {summaries.length > 0 ? (
        <p className="text-xs text-muted-foreground">{summaries.join(' · ')}</p>
      ) : null}
      <h3 className="text-sm font-bold text-foreground">Atualizações recentes</h3>
      <ul className="space-y-2">
        {data.recent.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-sm"
          >
            <CpuChipIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{item.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1 font-mono">{item.status}</span>
                {item.eventType ? ` · ${item.eventType}` : ''}
                {item.detail ? ` · ${item.detail}` : ''}
                {` · ${formatWhen(item.createdAt)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
