'use client'

import { useState, useEffect } from 'react'
import { useCustomFieldDefinitions, useCustomFieldValues, queryKeys } from '@/lib/hooks/use-queries'
import { useCurrentClinicId } from '@/lib/auth/context'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

interface ContactCustomFieldsTabProps {
  contactId: string
  contactType: 'patient' | 'lead'
}

interface FieldValueState {
  [definitionId: string]: string | number | boolean | null
}

export function ContactCustomFieldsTab({ contactId, contactType }: ContactCustomFieldsTabProps) {
  const queryClient = useQueryClient()
  // G1: invalidação no mesmo escopo da query (antes usava até o domínio errado).
  const clinicId = useCurrentClinicId()
  const [fieldValues, setFieldValues] = useState<FieldValueState>({})
  const [isDirty, setIsDirty] = useState(false)

  const { data: defsData, isLoading: defsLoading } = useCustomFieldDefinitions()
  const { data: valuesData, isLoading: valuesLoading } = useCustomFieldValues(contactId, contactType)

  const definitions = defsData?.data ?? []

  useEffect(() => {
    if (valuesData?.data) {
      const initial: FieldValueState = {}
      for (const v of valuesData.data) {
        let val: string | number | boolean | null = null
        if (v.value_text !== null) val = v.value_text
        else if (v.value_number !== null) val = v.value_number
        else if (v.value_date !== null) val = v.value_date
        else if (v.value_boolean !== null) val = v.value_boolean
        else if (v.value_json !== null) val = JSON.stringify(v.value_json)
        initial[v.definition_id] = val
      }
      setFieldValues(initial)
    }
  }, [valuesData])

  const updateMutation = useMutation({
    mutationFn: async (values: FieldValueState) => {
      const fields = Object.entries(values).map(([definition_id, value]) => ({
        definition_id,
        value,
      }))
      const res = await fetch('/api/custom-fields/values', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, contact_type: contactType, fields }),
      })
      if (!res.ok) throw new Error('Failed to save custom fields')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFieldValues(contactId, contactType, clinicId) })
      setIsDirty(false)
    },
  })

  const handleChange = (definitionId: string, value: string | number | boolean | null) => {
    setFieldValues((prev) => ({ ...prev, [definitionId]: value }))
    setIsDirty(true)
  }

  const handleSave = () => {
    updateMutation.mutate(fieldValues)
  }

  const isLoading = defsLoading || valuesLoading

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (definitions.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="Nenhum campo personalizado"
          description="Configure os campos personalizados nas configurações"
        />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {definitions.map((def: any) => (
        <div key={def.id} className="space-y-1.5">
          <Label className="flex items-center gap-1">
            {def.required && <span className="text-red-500">*</span>}
            {def.name}
          </Label>
          {def.field_type === 'text' && (
            <Input
              type="text"
              value={(fieldValues[def.id] as string) ?? ''}
              onChange={(e) => handleChange(def.id, e.target.value)}
            />
          )}
          {def.field_type === 'number' && (
            <Input
              type="number"
              value={fieldValues[def.id] as number ?? ''}
              onChange={(e) => handleChange(def.id, e.target.value ? Number(e.target.value) : null)}
            />
          )}
          {def.field_type === 'date' && (
            <Input
              type="date"
              value={(fieldValues[def.id] as string) ?? ''}
              onChange={(e) => handleChange(def.id, e.target.value || null)}
            />
          )}
          {def.field_type === 'select' && (
            <Select
              value={(fieldValues[def.id] as string) ?? ''}
              onValueChange={(v) => handleChange(def.id, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {def.options.map((opt: any) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {def.field_type === 'checkbox' && (
            <div className="flex items-center gap-2">
              <Switch
                checked={(fieldValues[def.id] as boolean) ?? false}
                onCheckedChange={(checked) => handleChange(def.id, checked)}
              />
              <span className="text-sm text-muted-foreground">
                {(fieldValues[def.id] as boolean) ? 'Sim' : 'Não'}
              </span>
            </div>
          )}
        </div>
      ))}

      {isDirty && (
        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      )}
    </div>
  )
}
