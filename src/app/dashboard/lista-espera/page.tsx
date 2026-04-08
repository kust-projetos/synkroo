'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import Link from 'next/link'
import { ClockIcon, PlusIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { StatsGrid } from '@/components/ui/stats-grid'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'

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

const statusBadgeTypes: Record<WaitlistStatus, 'warning' | 'info' | 'success' | 'zinc' | 'error'> = {
  waiting: 'warning',
  notified: 'info',
  scheduled: 'success',
  expired: 'zinc',
  cancelled: 'error',
}

const priorityColors: Record<number, string> = {
  1: 'bg-zinc-500',
  2: 'bg-zinc-400',
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

  const urgentEntries = entries.filter((e) => e.priority >= 7 && e.status === 'waiting')

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Lista de Espera"
        description="Gerencie pacientes aguardando vagas"
        action={
          <Button asChild className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <Link href="/dashboard/agendamentos/novo">
              <PlusIcon className="h-4 w-4 mr-2" />
              Nova Entrada
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      {stats && (
        <StatsGrid
          columns={5}
          stats={[
            { label: 'Total', value: stats.total },
            { label: 'Aguardando', value: stats.waiting },
            { label: 'Notificados', value: stats.notified },
            { label: 'Agendados', value: stats.scheduled },
            { label: 'Dias Média', value: stats.avgWaitDays },
          ]}
        />
      )}

      {/* Urgent Alert */}
      {urgentEntries.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="font-semibold text-red-700 dark:text-red-400">
              {urgentEntries.length} entrada(s) prioritária(s) precisam de atenção!
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {urgentEntries.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="bg-background px-3 py-2 rounded-lg text-sm whitespace-nowrap border border-border"
              >
                <span className="font-medium text-foreground">{entry.patientName}</span>
                <span className="text-muted-foreground ml-2">
                  {formatDate(entry.preferredDate)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as WaitlistStatus | 'all')}
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
            <label className="text-sm text-muted-foreground block mb-1">Data Preferida</label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-auto"
            />
          </div>
          {dateFilter && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateFilter('')}
              >
                Limpar filtro
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Waitlist Table */}
      {dataLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center">
          <ClockIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">Nenhuma entrada na lista de espera</p>
          <Link
            href="/dashboard/agendamentos/novo"
            className="text-teal-600 hover:text-teal-700"
          >
            Adicionar paciente à lista →
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Paciente</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Preferência</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Procedimento</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Dentista</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Prioridade</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Esperando</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{entry.patientName}</div>
                        <div className="text-sm text-muted-foreground">{entry.patientPhone}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="font-medium text-foreground">
                          {formatDate(entry.preferredDate)}
                        </div>
                        <div className="text-muted-foreground">
                          {formatTime(entry.preferredTimeStart)}
                          {entry.preferredTimeEnd !== entry.preferredTimeStart &&
                            ` - ${formatTime(entry.preferredTimeEnd)}`}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {entry.procedureName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {entry.dentistName || 'Qualquer'}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          priorityColors[entry.priority] || 'bg-zinc-500'
                        }`}
                      >
                        {entry.priority}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {getDaysWaiting(entry.createdAt)} dias
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={statusBadgeTypes[entry.status]}>
                        {statusLabels[entry.status]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {entry.status === 'waiting' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => cancelEntry(entry.id)}
                          >
                            Cancelar
                          </Button>
                        )}
                        {entry.status === 'notified' && (
                          <span className="text-sm text-muted-foreground">
                            Aguardando resposta
                          </span>
                        )}
                        {entry.status === 'scheduled' && entry.scheduledAppointmentId && (
                          <Link
                            href={`/dashboard/agendamentos/${entry.scheduledAppointmentId}`}
                            className="text-sm text-teal-600 hover:text-teal-700"
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
        </Card>
      )}

      {/* Notes section */}
      {entries.length > 0 && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-400 mb-2">Como funciona</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• Quando um agendamento é cancelado, pacientes na lista são notificados automaticamente</li>
                <li>• A prioridade vai de 1 (baixa) a 10 (urgente)</li>
                <li>• Pacientes notificados têm 2 horas para confirmar a vaga</li>
                <li>• Entradas expiram automaticamente após a data preferida</li>
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
