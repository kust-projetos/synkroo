'use client'

import { useState } from 'react'
import { useRecordPayment } from '@/hooks/usePayments'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PaymentRecorderDialogProps {
  budgetId: string
  budgetTitle: string
  remainingBalance: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'credit', label: 'Cartão de Crédito' },
  { value: 'debit', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'other', label: 'Outro' },
]

export function PaymentRecorderDialog({
  budgetId,
  budgetTitle,
  remainingBalance,
  open,
  onOpenChange,
}: PaymentRecorderDialogProps) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const recordPayment = useRecordPayment()

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Informe um valor válido')
      return
    }
    if (amountNum > remainingBalance) {
      alert(`Valor não pode exceder o saldo restante: R$ ${remainingBalance.toFixed(2)}`)
      return
    }
    if (!paymentMethod) {
      alert('Selecione o método de pagamento')
      return
    }

    recordPayment.mutate(
      {
        budget_id: budgetId,
        amount: amountNum,
        payment_method: paymentMethod,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setAmount('')
          setPaymentMethod('')
          setPaidAt(new Date().toISOString().split('T')[0])
          setNotes('')
          onOpenChange(false)
        },
        onError: () => {
          alert('Erro ao registrar pagamento')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            Registrando pagamento para: {budgetTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Máximo: R$ {remainingBalance.toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_at">Data</Label>
              <Input
                id="paid_at"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_method">Método de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais (opcional)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={recordPayment.isPending}>
            {recordPayment.isPending ? 'Registrando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
