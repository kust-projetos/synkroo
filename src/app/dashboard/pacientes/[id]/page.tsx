'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PencilIcon, TrashIcon, UserIcon, CalendarIcon, TagIcon } from '@heroicons/react/24/outline'
import { useToast } from '@/lib/ui/toast'
import { DetailPage } from '@/components/ui/detail-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { Patient, Appointment } from '@/lib/supabase/database.types'

interface PatientWithDetails extends Patient {
  appointments?: Array<Appointment & {
    procedures?: { name: string }
    dentists?: { name: string }
  }>
}

export default function PatientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const patientId = params.id as string

  const [patient, setPatient] = useState<PatientWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPatient = async () => {
    try {
      const response = await fetch(`/api/patients/${patientId}`)
      const data = await response.json()

      if (response.ok) {
        setPatient(data.patient)
      } else {
        console.error('Failed to fetch patient:', data.error)
      }
    } catch (error) {
      console.error('Error fetching patient:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPatient()
  }, [patientId])

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este paciente?')) return

    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.showToast('Paciente excluído com sucesso', 'success')
        router.push('/dashboard/pacientes')
      } else {
        const data = await response.json()
        toast.showToast(data.error || 'Erro ao excluir paciente', 'error')
      }
    } catch (error) {
      console.error('Error deleting patient:', error)
      toast.showToast('Erro ao excluir paciente', 'error')
    }
  }

  const formatPhone = (phone: string) => {
    if (phone.length === 11) {
      return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
    }
    return phone
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, "success" | "warning" | "error" | "info" | "teal" | "zinc"> = {
      scheduled: 'info',
      confirmed: 'teal',
      in_progress: 'warning',
      completed: 'success',
      cancelled: 'error',
      no_show: 'zinc',
    }
    return colors[status] || 'zinc'
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Paciente não encontrado</h2>
          <Link href="/dashboard/pacientes" className="mt-4 inline-block text-primary hover:text-primary/80">
            Voltar para lista
          </Link>
        </div>
      </div>
    )
  }

  const actions = (
    <>
      <Link href={`/dashboard/pacientes/${patientId}/editar`}>
        <Button variant="outline" size="sm">
          <PencilIcon className="h-4 w-4 mr-1" />
          Editar
        </Button>
      </Link>
      <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
        <TrashIcon className="h-4 w-4 mr-1" />
        Excluir
      </Button>
    </>
  )

  return (
    <DetailPage
      title={patient.name}
      backHref="/dashboard/pacientes"
      actions={actions}
    >
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="appointments">
            Agendamentos ({patient.appointments?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{formatPhone(patient.phone)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Telefone</label>
                <p className="text-foreground font-medium">{formatPhone(patient.phone)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                <p className="text-foreground font-medium">{patient.email || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">CPF</label>
                <p className="text-foreground font-medium">{patient.cpf || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Data de Nascimento</label>
                <p className="text-foreground font-medium">{formatDate(patient.birth_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Última Visita</label>
                <p className="text-foreground font-medium">{formatDate(patient.last_visit_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Cadastrado em</label>
                <p className="text-foreground font-medium">{formatDate(patient.created_at)}</p>
              </div>
            </div>

            {patient.tags && patient.tags.length > 0 && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <TagIcon className="h-4 w-4" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {patient.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {patient.notes && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-muted-foreground mb-1">Observações</label>
                <p className="text-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{patient.notes}</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-6">
          <Card>
            {patient.appointments && patient.appointments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Dentista</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patient.appointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="text-foreground font-medium">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          {formatDateTime(appointment.scheduled_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(appointment as any).procedures?.name || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(appointment as any).dentists?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={getStatusColor(appointment.status)}>
                          {getStatusLabel(appointment.status)}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nenhum agendamento encontrado</p>
                <Link href="/dashboard/agendamentos/novo">
                  <Button variant="outline">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Agendar consulta
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </DetailPage>
  )
}

function StatusBadge({ status, children }: { status: "success" | "warning" | "error" | "info" | "teal" | "zinc", children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={`font-medium text-xs border px-2.5 py-0.5 rounded-md ${
      status === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' :
      status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800' :
      status === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800' :
      status === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' :
      status === 'teal' ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-400 dark:border-teal-800' :
      'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
    }`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  )
}
