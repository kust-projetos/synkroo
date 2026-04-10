// src/components/calendar/SpecialtyFilter.tsx
'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SpecialtyFilterProps {
  specialties: string[]
  value: string
  onChange: (value: string) => void
}

export function SpecialtyFilter({ specialties, value, onChange }: SpecialtyFilterProps) {
  if (specialties.length === 0) return null

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Especialidade</span>
      <Select value={value || '_all'} onValueChange={(v) => onChange(v === '_all' ? '' : v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Todas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Todas</SelectItem>
          {specialties.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
