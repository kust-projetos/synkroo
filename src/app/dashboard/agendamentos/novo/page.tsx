'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

interface Patient {
  id: string
  name: string
  phone: string
}

interface Dentist {
  id: string
  name: string
}

interface Procedure {
  id: string
  name: string
  duration_minutes: number
  price: number
}

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const toast = useToast()

  const [patients, setPatients] = useState<Patient[]>([])
  const [dentists, setDentists] = useState<Dentist[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])

  const [loading, setLoading] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')

  // Form state
  const [selectedPatient, setSelectedPatient] = useState('')
  const [selectedDentist, setSelectedDentist] = useState('')
  const [selectedProcedure, setSelectedProcedure] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [duration, setDuration] = useState(30)
  const [notes, setNotes] = useState('')

  // Get clinic ID from auth context
  const clinicId = profile?.clinic_id

  // Get tomorrow's date as minimum
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  const fetchDentists = useCallback(async () => {
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
  }, [clinicId])

  const fetchProcedures = useCallback(async () => {
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
  }, [clinicId])

  useEffect(() => {
    if (clinicId) {
      fetchDentists()
      fetchProcedures()
    }
  }, [clinicId, fetchDentists, fetchProcedures])

  useEffect(() => {
    if (selectedDate && selectedDentist) {
      fetchAvailableSlots()
    }
    // fetchAvailableSlots uses selectedDate, selectedDentist, duration, clinicId - intentionally excluded to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedDentist, duration])

  useEffect(() => {
    if (selectedProcedure) {
      const proc = procedures.find(p => p.id === selectedProcedure)
      if (proc) {
        setDuration(proc.duration_minutes)
      }
    }
  }, [selectedProcedure, procedures])

  const searchPatients = async (query: string) => {
    if (!clinicId || query.length < 2) {
      setPatients([])
      return
    }

    setSearchingPatients(true)
    try {
      const response = await fetch(`/api/patients?clinic_id=${clinicId}&search=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()
      if (response.ok) {
        setPatients(data.patients || [])
      }
    } catch (error) {
      console.error('Error searching patients:', error)
    } finally {
      setSearchingPatients(false)
    }
  }

  const fetchAvailableSlots = async () => {
    if (!clinicId) return
    setLoadingSlots(true)
    setSelectedTime('')
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        date: selectedDate,
        duration_minutes: duration.toString(),
      })
      if (selectedDentist) {
        params.append('dentist_id', selectedDentist)
      }

      const response = await fetch(`/api/appointments/availability?${params}`)
      const data = await response.json()
      if (response.ok) {
        setAvailableSlots(data.slots || [])
      }
    } catch (error) {
      console.error('Error fetching availability:', error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPatient || !selectedDate || !selectedTime) {
      toast.showToast('Por favor, preencha todos os campos obrigatórios', 'error')
      return
    }

    setLoading(true)
    try {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`)

      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          patient_id: selectedPatient,
          dentist_id: selectedDentist || null,
          procedure_id: selectedProcedure || null,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: duration,
          notes,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.showToast('Agendamento criado com sucesso!', 'success')
        router.push('/dashboard/agendamentos')
      } else {
        toast.showToast(data.error || 'Erro ao criar agendamento', 'error')
      }
    } catch (error) {
      console.error('Error creating appointment:', error)
      toast.showToast('Erro ao criar agendamento', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
    }
    return phone
  }

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/agendamentos" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Novo Agendamento</h1>
              <p className="text-sm text-gray-500">Agende uma nova consulta</p>
            </div>
          </div>
        </div>

      {/* Form */}
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paciente *
            </label>
            <div className="relative">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value)
                  searchPatients(e.target.value)
                }}
                placeholder="Buscar paciente pelo nome ou telefone..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchingPatients && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            {patients.length > 0 && !selectedPatient && (
              <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatient(patient.id)
                      setPatientSearch(patient.name)
                      setPatients([])
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
                  >
                    <span className="font-medium">{patient.name}</span>
                    <span className="text-sm text-gray-500">{formatPhone(patient.phone)}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Paciente selecionado
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient('')
                    setPatientSearch('')
                  }}
                  className="text-red-600 hover:text-red-700 ml-2"
                >
                  Remover
                </button>
              </div>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duração (minutos)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hora</option>
                <option value={90}>1h 30min</option>
                <option value={120}>2 horas</option>
              </select>
            </div>
          </div>

          {/* Dentist */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dentista
            </label>
            <select
              value={selectedDentist}
              onChange={(e) => setSelectedDentist(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Procedimento
            </label>
            <select
              value={selectedProcedure}
              onChange={(e) => setSelectedProcedure(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um procedimento</option>
              {procedures.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.name} ({procedure.duration_minutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* Available Time Slots */}
          {selectedDate && selectedDentist && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Horário *
              </label>
              {loadingSlots ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">Nenhum horário disponível para esta data</p>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.time)}
                      className={`px-3 py-2 text-sm rounded-lg border transition ${
                        selectedTime === slot.time
                          ? 'bg-blue-600 text-white border-blue-600'
                          : slot.available
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                      title={slot.reason}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Observações sobre o agendamento..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/dashboard/agendamentos"
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading || !selectedPatient || !selectedDate || !selectedTime}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Agendamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}