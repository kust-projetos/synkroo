'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import type { Appointment } from '@/lib/supabase/database.types'

interface AppointmentWithDetails extends Appointment {
  patients?: { id: string; name: string; phone: string }
  dentists?: { id: string; name: string }
  procedures?: { id: string; name: string }
}

export default function AppointmentsPage() {
  const { profile } = useAuth()
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Get clinic ID from auth context
  const clinicId = profile?.clinic_id

  const fetchAppointments = async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        date: selectedDate,
      })
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/appointments?${params}`)
      const data = await response.json()

      if (response.ok) {
        setAppointments(data.appointments || [])
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clinicId) {
      fetchAppointments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, statusFilter, clinicId])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
      in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      no_show: 'bg-gray-100 text-gray-700 border-gray-200',
    }
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: 'Agendado',
      confirmed: 'Confirmado',
      in_progress: 'Em andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      no_show: 'Não compareceu',
    }
    return labels[status] || status
  }

  // Group appointments by time
  const groupedAppointments = appointments.reduce((acc, apt) => {
    const time = formatTime(apt.scheduled_at)
    if (!acc[time]) acc[time] = []
    acc[time].push(apt)
    return acc
  }, {} as Record<string, AppointmentWithDetails[]>)

  const sortedTimes = Object.keys(groupedAppointments).sort()

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
              <p className="text-sm text-gray-500">Gerencie as consultas da clínica</p>
            </div>
            <Link
              href="/dashboard/agendamentos/novo"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Agendamento
            </Link>
          </div>
        </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 items-center mb-6">
          <div className="flex items-center gap-2">
            <label htmlFor="date" className="text-sm font-medium text-gray-700">
              Data:
            </label>
            <input
              type="date"
              id="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="status" className="text-sm font-medium text-gray-700">
              Status:
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="scheduled">Agendados</option>
              <option value="confirmed">Confirmados</option>
              <option value="completed">Concluídos</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>

          {/* Quick date buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Hoje
            </button>
            <button
              onClick={() => {
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                setSelectedDate(tomorrow.toISOString().split('T')[0])
              }}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Amanhã
            </button>
          </div>
      </div>

      {/* Appointments List */}
      <div>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : appointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-gray-500">Nenhum agendamento para esta data</p>
            <Link href="/dashboard/agendamentos/novo" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
              Criar agendamento
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedTimes.map((time) => (
              <div key={time} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-lg font-semibold text-gray-900">{time}</span>
                </div>
                <div className="divide-y divide-gray-200">
                  {groupedAppointments[time].map((appointment) => (
                    <Link
                      key={appointment.id}
                      href={`/dashboard/agendamentos/${appointment.id}`}
                      className="block p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium">
                              {appointment.patients?.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {appointment.patients?.name || 'Paciente não encontrado'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {appointment.procedures?.name || 'Procedimento não especificado'}
                              {appointment.dentists && ` • Dr(a). ${appointment.dentists.name}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 text-xs rounded-full border ${getStatusColor(appointment.status)}`}>
                            {getStatusLabel(appointment.status)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {appointment.duration_minutes} min
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}