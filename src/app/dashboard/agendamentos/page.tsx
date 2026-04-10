// src/app/dashboard/agendamentos/page.tsx
'use client'

import { useState } from 'react'
import { CalendarLayout } from '@/components/calendar/CalendarLayout'
import { ListView } from './list-view'

type ViewMode = 'calendar' | 'list'

export default function AppointmentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')

  return (
    <div className="relative">
      {/* View toggle — floating top-right */}
      <div className="absolute top-4 right-4 z-10 lg:hidden">
        <div className="flex rounded-lg border border-border overflow-hidden bg-background shadow-sm">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'calendar' ? 'bg-teal-600 text-white' : 'text-muted-foreground'}`}
          >
            Calendário
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'text-muted-foreground'}`}
          >
            Lista
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? <CalendarLayout /> : <ListView />}
    </div>
  )
}
