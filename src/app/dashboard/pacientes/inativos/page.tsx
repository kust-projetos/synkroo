'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { UserIcon, PhoneIcon, CalendarIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

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

  const getSegmentColor = (segment: string): "success" | "warning" | "error" | "info" | "teal" | "zinc" => {
    const colors: Record<string, "success" | "warning" | "error" | "info" | "teal" | "zinc"> = {
      inactive_30: 'warning',
      inactive_60: 'warning',
      inactive_90: 'error',
      inactive_180: 'error',
    }
    return colors[segment] || 'zinc'
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
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Pacientes Inativos"
        description="Pacientes que não visitam há 30+ dias"
        action={
          <Link href="/dashboard/campanhas/nova">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <PaperAirplaneIcon className="h-4 w-4 mr-1" />
              Nova Campanha
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card
          className={`p-4 rounded-lg cursor-pointer transition ${selectedSegment === null ? 'bg-teal-50 dark:bg-teal-950 border-teal-500' : ''}`}
          onClick={() => setSelectedSegment(null)}
        >
          <div className="text-2xl font-bold text-foreground">{stats?.totalInactive || 0}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card
          className={`p-4 rounded-lg cursor-pointer transition ${selectedSegment === 'inactive_30' ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-500' : ''}`}
          onClick={() => setSelectedSegment('inactive_30')}
        >
          <div className="text-2xl font-bold text-yellow-600">{stats?.bySegment?.inactive_30 || 0}</div>
          <div className="text-sm text-muted-foreground">30-59 dias</div>
        </Card>
        <Card
          className={`p-4 rounded-lg cursor-pointer transition ${selectedSegment === 'inactive_60' ? 'bg-orange-50 dark:bg-orange-950 border-orange-500' : ''}`}
          onClick={() => setSelectedSegment('inactive_60')}
        >
          <div className="text-2xl font-bold text-orange-600">{stats?.bySegment?.inactive_60 || 0}</div>
          <div className="text-sm text-muted-foreground">60-89 dias</div>
        </Card>
        <Card
          className={`p-4 rounded-lg cursor-pointer transition ${selectedSegment === 'inactive_90' ? 'bg-red-50 dark:bg-red-950 border-red-500' : ''}`}
          onClick={() => setSelectedSegment('inactive_90')}
        >
          <div className="text-2xl font-bold text-red-500">{stats?.bySegment?.inactive_90 || 0}</div>
          <div className="text-sm text-muted-foreground">90-179 dias</div>
        </Card>
        <Card
          className={`p-4 rounded-lg cursor-pointer transition ${selectedSegment === 'inactive_180' ? 'bg-red-100 dark:bg-red-900 border-red-600' : ''}`}
          onClick={() => setSelectedSegment('inactive_180')}
        >
          <div className="text-2xl font-bold text-red-700">{stats?.bySegment?.inactive_180 || 0}</div>
          <div className="text-sm text-muted-foreground">6+ meses</div>
        </Card>
      </div>

      {/* Patients List */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            title="Nenhum paciente inativo"
            description={selectedSegment ? 'Nenhum paciente neste segmento' : 'Ótimo! Todos os pacientes estão em dia.'}
            icon={<UserIcon className="h-12 w-12 text-muted-foreground" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Última Visita</TableHead>
                <TableHead>Dias Inativo</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.patientId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-foreground font-medium">
                          {(patient.patientName ?? 'P').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">{patient.patientName ?? 'Paciente'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <PhoneIcon className="h-4 w-4" />
                      {formatPhone(patient.patientPhone)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarIcon className="h-4 w-4" />
                      {formatDate(patient.lastVisit)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground">{patient.daysSinceLastVisit} dias</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {getSegmentLabel(patient.inactivitySegment)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/pacientes/${patient.patientId}`}>
                      <Button variant="ghost" size="sm">Ver</Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => openContactModal(patient)} className="text-green-600 hover:text-green-700">
                      Contatar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Contact Modal */}
      <Dialog open={contactModal.isOpen} onOpenChange={(open) => setContactModal((prev) => ({ ...prev, isOpen: open }))}>
        <DialogContent>
          {contactModal.patient && (
            <>
              <DialogHeader>
                <DialogTitle>Contatar {contactModal.patient.patientName}</DialogTitle>
              </DialogHeader>

              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">Telefone</p>
                <p className="font-medium flex items-center gap-2">
                  <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                  {formatPhone(contactModal.patient.patientPhone)}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Mensagem
                </label>
                <textarea
                  value={contactModal.message}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, message: e.target.value }))}
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[150px] font-mono"
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setContactModal({ isOpen: false, patient: null, message: '', sending: false })}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={sendMessage}
                  disabled={contactModal.sending || !contactModal.message}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {contactModal.sending && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  )}
                  {contactModal.sending ? 'Enviando...' : 'Enviar WhatsApp'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
