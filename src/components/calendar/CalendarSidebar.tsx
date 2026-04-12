// src/components/calendar/CalendarSidebar.tsx
'use client'

import { MiniCalendar } from './MiniCalendar'
import { DentistFilter } from './DentistFilter'
import { SpecialtyFilter } from './SpecialtyFilter'

interface Dentist {
  id: string
  name: string
  specialty: string | null
}

interface CalendarSidebarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  dentists: Dentist[]
  selectedDentistIds: string[]
  onDentistChange: (ids: string[]) => void
  specialty: string
  onSpecialtyChange: (value: string) => void
}

export function CalendarSidebar({
  selectedDate,
  onSelectDate,
  dentists,
  selectedDentistIds,
  onDentistChange,
  specialty,
  onSpecialtyChange,
}: CalendarSidebarProps) {
  // Get distinct specialties
  const specialties = Array.from(
    new Set(dentists.map((d) => d.specialty).filter(Boolean))
  ) as string[]

  // Filter dentists by selected specialty
  const filteredDentists = specialty
    ? dentists.filter((d) => d.specialty === specialty)
    : dentists

  return (
    <aside className="calendar-sidebar w-[280px] flex-shrink-0 border-r border-border p-4 space-y-6 hidden lg:block">
      <MiniCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
      <SpecialtyFilter specialties={specialties} value={specialty} onChange={onSpecialtyChange} />
      <DentistFilter
        dentists={filteredDentists}
        selectedIds={selectedDentistIds}
        onChange={onDentistChange}
      />
    </aside>
  )
}
