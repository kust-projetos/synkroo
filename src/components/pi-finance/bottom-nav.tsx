/**
 * Bottom navigation — four tabs (Resumo / Registros / A pagar / Mais)
 * plus the central FAB that opens the quick-action dialog.
 */
'use client'

import { Plus, Home, ListChecks, Wallet, MoreHorizontal } from 'lucide-react'

export type PiTab = 'resumo' | 'registros' | 'pagar' | 'mais'

export interface BottomNavProps {
  tab: PiTab
  onTabChange: (tab: PiTab) => void
  onAction: () => void
}

const TABS: ReadonlyArray<{ id: PiTab; label: string; icon: typeof Home }> = [
  { id: 'resumo', label: 'Resumo', icon: Home },
  { id: 'registros', label: 'Registros', icon: ListChecks },
  { id: 'pagar', label: 'A pagar', icon: Wallet },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal },
]

export function BottomNav({ tab, onTabChange, onAction }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur"
      aria-label="Navegacao principal"
    >
      <div className="relative mx-auto flex h-16 max-w-2xl items-stretch justify-around px-2">
        {TABS.slice(0, 2).map((t) => (
          <NavButton key={t.id} tab={t} active={tab === t.id} onClick={() => onTabChange(t.id)} />
        ))}
        <div className="flex w-16 items-center justify-center">
          <button
            type="button"
            onClick={onAction}
            aria-label="Acao rapida"
            className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white shadow-lg ring-4 ring-white transition active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
        {TABS.slice(2).map((t) => (
          <NavButton key={t.id} tab={t} active={tab === t.id} onClick={() => onTabChange(t.id)} />
        ))}
      </div>
    </nav>
  )
}

function NavButton({
  tab, active, onClick,
}: { tab: { id: PiTab; label: string; icon: typeof Home }; active: boolean; onClick: () => void }) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-16 flex-col items-center justify-center gap-0.5 text-xs ${
        active ? 'text-slate-900' : 'text-slate-500'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span>{tab.label}</span>
    </button>
  )
}
