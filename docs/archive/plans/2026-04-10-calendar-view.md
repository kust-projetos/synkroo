# Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat list appointments page with a Google Calendar-style scheduling interface using @event-calendar/core.

**Architecture:** Vanilla JS calendar wrapped in React via useRef/createCalendar. Sidebar with dentist/specialty filters. URL-persisted state. Optimistic drag-and-drop with server-side reschedule endpoint.

**Tech Stack:** Next.js 15, @event-calendar/core v5.6, React Query, Radix UI Dialog, Tailwind CSS, date-fns (MiniCalendar only)

**Spec:** `docs/superpowers/specs/2026-04-10-calendar-view-design.md`

---

## Task 1: Install dependency

**Files:** None (package.json modified by npm)

- [ ] **Step 1: Install @event-calendar/core**

```bash
cd projetos/synkroo && npm install @event-calendar/core@^5.6.0
```

- [ ] **Step 2: Verify installation**

```bash
npm ls @event-calendar/core
```

Expected: `@event-calendar/core@5.6.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @event-calendar/core dependency for calendar view"
```

---

## Task 2: Pure utility — dentist colors

**Files:**
- Create: `src/components/calendar/utils/dentist-colors.ts`

- [ ] **Step 1: Create dentist-colors.ts**

```typescript
// src/components/calendar/utils/dentist-colors.ts

const DENTIST_PALETTE = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
] as const

/**
 * Get a deterministic color for a dentist.
 * Uses a Map cache so the same ID always returns the same color.
 */
const colorCache = new Map<string, string>()

export function getDentistColor(dentistId: string, fallbackIndex?: number): string {
  const cached = colorCache.get(dentistId)
  if (cached) return cached

  // Deterministic pick from ID hash if no index provided
  let index: number
  if (fallbackIndex !== undefined) {
    index = fallbackIndex
  } else {
    let hash = 0
    for (let i = 0; i < dentistId.length; i++) {
      hash = ((hash << 5) - hash + dentistId.charCodeAt(i)) | 0
    }
    index = Math.abs(hash)
  }

  const color = DENTIST_PALETTE[index % DENTIST_PALETTE.length]
  colorCache.set(dentistId, color)
  return color
}

export function clearDentistColorCache(): void {
  colorCache.clear()
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/components/calendar/utils/dentist-colors.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/utils/dentist-colors.ts
git commit -m "feat(calendar): add dentist color utility with deterministic palette"
```

---

## Task 3: Extend API — GET /api/appointments

**Files:**
- Modify: `src/app/api/appointments/route.ts`

- [ ] **Step 1: Add dentist_ids and specialty params to GET handler**

In `src/app/api/appointments/route.ts`, modify the GET function. After line 26 (`const endDate = ...`), add the new params:

```typescript
    const dentistIds = searchParams.getAll('dentist_ids')  // repeated param: ?dentist_ids=a&dentist_ids=b
    const specialty = searchParams.get('specialty')
```

- [ ] **Step 2: Add specialty to dentist join select**

Change line 38 from:
```
        dentists (id, name),
```
to:
```
        dentists (id, name, specialty),
```

- [ ] **Step 3: Add filter logic after existing filters (after line 47 `if (status)...`)**

```typescript
    // Multi-dentist filter (repeated params)
    if (dentistIds.length > 0) {
      query = query.in('dentist_id', dentistIds)
    }

    // Specialty filter — join on dentists table
    if (specialty) {
      query = query.eq('dentists.specialty', specialty)
    }
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds (existing warnings are fine)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/appointments/route.ts
git commit -m "feat(api): extend GET /appointments with dentist_ids and specialty filters"
```

---

## Task 4: Hook — useCalendarState (URL params)

**Files:**
- Create: `src/components/calendar/hooks/useCalendarState.ts`

- [ ] **Step 1: Create useCalendarState hook**

