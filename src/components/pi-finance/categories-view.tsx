/**
 * CategoriesView — "Categorias" screen.
 * Two sections (DESPESAS / RECEITAS) listing every active category. Per-row
 * "+ Sub / Editar / Desativar" actions are rendered as non-functional stubs
 * to mirror the captured copy; full CRUD is out of Slice C scope.
 */
'use client'

import { ChevronLeft } from 'lucide-react'
import {
  getCategories,
  type FinanceData,
} from '@/lib/pi-finance'

export interface CategoriesViewProps {
  data: FinanceData
  onBack: () => void
}

export function CategoriesView({ data, onBack }: CategoriesViewProps) {
  const expenses = getCategories(data, 'expense')
  const income = getCategories(data, 'income')
  const catInitials = (name: string) => (name[0] ?? '?').toUpperCase()

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
        <h1 className="text-xl font-bold">Categorias</h1>
        <button type="button" className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled>
          Nova
        </button>
      </header>

      <section aria-label="Despesas" className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Despesas</h2>
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
          {expenses.map((c) => (
            <CategoryRow key={c.id} initials={catInitials(c.name)} name={c.name} />
          ))}
        </ul>
      </section>

      <section aria-label="Receitas" className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receitas</h2>
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
          {income.map((c) => (
            <CategoryRow key={c.id} initials={catInitials(c.name)} name={c.name} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function CategoryRow({ initials, name }: { initials: string; name: string }) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold">
          {initials}
        </span>
        <p className="font-medium">{name}</p>
      </div>
      <div className="flex gap-3 text-xs text-slate-500">
        <button type="button" disabled>+ Sub</button>
        <button type="button" disabled>Editar</button>
        <button type="button" disabled>Desativar</button>
      </div>
    </li>
  )
}
