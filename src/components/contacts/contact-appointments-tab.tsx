'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useCalendarStore } from '@/components/calendar/store/calendar-store'
import { queryKeys } from '@/lib/hooks/use-queries'
import { useCurrentClinicId } from '@/lib/auth/context'

interface Appointment {
  id: string
  scheduledAt: string
  status: string
  notes: string | null
  durationMinutes: number
  patientName: string
  dentistName: string
  procedureName: string
}

interface ContactAppointmentsTabProps {
  contactId: string
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  rescheduled: 'bg-amber-100 text-amber-800 border-amber-200',
  scheduled: 'bg-slate-100 text-slate-800 border-slate-200',
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Realizado',
  rescheduled: 'Remarcado',
  scheduled: 'Agendado',
}

async function fetchAppointments(contactId: string): Promise<{ appointments: Appointment[] }> {
  const res = await fetch(`/api/contacts/${contactId}/appointments`)
  if (!res.ok) throw new Error('Failed to fetch appointments')
  return res.json()
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const scheduledDate = new Date(appointment.scheduledAt)
  const statusClass = STATUS_COLORS[appointment.status] || STATUS_COLORS.scheduled

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {format(scheduledDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(scheduledDate, 'HH:mm')} &middot; {appointment.durationMinutes} min
          </p>
        </div>
        <Badge className={statusClass}>
          {STATUS_LABELS[appointment.status] || appointment.status}
        </Badge>
      </div>
      {appointment.procedureName && (
        <p className="text-xs text-muted-foreground">
          {appointment.procedureName}
        </p>
      )}
      {appointment.dentistName && (
        <p className="text-xs text-muted-foreground">
          Dr(a). {appointment.dentistName}
        </p>
      )}
      {appointment.notes && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {appointment.notes}
        </p>
      )}
    </div>
  )
}

export function ContactAppointmentsTab({ contactId }: ContactAppointmentsTabProps) {
  const { prefillFromPatient } = useCalendarStore()
  // G1: tenant da sessão — a key carrega o clinicId no segmento [1].
  const clinicId = useCurrentClinicId()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.contactAppointments(contactId, clinicId),
    queryFn: () => fetchAppointments(contactId),
  })

  const { upcoming, past } = useMemo(() => {
    if (!data?.appointments) return { upcoming: [], past: [] }

    const now = new Date()
    const sorted = [...data.appointments].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )

    return {
      upcoming: sorted.filter((apt) => new Date(apt.scheduledAt) >= now),
      past: sorted.filter((apt) => new Date(apt.scheduledAt) < now).reverse(),
    }
  }, [data])

  const handleNewAppointment = () => {
    prefillFromPatient(contactId)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <p className="text-sm text-muted-foreground">Erro ao carregar agendamentos</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">Agendamentos</h3>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={handleNewAppointment}
        >
          Novo Agendamento
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
          <TabsTrigger
            value="upcoming"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            Próximos ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger
            value="past"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            Anteriores ({past.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : upcoming.length === 0 ? (
            <EmptyState
              title="Nenhum agendamento"
              description="Clique em Novo Agendamento para criar um agendamento para este contato."
            />
          ) : (
            upcoming.map((apt) => <AppointmentCard key={apt.id} appointment={apt} />)
          )}
        </TabsContent>

        <TabsContent value="past" className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : past.length === 0 ? (
            <EmptyState
              title="Nenhum agendamento"
              description="Agendamentos anteriores aparecerão aqui."
            />
          ) : (
            past.map((apt) => <AppointmentCard key={apt.id} appointment={apt} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}