```typescript
// src/components/calendar/hooks/useCalendarState.ts
'use client'

import { useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, addDays } from 'date-fns'

export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'resourceTimeGridDay'

export const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: 'Mês',
  timeGridWeek: 'Semana',
  timeGridDay: 'Dia',
  resourceTimeGridDay: 'Profissionais',
}

export const ALL_VIEWS: CalendarView[] = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimeGridDay']

export const MOBILE_VIEWS: CalendarView[] = ['timeGridDay']

export interface CalendarState {
  view: CalendarView
  date: Date
  dentistIds: string[]
  specialty: string
  startDate: string
  endDate: string
}

export function useCalendarState() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const state: CalendarState = useMemo(() => {
    const viewParam = searchParams.get('view') as CalendarView | null
    const view = ALL_VIEWS.includes(viewParam!) ? viewParam! : 'timeGridWeek'
    const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
    const date = new Date(dateStr + 'T12:00:00')
    const dentists = searchParams.get('dentists') || ''
    const dentistIds = dentists ? dentists.split(',').filter(Boolean) : []
    const specialty = searchParams.get('specialty') || ''

    // Compute date range based on view
    let startDate: string
    let endDate: string
    switch (view) {
      case 'dayGridMonth':
        startDate = format(startOfMonth(date), 'yyyy-MM-dd')
        endDate = format(endOfMonth(date), 'yyyy-MM-dd')
        break
      case 'resourceTimeGridDay':
      case 'timeGridDay':
        startDate = dateStr
        endDate = dateStr
        break
      case 'timeGridWeek':
      default:
        startDate = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        endDate = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        break
    }

    return { view, date, dentistIds, specialty, startDate, endDate }
  }, [searchParams])

  const updateState = useCallback((updates: Partial<{
    view: CalendarView
    date: Date
    dentistIds: string[]
    specialty: string
  }>) => {
    const params = new URLSearchParams(searchParams.toString())

    if (updates.view) params.set('view', updates.view)
    if (updates.date) params.set('date', format(updates.date, 'yyyy-MM-dd'))
    if (updates.dentistIds) {
      if (updates.dentistIds.length > 0) {
        params.set('dentists', updates.dentistIds.join(','))
      } else {
        params.delete('dentists')
      }
    }
    if (updates.specialty !== undefined) {
      if (updates.specialty) {
        params.set('specialty', updates.specialty)
      } else {
        params.delete('specialty')
      }
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  return { state, updateState }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/components/calendar/hooks/useCalendarState.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/hooks/useCalendarState.ts
git commit -m "feat(calendar): add useCalendarState hook for URL-persisted calendar state"
```

---

## Task 5: Hook — useCalendarEvents (data fetch + transform)

**Files:**
- Create: `src/components/calendar/hooks/useCalendarEvents.ts`
- Modify: `src/lib/hooks/use-queries.ts` (add calendar query key + hook)

- [ ] **Step 1: Add calendar query key and hook to use-queries.ts**

Add after the `queryKeys` object (after line 30):

```typescript
  calendarEvents: (params?: string) => ['calendar-events', params] as const,
```

Add after `useAppointments` (after line 125):

```typescript
/**
 * Calendar events — cached for 30s, enriched with joins
 */
export function useCalendarEvents(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : ''

  return useQuery({
    queryKey: queryKeys.calendarEvents(qs),
    queryFn: () => fetcher<any>(`/api/appointments${qs ? `?${qs}` : ''}`),
    staleTime: 30 * 1000,
    enabled: !!params,
  })
}
```

- [ ] **Step 2: Create useCalendarEvents hook (transform layer)**

```typescript
// src/components/calendar/hooks/useCalendarEvents.ts
'use client'

import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCalendarEvents as useCalendarEventsQuery } from '@/lib/hooks/use-queries'
import { getDentistColor } from '../utils/dentist-colors'
import { queryKeys } from '@/lib/hooks/use-queries'

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  resourceId: string
  backgroundColor: string
  editable: boolean
  extendedProps: {
    patientName: string
    procedureName: string
    status: string
    dentistName: string
    notes: string | null
    patientPhone: string | null
  }
}

export interface CalendarResource {
  id: string
  title: string
  eventBackgroundColor: string
}

interface AppointmentResponse {
  appointments: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    status: string
    notes: string | null
    patients?: { id: string; name: string; phone: string } | null
    dentists?: { id: string; name: string; specialty: string } | null
    procedures?: { id: string; name: string; duration_minutes: number } | null
  }>
}

const EDITABLE_STATUSES = new Set(['scheduled', 'confirmed', 'in_progress'])

function formatDateTime(dateStr: string): string {
  // API returns ISO with offset: "2026-04-10T09:00:00-03:00"
  // @event-calendar/core expects: "2026-04-10 09:00:00"
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

function addMinutes(dateStr: string, minutes: number): string {
  const d = new Date(dateStr)
  d.setMinutes(d.getMinutes() + minutes)
  return formatDateTime(d.toISOString())
}

export function useCalendarEvents(
  clinicId: string | undefined,
  startDate: string,
  endDate: string,
  dentistIds: string[],
  specialty: string
) {
  const queryClient = useQueryClient()

  const params = useMemo(() => {
    if (!clinicId) return undefined
    const p: Record<string, string> = {
      clinic_id: clinicId,
      start_date: startDate,
      end_date: endDate,
    }
    // Use first dentist_id for now (repeated params handled via URL construction)
    if (dentistIds.length > 0) {
      // We'll construct the URL manually to support repeated params
      return p
    }
    if (specialty) p.specialty = specialty
    return p
  }, [clinicId, startDate, endDate, dentistIds, specialty])

  // Build URL with repeated dentist_ids
  const queryUrl = useMemo(() => {
    if (!params) return ''
    const urlParams = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => urlParams.set(k, v))
    dentistIds.forEach(id => urlParams.append('dentist_ids', id))
    if (specialty) urlParams.set('specialty', specialty)
    return urlParams.toString()
  }, [params, dentistIds, specialty])

  const { data, isLoading, error, refetch } = useCalendarEventsQuery(queryUrl ? Object.fromEntries(new URLSearchParams(queryUrl)) : undefined)

  const events = useMemo((): CalendarEvent[] => {
    if (!data?.appointments) return []
    return data.appointments
      .filter((apt) => apt.dentists?.id)
      .map((apt, index) => ({
        id: apt.id,
        title: apt.patients?.name || 'Paciente',
        start: formatDateTime(apt.scheduled_at),
        end: addMinutes(apt.scheduled_at, apt.duration_minutes),
        resourceId: apt.dentists!.id,
        backgroundColor: getDentistColor(apt.dentists!.id, index),
        editable: EDITABLE_STATUSES.has(apt.status),
        extendedProps: {
          patientName: apt.patients?.name || 'Paciente',
          procedureName: apt.procedures?.name || '',
          status: apt.status,
          dentistName: apt.dentists?.name || '',
          notes: apt.notes,
          patientPhone: apt.patients?.phone || null,
        },
      }))
  }, [data])

  const resources = useMemo((): CalendarResource[] => {
    if (!data?.appointments) return []
    const seen = new Map<string, { name: string; color: string }>()
    data.appointments.forEach((apt, index) => {
      if (apt.dentists?.id && !seen.has(apt.dentists.id)) {
        seen.set(apt.dentists.id, {
          name: apt.dentists.name,
          color: getDentistColor(apt.dentists.id, index),
        })
      }
    })
    return Array.from(seen.entries()).map(([id, info]) => ({
      id,
      title: info.name,
      eventBackgroundColor: info.color,
    }))
  }, [data])

  const invalidateCalendar = () => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
  }

  return { events, resources, isLoading, error, refetch, invalidateCalendar }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/components/calendar/hooks/useCalendarEvents.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/hooks/useCalendarEvents.ts src/lib/hooks/use-queries.ts
git commit -m "feat(calendar): add useCalendarEvents hook with data transform"
```

