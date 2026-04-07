'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

interface Appointment {
  id: string
  scheduled_at: string
  duration_minutes: number
  status: string
  notes: string | null
  patients?: { id: string; name: string; phone: string }
  dentists?: { id: string; name: string }
  procedures?: { id: string; name: string; duration_minutes: number }
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
  { value: 'scheduled', label: 'Agendado', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'confirmed', label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'Em andamento', color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Concluído', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-100 text-red-700' },
  { value: 'no_show', label: 'Não compareceu', color: 'bg-gray-100 text-gray-700' },
]

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
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Agendamento não encontrado</h2>
          <Link href="/dashboard/agendamentos" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
            Voltar para lista
          </Link>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(appointment.status)

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/agendamentos" className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {appointment.patients?.name || 'Paciente não encontrado'}
                </h1>
                <p className="text-sm text-gray-500">{formatDateTime(appointment.scheduled_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 text-sm rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {!editing && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>

      {/* Content */}
      <div className="max-w-4xl">
        {editing ? (
          /* Edit Form */
          <div className="bg-white shadow rounded-lg p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Editar Agendamento</h2>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Duração (minutos)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Dentista</label>
              <select
                value={selectedDentist}
                onChange={(e) => setSelectedDentist(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Procedimento</label>
              <select
                value={selectedProcedure}
                onChange={(e) => setSelectedProcedure(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          /* Detail View */
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Paciente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Nome</label>
                  <p className="text-gray-900">{appointment.patients?.name || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Telefone</label>
                  <p className="text-gray-900">
                    {appointment.patients?.phone ? formatPhone(appointment.patients.phone) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Appointment Info */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalhes do Agendamento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Data/Hora</label>
                  <p className="text-gray-900">{formatDateTime(appointment.scheduled_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Duração</label>
                  <p className="text-gray-900">{appointment.duration_minutes} minutos</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Dentista</label>
                  <p className="text-gray-900">{appointment.dentists?.name || 'Não definido'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Procedimento</label>
                  <p className="text-gray-900">{appointment.procedures?.name || 'Não definido'}</p>
                </div>
              </div>

              {appointment.notes && (
                <div className="mt-4 pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Observações</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
              <div className="flex justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                >
                  Cancelar Agendamento
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}