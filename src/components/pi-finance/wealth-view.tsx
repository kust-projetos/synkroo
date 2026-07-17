/**
 * WealthView — "Patrimônio" screen.
 * Shows the captured breakdown: líquido, contas, reservas/metas, faturas, dívidas.
 * Renders the bank and cards lists inline so the screen feels like the live app.
 */
'use client'

import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  formatPercent,
  getBankAccounts,
  getCardUsage,
  getWealth,
  type FinanceData,
} from '@/lib/pi-finance'

export interface WealthViewProps {
  data: FinanceData
  onBack: () => void
}

export function WealthView({ data, onBack }: WealthViewProps) {
  const w = getWealth(data)
  const banks = getBankAccounts(data)
  const cards = getCardUsage(data, '2026-07')

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
        <h1 className="text-xl font-bold">Patrimônio</h1>
      </header>

      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow">
        <p className="text-xs uppercase tracking-wider text-slate-300">Patrimônio líquido</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(w.netWorthCents)}</p>
      </section>

      <section className="space-y-2">
        <BreakdownRow label="Saldo em contas" cents={w.accountsCents} />
        <BreakdownRow label="Reservas / Metas" cents={w.goalsCents} />
        <BreakdownRow label="Faturas abertas" cents={-w.openInvoicesCents} />
        <BreakdownRow label="Dívidas" cents={-w.debtsCents} />
      </section>

      <section aria-label="Contas" className="space-y-2">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">Contas</h2>
          <button type="button" className="text-xs text-slate-400" disabled>Gerenciar</button>
        </header>
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
          {banks.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-slate-500">Conta</p>
              </div>
              <p className="font-semibold">{formatCurrency(a.balanceCents)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Cartões" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500">Cartões</h2>
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
          {cards.map((u) => (
            <li key={u.card.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{u.card.name}</p>
                <p className="text-xs text-slate-500">Vence dia {u.card.dueDay ?? '-'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(u.usedCents)}</p>
                <p className="text-xs text-slate-500">{formatCurrency(u.freeLimitCents)} livre</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function BreakdownRow({ label, cents }: { label: string; cents: number }) {
  const isNegative = cents < 0
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
      <p className="text-sm text-slate-700">{label}</p>
      <p className={cn('font-semibold', isNegative && 'text-rose-600')}>
        {formatCurrency(cents)}
      </p>
    </div>
  )
}