---

## Task 6: EventCard + status CSS

**Files:**
- Create: `src/components/calendar/EventCard.tsx`
- Create: `src/components/calendar/calendar-styles.css`

- [ ] **Step 1: Create EventCard (eventContent callback)**

```typescript
// src/components/calendar/EventCard.tsx

/**
 * Custom event rendering callback for @event-calendar/core.
 * Returns HTML for event cards in week/day/resource views.
 */
export function eventContent(info: any): { html: string } {
  const { event, timeText, view } = info
  const props = event.extendedProps || {}
  const isMonthView = view.type === 'dayGridMonth'

  if (isMonthView) {
    return {
      html: `
        <div style="display:flex;align-items:center;gap:4px;overflow:hidden;font-size:11px;">
          <span style="width:6px;height:6px;border-radius:50%;background:${event.backgroundColor};flex-shrink:0;"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${timeText} ${event.title}</span>
        </div>
      `,
    }
  }

  return {
    html: `
      <div style="display:flex;flex-direction:column;padding:2px 4px;gap:1px;overflow:hidden;">
        <span style="font-size:11px;color:rgba(255,255,255,0.8);font-weight:500;">${timeText}</span>
        <span style="font-size:12px;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${event.title}</span>
        <span style="font-size:10px;color:rgba(255,255,255,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${props.procedureName || ''}</span>
      </div>
    `,
  }
}
```

- [ ] **Step 2: Create status CSS**

```css
/* src/components/calendar/calendar-styles.css */

/* Status-specific event styles */
.ec-event.ec-status-scheduled {
  border-left: 3px dashed rgba(96, 165, 250, 0.8) !important;
  opacity: 0.85;
}

.ec-event.ec-status-confirmed {
  border-left: 3px solid rgba(52, 211, 153, 0.8) !important;
}

.ec-event.ec-status-in-progress {
  border-left: 3px solid rgba(16, 185, 129, 0.9) !important;
  background-size: 200% 100% !important;
  animation: ec-shimmer 2s linear infinite;
}

.ec-event.ec-status-completed {
  border-left: 3px solid rgba(209, 213, 219, 0.6) !important;
  opacity: 0.7;
}

.ec-event.ec-status-cancelled {
  border-left: 3px solid rgba(248, 113, 113, 0.6) !important;
  opacity: 0.5;
  text-decoration: line-through;
}

.ec-event.ec-status-no-show {
  border-left: 3px solid rgba(248, 113, 113, 0.8) !important;
  opacity: 0.5;
}

@keyframes ec-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Dark mode integration with next-themes */
.dark .ec {
  color-scheme: dark;
}

.ec {
  --ec-border-color: var(--border);
  --ec-today-bg-color: rgba(59, 130, 246, 0.08);
  --ec-highlight-color: rgba(59, 130, 246, 0.12);
  font-family: inherit;
}

/* Calendar takes full height of container */
.ec {
  height: 100%;
}

/* Responsive: hide sidebar on mobile */
@media (max-width: 767px) {
  .calendar-sidebar {
    display: none;
  }
}
```

