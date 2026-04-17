// src/app/dashboard/agendamentos/page.tsx
'use client'

import { useState } from 'react'
import { Suspense } from 'react'
import { CalendarLayout } from '@/components/calendar/CalendarLayout'
import { ListView } from './list-view'

type ViewMode = 'calendar' | 'list'

function AgendamentosContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')

  return (
    <div className="relative h-full flex flex-col">
      {/* View toggle — floating top-right */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex rounded-lg border border-border overflow-hidden bg-background shadow-sm">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'calendar' ? 'bg-teal-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Calendario
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-teal-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Lista
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {viewMode === 'calendar' ? <CalendarLayout /> : <ListView />}
      </div>
    </div>
  )
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    }>
      <AgendamentosContent />
    </Suspense>
  )
}
