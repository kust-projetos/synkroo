'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
import { PageHeader } from '@/components/ui/page-header'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/ErrorState'
import {
  useAnalytics,
  useROI,
  AnalyticsMetrics,
  HourlyChart,
  DayOfWeekChart,
  TrendsChart,
  ROICard,
} from '@/lib/ui/analytics-charts'
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface NoShowPrediction {
  patient_id: string
  patient_name: string
  appointment_id?: string
  scheduled_at: string
  risk_score: number
  riskLevel: 'low' | 'medium' | 'high'
  factors: { name: string; impact: number; description: string }[]
  recommendations: string[]
}

const riskLevelConfig: Record<string, { label: string; status: 'success' | 'warning' | 'error' }> = {
  high: { label: 'Alto', status: 'error' },
  medium: { label: 'Médio', status: 'warning' },
  low: { label: 'Baixo', status: 'success' },
}

export default function AnalyticsPage() {
  const { profile } = useAuth()
  const { insights, loading: insightsLoading, error, refetch: refetchInsights } = useAnalytics(profile?.clinic_id)
  const { roiData, loading: roiLoading } = useROI(profile?.clinic_id)
  const [noShowRisks, setNoShowRisks] = useState<NoShowPrediction[]>([])
  const [risksLoading, setRisksLoading] = useState(true)
  const [risksError, setRisksError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchNoShowRisks()
    }
  }, [profile?.clinic_id])

  const fetchNoShowRisks = async () => {
    try {
      setRisksLoading(true)
      const response = await fetch('/api/analytics/noshow-prediction')
      if (response.ok) {
        const data = await response.json()
        setNoShowRisks(data.predictions || [])
      }
    } catch {
      setRisksError('Falha ao carregar previsões de no-show')
    } finally {
      setRisksLoading(false)
    }
  }

  const highRiskCount = noShowRisks.filter((r) => r.riskLevel === 'high').length
  const mediumRiskCount = noShowRisks.filter((r) => r.riskLevel === 'medium').length

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8">
      <PageHeader
        title="Analytics"
        description="Visão geral do desempenho da clínica"
      />

      {/* Analytics Error */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-700 dark:text-amber-400">
              Algumas métricas podem estar indisponíveis
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchInsights?.()}
            className="text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            <ArrowPathIcon className="w-4 h-4 mr-1" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Metrics Overview */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Métricas Principais</h2>
        <AnalyticsMetrics insights={insights} loading={insightsLoading} />
      </div>

      {/* ROI Card */}
      <ROICard roiData={roiData} loading={roiLoading} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por horário</CardTitle>
          </CardHeader>
          <CardContent>
            <HourlyChart insights={insights} loading={insightsLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por dia da semana</CardTitle>
          </CardHeader>
          <CardContent>
            <DayOfWeekChart insights={insights} loading={insightsLoading} />
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendências (14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendsChart insights={insights} loading={insightsLoading} />
        </CardContent>
      </Card>

      {/* No-Show Risk Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base">Previsão de No-Show</CardTitle>
            </div>
            {!risksLoading && (
              <div className="flex gap-3">
                <StatusBadge status="error">
                  {highRiskCount} alto risco
                </StatusBadge>
                <StatusBadge status="warning">
                  {mediumRiskCount} médio risco
                </StatusBadge>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Próximos 7 dias</p>
        </CardHeader>
        <CardContent>
          {risksError ? (
            <div className="py-4">
              <ErrorState message={risksError} onRetry={fetchNoShowRisks} />
            </div>
          ) : risksLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : noShowRisks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Nenhum agendamento previsto para os próximos 7 dias
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b border-border">
                    <th className="pb-3 font-medium">Paciente</th>
                    <th className="pb-3 font-medium">Data/Hora</th>
                    <th className="pb-3 font-medium">Risco</th>
                    <th className="pb-3 font-medium">Fatores</th>
                    <th className="pb-3 font-medium">Recomendações</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {noShowRisks.slice(0, 10).map((risk, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium text-foreground">{risk.patient_name}</td>
                      <td className="py-3 text-muted-foreground">
                        {formatTime(risk.scheduled_at)}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={riskLevelConfig[risk.riskLevel].status}>
                          {risk.risk_score}% {riskLevelConfig[risk.riskLevel].label}
                        </StatusBadge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {risk.factors.slice(0, 2).map((f, j) => (
                            <li key={j}>{f.description}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {risk.recommendations.slice(0, 2).map((r, j) => (
                            <li key={j}>{r}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
