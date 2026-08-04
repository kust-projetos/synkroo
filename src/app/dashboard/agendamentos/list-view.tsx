// src/app/dashboard/agendamentos/list-view.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useAppointments } from '@/lib/hooks/use-queries'
import { CalendarDaysIcon, PlusIcon, ClockIcon, UserIcon, ClipboardDocumentListIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Appointment } from '@/lib/db/types'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'

interface AppointmentWithDetails extends Appointment {
  patients?: { id: string; name: string; phone: string }
  dentists?: { id: string; name: string }
  procedures?: { id: string; name: string }
}

type StatusFilter = 'all' | 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

const statusLabels: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

const statusBadgeTypes: Record<string, 'warning' | 'info' | 'teal' | 'success' | 'error' | 'zinc'> = {
  scheduled: 'warning',
  confirmed: 'info',
  in_progress: 'teal',
  completed: 'success',
  cancelled: 'error',
  no_show: 'zinc',
}

export function ListView() {
  const { profile } = useAuth()
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const clinicId = profile?.clinic_id

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      clinic_id: clinicId || '',
      date: selectedDate,
    }
    if (statusFilter !== 'all') params.status = statusFilter
    return params
  }, [clinicId, selectedDate, statusFilter])

  const { data, isLoading: loading } = useAppointments(
    clinicId ? queryParams : undefined
  )

  const appointments = (data?.appointments || []) as AppointmentWithDetails[]

  const formatTime = (dateInput: Date | string) => {
    const date = new Date(dateInput)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateInput: Date | string) => {
    const date = new Date(dateInput.toString() + 'T12:00:00')
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Group appointments by time
  const groupedAppointments = appointments.reduce((acc, apt) => {
    const time = formatTime(apt.scheduledAt)
    if (!acc[time]) acc[time] = []
    acc[time].push(apt)
    return acc
  }, {} as Record<string, AppointmentWithDetails[]>)

  const sortedTimes = Object.keys(groupedAppointments).sort()

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <PageHeader
        title="Agendamentos"
        description={`Gerencie as consultas da clínica • ${formatDate(selectedDate)}`}
        action={
          <Button asChild className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
            <Link href="/dashboard/agendamentos/novo" prefetch={false}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Link>
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="date" className="text-sm font-medium text-foreground">
              Data:
            </label>
            <Input
              type="date"
              id="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="status" className="text-sm font-medium text-foreground">
              Status:
            </label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger id="status" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="scheduled">Agendados</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                setSelectedDate(tomorrow.toISOString().split('T')[0])
              }}
            >
              Amanhã
            </Button>
          </div>
        </div>
      </Card>

      {/* Appointments List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon className="h-8 w-8 text-teal-600 dark:text-teal-400" />}
          title="Nenhum agendamento para esta data"
          description="Não há consultas agendadas para o dia selecionado."
          action={{
            label: 'Criar Agendamento',
            onClick: () => window.location.href = '/dashboard/agendamentos/novo',
          }}
        />
      ) : (
        <div className="space-y-4">
          {sortedTimes.map((time) => (
            <Card key={time} className="overflow-hidden">
              <div className="bg-muted px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{time}</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {groupedAppointments[time].map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/dashboard/agendamentos/${appointment.id}`}
                    className="block p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">
                            {appointment.patients?.name || 'Paciente não encontrado'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {appointment.procedures?.name || 'Procedimento não especificado'}
                              {appointment.dentists && ` • Dr(a). ${appointment.dentists.name}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={statusBadgeTypes[appointment.status] || 'info'}>
                          {statusLabels[appointment.status] || appointment.status}
                        </StatusBadge>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {appointment.durationMinutes} min
                        </span>
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
