/**
 * Shared shell — background + safe-area + container + bottom-nav slot.
 * Lives at the slice boundary so each tab stays focused on its content.
 */
import type { ReactNode } from 'react'
import { BottomNav, type PiTab } from './bottom-nav'

export interface FinanceShellProps {
  tab: PiTab
  onTabChange: (tab: PiTab) => void
  onAction: () => void
  children: ReactNode
}

export function FinanceShell({ tab, onTabChange, onAction, children }: FinanceShellProps) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 pb-24">
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-32">
        {children}
      </main>
      <BottomNav tab={tab} onTabChange={onTabChange} onAction={onAction} />
    </div>
  )
}
