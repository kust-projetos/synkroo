'use client'

import { useState } from 'react'
import { useFinancialSummary, type PlanFinancialSummary } from '@/hooks/useFinancialSummary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FinancialCharts } from './financial-charts'
import { BudgetDetailPanel } from './budget-detail-panel'

interface ContactFinancialTabProps {
  contactId: string
}

interface BudgetDetail {
  id: string
  title?: string | null
  total_value: number
  discount_value: number
  final_value: number
  status: string
  items?: Array<{
    id?: string
    procedure_name: string
    quantity: number
    unit_price: number
    discount_percent: number
    total_price: number
  }>
  installments?: Array<{
    id?: string
    budget_id: string
    amount: number
    due_date: string
    status: string
    paid_at?: string | null
  }>
  payments?: Array<{
    id: string
    amount: number
    payment_method: string
    paid_at: string
    notes: string | null
  }>
}

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`
}

function getProgressColor(percent: number) {
  if (percent < 30) return 'bg-red-500'
  if (percent < 70) return 'bg-amber-500'
  return 'bg-green-500'
}

function getProgressTextColor(percent: number) {
  if (percent < 30) return 'text-red-500'
  if (percent < 70) return 'text-amber-500'
  return 'text-green-500'
}

interface TreatmentPlanCardProps {
  summary: PlanFinancialSummary
  onSelectBudget: () => void
  selected: boolean
}

function TreatmentPlanCard({ summary, onSelectBudget, selected }: TreatmentPlanCardProps) {
  const { plan, budget, billed, paid, owed, sessionsCompleted, sessionsTotal } = summary
  const progressPercent = sessionsTotal > 0 ? Math.round((sessionsCompleted / sessionsTotal) * 100) : 0

  return (
    <Card className={`cursor-pointer transition-colors ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{plan.title}</CardTitle>
          <Badge
            variant={plan.status === 'active' ? 'default' : plan.status === 'completed' ? 'secondary' : 'outline'}
          >
            {plan.status === 'active' ? 'Ativo' : plan.status === 'completed' ? 'Concluído' : plan.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Session Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Sessões</span>
            <span className={`font-medium ${getProgressTextColor(progressPercent)}`}>
              {sessionsCompleted}/{sessionsTotal} ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(progressPercent)} transition-all`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Faturado</p>
            <p className="font-medium">{formatCurrency(billed)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Pago</p>
            <p className="font-medium text-green-600">{formatCurrency(paid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Devido</p>
            <p className={`font-medium ${owed > 0 ? 'text-red-500' : ''}`}>{formatCurrency(owed)}</p>
          </div>
        </div>

        {budget && (
          <Button variant="outline" size="sm" className="w-full" onClick={onSelectBudget}>
            Ver Detalhes do Orçamento
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function ContactFinancialTab({ contactId }: ContactFinancialTabProps) {
  const { data, isLoading, isError } = useFinancialSummary(contactId)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Erro ao carregar dados financeiros</p>
      </div>
    )
  }

  if (!data || data.plans.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="Nenhum plano de tratamento"
          description="Crie um plano de tratamento para este paciente para acompanhar o progresso e gerenciar pagamentos."
        />
      </div>
    )
  }

  const selectedBudget: BudgetDetail | null = (() => {
    if (!selectedBudgetId) return null
    const found = data.plans.find((p) => p.budget?.id === selectedBudgetId)?.budget
    if (!found || !found.id) return null
    return found as unknown as BudgetDetail
  })()

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-medium text-muted-foreground">Financeiro</h3>
      {/* Treatment Plans */}
      <div className="space-y-3">
        {data.plans.map((summary) => (
          <TreatmentPlanCard
            key={summary.plan.id}
            summary={summary}
            selected={summary.budget?.id === selectedBudgetId}
            onSelectBudget={() => setSelectedBudgetId(summary.budget?.id || null)}
          />
        ))}
      </div>

      {/* Financial Charts */}
      <FinancialCharts
        data={data.plans.map((p) => ({
          name: p.plan.title.substring(0, 15),
          billed: p.billed,
          paid: p.paid,
          owed: p.owed,
        }))}
      />

      {/* Budget Detail Panel */}
      {selectedBudget && (
        <BudgetDetailPanel budget={selectedBudget} />
      )}
    </div>
  )
}
