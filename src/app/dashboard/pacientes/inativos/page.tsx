'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

interface InactivePatient {
  patientId: string
  patientName: string
  patientPhone: string
  lastVisit: Date | null
  daysSinceLastVisit: number
  inactivitySegment: 'inactive_30' | 'inactive_60' | 'inactive_90' | 'inactive_180'
  clinicId: string
  clinicName: string
  totalVisits: number
  lastProcedure?: string
  riskScore: number
}

interface InactivityStats {
  totalInactive: number
  bySegment: Record<string, number>
  atRiskRevenue: number
}

export default function InactivePatientsPage() {
  const { profile, loading: authLoading } = useAuth()
  const toast = useToast()
  const [patients, setPatients] = useState<InactivePatient[]>([])
  const [stats, setStats] = useState<InactivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [contactModal, setContactModal] = useState<{
    isOpen: boolean
    patient: InactivePatient | null
    message: string
    sending: boolean
  }>({ isOpen: false, patient: null, message: '', sending: false })

  const clinicId = profile?.clinic_id

  const fetchInactivePatients = useCallback(async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        min_days: '30',
      })

      const response = await fetch(`/api/patients/inactive?${params}`)
      const data = await response.json()

      if (response.ok) {
        setPatients(data.patients || [])
      } else {
        console.error('Failed to fetch inactive patients:', data.error)
      }
    } catch (error) {
      console.error('Error fetching inactive patients:', error)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  const fetchStats = useCallback(async () => {
    if (!clinicId) return

    try {
      const params = new URLSearchParams({
        clinic_id: clinicId,
        stats_only: 'true',
      })

      const response = await fetch(`/api/patients/inactive?${params}`)
      const data = await response.json()

      if (response.ok) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [clinicId])

  useEffect(() => {
    if (!authLoading && clinicId) {
      fetchInactivePatients()
      fetchStats()
    }
  }, [authLoading, clinicId, fetchInactivePatients, fetchStats])

  const formatPhone = (phone: string | undefined | null) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const formatDate = (dateStr: Date | null) => {
    if (!dateStr) return 'Nunca'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const getSegmentLabel = (segment: string) => {
    const labels: Record<string, string> = {
      inactive_30: '30-59 dias',
      inactive_60: '60-89 dias',
      inactive_90: '90-179 dias',
      inactive_180: '6+ meses',
    }
    return labels[segment] || segment
  }

  const getSegmentColor = (segment: string) => {
    const colors: Record<string, string> = {
      inactive_30: 'bg-yellow-100 text-yellow-700',
      inactive_60: 'bg-orange-100 text-orange-700',
      inactive_90: 'bg-red-100 text-red-700',
      inactive_180: 'bg-red-200 text-red-800',
    }
    return colors[segment] || 'bg-gray-100 text-gray-700'
  }

  const filteredPatients = selectedSegment
    ? patients.filter((p) => p.inactivitySegment === selectedSegment)
    : patients

  const openContactModal = (patient: InactivePatient) => {
    const defaultMessages: Record<string, string> = {
      inactive_30: `Olá, ${patient.patientName}! 👋\n\nSentimos sua falta! Já faz um tempo desde sua última visita.\n\nQue tal agendar uma consulta de retorno? 🦷\n\n📅 Responda essa mensagem que eu te ajudo a agendar.`,
      inactive_60: `Olá, ${patient.patientName}! 💙\n\nFaz 2 meses que não apareceu na clínica. Estamos com horários disponíveis!\n\n✨ Agende sua consulta de retorno e mantenha seu sorriso saudável.`,
      inactive_90: `Olá, ${patient.patientName}! 🦷\n\nFaz 3 meses que não te vemos. Sua saúde bucal é importante!\n\n🎁 Vamos oferecer um desconto especial para sua próxima consulta!`,
      inactive_180: `Olá, ${patient.patientName}! 💙\n\nFaz muito tempo que não te vemos. Sentimos sua falta!\n\n📞 Entre em contato para agendarmos sua próxima consulta.`,
    }
    setContactModal({
      isOpen: true,
      patient,
      message: defaultMessages[patient.inactivitySegment] || defaultMessages.inactive_60,
      sending: false,
    })
  }

  const sendMessage = async () => {
    if (!contactModal.patient || !contactModal.message) return

    setContactModal((prev) => ({ ...prev, sending: true }))

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contactModal.patient.patientPhone,
          message: contactModal.message,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.showToast('Mensagem enviada com sucesso!', 'success')
        setContactModal({ isOpen: false, patient: null, message: '', sending: false })
      } else {
        toast.showToast(data.error || 'Erro ao enviar mensagem', 'error')
        setContactModal((prev) => ({ ...prev, sending: false }))
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast.showToast('Erro ao enviar mensagem', 'error')
      setContactModal((prev) => ({ ...prev, sending: false }))
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pacientes Inativos</h1>
              <p className="text-sm text-gray-500">Pacientes que não visitam há 30+ dias</p>
            </div>
            <Link
              href="/dashboard/campanhas/nova"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Nova Campanha
            </Link>
          </div>
        </div>

      {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <button
            onClick={() => setSelectedSegment(null)}
            className={`p-4 rounded-lg border-2 transition ${
              selectedSegment === null
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900">{stats?.totalInactive || 0}</div>
            <div className="text-sm text-gray-600">Total</div>
          </button>
          <button
            onClick={() => setSelectedSegment('inactive_30')}
            className={`p-4 rounded-lg border-2 transition ${
              selectedSegment === 'inactive_30'
                ? 'border-yellow-500 bg-yellow-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">{stats?.bySegment?.inactive_30 || 0}</div>
            <div className="text-sm text-gray-600">30-59 dias</div>
          </button>
          <button
            onClick={() => setSelectedSegment('inactive_60')}
            className={`p-4 rounded-lg border-2 transition ${
              selectedSegment === 'inactive_60'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-orange-600">{stats?.bySegment?.inactive_60 || 0}</div>
            <div className="text-sm text-gray-600">60-89 dias</div>
          </button>
          <button
            onClick={() => setSelectedSegment('inactive_90')}
            className={`p-4 rounded-lg border-2 transition ${
              selectedSegment === 'inactive_90'
                ? 'border-red-400 bg-red-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-500">{stats?.bySegment?.inactive_90 || 0}</div>
            <div className="text-sm text-gray-600">90-179 dias</div>
          </button>
          <button
            onClick={() => setSelectedSegment('inactive_180')}
            className={`p-4 rounded-lg border-2 transition ${
              selectedSegment === 'inactive_180'
                ? 'border-red-600 bg-red-100'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-700">{stats?.bySegment?.inactive_180 || 0}</div>
            <div className="text-sm text-gray-600">6+ meses</div>
          </button>
        </div>

        {/* Patients List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2">
                {selectedSegment
                  ? 'Nenhum paciente neste segmento'
                  : 'Nenhum paciente inativo'}
              </p>
              <p className="text-sm mt-1">Ótimo! Todos os pacientes estão em dia.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paciente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Visita
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dias Inativo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Segmento
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <tr key={patient.patientId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {patient.patientName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {patient.patientName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPhone(patient.patientPhone)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(patient.lastVisit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {patient.daysSinceLastVisit} dias
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getSegmentColor(patient.inactivitySegment)}`}>
                        {getSegmentLabel(patient.inactivitySegment)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/pacientes/${patient.patientId}`}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Ver
                      </Link>
                      <button
                        onClick={() => openContactModal(patient)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Contatar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Contact Modal */}
        {contactModal.isOpen && contactModal.patient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Contatar {contactModal.patient.patientName}
                </h3>
                <button
                  onClick={() => setContactModal({ isOpen: false, patient: null, message: '', sending: false })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Telefone</p>
                <p className="font-medium">{formatPhone(contactModal.patient.patientPhone)}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={contactModal.message}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, message: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setContactModal({ isOpen: false, patient: null, message: '', sending: false })}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendMessage}
                  disabled={contactModal.sending || !contactModal.message}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {contactModal.sending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  )}
                  {contactModal.sending ? 'Enviando...' : 'Enviar WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}