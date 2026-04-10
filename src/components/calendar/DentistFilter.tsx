// src/components/calendar/DentistFilter.tsx
'use client'

import { getDentistColor } from './utils/dentist-colors'

interface Dentist {
  id: string
  name: string
  specialty: string | null
}

interface DentistFilterProps {
  dentists: Dentist[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function DentistFilter({ dentists, selectedIds, onChange }: DentistFilterProps) {
  const toggleDentist = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((d) => d !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const allSelected = selectedIds.length === dentists.length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profissionais</span>
        <button
          onClick={() => onChange(allSelected ? [] : dentists.map((d) => d.id))}
          className="text-[10px] text-teal-600 hover:text-teal-700"
        >
          {allSelected ? 'Nenhum' : 'Todos'}
        </button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {dentists.map((dentist) => {
          const isSelected = selectedIds.includes(dentist.id)
          const color = getDentistColor(dentist.id)
          return (
            <label
              key={dentist.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isSelected ? 'bg-muted' : 'opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleDentist(dentist.id)}
                className="sr-only"
              />
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm truncate">{dentist.name}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
