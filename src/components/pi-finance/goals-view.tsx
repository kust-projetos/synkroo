/**
 * GoalsView — "Metas & Dívidas" screen.
 * Tabs Metas / Dívidas. The seed has 4 active goals (savings/purchase/savings/emergency)
 * and zero debt goals; the Dívidas tab renders an honest empty state.
 */
'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatPercent,
  getGoalsWithProgress,
  type FinanceData,
  type GoalType,
} from '@/lib/pi-finance'

export interface GoalsViewProps {
  data: FinanceData
  onBack: () => void
}

type Tab = 'metas' | 'dividas'

const GOAL_LABEL: Record<GoalType, string> = {
  savings: 'Poupança',
  purchase: 'Compra planejada',
  emergency_fund: 'Reserva de emergência',
  debt_payoff: 'Dívida',
}

export function GoalsView({ data, onBack }: GoalsViewProps) {
  const [tab, setTab] = useState<Tab>('metas')
  const goals = getGoalsWithProgress(data)

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
        <h1 className="text-xl font-bold">Metas &amp; Dívidas</h1>
        <button type="button" className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled>
          Nova
        </button>
      </header>

      <div role="tablist" className="flex gap-2">
        {(['metas', 'dividas'] as Tab[]).map((t) => (
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
            {t === 'metas' ? 'Metas' : 'Dívidas'}
          </button>
        ))}
      </div>

      {tab === 'metas' && (
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-xs text-slate-500">{GOAL_LABEL[g.goalType]}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatPercent(g.percentUsed / 100)}</p>
                  <p className="text-xs text-slate-500">{formatPercent(g.percentUsed / 100)} concluído</p>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(100, g.percentUsed).toFixed(1)}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatCurrency(g.currentAmountCents)} de {formatCurrency(g.targetAmountCents)}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs" disabled>
                  Adicionar
                </button>
                <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-600" disabled>
                  Cancelar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === 'dividas' && (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">
          Nenhuma dívida cadastrada. Adicione uma meta do tipo &apos;Dívida&apos; para começar.
        </p>
      )}
    </div>
  )
}