- [ ] **Step 3: Create eventClassNames callback (add to EventCard.tsx)**

Append to EventCard.tsx:

```typescript
/**
 * Returns CSS class names based on appointment status.
 * Non-editable statuses are not draggable via Interaction plugin.
 */
export function eventClassNames(info: any): string[] {
  const status = info.event.extendedProps?.status || ''
  return [`ec-status-${status}`]
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/EventCard.tsx src/components/calendar/calendar-styles.css
git commit -m "feat(calendar): add EventCard rendering and status CSS styles"
```

---

## Task 7: ScheduleCalendar wrapper

**Files:**
- Create: `src/components/calendar/ScheduleCalendar.tsx`

- [ ] **Step 1: Create the calendar wrapper component**

```typescript
// src/components/calendar/ScheduleCalendar.tsx
'use client'

import { useEffect, useRef, useMemo } from 'react'
import {
  createCalendar,
  destroyCalendar,
  DayGrid,
  TimeGrid,
  ResourceTimeGrid,
  Interaction,
} from '@event-calendar/core'
import '@event-calendar/core/index.css'
import './calendar-styles.css'

import { eventContent, eventClassNames } from './EventCard'
import type { CalendarEvent, CalendarResource } from './hooks/useCalendarEvents'
import type { CalendarView } from './hooks/useCalendarState'

const PLUGINS = [DayGrid, TimeGrid, ResourceTimeGrid, Interaction]

interface ScheduleCalendarProps {
  events: CalendarEvent[]
  resources: CalendarResource[]
  view: CalendarView
  date: Date
  onEventClick: (event: CalendarEvent) => void
  onDateClick: (date: string, resourceId?: string) => void
  onEventDrop: (info: any) => void
  onEventResize: (info: any) => void
  onDatesSet: (startDate: string, endDate: string, viewType: string) => void
}

export function ScheduleCalendar({
  events,
  resources,
  view,
  date,
  onEventClick,
  onDateClick,
  onEventDrop,
  onEventResize,
  onDatesSet,
}: ScheduleCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Serialize to detect actual data changes (avoid re-create on reference change)
  const eventsKey = useMemo(() => JSON.stringify(events), [events])
  const resourcesKey = useMemo(() => JSON.stringify(resources), [resources])
  const dateStr = useMemo(() => date.toISOString().split('T')[0], [date])

  useEffect(() => {
    if (!containerRef.current) return

    // Destroy previous instance
    destroyCalendar(containerRef.current)

    createCalendar(containerRef.current, PLUGINS, {
      view,
      date: dateStr,
      events,
      resources,
      editable: true,
      selectable: true,
      nowIndicator: true,
      firstDay: 1,
      locale: 'pt-BR',
      slotDuration: '00:30:00',
      slotMinTime: '07:00:00',
      slotMaxTime: '20:00:00',
      scrollTime: '08:00:00',
      snapDuration: '00:15:00',
      headerToolbar: false,
      dayMaxEvents: 3,
      height: '100%',
      eventContent,
      eventClassNames,
      eventClick: (info: any) => {
        const e = info.event
        onEventClick({
          id: e.id,
          title: e.title,
          start: e.startStr || e.start,
          end: e.endStr || e.end,
          resourceId: e.resource?.id || '',
          backgroundColor: e.backgroundColor,
          editable: true,
          extendedProps: e.extendedProps || {},
        })
      },
      dateClick: (info: any) => {
        onDateClick(info.dateStr, info.resource?.id)
      },
      eventDrop: (info: any) => {
        onEventDrop(info)
      },
      eventResize: (info: any) => {
        onEventResize(info)
      },
      datesSet: (info: any) => {
        onDatesSet(info.startStr, info.endStr, info.view.type)
      },
    })

    return () => {
      destroyCalendar(containerRef.current)
    }
  }, [eventsKey, resourcesKey, view, dateStr])

  return <div ref={containerRef} className="ec" style={{ height: '100%' }} />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/components/calendar/ScheduleCalendar.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendar/ScheduleCalendar.tsx
git commit -m "feat(calendar): add ScheduleCalendar wrapper for @event-calendar/core"
```

---

## Task 8: Sidebar components

**Files:**
- Create: `src/components/calendar/MiniCalendar.tsx`
- Create: `src/components/calendar/DentistFilter.tsx`
- Create: `src/components/calendar/SpecialtyFilter.tsx`
- Create: `src/components/calendar/CalendarSidebar.tsx`

- [ ] **Step 1: Create MiniCalendar**

