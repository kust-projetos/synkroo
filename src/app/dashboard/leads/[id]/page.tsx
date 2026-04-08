'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { PhoneIcon, EnvelopeIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { DetailPage } from '@/components/ui/detail-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'lost'
type LeadTemperature = 'cold' | 'warm' | 'hot'

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
  last_contact_at: string | null
  next_followup_at: string | null
  patients?: { id: string; name: string } | null
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

const statusColors: Record<LeadStatus, "success" | "warning" | "error" | "info" | "teal" | "zinc"> = {
  new: 'info',
  contacted: 'teal',
  qualified: 'teal',
  proposal: 'warning',
  negotiation: 'warning',
  converted: 'success',
  lost: 'error',
}

const temperatureLabels: Record<LeadTemperature, string> = {
  cold: 'Frio',
  warm: 'Morno',
  hot: 'Quente',
}

const temperatureColors: Record<LeadTemperature, string> = {
  cold: 'bg-blue-500',
  warm: 'bg-orange-500',
  hot: 'bg-red-500',
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export default function LeadDetailPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState('')

  const fetchLead = useCallback(async () => {
    try {
      setDataLoading(true)
      const response = await fetch(`/api/leads/${leadId}`)

      if (response.ok) {
        const data = await response.json()
        setLead(data.lead)
        setNotes(data.lead.notes || '')
      } else {
        router.push('/dashboard/leads')
      }
    } catch (err) {
      console.error('Error fetching lead:', err)
    } finally {
      setDataLoading(false)
    }
  }, [leadId, router])

  useEffect(() => {
    if (leadId) {
      fetchLead()
    }
  }, [leadId, fetchLead])

  const updateStatus = async (newStatus: LeadStatus) => {
    if (!lead) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        fetchLead()
      }
    } catch (err) {
      console.error('Error updating lead:', err)
    } finally {
      setUpdating(false)
    }
  }

  const saveNotes = async () => {
    if (!lead) return

    try {
      setUpdating(true)
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      fetchLead()
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setUpdating(false)
    }
  }

  if (dataLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!lead) {
    return null
  }

  const statusColor = statusColors[lead.status]
  const statusLabel = statusLabels[lead.status]

  return (
    <DetailPage
      title={lead.name}
      backHref="/dashboard/leads"
      status={{ type: statusColor, label: statusLabel }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Card */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Informações de Contato</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Telefone</div>
                <div className="font-medium flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                  {lead.phone}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="font-medium">{lead.email || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Origem</div>
                <div className="font-medium capitalize">{lead.source}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Interesse</div>
                <div className="font-medium">{lead.interest || '-'}</div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Observações</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px]"
              rows={4}
              placeholder="Adicione observações sobre o lead..."
            />
            <Button
              onClick={saveNotes}
              disabled={updating}
              variant="outline"
              className="mt-2"
            >
              Salvar Observações
            </Button>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Score Card */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-muted-foreground" />
              Score & Temperatura
            </h2>
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-foreground">{lead.score}%</div>
              <div className="text-sm text-muted-foreground">Score do Lead</div>
            </div>

            {/* Score Bar */}
            <div className="w-full bg-muted rounded-full h-3 mb-4 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all ${getScoreColor(lead.score)}`}
                style={{ width: `${lead.score}%` }}
              />
            </div>

            <div className="flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${temperatureColors[lead.temperature]}`} />
              <span className="font-medium">{temperatureLabels[lead.temperature]}</span>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Ações</h2>
            <div className="space-y-2">
              <select
                value={lead.status}
                onChange={(e) => updateStatus(e.target.value as LeadStatus)}
                disabled={updating}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <a
                href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                💬 Abrir no WhatsApp
              </a>

              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="block w-full text-center bg-muted text-foreground px-4 py-2 rounded-lg hover:bg-muted/70 transition-colors flex items-center justify-center gap-2"
                >
                  <EnvelopeIcon className="h-4 w-4" />
                  Enviar Email
                </a>
              )}
            </div>
          </Card>

          {/* Dates */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Datas</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground">Criado em</div>
                <div className="font-medium">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </div>
              </div>
              {lead.last_contact_at && (
                <div>
                  <div className="text-muted-foreground">Último contato</div>
                  <div className="font-medium">
                    {new Date(lead.last_contact_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
              {lead.next_followup_at && (
                <div>
                  <div className="text-muted-foreground">Próximo follow-up</div>
                  <div className="font-medium">
                    {new Date(lead.next_followup_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </DetailPage>
  )
}
