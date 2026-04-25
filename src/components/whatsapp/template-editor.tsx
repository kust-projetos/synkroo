'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { validateTemplate } from '@/services/reminders/procedure-reminder-config.service'
import { Check, X } from 'lucide-react'

const SUPPORTED_PLACEHOLDERS = [
  { key: 'paciente_nome', label: '{{paciente_nome}}' },
  { key: 'data', label: '{{data}}' },
  { key: 'horario', label: '{{horario}}' },
  { key: 'dentista', label: '{{dentista}}' },
  { key: 'procedimento', label: '{{procedimento}}' },
]

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  errors?: string[]
}

export function TemplateEditor({ value, onChange, errors = [] }: TemplateEditorProps) {
  const [localErrors, setLocalErrors] = useState<string[]>([])

  // Real-time validation
  useEffect(() => {
    const validation = validateTemplate(value)
    setLocalErrors(validation.errors)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleInsertPlaceholder = (placeholder: string) => {
    const textarea = document.activeElement as HTMLTextAreaElement
    if (textarea && textarea.tagName === 'TEXTAREA') {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.slice(0, start) + `{{${placeholder}}}` + value.slice(end)
      onChange(newValue)

      // Move cursor after inserted placeholder
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + placeholder.length + 4, start + placeholder.length + 4)
      }, 0)
    } else {
      onChange((prev) => prev + `{{${placeholder}}}`)
    }
  }

  const isValid = localErrors.length === 0 && value.length > 0

  // Extract placeholders from current value for pill display
  const placeholderRegex = /\{\{(\w+)\}\}/g
  const matches = value.match(placeholderRegex) || []
  const extractedPlaceholders = [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))]

  return (
    <div className="space-y-2">
      {/* Textarea with monospace font */}
      <Textarea
        value={value}
        onChange={handleChange}
        rows={4}
        className="font-mono text-sm"
        placeholder="Digite sua mensagem usando placeholders como {{paciente_nome}}, {{data}}, etc."
      />

      {/* Validation indicator */}
      <div className="flex items-center gap-2">
        {value.length > 0 && (
          <>
            {isValid ? (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Modelo válido
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <X className="h-4 w-4" />
                Modelo com erros
              </span>
            )}
          </>
        )}
      </div>

      {/* Error messages */}
      {(errors.length > 0 || localErrors.length > 0) && (
        <div className="text-sm text-destructive space-y-1">
          {(errors.length > 0 ? errors : localErrors).map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* Extracted placeholders pills */}
      {extractedPlaceholders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Usados:</span>
          {extractedPlaceholders.map((ph) => (
            <span
              key={ph}
              className="text-xs px-2 py-1 rounded-md bg-accent text-accent-foreground font-mono"
            >
              {`{{${ph}}}`}
            </span>
          ))}
        </div>
      )}

      {/* Placeholder chips for insertion */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Clique para inserir placeholder:</label>
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
    </div>
  )
}