// CalendarToolbar — navigation, view switcher, title

import { useCalendarStore } from './store/calendar-store'
import { formatTitle } from './utils/date-utils'
import { cn } from '@/lib/utils'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  SunIcon,
  ViewColumnsIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'
import type { CalendarView } from './utils/types'

const VIEW_OPTIONS: { view: CalendarView; label: string; icon: React.ReactNode; primary?: boolean }[] = [
  { view: 'day', label: 'Dia', icon: <SunIcon className="h-4 w-4" />, primary: true },
  { view: 'week', label: 'Semana', icon: <ViewColumnsIcon className="h-4 w-4" />, primary: true },
  { view: 'month', label: 'Mês', icon: <CalendarDaysIcon className="h-4 w-4" />, primary: true },
  { view: 'professionals', label: 'Profissionais', icon: <UserGroupIcon className="h-4 w-4" />, primary: true },
  { view: 'list', label: 'Lista', icon: <ClipboardDocumentListIcon className="h-4 w-4" /> },
]

export function CalendarToolbar() {
  const { view, selectedDate, setView, goToday, goNext, goPrev } = useCalendarStore()
  const title = formatTitle(selectedDate, view)

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-background">
      {/* Left: Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToday}
          className="px-3 py-1.5 text-sm font-semibold rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
        >
          Hoje
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Proximo"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold ml-2">{title}</h2>
      </div>

      {/* Center: Primary view switcher */}
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        {VIEW_OPTIONS.filter((v) => v.primary).map(({ view: v, label, icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-r border-border last:border-r-0',
              view === v
                ? 'bg-teal-600 text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Right: Secondary view + CTA */}
      <div className="flex items-center gap-2">
        {VIEW_OPTIONS.filter((v) => !v.primary).map(({ view: v, label, icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors border border-border',
              view === v
                ? 'bg-teal-600 text-white border-teal-600'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <button className="px-3 py-1.5 text-sm font-semibold rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm">
          Novo agendamento
        </button>
      </div>
    </div>
  )
}
