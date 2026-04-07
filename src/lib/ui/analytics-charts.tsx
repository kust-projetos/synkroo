'use client'

import { useState, useEffect } from 'react'

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
          <div key={i} className="bg-white rounded-xl shadow-sm p-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700">
        Não foi possível carregar as métricas
      </div>
    )
  }

  const { metrics } = insights

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="text-2xl font-bold text-indigo-600">
          {metrics.avgAppointmentsPerDay.toFixed(1)}
        </div>
        <div className="text-sm text-gray-500">Média diária</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="text-2xl font-bold text-blue-600">
          {metrics.peakHour}:00
        </div>
        <div className="text-sm text-gray-500">Horário pico</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="text-2xl font-bold text-orange-600">
          {metrics.cancellationRate}%
        </div>
        <div className="text-sm text-gray-500">Taxa cancelamento</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="text-2xl font-bold text-red-600">
          {metrics.noShowRate}%
        </div>
        <div className="text-sm text-gray-500">Taxa no-show</div>
      </div>
    </div>
  )
}

export function HourlyChart({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
  }

  if (!insights) return null

  const data = insights.hourlyDistribution
    .filter((h) => h.count > 0)
    .map((h) => ({
      hour: `${h.hour.toString().padStart(2, '0')}:00`,
      consultas: h.count,
    }))

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição por Horário</h3>
      <div className="h-64">
        {data.length > 0 ? (
          <div className="flex items-end gap-1 h-full">
            {data.map((item, i) => {
              const maxCount = Math.max(...data.map((d) => d.consultas))
              const height = (item.consultas / maxCount) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${item.consultas} consultas`}
                  />
                  <span className="text-xs text-gray-500 mt-1 rotate-0 truncate w-full text-center">
                    {item.hour}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Sem dados suficientes
          </div>
        )}
      </div>
    </div>
  )
}

export function DayOfWeekChart({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
  }

  if (!insights) return null

  const data = insights.dayOfWeekDistribution.map((d) => ({
    dia: d.day,
    consultas: d.count,
    percentual: d.percentage,
  }))

  const maxCount = Math.max(...data.map((d) => d.consultas), 1)

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição por Dia da Semana</h3>
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-10 text-sm text-gray-600">{item.dia}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all"
                style={{ width: `${(item.consultas / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-12 text-sm text-gray-500 text-right">{item.consultas}</span>
          </div>
        ))}
      </div>
    </div>
  )
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
      <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-8 bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!roiData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700">
        Não foi possível carregar os dados de ROI
      </div>
    )
  }

  const changePercent = roiData.comparison?.changePercent ?? 0
  const isPositiveChange = changePercent >= 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Retorno sobre Investimento</h2>
        <div className="flex items-center gap-2">
          <span
            className={`text-2xl font-bold ${
              roiData.roi >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {roiData.roi.toFixed(1)}%
          </span>
          {roiData.comparison && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded ${
                isPositiveChange
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isPositiveChange ? '+' : ''}
              {changePercent.toFixed(1)}% vs periodo anterior
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-lg font-bold text-blue-600">
            {formatCurrency(roiData.savings.totalSaved)}
          </div>
          <div className="text-xs text-gray-500">
            Economia ({roiData.savings.messagesHandled} msgs IA)
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-600">
            {formatCurrency(roiData.revenue.totalRevenue)}
          </div>
          <div className="text-xs text-gray-500">
            Receita ({roiData.revenue.appointmentsBooked} agendamentos)
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-purple-600">
            {formatCurrency(roiData.revenue.recoveredRevenue)}
          </div>
          <div className="text-xs text-gray-500">
            No-shows recuperados ({roiData.revenue.recoveredNoShows})
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-orange-600">
            {formatCurrency(roiData.costs.total)}
          </div>
          <div className="text-xs text-gray-500">Custo plataforma</div>
        </div>
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Beneficio liquido</span>
          <span
            className={`text-lg font-bold ${
              roiData.netBenefit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(roiData.netBenefit)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function TrendsChart({ insights, loading }: { insights: ClinicInsights | null; loading: boolean }) {
  if (loading) {
    return <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
  }

  if (!insights || insights.appointmentTrends.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendências (30 dias)</h3>
        <div className="h-48 flex items-center justify-center text-gray-500">
          Sem dados suficientes
        </div>
      </div>
    )
  }

  const recentTrends = insights.appointmentTrends.slice(-14) // Last 14 days

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tendências (últimos 14 dias)</h3>
      <div className="h-48 overflow-x-auto">
        <div className="flex gap-1 h-full min-w-max">
          {recentTrends.map((trend, i) => {
            const maxTotal = Math.max(...recentTrends.map((t) => t.total), 1)
            const completedHeight = (trend.completed / maxTotal) * 100
            const cancelledHeight = (trend.cancelled / maxTotal) * 100
            const noShowHeight = (trend.no_show / maxTotal) * 100

            return (
              <div key={i} className="flex flex-col items-center w-8">
                <div className="flex-1 w-full flex flex-col justify-end gap-px">
                  {trend.completed > 0 && (
                    <div
                      className="w-full bg-green-500 rounded-t"
                      style={{ height: `${completedHeight}%`, minHeight: '2px' }}
                      title={`Concluídos: ${trend.completed}`}
                    />
                  )}
                  {trend.cancelled > 0 && (
                    <div
                      className="w-full bg-orange-500"
                      style={{ height: `${cancelledHeight}%`, minHeight: '2px' }}
                      title={`Cancelados: ${trend.cancelled}`}
                    />
                  )}
                  {trend.no_show > 0 && (
                    <div
                      className="w-full bg-red-500 rounded-b"
                      style={{ height: `${noShowHeight}%`, minHeight: '2px' }}
                      title={`No-show: ${trend.no_show}`}
                    />
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-1 truncate w-full text-center">
                  {new Date(trend.date).getDate()}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded" />
          <span className="text-gray-500">Concluído</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500 rounded" />
          <span className="text-gray-500">Cancelado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-gray-500">No-show</span>
        </div>
      </div>
    </div>
  )
}