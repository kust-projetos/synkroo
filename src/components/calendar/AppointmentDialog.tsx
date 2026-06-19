// AppointmentDialog — create/edit appointment dialog

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCalendarStore } from './store/calendar-store'
import { useAuth } from '@/lib/auth/context'
import { useDentists, useProcedures } from '@/lib/hooks/use-queries'
import { formatHourLabel } from './utils/date-utils'
import type { AppointmentStatus } from '@/lib/db/types'

interface DialogFormData {
  patientName: string
  patientPhone: string
  dentistId: string
  procedureId: string
  date: string
  hour: string
  minute: string
  duration: number
  notes: string
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]

export function AppointmentDialog() {
  const { dialog, closeDialog } = useCalendarStore()
  const { profile } = useAuth()
  const clinicId = profile?.clinic_id

  const { data: dentistsData } = useDentists(clinicId)
  const { data: proceduresData } = useProcedures(clinicId)

  const dentists = (dentistsData?.dentists || []) as { id: string; name: string }[]
  const procedures = (proceduresData?.procedures || []) as { id: string; name: string; duration_minutes: number }[]

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<DialogFormData>({
    patientName: '',
    patientPhone: '',
    dentistId: '',
    procedureId: '',
    date: '',
    hour: '09',
    minute: '00',
    duration: 30,
    notes: '',
  })

  // Pre-fill form when dialog opens with slot info
  useEffect(() => {
    if (dialog.open && dialog.mode === 'create' && dialog.slotInfo) {
      const { date, hour, minute, dentistId } = dialog.slotInfo
      const d = date
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setForm((prev) => ({
        ...prev,
        date: dateStr,
        hour: String(hour).padStart(2, '0'),
        minute: String(minute).padStart(2, '0'),
        dentistId: dentistId || prev.dentistId,
      }))
    }
  }, [dialog])

  // Pre-fill from contact/lead context
  useEffect(() => {
    if (!dialog.open || dialog.mode !== 'create') return

    const { defaultPatientId, defaultLeadName, defaultLeadPhone } = dialog
    if (!defaultPatientId && !defaultLeadName) return

    const prefill = async () => {
      if (defaultPatientId) {
        // Fetch patient data
        const res = await fetch(`/api/patients/${defaultPatientId}`)
        const data = await res.json()
        const patient = data?.patient
        if (patient) {
          setForm((prev) => ({
            ...prev,
            patientName: patient.name || '',
            patientPhone: patient.phone || '',
          }))
        }
      } else if (defaultLeadName) {
        // Use lead data directly
        setForm((prev) => ({
          ...prev,
          patientName: defaultLeadName,
          patientPhone: defaultLeadPhone || '',
        }))
      }

      // Clear pre-fill state after using it
      useCalendarStore.getState().clearPrefill()
    }

    prefill()
  }, [dialog])

  // Update duration when procedure changes
  useEffect(() => {
    if (form.procedureId) {
      const proc = procedures.find((p) => p.id === form.procedureId)
      if (proc?.duration_minutes) {
        setForm((prev) => ({ ...prev, duration: proc.duration_minutes }))
      }
    }
  }, [form.procedureId, procedures])

  const handleSave = useCallback(async () => {
    if (!clinicId || !form.patientName || !form.date) return

    setSaving(true)
    try {
      const scheduledAt = new Date(`${form.date}T${form.hour}:${form.minute}:00`)

      // First, find or create patient
      let patientId = ''
      const patientRes = await fetch('/api/patients?search=' + encodeURIComponent(form.patientName))
      const patientData = await patientRes.json()
      const existing = patientData?.patients?.find(
        (p: { name: string }) => p.name.toLowerCase() === form.patientName.toLowerCase()
      )

      if (existing) {
        patientId = existing.id
      } else {
        const createRes = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.patientName,
            phone: form.patientPhone || undefined,
          }),
        })
        const created = await createRes.json()
        patientId = created.patient?.id
      }

      if (!patientId) throw new Error('Failed to create/find patient')

      // Create appointment
      await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          dentist_id: form.dentistId || undefined,
          procedure_id: form.procedureId || undefined,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: form.duration,
          notes: form.notes || undefined,
        }),
      })

      closeDialog()
    } catch (err) {
      console.error('Failed to save appointment:', err)
    } finally {
      setSaving(false)
    }
  }, [form, clinicId, closeDialog])

  const isCreate = dialog.mode === 'create'

  return (
    <Dialog open={dialog.open && (dialog.mode === 'create' || dialog.mode === 'edit')} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'Novo Agendamento' : 'Editar Agendamento'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Patient */}
          <div className="grid gap-2">
            <Label htmlFor="patient">Paciente *</Label>
            <Input
              id="patient"
              placeholder="Nome do paciente"
              value={form.patientName}
              onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Select value={form.hour} onValueChange={(v) => setForm((f) => ({ ...f, hour: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 11 }, (_, i) => i + 8).map((h) => (
                    <SelectItem key={h} value={String(h).padStart(2, '0')}>
                      {formatHourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Duração</Label>
              <Select
                value={String(form.duration)}
                onValueChange={(v) => setForm((f) => ({ ...f, duration: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dentist */}
          <div className="grid gap-2">
            <Label>Dentista</Label>
            <Select value={form.dentistId} onValueChange={(v) => setForm((f) => ({ ...f, dentistId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar dentista" />
              </SelectTrigger>
              <SelectContent>
                {dentists.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Procedure */}
          <div className="grid gap-2">
            <Label>Procedimento</Label>
            <Select value={form.procedureId} onValueChange={(v) => setForm((f) => ({ ...f, procedureId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar procedimento" />
              </SelectTrigger>
              <SelectContent>
                {procedures.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.duration_minutes}min)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional fields separator */}
          <div className="border-t pt-4 mt-1">
            <p className="text-xs text-muted-foreground mb-3">Informações adicionais</p>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={form.patientPhone}
                onChange={(e) => setForm((f) => ({ ...f, patientPhone: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2 mt-4">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                placeholder="Notas opcionais..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.patientName || !form.date}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {saving ? 'Salvando...' : isCreate ? 'Agendar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
