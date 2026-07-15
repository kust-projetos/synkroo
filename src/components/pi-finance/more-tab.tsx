/**
 * MoreTab — list-of-entries + per-entry detail view router.
 * Slice C: no more "Detalhes serao preenchidos" placeholder — each entry
 * routes to a fully-implemented real screen.
 */
'use client'

import { ChevronRight } from 'lucide-react'
import type { FinanceData } from '@/lib/pi-finance'
import { WealthView } from './wealth-view'
import { AccountsView } from './accounts-view'
import { CardsView } from './cards-view'
import { SubscriptionsView } from './subscriptions-view'
import { BudgetsView } from './budgets-view'
import { GoalsView } from './goals-view'
import { CategoriesView } from './categories-view'
import { ReportsView } from './reports-view'

export type MoreViewId =
  | 'patrimonio'
  | 'contas'
  | 'cartoes'
  | 'assinaturas'
  | 'orcamentos'
  | 'metas'
  | 'categorias'
  | 'relatorios'

export interface MoreTabProps {
  data: FinanceData
  view: MoreViewId | null
  onSelect: (view: MoreViewId) => void
  onBack: () => void
}

export function MoreTab({ data, view, onSelect, onBack }: MoreTabProps) {
  if (view !== null) {
    return renderDetail(view, data, onBack)
  }
  return <MoreList onSelect={onSelect} />
}

const ENTRIES: ReadonlyArray<{ id: MoreViewId; label: string; hint: string }> = [
  { id: 'patrimonio', label: 'Patrimônio', hint: 'Visão consolidada de ativos' },
  { id: 'contas', label: 'Contas', hint: 'Contas bancárias e carteira' },
  { id: 'cartoes', label: 'Cartões', hint: 'Cartões de crédito e faturas' },
  { id: 'assinaturas', label: 'Assinaturas', hint: 'Recorrências mensais' },
  { id: 'orcamentos', label: 'Orçamentos', hint: 'Limites por categoria' },
  { id: 'metas', label: 'Metas & Dívidas', hint: 'Objetivos e passivos' },
  { id: 'categorias', label: 'Categorias', hint: 'Lista de categorias' },
  { id: 'relatorios', label: 'Relatórios', hint: 'Exportações e gráficos' },
]

function MoreList({ onSelect }: { onSelect: (view: MoreViewId) => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mais</h1>
      <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
        {ENTRIES.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
            >
              <div>
                <p className="font-medium">{e.label}</p>
                <p className="text-xs text-slate-500">{e.hint}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function renderDetail(view: MoreViewId, data: FinanceData, onBack: () => void) {
  switch (view) {
    case 'patrimonio': return <WealthView data={data} onBack={onBack} />
    case 'contas':     return <AccountsView data={data} onBack={onBack} />
    case 'cartoes':    return <CardsView data={data} onBack={onBack} />
    case 'assinaturas':return <SubscriptionsView data={data} onBack={onBack} />
    case 'orcamentos': return <BudgetsView data={data} onBack={onBack} />
    case 'metas':      return <GoalsView data={data} onBack={onBack} />
    case 'categorias': return <CategoriesView data={data} onBack={onBack} />
    case 'relatorios': return <ReportsView data={data} onBack={onBack} />
  }
}
