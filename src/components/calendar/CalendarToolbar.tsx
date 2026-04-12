// src/components/calendar/CalendarToolbar.tsx
'use client'

import { addWeeks, addMonths, addDays, subWeeks, subMonths, subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import {
  CalendarIcon,
  CalendarDaysIcon,
  ClockIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import type { CalendarView } from './hooks/useCalendarState'
import { VIEW_LABELS } from './hooks/useCalendarState'

const ALL_VIEWS: CalendarView[] = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay']

const VIEW_ICONS: Record<CalendarView, React.ComponentType<{ className?: string }>> = {
  dayGridMonth: CalendarDaysIcon,
  timeGridWeek: CalendarIcon,
  timeGridDay: ClockIcon,
  resourceTimeGridDay: UsersIcon,
}

interface CalendarToolbarProps {
  view: CalendarView
  date: Date
  onViewChange: (view: CalendarView) => void
  onDateChange: (date: Date) => void
  onToday: () => void
  onNewAppointment: () => void
  isLoading: boolean
  availableViews: CalendarView[]
}

export function CalendarToolbar({
  view,
  date,
  onViewChange,
  onDateChange,
  onToday,
  onNewAppointment,
  isLoading,
  availableViews,
}: CalendarToolbarProps) {
  const navigate = (direction: 'prev' | 'next') => {
    switch (view) {
      case 'dayGridMonth':
        onDateChange(direction === 'prev' ? subMonths(date, 1) : addMonths(date, 1))
        break
      case 'timeGridWeek':
        onDateChange(direction === 'prev' ? subWeeks(date, 1) : addWeeks(date, 1))
        break
      case 'timeGridDay':
      case 'resourceTimeGridDay':
        onDateChange(direction === 'prev' ? subDays(date, 1) : addDays(date, 1))
        break
    }
  }

  const title = (() => {
    switch (view) {
      case 'dayGridMonth':
        return format(date, "MMMM 'de' yyyy", { locale: ptBR })
      case 'timeGridWeek':
        return format(date, "d 'de' MMM", { locale: ptBR })
      case 'timeGridDay':
      case 'resourceTimeGridDay':
        return format(date, "EEEE, d 'de' MMMM", { locale: ptBR })
      default:
        return format(date, 'dd/MM/yyyy')
    }
  })()

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 shadow-sm">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('prev')}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('next')}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToday}>
          Hoje
        </Button>
        <h2 className="text-sm font-semibold ml-2 capitalize">{title}</h2>
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent ml-2" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 shadow-sm">
          {availableViews.map((v) => {
            const ViewIcon = VIEW_ICONS[v]
            return (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  view === v
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background'
                }`}
              >
                <ViewIcon className="h-3.5 w-3.5" />
                {VIEW_LABELS[v]}
              </button>
            )
          })}
        </div>
        <Button size="sm" onClick={onNewAppointment} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 shadow-sm">
          <PlusIcon className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>
    </div>
  )
}
