'use client'

import { Suspense, useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useLeads, useLeadStats, useLeadNotifications } from '@/lib/hooks/use-queries'
import Link from 'next/link'
import { UserGroupIcon, PlusIcon, BellIcon, FireIcon, CheckIcon } from '@heroicons/react/24/outline'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'lost'
type LeadTemperature = 'cold' | 'warm' | 'hot'
type LeadSource = 'whatsapp' | 'instagram' | 'web' | 'referral' | 'campaign' | 'other'

const sourceLabels: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  web: 'Website',
  referral: 'Indicação',
  campaign: 'Campanha',
  other: 'Outro',
}

interface Lead {
  id: string
  name: string
  phone: string
  email: string | null
  source: string
  status: LeadStatus
  temperature: LeadTemperature
  score: number
  interest: string | null
  notes: string | null
  created_at: string
  next_followup_at: string | null
}

interface LeadStats {
  total: number
  byStatus: Record<LeadStatus, number>
  byTemperature: Record<LeadTemperature, number>
  conversionRate: number
  avgScore: number
}

interface LeadNotification {
  id: string
  lead_id: string
  clinic_id: string
  type: string
  channel: string
  sent_at: string
  acknowledged: boolean
  lead_name?: string
  lead_phone?: string
  lead_score?: number
  lead_source?: string
  lead_interest?: string
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  converted: 'Convertido',
  lost: 'Perdido',
}

const statusBadgeTypes: Record<LeadStatus, 'info' | 'teal' | 'warning' | 'error' | 'success' | 'zinc'> = {
  new: 'info',
  contacted: 'teal',
  qualified: 'warning',
  proposal: 'warning',
  negotiation: 'error',
  converted: 'success',
  lost: 'zinc',
}

const temperatureColors: Record<LeadTemperature, string> = {
  cold: 'bg-blue-500',
  warm: 'bg-orange-500',
  hot: 'bg-red-500',
}

