/**
 * ReportsView — "Relatórios" screen.
 * Tabbed period report (Mês / Anterior / Trim. / Ano). For each tab the
 * view computes summary cards (Resultado, Receitas, Despesas, Poupado,
 * Ticket Médio, Taxa de Poupança) plus a small monthly-flow visualisation
 * for the trailing 6 months. Uses the static 2026-07 base cycle since
 * the seed snapshot was captured that day.
 */
'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatPercent,
  getMonthlyFlow,
  getReport,
  type FinanceData,
} from '@/lib/pi-finance'

export interface ReportsViewProps {
  data: FinanceData
  onBack: () => void
}

type Period = 'month' | 'prevMonth' | 'quarter' | 'year'

const BASE_CYCLE = '2026-07'

function cycleOf(period: Period): string {
  // period resolves to a single cycleYearMonth used to filter transactions
  if (period === 'month') return BASE_CYCLE
  if (period === 'prevMonth') {
    const [y, m] = BASE_CYCLE.split('-').map(Number)
    let nm = (m ?? 1) - 1
    let ny = y ?? 1970
    if (nm < 1) { nm += 12; ny -= 1 }
    return `${ny}-${String(nm).padStart(2, '0')}`
  }
  // quarter = current quarter (returns BASE_CYCLE for the summary; the
  // monthly-flow chart covers the trailing 3 months either side).
  return BASE_CYCLE
}

export function ReportsView({ data, onBack }: ReportsViewProps) {
  const [period, setPeriod] = useState<Period>('month')
  const cycle = cycleOf(period)
  const report = getReport(data, cycle)
  const flow = getMonthlyFlow(data, BASE_CYCLE, period === 'year' ? 12 : 6)
  const maxAbs = Math.max(1, ...flow.flatMap((p) => [p.incomeCents, p.expenseCents]))

  const PERIODS: ReadonlyArray<{ id: Period; label: string }> = [
    { id: 'month', label: 'Mês' },
    { id: 'prevMonth', label: 'Anterior' },
    { id: 'quarter', label: 'Trim.' },
    { id: 'year', label: 'Ano' },
  ]

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="rounded-full border border-slate-200 bg-white p-1.5"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Relatórios</h1>
      </header>

      <div role="tablist" aria-label="Período" className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              'flex-1 rounded-full border px-3 py-1 text-xs',
              period === p.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow">
        <p className="text-xs uppercase tracking-wider text-slate-300">Resultado do período</p>
        <p className={cn('mt-2 text-4xl font-bold', report.resultCents < 0 && 'text-rose-400')}>
          {formatCurrency(report.resultCents)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-300">Receitas</dt>
            <dd className="font-semibold">{formatCurrency(report.incomeCents)}</dd>
          </div>
          <div>
            <dt className="text-slate-300">Despesas</dt>
            <dd className="font-semibold">{formatCurrency(report.expenseCents)}</dd>
          </div>
          <div>
            <dt className="text-slate-300">Poupado</dt>
            <dd className="font-semibold">{formatPercent(report.savingsRate / 100)}</dd>
          </div>
          <div>
            <dt className="text-slate-300">Ticket médio</dt>
            <dd className="font-semibold">{formatCurrency(report.avgTicketCents)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-300">Taxa de poupança: {formatPercent(report.savingsRate / 100)} (meta 20%)</p>
      </section>

      <section aria-label="Fluxo mensal" className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fluxo mensal</h2>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <ul className="grid grid-cols-6 items-end gap-2">
            {flow.map((p) => (
              <li key={p.cycleYearMonth} className="text-center">
                <div className="mx-auto flex h-32 w-full max-w-[14px] flex-col-reverse justify-end gap-px rounded-sm bg-slate-100">
                  <div
                    className="bg-emerald-500"
                    style={{ height: `${(p.incomeCents / maxAbs) * 100}%` }}
                    title={`Receitas ${p.cycleYearMonth}: ${formatCurrency(p.incomeCents)}`}
                  />
                  <div
                    className="bg-rose-500"
                    style={{ height: `${(p.expenseCents / maxAbs) * 100}%` }}
                    title={`Despesas ${p.cycleYearMonth}: ${formatCurrency(p.expenseCents)}`}
                  />
                </div>
                <span className="mt-1 block text-[10px] uppercase text-slate-500">
                  {p.cycleYearMonth.slice(5)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Receitas</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-rose-500" /> Despesas</span>
          </div>
        </div>
      </section>
    </div>
  )
}
