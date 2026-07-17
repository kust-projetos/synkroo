/**
 * CardsView — "Cartões" screen.
 * One card per active credit-card account; shows current invoice,
 * percent of limit, and free limit for the current cycle.
 */
'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatPercent,
  getCardUsage,
  type FinanceData,
} from '@/lib/pi-finance'

export interface CardsViewProps {
  data: FinanceData
  onBack: () => void
}

const CYCLE = '2026-07'

export function CardsView({ data, onBack }: CardsViewProps) {
  const cards = getCardUsage(data, CYCLE)

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
        <h1 className="text-xl font-bold">Cartões</h1>
        <button type="button" className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled>
          Novo
        </button>
      </header>

      <ul className="space-y-3">
        {cards.map((u) => (
          <li key={u.card.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{u.card.name}</p>
                <p className="text-xs text-slate-500">
                  Fecha dia {u.card.closingDay ?? '-'} · vence dia {u.card.dueDay ?? '-'}
                </p>
              </div>
              <p className="text-right">
                <p className="text-xs uppercase tracking-wider text-slate-500">Fatura atual</p>
                <p className="text-xl font-bold">{formatCurrency(u.usedCents)}</p>
              </p>
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn('h-2 rounded-full', u.percentUsed >= 80 ? 'bg-rose-500' : 'bg-slate-900')}
                  style={{ width: `${Math.min(100, u.percentUsed).toFixed(1)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {formatPercent(u.percentUsed / 100)} de {formatCurrency(u.limitCents)}
              </p>
            </div>
            <p className="mt-2 text-xs font-semibold text-emerald-600">
              {formatCurrency(u.freeLimitCents)} livre
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
