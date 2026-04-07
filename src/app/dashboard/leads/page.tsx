'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import Link from 'next/link'
import { ErrorState } from '@/components/ui/ErrorState'

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
  negotiation: 'Negociacao',
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

const temperatureColors: Record<LeadTemperature, string> = {
  cold: 'bg-blue-500',
  warm: 'bg-orange-500',
  hot: 'bg-red-500',
}

export default function LeadsPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [notifications, setNotifications] = useState<LeadNotification[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [temperatureFilter, setTemperatureFilter] = useState<LeadTemperature | 'all'>('all')

  const fetchData = useCallback(async () => {
    try {
      setDataLoading(true)
      setError(null)

      const leadsParams = new URLSearchParams()
      if (statusFilter !== 'all') leadsParams.set('status', statusFilter)
      if (temperatureFilter !== 'all') leadsParams.set('temperature', temperatureFilter)

      const [leadsRes, statsRes, notifRes] = await Promise.all([
        fetch(`/api/leads?${leadsParams.toString()}`),
        fetch('/api/leads/stats'),
        fetch('/api/leads/notifications'),
      ])

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json()
        setLeads(leadsData.leads || [])
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (notifRes.ok) {
        const notifData = await notifRes.json()
        setNotifications(notifData.notifications || [])
      }
    } catch {
      setError('Falha ao carregar leads')
    } finally {
      setDataLoading(false)
    }
  }, [statusFilter, temperatureFilter])

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchData()
    }
  }, [profile?.clinic_id, fetchData])

  const handleAcknowledge = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/leads/notifications/${notificationId}/acknowledge`, {
        method: 'PUT',
      })

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
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
        setNotifications([])
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
        fetchData()
      }
    } catch (err) {
      console.error('Error updating lead:', err)
    }
  }

  if (error && !dataLoading) {
    return (
      <div className="p-4 lg:p-8">
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    )
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const hotLeads = leads.filter((l) => l.temperature === 'hot')

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-600 mt-1">Gerencie seu pipeline de vendas</p>
          </div>
          <Link
            href="/dashboard/leads/novo"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Novo Lead
          </Link>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.byStatus.new}</div>
              <div className="text-sm text-gray-500">Novos</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-indigo-600">{stats.byStatus.qualified}</div>
              <div className="text-sm text-gray-500">Qualificados</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-red-600">{stats.byTemperature.hot}</div>
              <div className="text-sm text-gray-500">Quentes</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-green-600">{stats.conversionRate}%</div>
              <div className="text-sm text-gray-500">Conversao</div>
            </div>
          </div>
        )}

        {/* Unacknowledged Hot Lead Notifications */}
        {notifications.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <span className="font-semibold text-red-700">
                  {notifications.length} alerta(s) de lead quente nao confirmado(s)
                </span>
              </div>
              <button
                onClick={handleAcknowledgeAll}
                className="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors"
              >
                Confirmar todos
              </button>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className="bg-white px-4 py-3 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <div>
                      <span className="font-medium text-gray-900">
                        {notification.lead_name || 'Lead desconhecido'}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        Score: {notification.lead_score ?? '-'} | Origem: {notification.lead_source || '-'}
                      </span>
                      {notification.lead_interest && (
                        <span className="text-xs text-indigo-600 ml-2">
                          Interesse: {notification.lead_interest}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {new Date(notification.sent_at).toLocaleString('pt-BR')}
                    </span>
                    <Link
                      href={`/dashboard/leads/${notification.lead_id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Ver lead
                    </Link>
                    <button
                      onClick={() => handleAcknowledge(notification.id)}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              ))}
              {notifications.length > 5 && (
                <p className="text-xs text-red-600 text-center">
                  E mais {notifications.length - 5} alerta(s)...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Hot Leads Alert (no unacknowledged notifications, just hot leads summary) */}
        {hotLeads.length > 0 && notifications.length === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🔥</span>
              <span className="font-semibold text-red-700">
                {hotLeads.length} lead(s) quente(s) precisam de atencao!
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {hotLeads.slice(0, 5).map((lead) => (
                <Link
                  key={lead.id}
                  href={`/dashboard/leads/${lead.id}`}
                  className="bg-white px-3 py-2 rounded-lg text-sm hover:bg-red-100 transition-colors whitespace-nowrap"
                >
                  {lead.name} ({lead.score}%)
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeadStatus | 'all')}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Temperatura</label>
              <select
                value={temperatureFilter}
                onChange={(e) => setTemperatureFilter(e.target.value as LeadTemperature | 'all')}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Todas</option>
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {dataLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">Nenhum lead encontrado</p>
              <Link href="/dashboard/leads/novo" className="text-indigo-600 hover:text-indigo-700">
                Adicionar primeiro lead
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Nome</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Contato</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Origem</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Score</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Interesse</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${temperatureColors[lead.temperature]}`} />
                          <span className="font-medium text-gray-900">{lead.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{lead.phone}</div>
                        {lead.email && <div className="text-xs text-gray-400">{lead.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{lead.source}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                lead.score >= 70 ? 'bg-red-500' : lead.score >= 40 ? 'bg-orange-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{lead.score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                          className={`text-xs px-2 py-1 rounded border-0 ${statusColors[lead.status]}`}
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lead.interest || '-'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="text-indigo-600 hover:text-indigo-700 text-sm"
                        >
                          Ver detalhes
                        </Link>
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
