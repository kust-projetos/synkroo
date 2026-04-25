'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useCampaigns } from '@/lib/hooks/use-queries'
import { useToast } from '@/lib/ui/toast'
import { CampaignWizard } from '@/components/campaigns/campaign-wizard'

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
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const clinicId = profile?.clinic_id

  const { data, isLoading: loading, refetch: fetchCampaigns } = useCampaigns(
    clinicId ? { clinic_id: clinicId } : undefined
  )

  const campaigns = (data?.campaigns || []) as Campaign[]

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-secondary text-secondary-foreground',
      scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      running: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return colors[status] || 'bg-secondary text-secondary-foreground'
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-card rounded-lg border border-border mb-6 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
              <p className="text-sm text-muted-foreground">Gerencie campanhas de reativação e follow-up</p>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Criar Campanha
            </button>
          </div>
        </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
            onClick={() => setFilterStatus(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterStatus === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted border border-border'
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
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted border border-border'
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-muted-foreground">
                {filterStatus
                  ? `Nenhuma campanha ${getStatusLabel(filterStatus).toLowerCase()}`
                  : 'Nenhuma campanha criada'}
              </p>
              <Link
                href="/dashboard/campanhas/nova"
                className="mt-4 inline-block text-primary hover:text-primary/80"
              >
                Criar primeira campanha
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(campaign.status)}`}>
                          {getStatusLabel(campaign.status)}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground">
                          {getTypeLabel(campaign.campaignType)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {campaign.scheduledAt
                          ? `Agendada para ${formatDate(campaign.scheduledAt)}`
                          : `Criada em ${formatDate(campaign.createdAt)}`}
                      </p>

                      {/* Progress Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                          <div className="text-lg font-bold text-foreground">{campaign.totalRecipients}</div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{campaign.sentCount}</div>
                          <div className="text-xs text-muted-foreground">Enviadas</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">{campaign.sentCount}</div>
                          <div className="text-xs text-muted-foreground">Entregues</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{campaign.responseCount}</div>
                          <div className="text-xs text-muted-foreground">Responderam</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-primary">{campaign.conversionCount}</div>
                          <div className="text-xs text-muted-foreground">Convertidos</div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {campaign.totalRecipients > 0 && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Progresso</span>
                            <span>{calculateRate(campaign.sentCount, campaign.totalRecipients)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
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
                        className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition"
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

      {/* Campaign Wizard Dialog */}
      <CampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onComplete={() => fetchCampaigns()}
      />
    </div>
  )
}
