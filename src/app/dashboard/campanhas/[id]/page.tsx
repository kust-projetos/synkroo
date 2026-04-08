'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PlayIcon, ClockIcon, CheckIcon, PauseIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'
import { DetailPage } from '@/components/ui/detail-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Skeleton } from '@/components/ui/skeleton'

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

const STATUS_COLORS: Record<string, "success" | "warning" | "error" | "info" | "teal" | "zinc"> = {
  draft: 'zinc',
  scheduled: 'info',
  running: 'success',
  paused: 'warning',
  completed: 'teal',
  cancelled: 'error',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  running: 'Em Andamento',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Campanha não encontrada</h1>
          <Link href="/dashboard/campanhas" className="text-primary hover:text-primary/80">
            Voltar para campanhas
          </Link>
        </div>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[campaign.status] || 'zinc'
  const statusLabel = STATUS_LABELS[campaign.status]

  // Build actions based on status
  const actions = (
    <>
      {campaign.status === 'draft' && (
        <>
          <Button
            onClick={() => handleStartCampaign()}
            disabled={actionLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            <PlayIcon className="h-4 w-4 mr-1" />
            Iniciar Agora
          </Button>
          <Button
            onClick={() => handleStatusChange('scheduled')}
            disabled={actionLoading}
            variant="outline"
          >
            <ClockIcon className="h-4 w-4 mr-1" />
            Agendar
          </Button>
        </>
      )}
      {campaign.status === 'scheduled' && (
        <>
          <Button
            onClick={() => handleStartCampaign()}
            disabled={actionLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            <PlayIcon className="h-4 w-4 mr-1" />
            Iniciar Agora
          </Button>
          <Button
            onClick={() => handleStatusChange('cancelled')}
            disabled={actionLoading}
            variant="outline"
            className="text-destructive"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </>
      )}
      {campaign.status === 'running' && (
        <Button
          onClick={() => handleStatusChange('paused')}
          disabled={actionLoading}
          variant="outline"
        >
          <PauseIcon className="h-4 w-4 mr-1" />
          Pausar
        </Button>
      )}
      {campaign.status === 'paused' && (
        <>
          <Button
            onClick={() => handleStatusChange('running')}
            disabled={actionLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            <PlayIcon className="h-4 w-4 mr-1" />
            Retomar
          </Button>
          <Button
            onClick={() => handleStatusChange('cancelled')}
            disabled={actionLoading}
            variant="outline"
            className="text-destructive"
          >
            <XMarkIcon className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
        </>
      )}
      {['draft', 'cancelled'].includes(campaign.status) && (
        <Button
          onClick={handleDelete}
          disabled={actionLoading}
          variant="outline"
          className="text-destructive"
        >
          <TrashIcon className="h-4 w-4 mr-1" />
          Excluir
        </Button>
      )}
    </>
  )

  return (
    <DetailPage
      title={campaign.name}
      backHref="/dashboard/campanhas"
      status={{ type: statusColor, label: statusLabel }}
      actions={actions}
    >
      <div className="space-y-6">
        {/* Stats */}
        {stats && (
          <StatsGrid
            stats={[
              { label: "Total", value: stats.total },
              { label: "Pendentes", value: stats.pending },
              { label: "Enviadas", value: stats.sent },
              { label: "Entregues", value: stats.delivered },
              { label: "Responderam", value: stats.responded },
              { label: "Convertidos", value: stats.converted },
              { label: "Falharam", value: stats.failed },
              { label: "Opt-out", value: stats.opted_out },
            ]}
            columns={4}
          />
        )}

        {/* Progress Bar */}
        {stats && stats.total > 0 && (
          <Card className="p-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Progresso de Envio</span>
              <span className="font-medium">{calculateRate(stats.sent + stats.failed, stats.total)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-teal-600 h-3 rounded-full transition-all"
                style={{ width: `${calculateRate(stats.sent + stats.failed, stats.total)}%` }}
              />
            </div>
          </Card>
        )}

        {/* Campaign Details & Message */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Detalhes</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Tipo</dt>
                <dd className="text-sm font-medium text-foreground capitalize">{campaign.campaignType}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Canal</dt>
                <dd className="text-sm font-medium text-foreground capitalize">{campaign.channel}</dd>
              </div>
              {campaign.targetSegment && (
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Segmento</dt>
                  <dd className="text-sm font-medium text-foreground">{campaign.targetSegment}</dd>
                </div>
              )}
              {campaign.scheduledAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Agendado para</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDate(campaign.scheduledAt)}</dd>
                </div>
              )}
              {campaign.startedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Iniciada em</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDate(campaign.startedAt)}</dd>
                </div>
              )}
              {campaign.completedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Concluída em</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDate(campaign.completedAt)}</dd>
                </div>
              )}
            </dl>
            {campaign.description && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Descrição</h3>
                <p className="text-sm text-foreground">{campaign.description}</p>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Modelo de Mensagem</h2>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground whitespace-pre-wrap">
              {campaign.messageTemplate}
            </div>
          </Card>
        </div>

        {/* Recent Recipients */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Destinatários Recentes</h2>
          {recipients.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum destinatário ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Paciente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Telefone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Enviado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recipients.map((recipient) => (
                    <tr key={recipient.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm text-foreground">{recipient.patientName}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{recipient.patientPhone}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{recipient.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {recipient.sentAt ? formatDate(recipient.sentAt) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DetailPage>
  )
}
