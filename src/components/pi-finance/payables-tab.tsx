/**
 * A pagar tab — summary totals + tabs (Todas / Vencidas / Proximas / Pagas)
 * + list. Marcar paga action calls onMarkPaid prop.
 */
'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDateLabel, getPayableSummary, type FinanceData, type Payable } from '@/lib/pi-finance'

export interface PayablesTabProps {
  data: FinanceData
  onMarkPaid: (payableId: string) => void
}

type Status = 'all' | 'overdue' | 'pending' | 'paid'

function classify(p: Payable, todayMs: number): Exclude<Status, 'all'> {
  if (p.status === 'paid') return 'paid'
  const dueMs = new Date(p.dueDate + 'T00:00:00Z').getTime()
  if (!Number.isFinite(dueMs)) return 'pending'
  return dueMs < todayMs ? 'overdue' : 'pending'
}

export function PayablesTab({ data, onMarkPaid }: PayablesTabProps) {
  const summary = getPayableSummary(data)
  const [tab, setTab] = useState<Status>('all')

  const todayMs = useMemo(() => new Date('2026-07-05T12:00:00Z').getTime(), [])

  const filtered = useMemo(() => {
    const sorted = [...data.payables].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    return sorted.filter((p) => {
      if (tab === 'all') return true
      return classify(p, todayMs) === tab
    })
  }, [data.payables, tab, todayMs])

  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories])
  const accMap = useMemo(() => new Map(data.accounts.map((a) => [a.id, a.name])), [data.accounts])

  const TABS: ReadonlyArray<{ id: Status; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: data.payables.length },
    { id: 'overdue', label: 'Vencidas', count: data.payables.filter((p) => classify(p, todayMs) === 'overdue').length },
    { id: 'pending', label: 'Proximas', count: data.payables.filter((p) => classify(p, todayMs) === 'pending').length },
    { id: 'paid', label: 'Pagas', count: data.payables.filter((p) => p.status === 'paid').length },
  ]

  return (
    <div className="space-y-4">
      <header className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={formatCurrency(summary.totalCents)} />
        <Stat label="Pago" value={formatCurrency(summary.paidCents)} />
        <Stat label="A pagar" value={formatCurrency(summary.pendingCents)} highlight />
      </header>

      <div role="tablist" aria-label="Status das contas" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs',
              tab === t.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
            )}
          >
            <span>{t.label.toUpperCase()}</span>
            <span className="rounded-full bg-white/20 px-1.5 text-[10px]">{t.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Nada por aqui neste filtro.
        </p>
      )}

      <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
        {filtered.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{p.description}</p>
              <p className="text-xs text-slate-500">
                {catMap.get(p.categoryId) ?? '-'} &middot; Vence {formatDateLabel(p.dueDate)}
              </p>
              <p className="text-xs text-slate-400">{accMap.get(p.accountId) ?? '-'}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="font-semibold">{formatCurrency(p.amountCents)}</p>
              {p.status === 'pending' && (
                <Button size="sm" variant="outline" onClick={() => onMarkPaid(p.id)}>
                  Marcar paga
                </Button>
              )}
              {p.status === 'paid' && (
                <span className="text-xs text-emerald-600">Paga</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-2xl bg-white p-3', highlight && 'ring-2 ring-slate-900')}>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  )
}
