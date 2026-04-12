// src/components/calendar/AppointmentDialog.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/lib/auth/context'
import { useDentists, useProcedures, useClinicSettings } from '@/lib/hooks/use-queries'
import type { CalendarEvent } from './hooks/useCalendarEvents'

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não Compareceu',
}

const STATUS_BADGE: Record<string, 'warning' | 'info' | 'teal' | 'success' | 'error' | 'zinc'> = {
  scheduled: 'warning',
  confirmed: 'info',
  in_progress: 'teal',
  completed: 'success',
  cancelled: 'error',
  no_show: 'zinc',
}

const READONLY_STATUSES = new Set(['completed', 'cancelled', 'no_show'])

interface AppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  event?: CalendarEvent | null
  prefillDate?: string
  prefillTime?: string
  prefillDentistId?: string
  onSuccess: () => void
}

export function AppointmentDialog({
  open,
  onOpenChange,
  mode,
  event,
  prefillDate,
  prefillTime,
  prefillDentistId,
  onSuccess,
}: AppointmentDialogProps) {
  const { profile } = useAuth()
  const { data: dentistsData } = useDentists(profile?.clinic_id)
  const { data: proceduresData } = useProcedures(profile?.clinic_id)
  const { data: settingsData } = useClinicSettings()

  const dentists = dentistsData?.dentists || []
  const procedures = proceduresData?.procedures || []
  const customDurations = settingsData?.settings?.appointment_durations || [15, 30, 45, 60, 90, 120]

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`
    if (mins === 60) return '1 hora'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}min` : `${h} hora${h > 1 ? 's' : ''}`
  }

  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [dentistId, setDentistId] = useState('')
  const [procedureId, setProcedureId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('30')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate end time from start time + duration
  const calculateEndTime = (startTime: string, dur: string): string => {
    if (!startTime || !dur) return ''
    const [h, m] = startTime.split(':').map(Number)
    const totalMinutes = h * 60 + m + parseInt(dur)
    const endH = Math.floor(totalMinutes / 60) % 24
    const endM = totalMinutes % 60
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  // Calculate duration from start time + end time
  const calculateDuration = (startTime: string, finTime: string): string => {
    if (!startTime || !finTime) return '30'
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = finTime.split(':').map(Number)
    const diff = (eh * 60 + em) - (sh * 60 + sm)
    return diff > 0 ? String(diff) : '30'
  }

  // Sync endTime when duration changes
  const handleDurationChange = (newDuration: string) => {
    setDuration(newDuration)
    if (time) {
      setEndTime(calculateEndTime(time, newDuration))
    }
  }

  // Sync duration when endTime changes
  const handleEndTimeChange = (newEndTime: string) => {
    setEndTime(newEndTime)
    if (time) {
      setDuration(calculateDuration(time, newEndTime))
    }
  }

  // Sync time + duration → endTime
  useEffect(() => {
    if (time && duration) {
      setEndTime(calculateEndTime(time, duration))
    }
  }, [time, duration])

  const isReadonly = mode === 'edit' && event ? READONLY_STATUSES.has(event.extendedProps.status) : false
  const status = event?.extendedProps.status

  // Prefill on open
  useEffect(() => {
    if (!open) return
    setError(null)

    if (mode === 'create') {
      setPatientName('')
      setPatientPhone('')
      setDentistId(prefillDentistId || '')
      setProcedureId('')
      setDate(prefillDate ? prefillDate.split(' ')[0] : '')
      setTime(prefillTime || prefillDate?.split(' ')[1]?.slice(0, 5) || '')
      setDuration('30')
      setNotes('')
    } else if (event) {
      setPatientName(event.extendedProps.patientName)
      setPatientPhone(event.extendedProps.patientPhone || '')
      setDentistId(event.resourceId)
      setProcedureId('')
      // Handle both Date object and ISO string formats
      const startDate = event.start instanceof Date
        ? event.start
        : new Date(event.start.replace(' ', 'T'))
      const endDate = event.end instanceof Date
        ? event.end
        : new Date(event.end.replace(' ', 'T'))
      setDate(startDate.toISOString().split('T')[0])
      setTime(startDate.toTimeString().slice(0, 5))
      const durMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
      setDuration(String(durMinutes > 0 ? durMinutes : 30))
      setEndTime(endDate.toTimeString().slice(0, 5))
      setNotes(event.extendedProps.notes || '')
    }
  }, [open, mode, event, prefillDate, prefillTime, prefillDentistId])

  const handleSubmit = async () => {
    if (!profile?.clinic_id) return
    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'create') {
        // Get local timezone offset (e.g., "-03:00", "-04:00", "+05:30")
        const tzOffset = (() => {
          const offset = new Date().getTimezoneOffset()
          const absOffset = Math.abs(offset)
          const hours = Math.floor(absOffset / 60)
          const minutes = absOffset % 60
          const sign = offset <= 0 ? '+' : '-'
          return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        })()
        const scheduledAt = `${date}T${time}:00${tzOffset}`
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_name: patientName,
            patient_phone: patientPhone,
            dentist_id: dentistId,
            procedure_id: procedureId || null,
            scheduled_at: scheduledAt,
            duration_minutes: parseInt(duration),
            clinic_id: profile.clinic_id,
            notes,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao criar agendamento')
        }
      } else if (event) {
        const res = await fetch(`/api/appointments/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dentist_id: dentistId,
            procedure_id: procedureId || null,
            notes,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao atualizar agendamento')
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusAction = async (action: string) => {
    if (!event) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/appointments/${event.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Erro ao ${action} agendamento`)
      }
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Agendamento' : 'Detalhes do Agendamento'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Preencha os dados para criar um novo agendamento' : 'Visualize e gerencie o agendamento'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {mode === 'edit' && event && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={STATUS_BADGE[status!] || 'info'}>
                {STATUS_LABELS[status!] || status}
              </StatusBadge>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Paciente</label>
            {mode === 'edit' ? (
              <p className="text-sm text-foreground mt-1">{patientName}</p>
            ) : (
              <div className="space-y-2 mt-1">
                <Input placeholder="Nome do paciente" value={patientName} onChange={(e) => setPatientName(e.target.value)} disabled={isReadonly} />
                <Input placeholder="Telefone" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} disabled={isReadonly} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Data</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isReadonly} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Início</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={isReadonly} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Término</label>
              <Input type="time" value={endTime} onChange={(e) => handleEndTimeChange(e.target.value)} disabled={isReadonly} className="mt-1" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Duração</label>
            <Select value={duration} onValueChange={handleDurationChange} disabled={isReadonly}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customDurations.map((mins) => (
                  <SelectItem key={mins} value={String(mins)}>{formatDuration(mins)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Profissional</label>
            <Select value={dentistId} onValueChange={setDentistId} disabled={isReadonly}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {dentists.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Procedimento</label>
            <Select value={procedureId} onValueChange={(v) => {
              setProcedureId(v)
              const proc = procedures.find((p: any) => p.id === v)
              if (proc?.duration_minutes) setDuration(String(proc.duration_minutes))
            }} disabled={isReadonly}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {procedures.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.duration_minutes}min)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isReadonly} placeholder="Notas opcionais" className="mt-1" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {mode === 'edit' && event && !isReadonly && (
            <>
              {status === 'scheduled' && (
                <>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusAction('cancel')} disabled={submitting}>Desmarcar</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusAction('confirm')} disabled={submitting}>Confirmar</Button>
                </>
              )}
              {status === 'confirmed' && (
                <>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusAction('cancel')} disabled={submitting}>Desmarcar</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatusAction('noshow')} disabled={submitting}>Não Compareceu</Button>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => handleStatusAction('confirm')} disabled={submitting}>Iniciar</Button>
                </>
              )}
              {status === 'in_progress' && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusAction('confirm')} disabled={submitting}>Concluir</Button>
              )}
            </>
          )}
          {mode === 'edit' && event && status === 'cancelled' && !submitting && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusAction('reactivate')} disabled={submitting}>Remarcar</Button>
          )}
          {mode === 'create' && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !patientName || !dentistId || !date || !time}>
              {submitting ? 'Criando...' : 'Criar Agendamento'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
