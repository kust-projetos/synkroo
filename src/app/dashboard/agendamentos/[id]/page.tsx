'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarIcon, UserIcon, ClockIcon, PencilIcon, TrashIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'
import { DetailPage } from '@/components/ui/detail-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  patients?: { id: string; name: string; phone: string }
  dentists?: { id: string; name: string }
  procedures?: { id: string; name: string; duration_minutes: number }
  dentist_id?: string
  procedure_id?: string
}

interface Dentist {
  id: string
  name: string
}

interface Procedure {
  id: string
  name: string
  duration_minutes: number
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Agendado', color: 'info' },
  { value: 'confirmed', label: 'Confirmado', color: 'teal' },
  { value: 'in_progress', label: 'Em andamento', color: 'warning' },
  { value: 'completed', label: 'Concluído', color: 'success' },
  { value: 'cancelled', label: 'Cancelado', color: 'error' },
  { value: 'no_show', label: 'Não compareceu', color: 'zinc' },
] as const

type StatusColor = "success" | "warning" | "error" | "info" | "teal" | "zinc"

export default function AppointmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const toast = useToast()
  const appointmentId = params.id as string

  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  // Edit form state
  const [selectedDentist, setSelectedDentist] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')

  // Get clinic ID from auth context
  const clinicId = profile?.clinic_id

  useEffect(() => {
    fetchAppointment()
    fetchDentists()
    fetchProcedures()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId])

  const fetchAppointment = async () => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`)
      const data = await response.json()

      if (response.ok) {
        setAppointment(data.appointment)
        // Set edit form values
        setSelectedDentist(data.appointment.dentist_id || '')
        setSelectedProcedure(data.appointment.procedure_id || '')
        setSelectedStatus(data.appointment.status)
        setDuration(data.appointment.duration_minutes)
        setNotes(data.appointment.notes || '')
      } else {
        console.error('Failed to fetch appointment:', data.error)
      }
    } catch (error) {
      console.error('Error fetching appointment:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDentists = async () => {
    if (!clinicId) return
    try {
      const response = await fetch(`/api/dentists?clinic_id=${clinicId}`)
      const data = await response.json()
      if (response.ok) {
        setDentists(data.dentists || [])
      }
    } catch (error) {
      console.error('Error fetching dentists:', error)
    }
  }

  const fetchProcedures = async () => {
    if (!clinicId) return
    try {
      const response = await fetch(`/api/procedures?clinic_id=${clinicId}`)
      const data = await response.json()
      if (response.ok) {
        setProcedures(data.procedures || [])
      }
    } catch (error) {
      console.error('Error fetching procedures:', error)
    }
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dentist_id: selectedDentist || null,
          procedure_id: selectedProcedure || null,
          status: selectedStatus,
          duration_minutes: duration,
          notes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setAppointment(data.appointment)
        setEditing(false)
        toast.showToast('Agendamento atualizado com sucesso!', 'success')
      } else {
        toast.showToast(data.error || 'Erro ao atualizar agendamento', 'error')
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast.showToast('Erro ao atualizar agendamento', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.showToast('Agendamento cancelado', 'success')
        router.push('/dashboard/agendamentos')
      } else {
        const data = await response.json()
        toast.showToast(data.error || 'Erro ao cancelar agendamento', 'error')
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      toast.showToast('Erro ao cancelar agendamento', 'error')
    }
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
    }
    return phone
  }

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Agendamento não encontrado</h2>
          <Link href="/dashboard/agendamentos" className="mt-4 inline-block text-primary hover:text-primary/80">
            Voltar para lista
          </Link>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(appointment.status)

  const actions = (
    <>
      {!editing && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon className="h-4 w-4 mr-1" />
          Editar
        </Button>
      )}
      {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
        <Button variant="outline" size="sm" onClick={handleCancel} className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
          <TrashIcon className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
      )}
    </>
  )

  return (
    <DetailPage
      title={appointment.patients?.name || 'Paciente não encontrado'}
      backHref="/dashboard/agendamentos"
      status={{ type: statusInfo.color as StatusColor, label: statusInfo.label }}
      actions={actions}
    >
      <div className="max-w-4xl">
        {editing ? (
          /* Edit Form */
          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Editar Agendamento</h2>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Duração (minutos)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h 30min</option>
                <option value={120}>2 horas</option>
              </select>
            </div>

            {/* Dentist */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Dentista</label>
              <select
                value={selectedDentist}
                onChange={(e) => setSelectedDentist(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecione um dentista</option>
                {dentists.map((dentist) => (
                  <option key={dentist.id} value={dentist.id}>
                    {dentist.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Procedure */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Procedimento</label>
              <select
                value={selectedProcedure}
                onChange={(e) => setSelectedProcedure(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Selecione um procedimento</option>
                {procedures.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.name} ({procedure.duration_minutes} min)
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </Card>
        ) : (
          /* Detail View */
          <div className="space-y-6">
            {/* Patient Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-muted-foreground" />
                Informações do Paciente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Nome</label>
                  <p className="text-foreground font-medium">{appointment.patients?.name || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Telefone</label>
                  <p className="text-foreground font-medium flex items-center gap-2">
                    <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                    {appointment.patients?.phone ? formatPhone(appointment.patients.phone) : '-'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Appointment Info */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                Detalhes do Agendamento
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Data/Hora</label>
                  <p className="text-foreground font-medium">{formatDateTime(appointment.scheduled_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Duração</label>
                  <p className="text-foreground font-medium flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    {appointment.duration_minutes} minutos
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Dentista</label>
                  <p className="text-foreground font-medium">{appointment.dentists?.name || 'Não definido'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Procedimento</label>
                  <p className="text-foreground font-medium">{appointment.procedures?.name || 'Não definido'}</p>
                </div>
              </div>

              {appointment.notes && (
                <div className="mt-4 pt-4 border-t">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Observações</label>
                  <p className="text-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{appointment.notes}</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </DetailPage>
  )
}
