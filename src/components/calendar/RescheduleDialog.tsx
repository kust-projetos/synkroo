// RescheduleDialog — confirmation dialog after drag-and-drop in month view
// Lets user pick new time and professional before confirming reschedule

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCalendarStore } from './store/calendar-store'
import { useAuth } from '@/lib/auth/context'
import { useDentists, invalidateAppointmentChanged } from '@/lib/hooks/use-queries'
import { formatDateKey, formatHourLabel } from './utils/date-utils'
import { useToast } from '@/lib/ui/toast'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { getDentistDotColor } from './utils/dentist-colors'
import type { CalendarEvent } from './utils/types'

interface RescheduleDialogProps {
  events: CalendarEvent[]
}

const MINUTE_OPTIONS = ['00', '15', '30', '45']

function formatDisplayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function RescheduleDialog({ events }: RescheduleDialogProps) {
  const { dialog, closeDialog } = useCalendarStore()
  const { profile } = useAuth()
  const clinicId = profile?.clinic_id
  const { data: dentistsData } = useDentists(clinicId)
  const dentists = (dentistsData?.dentists || []) as { id: string; name: string }[]
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const rescheduleInfo =
    dialog.mode === 'reschedule' ? dialog.rescheduleInfo : null
  const event = rescheduleInfo
    ? events.find((e) => e.id === rescheduleInfo.eventId)
    : null

  const [saving, setSaving] = useState(false)
  const [hour, setHour] = useState('')
  const [minute, setMinute] = useState('00')
  const [dentistId, setDentistId] = useState('')

  const isOpen = dialog.open && dialog.mode === 'reschedule'

  // Pre-fill form when dialog opens
  useEffect(() => {
    if (rescheduleInfo && event) {
      setHour(String(rescheduleInfo.originalHour).padStart(2, '0'))
      setMinute(String(rescheduleInfo.originalMinute).padStart(2, '0'))
      setDentistId(event.dentistId)
    }
  }, [rescheduleInfo, event])

  const handleConfirm = useCallback(async () => {
    if (!rescheduleInfo) return
    setSaving(true)

    try {
      const timeStr = `${hour}:${minute}`
      const body: Record<string, unknown> = {
        new_date: rescheduleInfo.targetDateKey,
        new_time: timeStr,
        notify_patient: false,
      }
      if (dentistId) {
        body.dentist_id = dentistId
      }

      const res = await fetch(
        `/api/appointments/${rescheduleInfo.eventId}/reschedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(
          data?.error || 'Nao foi possivel remarcar este agendamento.'
        )
      }

      showToast('Agendamento remarcado com sucesso!', 'success')
      closeDialog()
      // G1: invalida só as faixas de calendário que contêm a data origem ou
      // destino (mês/semana/dia) — antes: prefixo de todas as faixas da clínica.
      // Etapa 1: coleção + detalhe + dashboard junto (helper central).
      const originKey = event ? formatDateKey(event.start) : null
      invalidateAppointmentChanged(
        queryClient,
        clinicId,
        rescheduleInfo.eventId,
        ...(originKey
          ? [originKey, rescheduleInfo.targetDateKey]
          : [rescheduleInfo.targetDateKey]),
      )
    } catch (err) {
      const baseMsg =
        err instanceof Error ? err.message : 'Erro ao remarcar. Tente novamente.'
      // Use more explicit copy for conflict-like errors
      const conflictHint =
        baseMsg.includes('conflito') || baseMsg.includes('disponivel') || baseMsg.includes('horario')
          ? 'Não foi possível salvar a mudança por conflito de horário.'
          : baseMsg
      showToast(conflictHint, 'warning')
    } finally {
      setSaving(false)
    }
  }, [rescheduleInfo, event, hour, minute, dentistId, showToast, closeDialog, queryClient, clinicId])

  if (!rescheduleInfo || !event) return null

  const originalDateStr = event.start.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const originalTimeStr = `${String(event.start.getHours()).padStart(2, '0')}:${String(event.start.getMinutes()).padStart(2, '0')}`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-md" aria-busy={saving}>
        <DialogHeader>
          <DialogTitle>Reagendar Consulta</DialogTitle>
          <DialogDescription>
            Confira os dados e ajuste o horario e profissional antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Event info */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                getDentistDotColor(event.dentistId)
              )}
            />
            {event.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {event.procedureName} &middot; {event.durationMinutes}min
            {event.procedureCategory && (
              <> &middot; {event.procedureCategory}</>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {event.dentistName}
            {event.dentistSpecialty && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {event.dentistSpecialty}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            De: {originalDateStr} às {originalTimeStr}
          </div>
          <div className="text-xs font-medium text-teal-600 dark:text-teal-400">
            Para: {formatDisplayDate(rescheduleInfo.targetDateKey)} às {hour}:{minute}
          </div>
        </div>

        {/* Time picker */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Hora</Label>
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                  <SelectItem key={h} value={String(h).padStart(2, '0')}>
                    {formatHourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Minuto</Label>
            <Select value={minute} onValueChange={setMinute}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dentist selector */}
        <div className="grid gap-1.5">
          <Label>Profissional</Label>
          <Select value={dentistId} onValueChange={setDentistId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar profissional" />
            </SelectTrigger>
            <SelectContent>
              {dentists.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        getDentistDotColor(d.id)
                      )}
                    />
                    {d.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={closeDialog} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !hour || !dentistId}
            aria-busy={saving}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {saving ? 'Reagendando...' : 'Confirmar Reagendamento'}
          </Button>
        </DialogFooter>
        {saving && (
          <p aria-live="polite" className="sr-only">Reagendando consulta...</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
