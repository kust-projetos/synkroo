/**
 * BudgetsView — "Orçamentos" screen.
 * Two tabs (Despesas / Receitas - previsão). Seed only has expense budgets;
 * the preview tab shows the same list with the "previsão" label so the
 * structure mirrors the captured UI.
 */
'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatPercent,
  getBudgetUsage,
  type FinanceData,
} from '@/lib/pi-finance'

export interface BudgetsViewProps {
  data: FinanceData
  onBack: () => void
}

type Tab = 'despesas' | 'receitas'

export function BudgetsView({ data, onBack }: BudgetsViewProps) {
  const [tab, setTab] = useState<Tab>('despesas')
  const usages = getBudgetUsage(data)
  const totalAmount = usages.reduce((s, u) => s + u.amountCents, 0)
  const totalSpent = usages.reduce((s, u) => s + u.spentCents, 0)

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
        <h1 className="text-xl font-bold">Orçamentos</h1>
        <button type="button" className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled>
          Novo
        </button>
      </header>

      <div role="tablist" className="flex gap-2">
        {(['despesas', 'receitas'] as Tab[]).map((t) => (
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
            {t === 'despesas' ? 'Despesas' : 'Receitas (previsão)'}
          </button>
        ))}
      </div>

      {tab === 'despesas' && (
        <>
          <p className="text-xs text-slate-500">
            Você usou {formatCurrency(totalSpent)} de {formatCurrency(totalAmount)}
          </p>
          <ul className="space-y-3">
            {usages.map((u) => (
              <li key={u.budget.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{u.budget.name}</p>
                  <p className="text-sm font-semibold">{formatPercent(u.percentUsed / 100)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-2 rounded-full', u.percentUsed >= 80 ? 'bg-rose-500' : 'bg-slate-900')}
                    style={{ width: `${Math.min(100, u.percentUsed).toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {formatCurrency(u.spentCents)} gasto de {formatCurrency(u.amountCents)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
      {tab === 'receitas' && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Receitas previstas disponíveis em breve.
        </p>
      )}
    </div>
  )
}
