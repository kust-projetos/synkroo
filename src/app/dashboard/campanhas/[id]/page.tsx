'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

interface CampaignDetails {
  id: string
  clinicId: string
  name: string
  description?: string
  campaignType: string
  targetSegment?: string
  messageTemplate: string
  channel: string
  status: string
  scheduledAt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

interface CampaignStats {
  total: number
  pending: number
  sent: number
  delivered: number
  failed: number
  responded: number
  converted: number
  opted_out: number
}

interface Recipient {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  status: string
  sentAt?: string
  deliveredAt?: string
  errorMessage?: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  running: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em Andamento',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-600',
  delivered: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
  responded: 'bg-purple-100 text-purple-600',
  converted: 'bg-indigo-100 text-indigo-600',
  opted_out: 'bg-orange-100 text-orange-600',
}

export default function CampaignDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const toast = useToast()
  const [campaign, setCampaign] = useState<CampaignDetails | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const campaignId = params.id as string

  const fetchCampaign = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`)
      const data = await response.json()

      if (response.ok) {
        setCampaign(data.campaign)
        setStats(data.stats)
        setRecipients(data.recentRecipients || [])
      } else {
        console.error('Failed to fetch campaign:', data.error)
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    if (campaignId) {
      fetchCampaign()
    }
  }, [campaignId, fetchCampaign])

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.showToast('Campanha atualizada com sucesso!', 'success')
        fetchCampaign()
      } else {
        toast.showToast(data.error || 'Erro ao atualizar campanha', 'error')
      }
    } catch (error) {
      console.error('Error updating campaign:', error)
      toast.showToast('Erro ao atualizar campanha', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.showToast('Campanha excluída com sucesso!', 'success')
        router.push('/dashboard/campanhas')
      } else {
        const data = await response.json()
        toast.showToast(data.error || 'Erro ao excluir campanha', 'error')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      toast.showToast('Erro ao excluir campanha', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStartCampaign = async () => {
    if (!confirm('Iniciar o envio da campanha agora? Esta ação não pode ser desfeita.')) return

    setActionLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        toast.showToast('Campanha iniciada com sucesso!', 'success')
        fetchCampaign()
      } else {
        toast.showToast(data.error || 'Erro ao iniciar campanha', 'error')
      }
    } catch (error) {
      console.error('Error starting campaign:', error)
      toast.showToast('Erro ao iniciar campanha', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Campanha não encontrada</h1>
          <Link href="/dashboard/campanhas" className="text-indigo-600 hover:text-indigo-700">
            Voltar para campanhas
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/campanhas" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
                  <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[campaign.status]}`}>
                    {STATUS_LABELS[campaign.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Criada em {formatDate(campaign.createdAt)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {campaign.status === 'draft' && (
                <>
                  <button
                    onClick={() => handleStartCampaign()}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Iniciar Agora
                  </button>
                  <button
                    onClick={() => handleStatusChange('scheduled')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Agendar
                  </button>
                </>
              )}
              {campaign.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => handleStartCampaign()}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Iniciar Agora
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </>
              )}
              {campaign.status === 'running' && (
                <button
                  onClick={() => handleStatusChange('paused')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  Pausar
                </button>
              )}
              {campaign.status === 'paused' && (
                <>
                  <button
                    onClick={() => handleStatusChange('running')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Retomar
                  </button>
                  <button
                    onClick={() => handleStatusChange('cancelled')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </>
              )}
              {['draft', 'cancelled'].includes(campaign.status) && (
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  Excluir
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
                <div className="text-xs text-gray-500">Pendentes</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
                <div className="text-xs text-gray-500">Enviadas</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
                <div className="text-xs text-gray-500">Entregues</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.responded}</div>
                <div className="text-xs text-gray-500">Responderam</div>
              </div>
              <div className="text-center p-3 bg-indigo-50 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600">{stats.converted}</div>
                <div className="text-xs text-gray-500">Convertidos</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-gray-500">Falharam</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.opted_out}</div>
                <div className="text-xs text-gray-500">Opt-out</div>
              </div>
            </div>

            {/* Progress Bar */}
            {stats.total > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progresso de Envio</span>
                  <span>{calculateRate(stats.sent + stats.failed, stats.total)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all"
                    style={{ width: `${calculateRate(stats.sent + stats.failed, stats.total)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaign Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalhes</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Tipo</dt>
                <dd className="text-sm font-medium text-gray-900 capitalize">{campaign.campaignType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Canal</dt>
                <dd className="text-sm font-medium text-gray-900 capitalize">{campaign.channel}</dd>
              </div>
              {campaign.targetSegment && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Segmento</dt>
                  <dd className="text-sm font-medium text-gray-900">{campaign.targetSegment}</dd>
                </div>
              )}
              {campaign.scheduledAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Agendado para</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(campaign.scheduledAt)}</dd>
                </div>
              )}
              {campaign.startedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Iniciada em</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(campaign.startedAt)}</dd>
                </div>
              )}
              {campaign.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Concluída em</dt>
                  <dd className="text-sm font-medium text-gray-900">{formatDate(campaign.completedAt)}</dd>
                </div>
              )}
            </dl>
            {campaign.description && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Descrição</h3>
                <p className="text-sm text-gray-700">{campaign.description}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Modelo de Mensagem</h2>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-700 whitespace-pre-wrap">
              {campaign.messageTemplate}
            </div>
          </div>
        </div>

        {/* Recent Recipients */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Destinatários Recentes</h2>
          {recipients.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum destinatário ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paciente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enviado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recipients.map((recipient) => (
                    <tr key={recipient.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{recipient.patientName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{recipient.patientPhone}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${RECIPIENT_STATUS_COLORS[recipient.status]}`}>
                          {recipient.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {recipient.sentAt ? formatDate(recipient.sentAt) : '-'}
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