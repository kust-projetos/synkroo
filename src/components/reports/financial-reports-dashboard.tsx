'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { ReportExportButton } from './report-export-button'

const FinancialOverviewChart = dynamic(
  () => import('./financial-overview-chart').then((m) => m.FinancialOverviewChart),
  { ssr: false, loading: () => <div className="h-72 bg-muted rounded-xl animate-pulse" /> }
)

type PeriodType = 'month' | 'quarter' | 'year'

interface FinancialReport {
  period: string
  revenue: number
  payments: number
  outstanding: number
  byProcedure: ProcedureBreakdown[]
}

interface ProcedureBreakdown {
  procedureId: string
  procedureName: string
  revenue: number
  payments: number
}

export function FinancialReportsDashboard() {
  const [period, setPeriod] = useState<PeriodType>('month')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/financial?period=${period}&date=${selectedDate}`)
      if (!res.ok) throw new Error('Failed to fetch financial report')
      const data: FinancialReport = await res.json()
      setReport(data)
    } catch (err) {
      setError('Erro ao carregar dados. Tente novamente.')
      console.error('Financial report error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod)
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  const renderChart = () => {
    if (loading) {
      return <div className="h-72 bg-muted rounded-xl animate-pulse" />
    }

    if (!report || (report.revenue === 0 && report.payments === 0 && report.outstanding === 0)) {
      return (
        <EmptyState
          title="Nenhum movimento financeiro neste periodo"
          description="Registre pagamentos e recebimentos para ver relatorios."
        />
      )
    }

    const chartData = [
      {
        name: report.period,
        receita: report.revenue,
        pagamentos: report.payments,
        receber: report.outstanding,
      },
    ]

    return <FinancialOverviewChart data={chartData} formatCurrency={formatCurrency} />
  }

  const renderSummaryCards = () => {
    if (!report) return null

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-600">Receita</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(report.revenue)}</div>
            <p className="text-sm text-muted-foreground">Orcamentos aceitos no periodo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-600">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(report.payments)}</div>
            <p className="text-sm text-muted-foreground">Valor recebido no periodo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-600">Em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(report.outstanding)}</div>
            <p className="text-sm text-muted-foreground">Receita menos pagamentos</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector and Export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => handlePeriodChange(v as PeriodType)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />

          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </Button>
        </div>

        <ReportExportButton
          reportType="financial"
          startDate={selectedDate}
          endDate={selectedDate}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>{renderChart()}</CardContent>
      </Card>

      {/* Summary Cards */}
      {renderSummaryCards()}
    </div>
  )
}
