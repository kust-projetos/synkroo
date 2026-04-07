'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

interface Campaign {
  id: string
  name: string
  campaignType: 'reactivation' | 'retention' | 'promotional' | 'follow_up'
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  targetSegment: string
  messageTemplate: string
  channel: string
  totalRecipients: number
  sentCount: number
  responseCount: number
  conversionCount: number
  optOutCount: number
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  createdAt?: Date
}

export default function CampaignsPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const clinicId = profile?.clinic_id

  const fetchCampaigns = useCallback(async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
      })

      const response = await fetch(`/api/campaigns?${params}`)
      const data = await response.json()

      if (response.ok) {
        setCampaigns(data.campaigns || [])
      } else {
        console.error('Failed to fetch campaigns:', data.error)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => {
    if (!authLoading && clinicId) {
      fetchCampaigns()
    }
  }, [authLoading, clinicId, fetchCampaigns])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      running: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Rascunho',
      scheduled: 'Agendada',
      running: 'Em Andamento',
      paused: 'Pausada',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    }
    return labels[status] || status
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      reactivation: 'Reativação',
      retention: 'Retenção',
      promotional: 'Promocional',
      follow_up: 'Follow-up',
    }
    return labels[type] || type
  }

  const formatDate = (dateStr: Date | string | null | undefined) => {
    if (!dateStr) return '-'
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calculateRate = (count: number, total: number) => {
    if (total === 0) return 0
    return Math.round((count / total) * 100)
  }

  const handleStartCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        toast.showToast('Campanha iniciada com sucesso!', 'success')
        fetchCampaigns()
      } else {
        toast.showToast(data.error || 'Erro ao iniciar campanha', 'error')
      }
    } catch (error) {
      console.error('Error starting campaign:', error)
      toast.showToast('Erro ao iniciar campanha', 'error')
    }
  }

  const filteredCampaigns = filterStatus
    ? campaigns.filter((c) => c.status === filterStatus)
    : campaigns

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
              <p className="text-sm text-gray-500">Gerencie campanhas de reativação e follow-up</p>
            </div>
            <Link
              href="/dashboard/campanhas/nova"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Campanha
            </Link>
          </div>
        </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
            onClick={() => setFilterStatus(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterStatus === null
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Todas
          </button>
          {['draft', 'scheduled', 'running', 'paused', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                filterStatus === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>

        {/* Campaigns List */}
        <div className="pb-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-gray-500">
                {filterStatus
                  ? `Nenhuma campanha ${getStatusLabel(filterStatus).toLowerCase()}`
                  : 'Nenhuma campanha criada'}
              </p>
              <Link
                href="/dashboard/campanhas/nova"
                className="mt-4 inline-block text-indigo-600 hover:text-indigo-700"
              >
                Criar primeira campanha
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(campaign.status)}`}>
                          {getStatusLabel(campaign.status)}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                          {getTypeLabel(campaign.campaignType)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        {campaign.scheduledAt
                          ? `Agendada para ${formatDate(campaign.scheduledAt)}`
                          : `Criada em ${formatDate(campaign.createdAt)}`}
                      </p>

                      {/* Progress Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                          <div className="text-lg font-bold text-gray-900">{campaign.totalRecipients}</div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-600">{campaign.sentCount}</div>
                          <div className="text-xs text-gray-500">Enviadas</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600">{campaign.sentCount}</div>
                          <div className="text-xs text-gray-500">Entregues</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-purple-600">{campaign.responseCount}</div>
                          <div className="text-xs text-gray-500">Responderam</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-indigo-600">{campaign.conversionCount}</div>
                          <div className="text-xs text-gray-500">Convertidos</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {campaign.totalRecipients > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progresso</span>
                            <span>{calculateRate(campaign.sentCount, campaign.totalRecipients)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full transition-all"
                              style={{ width: `${calculateRate(campaign.sentCount, campaign.totalRecipients)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Link
                        href={`/dashboard/campanhas/${campaign.id}`}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Detalhes
                      </Link>
                      {campaign.status === 'draft' && (
                        <button
                          onClick={() => handleStartCampaign(campaign.id)}
                          className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700"
                        >
                          Iniciar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}