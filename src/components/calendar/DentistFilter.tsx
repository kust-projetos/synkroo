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

/** Extract initials from a name (e.g., "João Silva" → "JS") */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
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
          className="text-[10px] text-teal-600 hover:text-teal-700 font-medium transition-colors"
        >
          {allSelected ? 'Nenhum' : 'Todos'}
        </button>
      </div>
      <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
        {dentists.map((dentist) => {
          const isSelected = selectedIds.includes(dentist.id)
          const color = getDentistColor(dentist.id)
          const initials = getInitials(dentist.name)
          return (
            <label
              key={dentist.id}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'bg-muted/80 shadow-sm'
                  : 'opacity-50 hover:opacity-70'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleDentist(dentist.id)}
                className="sr-only"
              />
              {/* Avatar with initials */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{dentist.name}</span>
                {dentist.specialty && (
                  <span className="text-[10px] text-muted-foreground truncate">{dentist.specialty}</span>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
