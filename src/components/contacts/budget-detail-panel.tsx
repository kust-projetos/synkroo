'use client'

import { useState } from 'react'
import { usePayments } from '@/hooks/usePayments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentRecorderDialog } from './payment-recorder-dialog'

interface BudgetItem {
  id?: string
  procedure_name: string
  quantity: number
  unit_price: number
  discount_percent: number
  total_price: number
}

interface BudgetDetail {
  id: string
  title?: string | null
  total_value: number
  discount_value: number
  final_value: number
  status: string
  items?: BudgetItem[]
  installments?: BudgetInstallment[]
  payments?: Payment[]
}

interface Payment {
  id: string
  amount: number
  payment_method: string
  paid_at: string
  notes: string | null
}

interface BudgetInstallment {
  id?: string
  budget_id: string
  amount: number
  due_date: string
  status: string
  paid_at?: string | null
}

interface BudgetDetailPanelProps {
  budget: BudgetDetail | null
  loading?: boolean
}

function getInstallmentStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-500">Paga</Badge>
    case 'overdue':
      return <Badge className="bg-red-500">Vencida</Badge>
    case 'pending':
      return <Badge variant="outline">Pendente</Badge>
    case 'cancelled':
      return <Badge variant="secondary">Cancelada</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function BudgetDetailPanel({ budget, loading }: BudgetDetailPanelProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)

  const { data: payments } = usePayments(budget?.id || null)

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!budget) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Selecione um orçamento para ver os detalhes
      </div>
    )
  }

  const paidInstallments = budget.installments?.filter((i) => i.status === 'paid') || []
  const totalPaid = paidInstallments.reduce((sum, i) => sum + i.amount, 0)
  const remainingBalance = budget.final_value - totalPaid

  return (
    <div className="space-y-4 p-4">
      {/* Budget Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{budget.title || 'Orçamento'}</CardTitle>
            <Badge variant={budget.status === 'accepted' ? 'default' : 'outline'}>
              {budget.status === 'accepted' ? 'Aceito' : budget.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-medium">{formatCurrency(budget.total_value)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pago</p>
              <p className="font-medium text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Devido</p>
              <p className="font-medium text-red-600">{formatCurrency(remainingBalance)}</p>
            </div>
          </div>
          {budget.discount_value > 0 && (
            <p className="text-xs text-muted-foreground">
              Desconto: {formatCurrency(budget.discount_value)}
            </p>
          )}
          <Button
            className="w-full mt-2"
            onClick={() => setPaymentDialogOpen(true)}
            disabled={remainingBalance <= 0}
          >
            Registrar Pagamento
          </Button>
        </CardContent>
      </Card>

      {/* Procedure List */}
      {budget.items && budget.items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Procedimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budget.items.map((item, idx) => (
                <div key={item.id || idx} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.procedure_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity}x {formatCurrency(item.unit_price)}
                      {item.discount_percent > 0 && ` (-${item.discount_percent}%)`}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.total_price)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Installment List */}
      {budget.installments && budget.installments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budget.installments.map((inst, idx) => (
                <div key={inst.id || idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{idx + 1}.</span>
                    <span>{formatCurrency(inst.amount)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(inst.due_date)}
                    </span>
                  </div>
                  {getInstallmentStatusBadge(inst.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.map((payment) => (
                <div key={payment.id} className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.paid_at)} • {payment.payment_method}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PaymentRecorderDialog
        budgetId={budget.id}
        budgetTitle={budget.title || 'Orçamento'}
        remainingBalance={remainingBalance}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </div>
  )
}
