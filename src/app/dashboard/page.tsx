'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { ErrorState } from '@/components/ui/ErrorState'

interface DashboardStats {
  today: {
    appointments: number
    confirmed: number
    pending: number
  }
  metrics: {
    confirmationRate: number
    activeCampaigns: number
    openConversations: number
    totalPatients: number
  }
  inactivePatients: {
    totalInactive: number
    bySegment: Record<string, number>
  }
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!profile?.clinic_id) return

    try {
      setError(null)
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()
      if (response.ok) {
        setStats(data)
      }
    } catch {
      setError('Falha ao carregar estatísticas')
    } finally {
      setStatsLoading(false)
    }
  }, [profile?.clinic_id])

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchStats()
    }
  }, [profile?.clinic_id, fetchStats])

  return (
    <div className="p-4 lg:p-8">
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Bem-vindo, {profile?.name}! 👋
          </h2>
          <p className="text-gray-600">
            {profile?.clinics?.name || 'Sua clínica'}
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={fetchStats} />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-indigo-600">
              {statsLoading ? '...' : stats?.today.appointments || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Agendamentos Hoje</div>
            {stats?.today.pending ? (
              <div className="text-xs text-orange-500 mt-1">
                {stats.today.pending} pendente(s)
              </div>
            ) : null}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-green-600">
              {statsLoading ? '...' : `${stats?.metrics.confirmationRate || 0}%`}
            </div>
            <div className="text-sm text-gray-600 mt-1">Taxa de Confirmação</div>
            <div className="text-xs text-gray-400 mt-1">Últimos 30 dias</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-orange-600">
              {statsLoading ? '...' : stats?.inactivePatients.totalInactive || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Pacientes Inativos</div>
            <Link href="/dashboard/pacientes/inativos" className="text-xs text-indigo-500 hover:text-indigo-600 mt-1 inline-block">
              Ver detalhes →
            </Link>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-purple-600">
              {statsLoading ? '...' : stats?.metrics.totalPatients || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total de Pacientes</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-blue-600">
              {statsLoading ? '...' : stats?.metrics.activeCampaigns || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Campanhas Ativas</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-3xl font-bold text-teal-600">
              {statsLoading ? '...' : stats?.metrics.openConversations || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Conversas Abertas</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/agendamentos/novo" className="p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors text-center">
              <div className="text-2xl mb-2">📅</div>
              <div className="text-sm font-medium text-gray-700">Novo Agendamento</div>
            </Link>
            <Link href="/dashboard/pacientes/inativos" className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-center">
              <div className="text-2xl mb-2">⏰</div>
              <div className="text-sm font-medium text-gray-700">Pacientes Inativos</div>
            </Link>
            <Link href="/dashboard/campanhas/nova" className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center">
              <div className="text-2xl mb-2">📢</div>
              <div className="text-sm font-medium text-gray-700">Nova Campanha</div>
            </Link>
            <Link href="/dashboard/conversas" className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center">
              <div className="text-2xl mb-2">💬</div>
              <div className="text-sm font-medium text-gray-700">Mensagens</div>
            </Link>
          </div>
        </div>
    </div>
  )
}