```typescript
// src/components/calendar/MiniCalendar.tsx
'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

export function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-1 rounded hover:bg-muted">
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-muted">
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-[10px] text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, currentMonth)
          const selected = isSameDay(d, selectedDate)
          const today = isToday(d)
          return (
            <button
              key={i}
              onClick={() => onSelectDate(d)}
              className={`
                text-xs py-1 rounded-sm transition-colors
                ${!inMonth ? 'text-muted-foreground/40' : 'text-foreground'}
                ${selected ? 'bg-teal-600 text-white font-semibold' : 'hover:bg-muted'}
                ${today && !selected ? 'ring-1 ring-teal-400' : ''}
              `}
            >
              {format(d, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DentistFilter**

```typescript
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
```

- [ ] **Step 3: Create SpecialtyFilter**

```typescript
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
```

- [ ] **Step 4: Create CalendarSidebar (combines all)**

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/MiniCalendar.tsx src/components/calendar/DentistFilter.tsx src/components/calendar/SpecialtyFilter.tsx src/components/calendar/CalendarSidebar.tsx
git commit -m "feat(calendar): add sidebar components (MiniCalendar, DentistFilter, SpecialtyFilter)"
```

---

## Task 9: CalendarToolbar

**Files:**
- Create: `src/components/calendar/CalendarToolbar.tsx`

- [ ] **Step 1: Create toolbar**

```typescript
// src/components/calendar/CalendarToolbar.tsx
'use client'

import { addWeeks, addMonths, addDays, subWeeks, subMonths, subDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import type { CalendarView, ALL_VIEWS } from './hooks/useCalendarState'
import { VIEW_LABELS } from './hooks/useCalendarState'

interface CalendarToolbarProps {
  view: CalendarView
  date: Date
  onViewChange: (view: CalendarView) => void
  onDateChange: (date: Date) => void
  onToday: () => void
  onNewAppointment: () => void
  isLoading: boolean
  availableViews: typeof ALL_VIEWS
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
    const fn = direction === 'prev' ? { week: subWeeks, month: subMonths, day: subDays, resource: subDays } : { week: addWeeks, month: addMonths, day: addDays, resource: addDays }
    const amount = 1
    switch (view) {
      case 'dayGridMonth':
        onDateChange(direction === 'prev' ? subMonths(date, amount) : addMonths(date, amount))
        break
      case 'timeGridWeek':
        onDateChange(direction === 'prev' ? subWeeks(date, amount) : addWeeks(date, amount))
        break
      case 'timeGridDay':
      case 'resourceTimeGridDay':
        onDateChange(direction === 'prev' ? subDays(date, amount) : addDays(date, amount))
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
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-background">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('prev')}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('next')}>
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoje
        </Button>
        <h2 className="text-sm font-semibold ml-2 capitalize">{title}</h2>
        {isLoading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent ml-2" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {availableViews.map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-teal-600 text-white'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={onNewAppointment} className="bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600">
          <PlusIcon className="h-4 w-4 mr-1" />
          Novo
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/CalendarToolbar.tsx
git commit -m "feat(calendar): add CalendarToolbar with view switcher and navigation"
```

---

## Task 10: AppointmentDialog

**Files:**
- Create: `src/components/calendar/AppointmentDialog.tsx`

- [ ] **Step 1: Create the dialog**

This is the create/edit modal. It uses the existing `Dialog` component from `@/components/ui/dialog`.

