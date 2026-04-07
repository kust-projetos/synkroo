'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import Link from 'next/link'

type WaitlistStatus = 'waiting' | 'notified' | 'scheduled' | 'expired' | 'cancelled'

interface WaitlistEntry {
  id: string
  clinicId: string
  patientId: string
  patientName: string
  patientPhone: string
  preferredDate: string
  preferredTimeStart: string
  preferredTimeEnd: string
  procedureId?: string
  procedureName?: string
  dentistId?: string
  dentistName?: string
  priority: number
  status: WaitlistStatus
  notes?: string
  createdAt: Date
  notifiedAt?: Date
  scheduledAppointmentId?: string
}

interface WaitlistStats {
  total: number
  waiting: number
  notified: number
  scheduled: number
  avgWaitDays: number
}

const statusLabels: Record<WaitlistStatus, string> = {
  waiting: 'Aguardando',
  notified: 'Notificado',
  scheduled: 'Agendado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
}

const statusColors: Record<WaitlistStatus, string> = {
  waiting: 'bg-yellow-100 text-yellow-700',
  notified: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
}

const priorityColors: Record<number, string> = {
  1: 'bg-gray-500',
  2: 'bg-gray-400',
  3: 'bg-yellow-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
  6: 'bg-red-600',
  7: 'bg-red-700',
  8: 'bg-red-800',
  9: 'bg-red-900',
  10: 'bg-red-950',
}

export default function WaitlistPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [stats, setStats] = useState<WaitlistStats | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | 'all'>('waiting')
  const [dateFilter, setDateFilter] = useState<string>('')

  const fetchData = useCallback(async () => {
    if (!profile?.clinic_id) return

    try {
      setDataLoading(true)

      const params = new URLSearchParams()
      params.set('clinic_id', profile.clinic_id)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateFilter) params.set('date', dateFilter)

      const response = await fetch(`/api/waitlist?${params.toString()}`)

      if (response.ok) {
        const data = await response.json()
        const waitlist = data.waitlist || []
        setEntries(waitlist)

        // Calculate stats
        const waiting = waitlist.filter((e: WaitlistEntry) => e.status === 'waiting').length
        const notified = waitlist.filter((e: WaitlistEntry) => e.status === 'notified').length
        const scheduled = waitlist.filter((e: WaitlistEntry) => e.status === 'scheduled').length

        // Calculate average wait days for waiting entries
        const waitingEntries = waitlist.filter((e: WaitlistEntry) => e.status === 'waiting')
        let avgWaitDays = 0
        if (waitingEntries.length > 0) {
          const totalDays = waitingEntries.reduce((acc: number, e: WaitlistEntry) => {
            const created = new Date(e.createdAt)
            const now = new Date()
            return acc + Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          }, 0)
          avgWaitDays = Math.round(totalDays / waitingEntries.length)
        }

        setStats({
          total: waitlist.length,
          waiting,
          notified,
          scheduled,
          avgWaitDays,
        })
      }
    } catch (err) {
      console.error('Error fetching waitlist:', err)
    } finally {
      setDataLoading(false)
    }
  }, [profile?.clinic_id, statusFilter, dateFilter])

  useEffect(() => {
    if (profile?.clinic_id) {
      fetchData()
    }
  }, [profile?.clinic_id, fetchData])

  const cancelEntry = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta entrada da lista de espera?')) return

    try {
      const params = new URLSearchParams()
      params.set('id', id)
      params.set('reason', 'Cancelado pelo usuário')

      const response = await fetch(`/api/waitlist?${params.toString()}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Error cancelling waitlist entry:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
  }

  const formatTime = (time: string) => {
    return time.substring(0, 5)
  }

  const getDaysWaiting = (createdAt: Date) => {
    const created = new Date(createdAt)
    const now = new Date()
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const urgentEntries = entries.filter((e) => e.priority >= 7 && e.status === 'waiting')

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lista de Espera</h1>
            <p className="text-gray-600 mt-1">Gerencie pacientes aguardando vagas</p>
          </div>
          <Link
            href="/dashboard/agendamentos/novo"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Nova Entrada
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
              <div className="text-2xl font-bold text-yellow-600">{stats.waiting}</div>
              <div className="text-sm text-gray-500">Aguardando</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.notified}</div>
              <div className="text-sm text-gray-500">Notificados</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-green-600">{stats.scheduled}</div>
              <div className="text-sm text-gray-500">Agendados</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-2xl font-bold text-indigo-600">{stats.avgWaitDays}</div>
              <div className="text-sm text-gray-500">Dias Média</div>
            </div>
          </div>
        )}

        {/* Urgent Alert */}
        {urgentEntries.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">⚠️</span>
              <span className="font-semibold text-red-700">
                {urgentEntries.length} entrada(s) prioritária(s) precisam de atenção!
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {urgentEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white px-3 py-2 rounded-lg text-sm whitespace-nowrap"
                >
                  <span className="font-medium">{entry.patientName}</span>
                  <span className="text-gray-500 ml-2">
                    {formatDate(entry.preferredDate)}
                  </span>
                </div>
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
                onChange={(e) => setStatusFilter(e.target.value as WaitlistStatus | 'all')}
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
              <label className="text-sm text-gray-600 block mb-1">Data Preferida</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {dateFilter && (
              <div className="flex items-end">
                <button
                  onClick={() => setDateFilter('')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Limpar filtro
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Waitlist Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {dataLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">Nenhuma entrada na lista de espera</p>
              <Link
                href="/dashboard/agendamentos/novo"
                className="text-indigo-600 hover:text-indigo-700"
              >
                Adicionar paciente à lista →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Paciente</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Preferência</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Procedimento</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Dentista</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Prioridade</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Esperando</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{entry.patientName}</div>
                          <div className="text-sm text-gray-500">{entry.patientPhone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {formatDate(entry.preferredDate)}
                          </div>
                          <div className="text-gray-500">
                            {formatTime(entry.preferredTimeStart)}
                            {entry.preferredTimeEnd !== entry.preferredTimeStart &&
                              ` - ${formatTime(entry.preferredTimeEnd)}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.procedureName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.dentistName || 'Qualquer'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              priorityColors[entry.priority] || 'bg-gray-500'
                            }`}
                          >
                            {entry.priority}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getDaysWaiting(entry.createdAt)} dias
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded ${statusColors[entry.status]}`}
                        >
                          {statusLabels[entry.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {entry.status === 'waiting' && (
                            <>
                              <button
                                onClick={() => cancelEntry(entry.id)}
                                className="text-red-600 hover:text-red-700 text-sm"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          {entry.status === 'notified' && (
                            <span className="text-sm text-gray-500">
                              Aguardando resposta
                            </span>
                          )}
                          {entry.status === 'scheduled' && entry.scheduledAppointmentId && (
                            <Link
                              href={`/dashboard/agendamentos/${entry.scheduledAppointmentId}`}
                              className="text-indigo-600 hover:text-indigo-700 text-sm"
                            >
                              Ver agendamento
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes section */}
        {entries.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-medium text-blue-900 mb-2">💡 Como funciona</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Quando um agendamento é cancelado, pacientes na lista são notificados automaticamente</li>
              <li>• A prioridade vai de 1 (baixa) a 10 (urgente)</li>
              <li>• Pacientes notificados têm 2 horas para confirmar a vaga</li>
              <li>• Entradas expiram automaticamente após a data preferida</li>
            </ul>
          </div>
        )}
    </div>
  )
}