'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/context'
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

export default function AnalyticsPage() {
  const { profile } = useAuth()
  const { insights, loading: insightsLoading, error } = useAnalytics(profile?.clinic_id)
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

  return (
    <div className="p-4 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Visão geral do desempenho da clínica</p>
        </div>

        {/* Analytics Error */}
        {error && (
          <div className="mb-6">
            <ErrorState message="Falha ao carregar dados de analytics. Algumas métricas podem estar indisponíveis." />
          </div>
        )}

        {/* Metrics Overview */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Métricas Principais</h2>
          <AnalyticsMetrics insights={insights} loading={insightsLoading} />
        </div>

        {/* ROI Card */}
        <div className="mb-6">
          <ROICard roiData={roiData} loading={roiLoading} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <HourlyChart insights={insights} loading={insightsLoading} />
          <DayOfWeekChart insights={insights} loading={insightsLoading} />
        </div>

        {/* Trends */}
        <div className="mb-6">
          <TrendsChart insights={insights} loading={insightsLoading} />
        </div>

        {/* No-Show Risk Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Previsão de No-Show (próximos 7 dias)
            </h2>
            {!risksLoading && (
              <div className="flex gap-4 text-sm">
                <span className="text-red-600 font-medium">{highRiskCount} alto risco</span>
                <span className="text-orange-600 font-medium">{mediumRiskCount} médio risco</span>
              </div>
            )}
          </div>

          {risksError ? (
            <div className="py-4">
              <ErrorState message={risksError} onRetry={fetchNoShowRisks} />
            </div>
          ) : risksLoading ? (
            <div className="h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : noShowRisks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Nenhum agendamento previsto para os próximos 7 dias
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2 font-medium">Paciente</th>
                    <th className="pb-2 font-medium">Data/Hora</th>
                    <th className="pb-2 font-medium">Risco</th>
                    <th className="pb-2 font-medium">Fatores</th>
                    <th className="pb-2 font-medium">Recomendações</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {noShowRisks.slice(0, 10).map((risk, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 font-medium text-gray-900">{risk.patient_name}</td>
                      <td className="py-3 text-gray-600">
                        {new Date(risk.scheduled_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            risk.riskLevel === 'high'
                              ? 'bg-red-100 text-red-700'
                              : risk.riskLevel === 'medium'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {risk.risk_score}% ({risk.riskLevel === 'high' ? 'Alto' : risk.riskLevel === 'medium' ? 'Médio' : 'Baixo'})
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">
                        <ul className="list-disc list-inside text-xs">
                          {risk.factors.slice(0, 2).map((f, j) => (
                            <li key={j}>{f.description}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-3 text-gray-600">
                        <ul className="list-disc list-inside text-xs">
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
        </div>
    </div>
  )
}
