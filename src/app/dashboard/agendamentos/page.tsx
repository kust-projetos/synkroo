// src/app/dashboard/agendamentos/page.tsx
'use client'

import { Suspense } from 'react'
import { CalendarLayout } from '@/components/calendar/CalendarLayout'
import { ListView } from './list-view'

function AgendamentosContent() {
  return (
    <div className="h-full flex flex-col">
      <CalendarLayout ListComponent={ListView} />
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
