'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDaysIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { isMockMode, getMockForUrl } from '@/lib/mocks'

const HourlyChartRecharts = dynamic(
  () => import('@/components/charts/hourly-chart').then((m) => m.HourlyChartRecharts),
  { ssr: false, loading: () => <div className="h-48 bg-muted rounded-xl animate-pulse" /> }
)
const DayOfWeekChartRecharts = dynamic(
  () => import('@/components/charts/day-of-week-chart').then((m) => m.DayOfWeekChartRecharts),
  { ssr: false, loading: () => <div className="h-48 bg-muted rounded-xl animate-pulse" /> }
)
const TrendsChartRecharts = dynamic(
  () => import('@/components/charts/trends-chart').then((m) => m.TrendsChartRecharts),
  { ssr: false, loading: () => <div className="h-64 bg-muted rounded-xl animate-pulse" /> }
)

interface AppointmentTrend {
  date: string
  total: number
  confirmed: number
  cancelled: number
  no_show: number
  completed: number
}

interface HourlyDistribution {
  hour: number
  count: number
  percentage: number
}

interface DayOfWeekDistribution {
  day: string
  dayIndex: number
  count: number
  percentage: number
}

interface ClinicInsights {
  appointmentTrends: AppointmentTrend[]
  hourlyDistribution: HourlyDistribution[]
  dayOfWeekDistribution: DayOfWeekDistribution[]
  metrics: {
    avgAppointmentsPerDay: number
    peakHour: number
    peakDay: string
    cancellationRate: number
    noShowRate: number
    avgConfirmationTime: number
  }
}

export function useAnalytics(clinicId: string | undefined) {
  const [insights, setInsights] = useState<ClinicInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) {
      setLoading(false)
      return
    }

    fetchInsights()
  }, [clinicId])

  const fetchInsights = async () => {
    try {
      setLoading(true)
      if (isMockMode()) {
        const data = getMockForUrl('/api/analytics/insights') as ClinicInsights | null
        if (data) {
          setInsights(data)
          setError(null)
          return
        }
      }
      const response = await fetch('/api/analytics/insights')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      const data = await response.json()
      setInsights(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return { insights, loading, error, refetch: fetchInsights }
}

export function AnalyticsMetrics({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-xl shadow-sm p-4 animate-pulse">
            <div className="h-8 bg-muted rounded mb-2" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-yellow-700 dark:text-yellow-400">
        Não foi possível carregar as métricas
      </div>
    )
  }

  const { metrics } = insights

  const stats = [
    {
      label: 'Média diária',
      value: metrics.avgAppointmentsPerDay.toFixed(1),
      icon: <CalendarDaysIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
    },
    {
      label: 'Horário pico',
      value: `${metrics.peakHour}:00`,
      icon: <ClockIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
    },
    {
      label: 'Taxa cancelamento',
      value: `${metrics.cancellationRate}%`,
      icon: <XCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
    },
    {
      label: 'Taxa no-show',
      value: `${metrics.noShowRate}%`,
      icon: <CheckCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />,
    },
  ]

  return <StatsGrid stats={stats} columns={4} />
}

export function HourlyChart({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return <div className="h-64 bg-muted rounded-xl animate-pulse" />
  }

  if (!insights) return null

  const data = insights.hourlyDistribution
    .filter((h) => h.count > 0)
    .map((h) => ({
      hour: `${h.hour.toString().padStart(2, '0')}:00`,
      consultas: h.count,
    }))

  return <HourlyChartRecharts data={data} loading={loading} />
}

export function DayOfWeekChart({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />
  }

  if (!insights) return null

  const data = insights.dayOfWeekDistribution.map((d) => ({
    dia: d.day,
    consultas: d.count,
    percentual: d.percentage,
  }))

  return <DayOfWeekChartRecharts data={data} loading={loading} />
}

export interface ROIMetricsData {
  period: { start: string; end: string }
  savings: {
    messagesHandled: number
    avgHandlingTimeMin: number
    hourlyRate: number
    totalSaved: number
  }
  revenue: {
    appointmentsBooked: number
    avgTicket: number
    totalRevenue: number
    recoveredNoShows: number
    recoveredRevenue: number
  }
  costs: {
    platform: number
    tokens: number
    total: number
  }
  roi: number
  netBenefit: number
  comparison?: {
    previousPeriod: ROIMetricsData
    changePercent: number
  }
}

export function useROI(clinicId: string | undefined) {
  const [roiData, setRoiData] = useState<ROIMetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clinicId) {
      setLoading(false)
      return
    }

    fetchROI()
  }, [clinicId])

  const fetchROI = async () => {
    try {
      setLoading(true)
      if (isMockMode()) {
        const data = getMockForUrl('/api/analytics/roi?period=month') as ROIMetricsData | null
        if (data) {
          setRoiData(data)
          setError(null)
          return
        }
      }
      const response = await fetch('/api/analytics/roi?period=month')
      if (!response.ok) {
        throw new Error('Failed to fetch ROI data')
      }
      const data = await response.json()
      setRoiData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return { roiData, loading, error, refetch: fetchROI }
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ROICard({
  roiData,
  loading,
}: {
  roiData: ROIMetricsData | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-8 bg-muted rounded mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!roiData) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-yellow-700 dark:text-yellow-400">
        Não foi possível carregar os dados de ROI
      </div>
    )
  }

  const changePercent = roiData.comparison?.changePercent ?? 0
  const isPositiveChange = changePercent >= 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Retorno sobre Investimento</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-bold ${
                roiData.roi >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {roiData.roi.toFixed(1)}%
            </span>
            {roiData.comparison && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  isPositiveChange
                    ? 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400'
                    : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                }`}
              >
                {isPositiveChange ? '+' : ''}
                {changePercent.toFixed(1)}% vs periodo anterior
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-lg font-bold text-teal-600 dark:text-teal-400">
              {formatCurrency(roiData.savings.totalSaved)}
            </div>
            <div className="text-xs text-muted-foreground">
              Economia ({roiData.savings.messagesHandled} msgs IA)
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-teal-600 dark:text-teal-400">
              {formatCurrency(roiData.revenue.totalRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">
              Receita ({roiData.revenue.appointmentsBooked} agendamentos)
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-teal-600 dark:text-teal-400">
              {formatCurrency(roiData.revenue.recoveredRevenue)}
            </div>
            <div className="text-xs text-muted-foreground">
              No-shows recuperados ({roiData.revenue.recoveredNoShows})
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(roiData.costs.total)}
            </div>
            <div className="text-xs text-muted-foreground">Custo plataforma</div>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Beneficio liquido</span>
            <span
              className={`text-lg font-bold ${
                roiData.netBenefit >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(roiData.netBenefit)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TrendsChart({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return <div className="h-48 bg-muted rounded-xl animate-pulse" />
  }

  if (!insights || insights.appointmentTrends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tendências (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Sem dados suficientes
          </div>
        </CardContent>
      </Card>
    )
  }

  const recentTrends = insights.appointmentTrends.slice(-14) // Last 14 days

  const data = recentTrends.map((trend) => ({
    date: new Date(trend.date).getDate().toString(),
    concluidos: trend.completed,
    cancelados: trend.cancelled,
    noShow: trend.no_show,
  }))

  return <TrendsChartRecharts data={data} loading={loading} />
}