function LeadsPageContent() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [temperatureFilter, setTemperatureFilter] = useState<LeadTemperature | 'all'>('all')

  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter === 'hot') setTemperatureFilter('hot')
    else if (filter === null) setTemperatureFilter('all')
  }, [searchParams])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'whatsapp' as LeadSource,
    interest: '',
    notes: '',
  })

  const leadsParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (statusFilter !== 'all') params.status = statusFilter
    if (temperatureFilter !== 'all') params.temperature = temperatureFilter
    return params
  }, [statusFilter, temperatureFilter])

  const { data: leadsData, isLoading: leadsLoading, error: leadsError, refetch: refetchLeads } = useLeads(leadsParams)
  const { data: stats } = useLeadStats()
  const { data: notifData, refetch: refetchNotifs } = useLeadNotifications()

  const leads = (leadsData?.leads || []) as Lead[]
  const notifications = (notifData?.notifications || []) as LeadNotification[]
  const dataLoading = leadsLoading

  const fetchData = async () => {
    await Promise.all([refetchLeads(), refetchNotifs()])
  }

  const handleAcknowledge = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/leads/notifications/${notificationId}/acknowledge`, {
        method: 'PUT',
      })

      if (response.ok) {
        refetchNotifs()
      }
    } catch (err) {
      console.error('Error acknowledging notification:', err)
    }
  }

  const handleAcknowledgeAll = async () => {
    try {
      const results = await Promise.all(
        notifications.map((n) =>
          fetch(`/api/leads/notifications/${n.id}/acknowledge`, { method: 'PUT' })
        )
      )
      const allOk = results.every((r) => r.ok)
      if (allOk) {
        refetchNotifs()
      }
    } catch (err) {
      console.error('Error acknowledging all notifications:', err)
    }
  }

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        refetchLeads()
      }
    } catch (err) {
      console.error('Error updating lead:', err)
    }
  }

  if (leadsError && !dataLoading) {
    return (
      <div className="p-4 lg:p-8">
        <ErrorState message="Falha ao carregar leads" onRetry={fetchData} />
      </div>
    )
  }

  const hotLeads = leads.filter((l) => l.temperature === 'hot')

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      setError('Nome e telefone são obrigatórios')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        setDialogOpen(false)
        setFormData({ name: '', phone: '', email: '', source: 'whatsapp', interest: '', notes: '' })
        refetchLeads()
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao criar lead')
      }
    } catch {
      setError('Erro ao criar lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Leads"
        description="Gerencie seu pipeline de vendas"
        action={
          <Button onClick={() => setDialogOpen(true)} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <PlusIcon className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        }
      />

      {/* Stats */}
      {stats && (
        <StatsGrid
          columns={5}
          stats={[
            { label: 'Total', value: stats.total },
            { label: 'Novos', value: stats.byStatus.new },
            { label: 'Qualificados', value: stats.byStatus.qualified },
            { label: 'Quentes', value: stats.byTemperature.hot },
            { label: 'Conversão', value: `${stats.conversionRate}%` },
          ]}
        />
      )}

      {/* Unacknowledged Hot Lead Notifications */}
      {notifications.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BellIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              <span className="font-semibold text-red-700 dark:text-red-400">
                {notifications.length} alerta(s) de lead quente não confirmado(s)
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleAcknowledgeAll}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar todos
            </Button>
          </div>
          <div className="space-y-2">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className="bg-background px-4 py-3 rounded-lg flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">
                      {notification.lead_name || 'Lead desconhecido'}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      Score: {notification.lead_score ?? '-'} | Origem: {notification.lead_source || '-'}
                    </span>
                    {notification.lead_interest && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {notification.lead_interest}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(notification.sent_at).toLocaleString('pt-BR')}
                  </span>
                  <Link
                    href={`/dashboard/leads/${notification.lead_id}`}
                    className="text-xs text-teal-600 hover:text-teal-700"
                  >
                    Ver lead
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAcknowledge(notification.id)}
                  >
                    <CheckIcon className="h-3 w-3 mr-1" />
                    Confirmar
                  </Button>
                </div>
              </div>
            ))}
            {notifications.length > 5 && (
              <p className="text-xs text-red-600 dark:text-red-400 text-center">
                E mais {notifications.length - 5} alerta(s)...
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Hot Leads Alert */}
      {hotLeads.length > 0 && notifications.length === 0 && (
        <Card className="p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-3">
            <FireIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <span className="font-semibold text-orange-700 dark:text-orange-400">
              {hotLeads.length} lead(s) quente(s) precisam de atenção!
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {hotLeads.slice(0, 5).map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="bg-background px-3 py-2 rounded-lg text-sm hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors whitespace-nowrap border border-border"
              >
                {lead.name} ({lead.score}%)
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Filtrar por status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as LeadStatus | 'all')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Temperatura</label>
            <Select
              value={temperatureFilter}
              onValueChange={(v) => setTemperatureFilter(v as LeadTemperature | 'all')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="hot">Quente</SelectItem>
                <SelectItem value="warm">Morno</SelectItem>
                <SelectItem value="cold">Frio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Leads Table */}
      {dataLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-12 text-center">
          <UserGroupIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">Nenhum lead encontrado</p>
          <Link href="/dashboard/leads/novo" className="text-teal-600 hover:text-teal-700">
            Adicionar primeiro lead
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Contato</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Origem</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Score</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Interesse</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${temperatureColors[lead.temperature]}`} />
                        <span className="font-medium text-foreground">{lead.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div>{lead.phone}</div>
                      {lead.email && <div className="text-xs text-muted-foreground">{lead.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{lead.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              lead.score >= 70 ? 'bg-red-500' : lead.score >= 40 ? 'bg-orange-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span data-testid="lead-score" className="text-sm text-muted-foreground">{lead.score}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                        className="text-xs border-0 bg-transparent cursor-pointer"
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{lead.interest || '-'}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/leads/${lead.id}`}
                        className="text-sm text-teal-600 hover:text-teal-700"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Telefone *</label>
            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Origem</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(sourceLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Interesse</label>
            <Input value={formData.interest} onChange={(e) => setFormData({ ...formData, interest: e.target.value })} placeholder="Ex: Clareamento, Implante..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
              placeholder="Informações adicionais..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
            {submitting ? 'Salvando...' : 'Salvar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-4 lg:p-8"><div className="animate-pulse h-32 bg-muted rounded" /></div>}>
      <LeadsPageContent />
    </Suspense>
  )
}
