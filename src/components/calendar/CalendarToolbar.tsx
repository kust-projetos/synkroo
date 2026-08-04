// CalendarToolbar — navigation, view switcher, title

import Link from 'next/link'
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
  const { view, selectedDate, setView, goToday, goNext, goPrev, groupMode, densityMode, setGroupMode, setDensityMode, layoutMode, setLayoutMode } = useCalendarStore()
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

        {/* Layout mode toggle — only in day/week/month views */}
        {(view === 'day' || view === 'week' || view === 'month') && (
          <div className="flex items-center ml-3 pl-3 border-l border-border">
            {(['agenda', 'professionals'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayoutMode(mode)}
                className={cn(
                  'px-2 py-0.5 text-[10px] font-medium rounded transition-colors',
                  layoutMode === mode
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {mode === 'agenda' ? 'Agenda' : 'Profissionais'}
              </button>
            ))}
          </div>
        )}

        {/* Professionals scaling controls — visible only in professionals view */}
        {view === 'professionals' && (
          <div className="flex items-center gap-1 ml-4 pl-4 border-l border-border">
            <span className="text-[10px] text-muted-foreground mr-1">Agrupar:</span>
            {(['professionals', 'time', 'status'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode)}
                className={cn(
                  'px-1.5 py-0.5 text-[10px] rounded transition-colors',
                  groupMode === mode
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {mode === 'professionals' ? 'Prof.' : mode === 'time' ? 'Hora' : 'Status'}
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground mx-1">|</span>
            {(['comfortable', 'compact'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDensityMode(mode)}
                className={cn(
                  'px-1.5 py-0.5 text-[10px] rounded transition-colors',
                  densityMode === mode
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {mode === 'compact' ? 'Compacto' : 'Confortável'}
              </button>
            ))}
          </div>
        )}
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
        <Link
          href="/dashboard/agendamentos/novo"
          className="px-3 py-1.5 text-sm font-medium rounded-md text-teal-600 dark:text-teal-400 border border-teal-600/30 dark:border-teal-400/30 hover:bg-teal-50 dark:hover:bg-teal-950/20 transition-colors"
        >
          Novo agendamento
        </Link>
      </div>
    </div>
  )
}
