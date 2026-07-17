/**
 * AccountsView — "Contas" screen.
 * Lists every active bank, its current balance, and its 3 latest transactions
 * (matching the captured live-app copy: "Saldo somado", "6 contas", and the
 * "ÚLTIMOS LANÇAMENTOS" list per account).
 */
'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatDateLabel,
  getAccountTransactions,
  getBankAccounts,
  type FinanceData,
} from '@/lib/pi-finance'

export interface AccountsViewProps {
  data: FinanceData
  onBack: () => void
}

export function AccountsView({ data, onBack }: AccountsViewProps) {
  const banks = getBankAccounts(data)
  const total = banks.reduce((s, a) => s + a.balanceCents, 0)
  const catMap = new Map(data.categories.map((c) => [c.id, c.name]))

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
        <h1 className="text-xl font-bold">Contas</h1>
        <button type="button" className="ml-auto rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" disabled>
          Nova
        </button>
      </header>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-slate-500">Saldo somado</p>
        <p className="mt-1 text-2xl font-bold">{formatCurrency(total)}</p>
        <p className="text-xs text-slate-500">{banks.length} contas</p>
      </section>

      <ul className="space-y-3">
        {banks.map((a) => {
          const initials = a.name
            .split(/\s+/)
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          const txns = getAccountTransactions(data, a.id, 3)
          return (
            <li key={a.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold">
                    {initials}
                  </span>
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-slate-500">Conta</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-semibold">{formatCurrency(a.balanceCents)}</p>
                  <div className="flex gap-3 text-xs text-slate-500">
                    <button type="button" disabled>Editar</button>
                    <button type="button" disabled>Desativar</button>
                  </div>
                </div>
              </div>
              {txns.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Últimos lançamentos</p>
                  <ul className="space-y-1.5">
                    {txns.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-xs">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{t.description}</span>
                          <span className="text-slate-400">{catMap.get(t.categoryId) ?? '-'} · {formatDateLabel(t.date)}</span>
                        </div>
                        <span className={cn('font-semibold', t.kind === 'income' ? 'text-emerald-600' : 'text-slate-900')}>
                          {t.kind === 'income' ? '+' : '−'}{formatCurrency(t.amountCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
