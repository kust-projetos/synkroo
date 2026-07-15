/**
 * SubscriptionsView — "Assinaturas" screen.
 * Seed has no subscriptions entity — renders the captured empty-state
 * ('Custo mensal recorrente R$ 0,00', '0 ativas', tabs Ativas/Canceladas,
 * 'Nenhuma assinatura ativa'). Implementing the empty state honestly is the
 * Slice C scope; full CRUD lands in a later slice.
 */
'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/pi-finance'
import type { FinanceData } from '@/lib/pi-finance'

export interface SubscriptionsViewProps {
  data: FinanceData
  onBack: () => void
}

type Tab = 'ativas' | 'canceladas'

export function SubscriptionsView({ data: _data, onBack }: SubscriptionsViewProps) {
  const [tab, setTab] = useState<Tab>('ativas')

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
        <h1 className="text-xl font-bold">Assinaturas</h1>
        <button type="button" className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled>
          Nova
        </button>
      </header>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-slate-500">Custo mensal recorrente</p>
        <p className="mt-1 text-2xl font-bold">{formatCurrency(0)}</p>
        <p className="text-xs text-slate-500">0 ativas</p>
      </section>

      <div role="tablist" className="flex gap-2">
        {(['ativas', 'canceladas'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs capitalize',
              tab === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
        Nenhuma assinatura ativa.
      </p>
    </div>
  )
}
