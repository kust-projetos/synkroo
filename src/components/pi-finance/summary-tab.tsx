/**
 * Resumo tab — hero saldo, receitas/despesas/resultado, contas, cartoes,
 * pagar, gastos por categoria, insights.
 *
 * Slice C additions: per-section "Ver tudo" links that drill into the
 * matching drilldown screen via the onNavigate callback.
 */
'use client'

import {
  formatCurrency,
  formatPercent,
  getBankAccounts,
  getCreditCards,
  getCreditSummary,
  getInsights,
  getPayableSummary,
  getSpendingByCategory,
  getSummary,
  type FinanceData,
} from '@/lib/pi-finance'

export interface SummaryTabProps {
  data: FinanceData
  onNavigate?: (target: 'contas' | 'cartoes' | 'pagar') => void
}

export function SummaryTab({ data, onNavigate }: SummaryTabProps) {
  const summary = getSummary(data)
  const credit = getCreditSummary(data)
  const payable = getPayableSummary(data)
  const groups = getSpendingByCategory(data)
  const insights = getInsights(data)
  const banks = getBankAccounts(data)
  const cards = getCreditCards(data)
  const savingsRate = summary.incomeCents > 0 ? summary.resultCents / summary.incomeCents : 0
  const totalExpense = groups.reduce((s, g) => s + g.amountCents, 0) || 1

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-sm uppercase tracking-wider text-slate-300">Saldo total &middot; contas</p>
        <p className="mt-2 text-4xl font-bold">{formatCurrency(summary.bankBalanceCents)}</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-300">Receitas</dt>
            <dd className="font-semibold">{formatCurrency(summary.incomeCents)}</dd>
          </div>
          <div>
            <dt className="text-slate-300">Despesas</dt>
            <dd className="font-semibold">{formatCurrency(summary.expenseCents)}</dd>
          </div>
          <div>
            <dt className="text-slate-300">Resultado</dt>
            <dd className="font-semibold">{formatCurrency(summary.resultCents)}</dd>
          </div>
        </dl>
      </header>

      <section aria-label="Contas" className="space-y-2">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">Minhas contas</h2>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('contas')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Ver tudo
            </button>
          )}
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

      <section aria-label="Cartoes" className="space-y-2">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">Cartoes de credito</h2>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('cartoes')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Ver tudo
            </button>
          )}
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card label="Fatura atual" value={formatCurrency(credit.currentInvoiceCents)} />
          <Card label="Limite total" value={formatCurrency(credit.totalLimitCents)} />
          <Card label="Limite livre" value={formatCurrency(credit.freeLimitCents)} />
        </div>
        <ul className="divide-y divide-slate-200 rounded-2xl bg-white">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-slate-500">
                  Limite {formatCurrency(c.creditLimitCents ?? 0)} &middot; Fecha dia {c.closingDay ?? '-'} &middot; Vence dia {c.dueDay ?? '-'}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(c.balanceCents)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Contas a pagar" className="space-y-2">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">Contas a pagar</h2>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('pagar')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Ver tudo
            </button>
          )}
        </header>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-2xl font-bold">{formatCurrency(payable.pendingCents)}</p>
          <p className="text-xs text-slate-500">{payable.pendingCount} pendente(s)</p>
        </div>
      </section>

      <section aria-label="Gastos por categoria" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500">Gastos por categoria</h2>
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className="font-semibold">{formatCurrency(summary.expenseCents)}</span>
          </div>
          <ul className="space-y-2">
            {groups.map((g) => {
              const pct = (g.amountCents / totalExpense) * 100
              return (
                <li key={g.topCategory}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{g.topCategory}</span>
                    <span className="font-semibold">{formatPercent(pct / 100)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatCurrency(g.amountCents)}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section aria-label="Insights" className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-500">Insights</h2>
        <ul className="space-y-2">
          {insights.length === 0 ? (
            <li className="rounded-2xl bg-white p-4 text-sm text-slate-500">
              Sem insights ainda — adicione transacoes para gerar.
            </li>
          ) : (
            insights.map((line, i) => (
              <li key={i} className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                {line}
              </li>
            ))
          )}
        </ul>
        {summary.incomeCents > 0 && (
          <p className="text-xs text-slate-500">
            Taxa de poupanca efetiva: {formatPercent(savingsRate)}.
          </p>
        )}
      </section>
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}
