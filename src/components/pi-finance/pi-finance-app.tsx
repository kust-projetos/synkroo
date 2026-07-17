/**
 * Client root — registration gate, hydration, state, write-through storage.
 *
 * Slice C additions:
 *   - moreView state for the in-memory drilldown within the Mais tab
 *   - summary "Ver tudo" buttons call onNavigate(view) which switches to
 *     the Mais tab and renders the matching subview
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  PI_FINANCE_TOKEN,
  addTransaction,
  createInitialSnapshot,
  initialFinanceData,
  localStorageAdapter,
  markPayablePaid,
  safeReadSnapshot,
  safeReadToken,
  safeWriteSnapshot,
  safeWriteToken,
  type FinanceData,
} from '@/lib/pi-finance'

import { FinanceShell } from './finance-shell'
import { SummaryTab } from './summary-tab'
import { RecordsTab } from './records-tab'
import { PayablesTab } from './payables-tab'
import { MoreTab, type MoreViewId } from './more-tab'
import {
  QuickActionDialog,
  type QuickActionSubmit,
} from './quick-action-dialog'
import type { PiTab } from './bottom-nav'

type Phase = 'loading' | 'gate' | 'ready'

function readLocationState() {
  if (typeof window === 'undefined') {
    return { tab: 'resumo' as PiTab, moreView: null as MoreViewId | null }
  }

  const params = new URLSearchParams(window.location.search)
  const tabParam = params.get('tab')
  const viewParam = params.get('view')
  const tab: PiTab =
    tabParam === 'registros' || tabParam === 'pagar' || tabParam === 'mais'
      ? tabParam
      : 'resumo'
  const moreView: MoreViewId | null =
    tab === 'mais' &&
    (viewParam === 'patrimonio' ||
      viewParam === 'contas' ||
      viewParam === 'cartoes' ||
      viewParam === 'assinaturas' ||
      viewParam === 'orcamentos' ||
      viewParam === 'metas' ||
      viewParam === 'categorias' ||
      viewParam === 'relatorios')
      ? viewParam
      : null

  return { tab, moreView }
}

function writeLocationState(tab: PiTab, moreView: MoreViewId | null) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('tab')
  url.searchParams.delete('view')

  if (tab !== 'resumo') {
    url.searchParams.set('tab', tab)
  }
  if (tab === 'mais' && moreView) {
    url.searchParams.set('view', moreView)
  }

  window.history.pushState({ tab, moreView }, '', `${url.pathname}${url.search}${url.hash}`)
}

export function PiFinanceApp() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [data, setData] = useState<FinanceData>(initialFinanceData)
  const [tab, setTab] = useState<PiTab>('resumo')
  const [moreView, setMoreView] = useState<MoreViewId | null>(null)
  const [actionOpen, setActionOpen] = useState(false)

  useEffect(() => {
    const nextLocation = readLocationState()
    setTab(nextLocation.tab)
    setMoreView(nextLocation.moreView)

    const syncFromLocation = () => {
      const next = readLocationState()
      setTab(next.tab)
      setMoreView(next.moreView)
    }

    window.addEventListener('popstate', syncFromLocation)

    const storage = localStorageAdapter()
    if (!storage) {
      setPhase('gate')
      return () => window.removeEventListener('popstate', syncFromLocation)
    }
    const token = safeReadToken(storage)
    const snap = safeReadSnapshot(storage)
    if (token && snap) {
      setData(snap.data)
      setPhase('ready')
    } else {
      setPhase('gate')
    }

    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [])

  function handleRegister() {
    const storage = localStorageAdapter()
    if (!storage) return
    const snap = createInitialSnapshot()
    safeWriteToken(storage, PI_FINANCE_TOKEN)
    safeWriteSnapshot(storage, snap)
    setData(snap.data)
    setPhase('ready')
  }

  function persistSnapshot(next: FinanceData) {
    const storage = localStorageAdapter()
    if (!storage) return
    const prev = safeReadSnapshot(storage)
    safeWriteSnapshot(storage, {
      version: 1,
      token: PI_FINANCE_TOKEN,
      syncedAt: prev?.syncedAt ?? {
        accounts: new Date().toISOString(),
        categories: new Date().toISOString(),
        transactions: new Date().toISOString(),
        payables: new Date().toISOString(),
        budgets: new Date().toISOString(),
        goals: new Date().toISOString(),
        cardStatements: new Date().toISOString(),
      },
      data: next,
    })
  }

  function handleAddTransaction(input: QuickActionSubmit) {
    const next = addTransaction(data, {
      kind: input.kind,
      description: input.description,
      amountCents: input.amountCents,
      date: input.date,
      accountId: input.accountId,
      categoryId: input.categoryId,
    })
    setData(next)
    persistSnapshot(next)
    setActionOpen(false)
  }

  function handleMarkPaid(payableId: string) {
    const today = new Date().toISOString().slice(0, 10)
    const next = markPayablePaid(data, payableId, today)
    setData(next)
    persistSnapshot(next)
  }

  const handleSelectTab = useCallback((next: PiTab) => {
    setTab(next)
    if (next !== 'mais') {
      setMoreView(null)
      writeLocationState(next, null)
      return
    }
    setMoreView(null)
    writeLocationState('mais', null)
  }, [])

  const handleNavigate = useCallback((target: string) => {
    if (target === 'pagar') {
      setTab('pagar')
      setMoreView(null)
      writeLocationState('pagar', null)
      return
    }

    const nextView = target as MoreViewId
    setTab('mais')
    setMoreView(nextView)
    writeLocationState('mais', nextView)
  }, [])

  const handleMoreSelect = useCallback((next: MoreViewId) => {
    setTab('mais')
    setMoreView(next)
    writeLocationState('mais', next)
  }, [])

  const handleMoreBack = useCallback(() => {
    setTab('mais')
    setMoreView(null)
    writeLocationState('mais', null)
  }, [])

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-2xl items-center justify-center px-4 text-sm text-slate-500">
        Carregando Pi Financeiro...
      </main>
    )
  }

  if (phase === 'gate') {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="rounded-2xl bg-slate-900 px-6 py-3 text-white shadow">
          <span className="font-semibold">Pi Financeiro</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">Registre seu dispositivo.</h1>
          <p className="mt-2 text-sm text-slate-500">
            Um identificador único será salvo neste navegador para sincronizar
            suas finanças localmente. Nada sai do seu dispositivo.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRegister}
          className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-slate-800"
        >
          Registrar
        </button>
        <p className="text-xs text-slate-400">
          Token: <code className="font-mono">{PI_FINANCE_TOKEN.slice(0, 8)}...</code>
        </p>
      </main>
    )
  }

  return (
    <>
      <FinanceShell tab={tab} onTabChange={handleSelectTab} onAction={() => setActionOpen(true)}>
        {tab === 'resumo' && <SummaryTab data={data} onNavigate={handleNavigate} />}
        {tab === 'registros' && <RecordsTab data={data} />}
        {tab === 'pagar' && <PayablesTab data={data} onMarkPaid={handleMarkPaid} />}
        {tab === 'mais' && (
          <MoreTab
            data={data}
            view={moreView}
            onSelect={handleMoreSelect}
            onBack={handleMoreBack}
          />
        )}
      </FinanceShell>

      <QuickActionDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        accounts={data.accounts}
        categories={data.categories}
        onSubmit={handleAddTransaction}
      />
    </>
  )
}