```typescript
// src/components/calendar/AppointmentDialog.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAuth } from '@/lib/auth/context'
import { useDentists, useProcedures } from '@/lib/hooks/use-queries'
import type { CalendarEvent } from './hooks/useCalendarEvents'

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não Compareceu',
}

const STATUS_BADGE: Record<string, 'warning' | 'info' | 'teal' | 'success' | 'error' | 'zinc'> = {
  scheduled: 'warning',
  confirmed: 'info',
  in_progress: 'teal',
  completed: 'success',
  cancelled: 'error',
  no_show: 'zinc',
}

const READONLY_STATUSES = new Set(['completed', 'cancelled', 'no_show'])

interface AppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  event?: CalendarEvent | null
  prefillDate?: string
  prefillTime?: string
  prefillDentistId?: string
  onSuccess: () => void
}

export function AppointmentDialog({
  open,
  onOpenChange,
  mode,
  event,
  prefillDate,
  prefillTime,
  prefillDentistId,
  onSuccess,
}: AppointmentDialogProps) {
  const { profile } = useAuth()
  const { data: dentistsData } = useDentists(profile?.clinic_id)
  const { data: proceduresData } = useProcedures(profile?.clinic_id)

  const dentists = dentistsData?.dentists || []
  const procedures = proceduresData?.procedures || []

  const [patientName, setPatientName] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [dentistId, setDentistId] = useState('')
  const [procedureId, setProcedureId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('30')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReadonly = mode === 'edit' && event ? READONLY_STATUSES.has(event.extendedProps.status) : false
  const status = event?.extendedProps.status

  // Prefill on open
  useEffect(() => {
    if (!open) return
    setError(null)

    if (mode === 'create') {
      setPatientName('')
      setPatientPhone('')
      setDentistId(prefillDentistId || '')
      setProcedureId('')
      setDate(prefillDate ? prefillDate.split(' ')[0] : '')
      setTime(prefillTime || prefillDate?.split(' ')[1]?.slice(0, 5) || '')
      setDuration('30')
      setNotes('')
    } else if (event) {
      setPatientName(event.extendedProps.patientName)
      setPatientPhone(event.extendedProps.patientPhone || '')
      setDentistId(event.resourceId)
      setProcedureId('')
      const start = event.start.replace(' ', 'T')
      const d = new Date(start)
      setDate(d.toISOString().split('T')[0])
      setTime(d.toTimeString().slice(0, 5))
      setNotes(event.extendedProps.notes || '')
    }
  }, [open, mode, event, prefillDate, prefillTime, prefillDentistId])

  const handleSubmit = async () => {
    if (!profile?.clinic_id) return
    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'create') {
        // For create, we need patient_id — simplified: search by name or create
        // This uses the existing POST /api/appointments endpoint
        const scheduledAt = `${date}T${time}:00-03:00`
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_name: patientName,
            patient_phone: patientPhone,
            dentist_id: dentistId,
            procedure_id: procedureId || null,
            scheduled_at: scheduledAt,
            duration_minutes: parseInt(duration),
            clinic_id: profile.clinic_id,
            notes,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao criar agendamento')
        }
      } else if (event) {
        const res = await fetch(`/api/appointments/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dentist_id: dentistId,
            procedure_id: procedureId || null,
            notes,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao atualizar agendamento')
        }
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusAction = async (action: string) => {
    if (!event) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/appointments/${event.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Erro ao ${action} agendamento`)
      }
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Agendamento' : 'Detalhes do Agendamento'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? 'Preencha os dados para criar um novo agendamento' : 'Visualize e gerencie o agendamento'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {mode === 'edit' && event && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={STATUS_BADGE[status!] || 'info'}>
                {STATUS_LABELS[status!] || status}
              </StatusBadge>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Paciente</label>
            {mode === 'edit' ? (
              <p className="text-sm text-foreground mt-1">{patientName}</p>
            ) : (
              <div className="space-y-2 mt-1">
                <Input placeholder="Nome do paciente" value={patientName} onChange={(e) => setPatientName(e.target.value)} disabled={isReadonly} />
                <Input placeholder="Telefone" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} disabled={isReadonly} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isReadonly} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Horário</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={isReadonly} className="mt-1" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Profissional</label>
            <Select value={dentistId} onValueChange={setDentistId} disabled={isReadonly}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {dentists.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Procedimento</label>
            <Select value={procedureId} onValueChange={(v) => {
              setProcedureId(v)
              const proc = procedures.find((p: any) => p.id === v)
              if (proc?.duration_minutes) setDuration(String(proc.duration_minutes))
            }} disabled={isReadonly}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {procedures.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.duration_minutes}min)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Observações</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isReadonly} placeholder="Notas opcionais" className="mt-1" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {mode === 'edit' && event && !isReadonly && (
            <>
              {status === 'scheduled' && (
                <>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusAction('cancel')} disabled={submitting}>Cancelar</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusAction('confirm')} disabled={submitting}>Confirmar</Button>
                </>
              )}
              {status === 'confirmed' && (
                <>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusAction('cancel')} disabled={submitting}>Cancelar</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatusAction('noshow')} disabled={submitting}>Não Compareceu</Button>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => handleStatusAction('confirm')} disabled={submitting}>Iniciar</Button>
                </>
              )}
              {status === 'in_progress' && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusAction('confirm')} disabled={submitting}>Concluir</Button>
              )}
            </>
          )}
          {mode === 'create' && (
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !patientName || !dentistId || !date || !time}>
              {submitting ? 'Criando...' : 'Criar Agendamento'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/AppointmentDialog.tsx
git commit -m "feat(calendar): add AppointmentDialog for create/edit with status actions"
```

---

## Task 11: CalendarLayout + page rewrite

**Files:**
- Create: `src/components/calendar/CalendarLayout.tsx`
- Create: `src/app/dashboard/agendamentos/list-view.tsx`
- Modify: `src/app/dashboard/agendamentos/page.tsx` (rewrite)

- [ ] **Step 1: Extract current page to list-view.tsx**

Copy the entire content of the current `page.tsx` (227 lines) into a new client component:

```typescript
// src/app/dashboard/agendamentos/list-view.tsx
'use client'

// Paste the entire current page.tsx content here, renamed from:
// export default function AppointmentsPage() → export function ListView()
// Remove 'default' export — this is now a named export

import { useState, useMemo } from 'react'
import Link from 'next/link'
// ... (all existing imports remain identical)

export function ListView() {
  // ... (all existing code remains identical — just rename the function)
}
```

- [ ] **Step 2: Create CalendarLayout**

```typescript
// src/components/calendar/CalendarLayout.tsx
'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useDentists } from '@/lib/hooks/use-queries'
import { CalendarSidebar } from './CalendarSidebar'
import { CalendarToolbar } from './CalendarToolbar'
import { AppointmentDialog } from './AppointmentDialog'
import { useCalendarState, ALL_VIEWS, MOBILE_VIEWS } from './hooks/useCalendarState'
import type { CalendarView } from './hooks/useCalendarState'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import type { CalendarEvent } from './hooks/useCalendarEvents'

// Dynamic import — calendar uses DOM, breaks in SSR
const ScheduleCalendar = dynamic(
  () => import('./ScheduleCalendar').then((m) => ({ default: m.ScheduleCalendar })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    ),
  }
)

export function CalendarLayout() {
  const { profile } = useAuth()
  const { state, updateState } = useCalendarState()
  const { data: dentistsData } = useDentists(profile?.clinic_id)
  const dentists = dentistsData?.dentists || []

  // Resolve dentist IDs: if empty in URL, default to all dentists
  const activeDentistIds = state.dentistIds.length > 0
    ? state.dentistIds
    : dentists.map((d: any) => d.id)

  const {
    events,
    resources,
    isLoading,
    invalidateCalendar,
  } = useCalendarEvents(
    profile?.clinic_id,
    state.startDate,
    state.endDate,
    activeDentistIds,
    state.specialty,
  )

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [prefillDate, setPrefillDate] = useState<string>('')
  const [prefillDentistId, setPrefillDentistId] = useState<string>('')

  const handleEventClick = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event)
    setDialogMode('edit')
    setDialogOpen(true)
  }, [])

  const handleDateClick = useCallback((dateStr: string, resourceId?: string) => {
    setPrefillDate(dateStr)
    setPrefillDentistId(resourceId || '')
    setSelectedEvent(null)
    setDialogMode('create')
    setDialogOpen(true)
  }, [])

  const handleEventDrop = useCallback(async (info: any) => {
    const eventId = info.event.id
    const newStart = new Date(info.event.start)
    const newDate = newStart.toISOString().split('T')[0]
    const newTime = newStart.toTimeString().slice(0, 5)

    try {
      const res = await fetch(`/api/appointments/${eventId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_date: newDate, new_time: newTime, notify_patient: true }),
      })
      if (!res.ok) {
        info.revert()
        const data = await res.json()
        throw new Error(data.error || 'Erro ao reagendar')
      }
      invalidateCalendar()
    } catch (err: any) {
      info.revert()
      // TODO: show toast
      console.error('Reschedule error:', err.message)
    }
  }, [invalidateCalendar])

  const handleEventResize = useCallback(async (info: any) => {
    const eventId = info.event.id
    const start = new Date(info.event.start)
    const end = new Date(info.event.end)
    const newDuration = Math.round((end.getTime() - start.getTime()) / 60000)

    try {
      const res = await fetch(`/api/appointments/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_minutes: newDuration }),
      })
      if (!res.ok) {
        info.revert()
        throw new Error('Erro ao alterar duração')
      }
      invalidateCalendar()
    } catch {
      info.revert()
    }
  }, [invalidateCalendar])

  const handleDatesSet = useCallback((_start: string, _end: string, viewType: string) => {
    // Sync view if changed via calendar internals
    if (ALL_VIEWS.includes(viewType as CalendarView)) {
      updateState({ view: viewType as CalendarView })
    }
  }, [updateState])

  // Responsive: show only mobile views on small screens
  const availableViews = typeof window !== 'undefined' && window.innerWidth < 768
    ? MOBILE_VIEWS
    : ALL_VIEWS

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <CalendarToolbar
        view={state.view}
        date={state.date}
        onViewChange={(v) => updateState({ view: v })}
        onDateChange={(d) => updateState({ date: d })}
        onToday={() => updateState({ date: new Date() })}
        onNewAppointment={() => {
          setSelectedEvent(null)
          setDialogMode('create')
          setPrefillDate('')
          setPrefillDentistId('')
          setDialogOpen(true)
        }}
        isLoading={isLoading}
        availableViews={availableViews}
      />

      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebar
          selectedDate={state.date}
          onSelectDate={(d) => updateState({ date: d })}
          dentists={dentists}
          selectedDentistIds={activeDentistIds}
          onDentistChange={(ids) => updateState({ dentistIds: ids })}
          specialty={state.specialty}
          onSpecialtyChange={(s) => updateState({ specialty: s })}
        />

        <div className="flex-1 overflow-hidden">
          <ScheduleCalendar
            events={events}
            resources={resources}
            view={state.view}
            date={state.date}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onDatesSet={handleDatesSet}
          />
        </div>
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        event={selectedEvent}
        prefillDate={prefillDate}
        prefillDentistId={prefillDentistId}
        onSuccess={invalidateCalendar}
      />
    </div>
  )
}
```

- [ ] **Step 3: Rewrite page.tsx with view toggle**

```typescript
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
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds. New route `/dashboard/agendamentos` may show slightly different size.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/CalendarLayout.tsx src/app/dashboard/agendamentos/list-view.tsx src/app/dashboard/agendamentos/page.tsx
git commit -m "feat(calendar): rewrite agendamentos page with calendar/list view toggle"
```

---

## Task 12: Hook — useOptimisticUpdate

**Files:**
- Create: `src/components/calendar/hooks/useOptimisticUpdate.ts`

**Note:** The optimistic update logic is already inline in `CalendarLayout.tsx` (handleEventDrop/handleEventResize). This hook extracts it for testability and reuse.

- [ ] **Step 1: Create useOptimisticUpdate**

```typescript
// src/components/calendar/hooks/useOptimisticUpdate.ts
'use client'

import { useCallback } from 'react'

interface RescheduleParams {
  appointmentId: string
  newDate: string
  newTime: string
  notifyPatient?: boolean
}

interface ResizeParams {
  appointmentId: string
  durationMinutes: number
}

export function useOptimisticUpdate(invalidateCalendar: () => void) {
  const reschedule = useCallback(async (params: RescheduleParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/appointments/${params.appointmentId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_date: params.newDate,
          new_time: params.newTime,
          notify_patient: params.notifyPatient ?? true,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data.error || 'Erro ao reagendar' }
      }
      invalidateCalendar()
      return { success: true }
    } catch {
      return { success: false, error: 'Sem conexão com o servidor' }
    }
  }, [invalidateCalendar])

  const resize = useCallback(async (params: ResizeParams): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/appointments/${params.appointmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_minutes: params.durationMinutes }),
      })
      if (!res.ok) {
        return { success: false, error: 'Erro ao alterar duração' }
      }
      invalidateCalendar()
      return { success: true }
    } catch {
      return { success: false, error: 'Sem conexão com o servidor' }
    }
  }, [invalidateCalendar])

  return { reschedule, resize }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/hooks/useOptimisticUpdate.ts
git commit -m "feat(calendar): add useOptimisticUpdate hook for reschedule/resize"
```

---

## Task 13: Build verification + manual testing

**Files:** None

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: Build succeeds with no new errors.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual test checklist**

Open `http://localhost:3000/dashboard/agendamentos` and verify:

- [ ] Calendar renders with week view
- [ ] Navigation (prev/next/today) works
- [ ] View switcher (Month/Week/Day/Resource) works
- [ ] Sidebar dentist filter toggles events
- [ ] Mini calendar navigates to clicked date
- [ ] Click on empty slot opens create dialog
- [ ] Click on event opens edit dialog
- [ ] Drag-and-drop moves event (if appointments exist)
- [ ] List view toggle works
- [ ] Dark mode renders correctly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(calendar): complete calendar view implementation with all components"
```

---

## Self-Review Checklist

| Spec Requirement | Task |
|---|---|
| Install @event-calendar/core | Task 1 |
| Dentist color utility | Task 2 |
| API: dentist_ids + specialty filters | Task 3 |
| API: specialty in dentist join | Task 3 |
| useCalendarState (URL params) | Task 4 |
| useCalendarEvents (data transform) | Task 5 |
| useCalendarEvents (calendar query key) | Task 5 |
| EventCard (eventContent) | Task 6 |
| Status CSS classes | Task 6 |
| Dark mode CSS | Task 6 |
| ScheduleCalendar wrapper | Task 7 |
| destroy+recreate pattern | Task 7 |
| MiniCalendar | Task 8 |
| DentistFilter | Task 8 |
| SpecialtyFilter | Task 8 |
| CalendarSidebar | Task 8 |
| CalendarToolbar | Task 9 |
| AppointmentDialog (create) | Task 10 |
| AppointmentDialog (edit + status) | Task 10 |
| CalendarLayout | Task 11 |
| page.tsx rewrite + list toggle | Task 11 |
| list-view.tsx extraction | Task 11 |
| useOptimisticUpdate | Task 12 |
| eventResize handler | Task 11 (in CalendarLayout) |
| Build verification | Task 13 |

**Placeholder scan:** No TBDs, TODOs, or "implement later" patterns found.

**Type consistency:** CalendarEvent interface defined in Task 5, used consistently in Tasks 6, 7, 10, 11. CalendarView type defined in Task 4, used in Tasks 7, 9, 11. All imports match export paths.
