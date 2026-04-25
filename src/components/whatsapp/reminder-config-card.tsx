'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { validateTemplate, type ReminderConfigPerProcedure } from '@/services/reminders/procedure-reminder-config.service'

interface ProcedureType {
  id: string
  name: string
}

const TIMING_OPTIONS = [
  { value: '24', label: '24 horas', hours: 24 },
  { value: '48', label: '48 horas', hours: 48 },
  { value: '168', label: '1 semana', hours: 168 },
]

const SUPPORTED_PLACEHOLDERS = [
  { key: 'paciente_nome', label: '{{paciente_nome}}' },
  { key: 'data', label: '{{data}}' },
  { key: 'horario', label: '{{horario}}' },
  { key: 'dentista', label: '{{dentista}}' },
  { key: 'procedimento', label: '{{procedimento}}' },
]

interface ReminderConfigCardProps {
  procedureType: ProcedureType
  config: ReminderConfigPerProcedure | null
  onSave: (config: ReminderConfigPerProcedure) => Promise<void>
}

export function ReminderConfigCard({ procedureType, config, onSave }: ReminderConfigCardProps) {
  const [hoursBefore, setHoursBefore] = useState<string>('24')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Initialize from config
  useEffect(() => {
    if (config) {
      setHoursBefore(String(config.hours_before))
      setMessageTemplate(config.message_template)
      setEnabled(config.enabled)
    } else {
      // Default values for new config
      setHoursBefore('24')
      setMessageTemplate('')
      setEnabled(true)
    }
    setIsDirty(false)
    setErrors([])
  }, [config, procedureType.id])

  const handleTimingChange = (value: string) => {
    setHoursBefore(value)
    setIsDirty(true)
  }

  const handleTemplateChange = (value: string) => {
    setMessageTemplate(value)
    setIsDirty(true)

    // Real-time validation
    const validation = validateTemplate(value)
    setErrors(validation.errors)
  }

  const handleInsertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById(`template-${procedureType.id}`) as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = messageTemplate.slice(0, start) + `{{${placeholder}}}` + messageTemplate.slice(end)
      setMessageTemplate(newValue)
      setIsDirty(true)

      // Move cursor after inserted placeholder
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + placeholder.length + 4, start + placeholder.length + 4)
      }, 0)
    } else {
      setMessageTemplate((prev) => prev + `{{${placeholder}}}`)
      setIsDirty(true)
    }
  }

  const handleSave = async () => {
    const validation = validateTemplate(messageTemplate)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        procedure_type_id: procedureType.id,
        procedure_type_name: procedureType.name,
        hours_before: parseInt(hoursBefore, 10),
        message_template: messageTemplate,
        enabled,
      })
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (config) {
      setHoursBefore(String(config.hours_before))
      setMessageTemplate(config.message_template)
      setEnabled(config.enabled)
    }
    setIsDirty(false)
    setErrors([])
  }

  const isDefault = !config || (config.hours_before === 24 && !config.message_template)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{procedureType.name}</CardTitle>
          {isDefault && (
            <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
              Padrão
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timing Dropdown */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Enviar lembrete com antecedência</label>
          <Select value={hoursBefore} onValueChange={handleTimingChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template Textarea */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Mensagem personalizada</label>
          <Textarea
            id={`template-${procedureType.id}`}
            value={messageTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            rows={4}
            className="font-mono text-sm"
            placeholder="Digite sua mensagem usando os placeholders abaixo..."
          />

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="text-sm text-destructive">
              {errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}
        </div>

        {/* Placeholder chips */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Placeholders disponíveis (clique para inserir)</label>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_PLACEHOLDERS.map((ph) => (
              <button
                key={ph.key}
                type="button"
                onClick={() => handleInsertPlaceholder(ph.key)}
                className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground font-mono transition-colors"
              >
                {ph.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save/Cancel buttons */}
        {isDirty && (
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={isSaving || errors.length > 0} size="sm">
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button onClick={handleCancel} variant="outline" size="sm">
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export type { ProcedureType }