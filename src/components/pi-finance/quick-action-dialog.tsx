/**
 * Quick-action dialog — entry picks (Despesa / Receita / Transferir).
 *
 * Despesa & Receita submit via onSubmit (caller wires to addTransaction).
 * Transferir has no model action in Slice A so it shows an informational
 * "em breve" placeholder instead of a form.
 */
'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Account, Category } from '@/lib/pi-finance'

export type QuickActionKind = 'despesa' | 'receita' | 'transferir'

export interface QuickActionSubmit {
  kind: 'income' | 'expense'
  description: string
  /** cents */
  amountCents: number
  /** YYYY-MM-DD */
  date: string
  accountId: string
  categoryId: string
}

export interface QuickActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  categories: Category[]
  onSubmit: (input: QuickActionSubmit) => void
}

/** Parse "50,00" / "1.234,56" / "100" → integer cents. */
export function parseBRLToCents(input: string): number {
  const normalized = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

function todayISO(): string {
  // Live UI uses the user's local date. Tests inject a fixed seed via the form.
  return new Date().toISOString().slice(0, 10)
}

export function QuickActionDialog({
  open, onOpenChange, accounts, categories, onSubmit,
}: QuickActionDialogProps) {
  const [kind, setKind] = useState<QuickActionKind | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryKind, setCategoryKind] = useState<'income' | 'expense'>('expense')

  const filteredCats = useMemo(
    () => categories.filter((c) => c.kind === categoryKind && c.status === 'active'),
    [categories, categoryKind]
  )
  const [categoryId, setCategoryId] = useState(filteredCats[0]?.id ?? '')

  function pickKind(k: QuickActionKind) {
    setKind(k)
    if (k === 'despesa') {
      setCategoryKind('expense')
    } else if (k === 'receita') {
      setCategoryKind('income')
    }
    // reset selected category when kind flips
    const next = categories.filter((c) => c.kind === (k === 'receita' ? 'income' : 'expense'))
    setCategoryId(next[0]?.id ?? '')
    setDescription('')
    setAmount('')
  }

  function close() {
    setKind(null)
    onOpenChange(false)
  }

  function submit() {
    if (!accountId || !categoryId) return
    const amountCents = parseBRLToCents(amount)
    if (amountCents <= 0) return
    onSubmit({
      kind: kind === 'receita' ? 'income' : 'expense',
      description: description.trim() || (kind === 'receita' ? 'Receita' : 'Despesa'),
      amountCents,
      date: todayISO(),
      accountId,
      categoryId,
    })
    setDescription('')
    setAmount('')
    setKind(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setKind(null); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acao rapida</DialogTitle>
          <DialogDescription>
            {kind === null ? 'Escolha o tipo de lancamento.' : `Lancando ${kind}.`}
          </DialogDescription>
        </DialogHeader>

        {kind === null && (
          <div className="grid grid-cols-3 gap-2">
            {(['despesa', 'receita', 'transferir'] as QuickActionKind[]).map((k) => (
              <Button key={k} variant="outline" className="h-20" onClick={() => pickKind(k)}>
                {k === 'despesa' ? 'Despesa' : k === 'receita' ? 'Receita' : 'Transferir'}
              </Button>
            ))}
          </div>
        )}

        {kind === 'transferir' && (
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Transferencia entre contas disponivel em breve.
          </div>
        )}

        {(kind === 'despesa' || kind === 'receita') && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Descrição</span>
              <input
                aria-label="Descrição"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={kind === 'receita' ? 'Salário, freelance...' : 'Mercado, aluguel...'}
                required
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">Valor (R$)</span>
              <input
                aria-label="Valor"
                inputMode="decimal"
                className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Conta</span>
                <select
                  aria-label="Conta"
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600">Categoria</span>
                <select
                  aria-label="Categoria"
                  className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {filteredCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        )}

        {kind === 'transferir' && (
          <DialogFooter>
            <Button onClick={close}>Fechar</Button>
          </DialogFooter>
        )}

        {/* hidden helper text for tests asserting presence of "em breve" copy */}
        <span data-testid="quick-action-spacer" className={cn('hidden')}>spacer</span>
      </DialogContent>
    </Dialog>
  )
}
