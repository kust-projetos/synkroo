/**
 * Registros tab — group transactions by date (newest first), plus a
 * minimal filter drawer toggle that hides transactions of the unselected
 * kind. Logic-only filter — no server call.
 */
'use client'

import { useMemo, useState } from 'react'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateLabel, type FinanceData, type Transaction } from '@/lib/pi-finance'

export interface RecordsTabProps {
  data: FinanceData
}

type Filter = 'all' | 'income' | 'expense'

function dayKey(date: string): string {
  // ISO YYYY-MM-DD or full ISO; group by day string.
  return date.slice(0, 10)
}

function describeTx(t: Transaction, catName: string, accountName: string) {
  const sign = t.kind === 'income' ? '+' : '-'
  return {
    category: catName,
    account: accountName,
    amountText: `${sign}${formatCurrency(t.amountCents)}`,
    description: t.description,
  }
}

export function RecordsTab({ data }: RecordsTabProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [filterOpen, setFilterOpen] = useState(false)

  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories])
  const accMap = useMemo(() => new Map(data.accounts.map((a) => [a.id, a.name])), [data.accounts])

  const filtered = useMemo(
    () =>
      [...data.transactions]
        .filter((t) => filter === 'all' || t.kind === filter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.transactions, filter]
  )

  const groups = useMemo(() => {
    const out = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const k = dayKey(t.date)
      if (!out.has(k)) out.set(k, [])
      out.get(k)!.push(t)
    }
    return [...out.entries()]
  }, [filtered])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Registros</h1>
        <Button variant="outline" size="sm" onClick={() => setFilterOpen((s) => !s)}>
          <Filter className="mr-1 h-4 w-4" /> Filtro
        </Button>
      </header>

      {filterOpen && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium text-slate-500">Tipo</p>
          <div className="flex gap-2">
            {(['all', 'income', 'expense'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  filter === f ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                )}
              >
                {f === 'all' ? 'Todas' : f === 'income' ? 'Receitas' : 'Despesas'}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Nenhuma transacao encontrada.
        </p>
      )}

      <ul className="space-y-4">
        {groups.map(([day, items]) => (
          <li key={day}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {formatDateLabel(day)}
            </p>
            <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
              {items.map((t) => {
                const d = describeTx(t, catMap.get(t.categoryId) ?? '-', accMap.get(t.accountId) ?? '-')
                return (
                  <li key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium">{d.description}</p>
                      <p className="text-xs text-slate-500">
                        {d.category} &middot; {d.account}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'font-semibold',
                        t.kind === 'income' ? 'text-emerald-600' : 'text-slate-900'
                      )}
                    >
                      {d.amountText}
                    </p>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
