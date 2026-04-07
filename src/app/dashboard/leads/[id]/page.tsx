'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-purple-100 text-purple-700',
  qualified: 'bg-indigo-100 text-indigo-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
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
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!lead) {
    return null
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/leads"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Voltar para Leads
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
              <p className="text-gray-600 mt-1">Lead detalhes</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[lead.status]}`}>
              {statusLabels[lead.status]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações de Contato</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Telefone</div>
                  <div className="font-medium">{lead.phone}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="font-medium">{lead.email || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Origem</div>
                  <div className="font-medium capitalize">{lead.source}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Interesse</div>
                  <div className="font-medium">{lead.interest || '-'}</div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Observações</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={4}
                placeholder="Adicione observações sobre o lead..."
              />
              <button
                onClick={saveNotes}
                disabled={updating}
                className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Salvar Observações
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Score Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Score & Temperatura</h2>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-gray-900">{lead.score}%</div>
                <div className="text-sm text-gray-500">Score do Lead</div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${temperatureColors[lead.temperature]}`} />
                <span className="font-medium">{temperatureLabels[lead.temperature]}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações</h2>
              <div className="space-y-2">
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(e.target.value as LeadStatus)}
                  disabled={updating}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
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
                  className="block w-full text-center bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                >
                  💬 Abrir no WhatsApp
                </a>

                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="block w-full text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    ✉️ Enviar Email
                  </a>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Datas</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-gray-500">Criado em</div>
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
                    <div className="text-gray-500">Último contato</div>
                    <div className="font-medium">
                      {new Date(lead.last_contact_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                )}
                {lead.next_followup_at && (
                  <div>
                    <div className="text-gray-500">Próximo follow-up</div>
                    <div className="font-medium">
                      {new Date(lead.next_followup_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}