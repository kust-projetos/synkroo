# Calendar View Design Spec

**Date:** 2026-04-10
**Status:** Approved (v3 — migrated to @event-calendar/core)
**Phase:** Phase 1 (Calendar UI) — Phase 2 (Google Calendar integration) is separate

---

## Overview

Replace the current flat list-by-day appointments page with a Google Calendar-style scheduling interface. Four views (month/week/day/resource), filtering by dentist and specialty, drag-and-drop rescheduling, click-to-create, and click-to-edit. Uses `@event-calendar/core` (vkurko/calendar) — a zero-dependency, lightweight calendar with built-in resource views, DnD, now indicator, and custom event rendering.

The existing list view is preserved as a toggle option ("Lista" | "Calendario").

---

## Component Architecture

```
src/app/dashboard/agendamentos/page.tsx          (rewritten — view toggle)
├── components/calendar/
│   ├── CalendarLayout.tsx          — responsive shell: sidebar + calendar area
│   ├── CalendarToolbar.tsx         — view switcher, navigation, "Hoje", "Novo"
│   ├── CalendarSidebar.tsx         — collapsible/drawer on mobile
│   │   ├── MiniCalendar.tsx        — date-fns mini date picker
│   │   ├── DentistFilter.tsx       — multi-checkbox, color per dentist, count badge
│   │   └── SpecialtyFilter.tsx     — dropdown from distinct specialties
│   ├── ScheduleCalendar.tsx        — @event-calendar/core wrapper + plugins + config
│   ├── EventCard.tsx               — custom event rendering (eventContent callback)
│   ├── AppointmentDialog.tsx       — modal for create/edit
│   │   ├── CreateMode.tsx          — date/time/dentist pre-filled from click
│   │   └── EditMode.tsx            — existing data + contextual actions
│   └── hooks/
│       ├── useCalendarEvents.ts    — fetch + transform to EventCalendar.Event[]
│       ├── useOptimisticUpdate.ts  — optimistic drag/drop with rollback
│       └── useCalendarState.ts     — URL params + navigation state
│   └── utils/
│       └── dentist-colors.ts       — pure function: getDentistColor(id, index) → string
src/app/dashboard/agendamentos/list-view.tsx       (extracted current page — preserved)
```

**Changes from v2:**
- Migrated from `react-big-calendar` to `@event-calendar/core` — zero-dependency, 4x smaller bundle
- Removed `CurrentTimeIndicator.tsx` — built-in via `nowIndicator: true`
- Removed `@dnd-kit/core` dependency — built-in via `Interaction` plugin
- DnD rollback uses built-in `info.revert()` instead of manual state rollback
- Resource view uses built-in `ResourceTimeGrid` plugin instead of manual setup
- CSS theming via CSS variables (supports dark mode natively via `ec-dark` class)

---

## Dependencies

```json
{
  "@event-calendar/core": "^3.0.0"
}
```

**Notes:**
- Single package — all plugins included (`DayGrid`, `TimeGrid`, `List`, `ResourceTimeGrid`, `ResourceTimeline`, `Interaction`)
- Zero external dependencies — no `moment`, `date-fns` localizer needed (built-in date handling)
- Bundle size: ~45KB gzipped (vs ~180KB for react-big-calendar + date-fns)
- Must be loaded with `next/dynamic({ ssr: false })` — uses DOM manipulation, breaks in SSR
- CSS imported via `import '@event-calendar/core/index.css'`
- Keep `date-fns` (already installed) for MiniCalendar and date utilities only

---

## Calendar Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| Plugins | `DayGrid`, `TimeGrid`, `ResourceTimeGrid`, `Interaction` | Month/week/day/resource views + DnD |
| First day of week | `firstDay: 1` | Brazilian convention (Monday) |
| Time slot interval | `slotDuration: '00:30:00'` | Matches existing scheduler default |
| Time range | `slotMinTime: '07:00:00'`, `slotMaxTime: '20:00:00'` | Covers early/late appointments |
| Default view | `timeGridWeek` | Most useful for clinics |
| Scroll to time | `scrollTime: '08:00:00'` | Start of business hours |
| Locale | `locale: 'pt-BR'` | Portuguese locale |
| Snap duration | `snapDuration: '00:15:00'` | 15-min snap when dragging |
| Now indicator | `nowIndicator: true` | Red line at current time |
| Views | `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `resourceTimeGridDay` | 4 views including resource |

---

## React Wrapper Strategy

`@event-calendar/core` uses vanilla JS API (`createCalendar`). We wrap it in a React component:

```typescript
// ScheduleCalendar.tsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import { createCalendar, destroyCalendar,
         DayGrid, TimeGrid, ResourceTimeGrid, Interaction } from '@event-calendar/core'
import '@event-calendar/core/index.css'

export function ScheduleCalendar({ events, resources, options, onEventClick, onDateClick, onEventDrop, onDatesSet }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ecRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    ecRef.current = createCalendar(containerRef.current,
      [DayGrid, TimeGrid, ResourceTimeGrid, Interaction],
      {
        view: options.view,
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
        headerToolbar: false, // We use custom CalendarToolbar
        eventClick: onEventClick,
        dateClick: onDateClick,
        eventDrop: onEventDrop,
        datesSet: onDatesSet,
        eventContent: customEventContent,
        eventClassNames: eventClassNames,
        ...options,
      }
    )

    return () => {
      if (ecRef.current) destroyCalendar(ecRef.current)
    }
  }, []) // Mount only

  // Update events/resources on change (without full re-mount)
  useEffect(() => {
    if (ecRef.current) {
      ecRef.current.setOption('events', events)
    }
  }, [events])

  useEffect(() => {
    if (ecRef.current) {
      ecRef.current.setOption('resources', resources)
    }
  }, [resources])

  return <div ref={containerRef} className="ec" />
}
```

Loaded via `next/dynamic` in parent:

```typescript
const ScheduleCalendar = dynamic(() =>
  import('@/components/calendar/ScheduleCalendar').then(m => ({ default: m.ScheduleCalendar })),
  { ssr: false, loading: () => <CalendarSkeleton /> }
)
```

---

## Data Flow

### Loading Events

```
1. URL state: { view, date, dentistIds, specialty } via useCalendarState hook
2. Compute date range from view + date
   - Month: first/last day of month (padded to week boundaries)
   - Week: Mon-Sun of current week
   - Day: 07:00-20:00 of selected date
   - Resource: same as week (Mon-Sun)
3. GET /api/appointments?clinic_id=X&start_date=Y&end_date=Z&dentist_ids=A&dentist_ids=B
4. Transform response → EventCalendar.Event[] via useCalendarEvents hook
5. Each event gets: id, title (patient name), start, end, resourceId (dentist id)
   Resource mapping: each dentist becomes a resource with id, title, eventBackgroundColor
```

### Event Data Format

```typescript
// @event-calendar/core event format
interface CalendarEvent {
  id: string
  title: string           // Patient name
  start: string           // ISO datetime: '2026-04-10 09:00:00'
  end: string             // ISO datetime: '2026-04-10 09:30:00'
  resourceId: string      // Dentist ID
  backgroundColor: string // Dentist color
  extendedProps: {
    patientName: string
    procedureName: string
    status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
    dentistName: string
    notes?: string
    patientPhone?: string
  }
}

// Resource format
interface CalendarResource {
  id: string
  title: string           // Dentist name: "Dr. Joao"
  eventBackgroundColor: string  // Dentist color
}
```

### Loading States

| State | UI |
|-------|----|
| Initial load | Skeleton calendar with animated shimmer over slot grid |
| Refetch (navigation) | Semi-transparent overlay + spinner in toolbar, calendar still visible |
| Error | Toast + retry button in toolbar. Calendar shows last cached data |
| Empty (no appointments) | Calendar grid renders normally, center message: "Nenhum agendamento neste periodo" |

### Drag & Drop (Optimistic)

```
1. User drags event to new slot
2. Validation (before optimistic update):
   - Is status editable? (completed/cancelled/no_show → reject via eventClassNames: not draggable)
   - Is target within working hours? (no → reject with red highlight)
   - Is target slot free? (checked client-side against loaded events)
3. EventCalendar handles visual feedback automatically (shadow, snap)
4. Background: PUT /api/appointments/[id]/reschedule { scheduled_at, duration_minutes }
5. On success: revalidate cache (invalidate React Query key)
6. On error: call info.revert() + show toast with error message
   - "Conflito de horario" for server-side overlap (race condition)
   - "Fora do horario de atendimento" for out-of-bounds
   - "Agendamento nao pode ser alterado" for terminal statuses
```

### Click-to-Create

```
1. User clicks empty slot (dateClick callback)
2. Open AppointmentDialog in create mode
3. Pre-fill: date, time (slot start), duration (30min default from procedure)
4. If single dentist/resource clicked, pre-fill that dentist
5. User fills: patient (search by name/phone), procedure (auto-sets duration), notes
6. POST /api/appointments
7. On success: invalidate calendar query + close dialog
8. On error: show inline error in dialog
```

### Click-to-Edit

```
1. User clicks existing event (eventClick callback)
2. Open AppointmentDialog in edit mode
3. Show: patient info (read-only), date/time, duration, dentist, procedure, notes, status
4. Contextual actions by status:
   - scheduled   → confirm, cancel
   - confirmed   → start attendance, cancel, mark no-show
   - in_progress → complete
   - completed/cancelled/no_show → view only (read-only)
5. PUT /api/appointments/[id] for field edits
6. POST /api/appointments/[id]/confirm etc. for status changes
7. WhatsApp notifications sent automatically by existing service layer
   (confirmAppointment, cancelAppointment etc. already send WhatsApp)
```

---

## Resource View (Column per Dentist)

The fourth view mode: **Resource**. Uses built-in `ResourceTimeGrid` plugin. Displays each dentist as a vertical column.

```
|  Horario  |  Dr. Joao  |  Dra. Maria  |  Dr. Pedro  |
|-----------|------------|--------------|-------------|
|  08:00    | [Evento]   |              | [Evento]    |
|  08:30    |            | [Evento]     |             |
|  09:00    | [Evento]   |              |             |
|  ...      |            |              |             |
```

Implementation:
- Uses `ResourceTimeGrid` plugin — just include in plugins array
- Resources array built from active dentists in filter
- Only dentists active in the filter are shown as columns
- Max 5 columns visible; beyond that, horizontal scroll
- On mobile: resource view hidden (replaced by day view with dentist filter)
- Resource labels show dentist name + specialty via `resourceLabelContent`

---

## API Changes

### Extend Existing Endpoint (No New Route)

`GET /api/appointments` — add query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `dentist_ids` | repeated string | `?dentist_ids=uuid1&dentist_ids=uuid2` (standard repeated params) |
| `specialty` | string | Filter by dentist specialty (server joins dentists table) |
| `include_joins` | boolean | When true, always include patient, dentist, procedure objects |

When `start_date` and `end_date` are both present, the endpoint automatically returns joins (calendar mode). No need for explicit `include_joins` — just using date range triggers the enriched response.

Response format:
```json
{
  "appointments": [{
    "id": "uuid",
    "scheduled_at": "2026-04-10T09:00:00-03:00",
    "duration_minutes": 30,
    "status": "confirmed",
    "notes": "...",
    "patient": { "id": "uuid", "name": "Maria Silva" },
    "dentist": { "id": "uuid", "name": "Dr. Joao", "specialty": "Ortodontia" },
    "procedure": { "id": "uuid", "name": "Limpeza", "duration_minutes": 30 }
  }]
}
```

---

## Visual Design

### Color System

**Dentist colors** (8-color palette, cycled for clinics with >8 dentists):
```
#3B82F6 (blue), #10B981 (emerald), #F59E0B (amber), #EF4444 (red),
#8B5CF6 (violet), #EC4899 (pink), #06B6D4 (cyan), #F97316 (orange)
```

Each dentist resource gets `eventBackgroundColor` set to their color.

**Status visualization** (applied via `eventClassNames` callback):

| Status | CSS Class | Border | Background | Opacity | Effect |
|--------|-----------|--------|-----------|---------|--------|
| scheduled | `ec-status-scheduled` | dashed, blue-400 | dentist color, 10% tint | 85% | — |
| confirmed | `ec-status-confirmed` | solid, emerald-400 | dentist color, 15% tint | 100% | — |
| in_progress | `ec-status-in-progress` | solid, emerald-500 | dentist color, 20% tint | 100% | subtle left-to-right shimmer |
| completed | `ec-status-completed` | solid, gray-300 | dentist color, 5% tint | 70% | — |
| cancelled | `ec-status-cancelled` | solid, red-300 | dentist color, 3% tint | 50% | strikethrough on text |
| no_show | `ec-status-no-show` | solid, red-400 | dentist color, 5% tint | 50% | — |

Non-editable statuses (completed/cancelled/no_show) return `editable: false` via `eventClassNames` → `Interaction` plugin prevents dragging.

### Event Card (via `eventContent` callback)

```
┌─────────────────────────────┐
│ ▊ 09:00 - 09:30             │ ← dentist color bar on left (via backgroundColor)
│ Maria Silva                  │ ← patient name (font-medium)
│ Limpeza                      │ ← procedure name (text-muted)
└─────────────────────────────┘
```

Implemented via `eventContent` callback returning custom HTML. Dentist name only shown in month view.

### Month View Events

Compact: colored dot (dentist color) + patient name truncated + time.
Max 3 visible per day cell, "+N more" link via `dayMaxEvents: 3`.

### Dark Mode

Automatic via CSS: `next-themes` already applies `dark` class. Map to `ec-dark`:
```css
.dark .ec { color-scheme: dark; }
```

CSS variables for theming:
```css
.ec {
  --ec-border-color: var(--border);
  --ec-today-bg-color: rgba(59, 130, 246, 0.1);
  --ec-highlight-color: rgba(59, 130, 246, 0.15);
}
```

---

## Filtering

| Filter | Type | Behavior |
|--------|------|----------|
| Dentist | Multi-checkbox | Each checkbox shows dentist name + colored dot + appointment count. Unchecking removes their resource column and hides their events. |
| Specialty | Dropdown | Filters dentist checkboxes to only matching specialties. "Todas" = no filter. |
| Date | Mini-calendar | Clicking a date navigates calendar to that date. Selected date highlighted with ring. |
| View | Segmented control | "Mes" / "Semana" / "Dia" / "Profissionais" toggle. Persists to URL params. |

### Default Values

| Param | Default | Reason |
|-------|---------|--------|
| `view` | `timeGridWeek` | Most useful overview for clinics |
| `date` | Today | Current date |
| `dentists` | All active | Show everyone by default |
| `specialty` | `""` (all) | No filter by default |

Filters persist in URL search params for shareable/bookmarkable views:
```
/dashboard/agendamentos?view=timeGridWeek&date=2026-04-10&dentists=uuid1,uuid2&specialty=Ortodontia
```

---

## Responsive Behavior

| Breakpoint | Sidebar | Default View | Resource View |
|-----------|---------|-------------|---------------|
| >=1024px (desktop) | Fixed left, 280px | Week | Available, max 5 columns |
| 768-1023px (tablet) | Collapsible overlay | Week | Available, max 3 columns |
| <768px (mobile) | Drawer (swipe from left) | Day | Hidden, falls back to day |

### Mobile Adaptations

- View toggle shows only "Dia" and "Lista" on mobile
- Drag & drop disabled on touch devices (`editable: false` on mobile, tap-to-edit only)
- Event cards expand to full width
- "Novo" button as FAB (floating action button) in bottom-right
- Mini-calendar hidden on mobile (date picker via dialog instead)
- Resource view replaced by day view with dentist filter active

---

## Timezone Handling

- Calendar displays in clinic timezone from `clinics.settings.timezone`
- Default: `America/Sao_Paulo`
- Fallback: browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- @event-calendar/core accepts datetime strings without timezone offset (local time)
- All API times remain ISO 8601 with offset (`2026-04-10T09:00:00-03:00`)
- Transform strips offset for display, adds back for API calls

---

## Availability Overlay

Implemented via `eventContent` + background events:
- Create background events for non-working hours (grayed out)
- Lunch break highlighted as a "blocked" background event
- Uses `display: 'background'` event property
- When dragging, `Interaction` plugin respects these boundaries
- Falls back to `clinics.settings.operating_hours` (default: 08:00-18:00, lunch 12:00-13:00, Mon-Fri)

---

## State Management

### URL State (via `useCalendarState` hook)

```typescript
// URL params managed by the hook
interface CalendarURLState {
  view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'resourceTimeGridDay'
  date: string         // YYYY-MM-DD
  dentists: string     // comma-separated UUIDs
  specialty: string    // specialty name or empty
}
```

Hook syncs bidirectionally: URL → state on mount, state → URL on change.
View name mapping for UI: `dayGridMonth` → "Mes", `timeGridWeek` → "Semana", `timeGridDay` → "Dia", `resourceTimeGridDay` → "Profissionais"

### React Query

Query key: `['calendar-events', clinicId, startDate, endDate, dentistIds, specialty]`
- Stale time: 30 seconds (matches existing `useAppointments`)
- On mutation success: invalidate calendar query
- On navigation (date/view change): new fetch with updated date range
- Prefetch: prefetch adjacent period on idle (via `queryClient.prefetchQuery`)

---

## Error Handling

| Scenario | UI Response |
|----------|------------|
| Drag to occupied slot | Red highlight on target + toast "Conflito: horario ja ocupado" + `info.revert()` |
| Drag outside work hours | Gray highlight + toast "Fora do horario de atendimento" + `info.revert()` |
| Drag completed/cancelled | Blocked entirely (event not draggable, non-editable status) |
| API error on create | Inline error in dialog, dialog stays open |
| API error on edit | Inline error in dialog, dialog stays open |
| API error on status change | Toast with error message, dialog stays open |
| Network error | Toast "Sem conexao. Tentando novamente..." + auto-retry (React Query default) |
| Auth expired | Redirect to login (existing middleware handles this) |
| No appointments | Calendar renders normally + centered message "Nenhum agendamento" |
| Initial load | Skeleton calendar with shimmer animation |

---

## WhatsApp Notification Integration

Status changes made via the AppointmentDialog trigger WhatsApp notifications automatically through the existing service layer:

| Action | API Endpoint | WhatsApp Notification |
|--------|-------------|----------------------|
| Confirm | `POST /api/appointments/[id]/confirm` | Yes — confirmation message |
| Cancel | `POST /api/appointments/[id]/cancel` | Yes — cancellation message |
| Reschedule (drag) | `PUT /api/appointments/[id]/reschedule` | Yes — reschedule notification |
| No-show | `POST /api/appointments/[id]/noshow` | No — internal action only |
| Create | `POST /api/appointments` | No — clinic-initiated, not patient-facing |

The dialog does NOT need custom notification logic — existing service functions (`confirmAppointment`, `cancelAppointment`, `rescheduleAppointment`) already handle this.

---

## Performance Considerations

- **Date-range queries**: only fetch appointments for the visible range, not the entire month
- **Optimistic updates**: no waiting for API on drag/drop (built-in visual feedback)
- **Memoization**: event list memoized with `useMemo`, recompute only when filters change
- **Debounced filter**: specialty dropdown debounces 300ms before re-fetching
- **Code splitting**: calendar loaded via `next/dynamic({ ssr: false })` — only loaded on this page
- **Lightweight library**: @event-calendar/core is ~45KB (vs ~180KB for react-big-calendar + deps)
- **Zero dependencies**: no date-fns localizer, no moment, no separate DnD library
- **Prefetch**: adjacent week prefetched on idle for smooth navigation
- **Event transform**: `useCalendarEvents` memoizes the API → CalendarEvent[] transform
- **setOption updates**: events/resources updated without full calendar re-mount

---

## Testing Strategy

| Test Type | Scope | Tool |
|-----------|-------|------|
| Unit | `useCalendarEvents` transform logic (API data → CalendarEvent[]) | Jest |
| Unit | `getDentistColor()` pure function | Jest |
| Unit | `useCalendarState` URL sync hook | Jest + React Testing Library |
| Unit | `useOptimisticUpdate` rollback logic | Jest |
| Integration | AppointmentDialog create/edit flows | React Testing Library |
| Component | ScheduleCalendar mount/unmount lifecycle | Jest |
| Visual | Responsive breakpoints (desktop/tablet/mobile) | Playwright |
| E2E | Create appointment via click → verify in calendar | Playwright |
| E2E | Drag-and-drop reschedule → verify API call | Playwright |

---

## Out of Scope (Phase 2)

These items are explicitly deferred to Phase 2 (Google Calendar integration):

- Google Calendar OAuth2 flow
- Bidirectional event sync
- Webhook listener for GCal changes
- `google_calendar_tokens` table
- `calendar_sync_log` table
- Conflict resolution engine
- Recurring events support
- Keyboard shortcuts
- Print/export view

---

## Files to Create/Modify

### New Files (11)
- `src/components/calendar/CalendarLayout.tsx`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/CalendarSidebar.tsx`
- `src/components/calendar/MiniCalendar.tsx`
- `src/components/calendar/DentistFilter.tsx`
- `src/components/calendar/SpecialtyFilter.tsx`
- `src/components/calendar/ScheduleCalendar.tsx`
- `src/components/calendar/EventCard.tsx`
- `src/components/calendar/AppointmentDialog.tsx`
- `src/components/calendar/hooks/useCalendarEvents.ts`
- `src/components/calendar/hooks/useOptimisticUpdate.ts`
- `src/components/calendar/hooks/useCalendarState.ts`
- `src/components/calendar/utils/dentist-colors.ts`

### Modified Files (2)
- `src/app/dashboard/agendamentos/page.tsx` — rewritten with view toggle
- `src/app/api/appointments/route.ts` — extend GET with `dentist_ids` (repeated params), `specialty`, auto-joins on date range

### Preserved Files
- `src/app/dashboard/agendamentos/novo/page.tsx` — keep existing create flow
- `src/app/dashboard/agendamentos/[id]/page.tsx` — keep existing detail page
- Current list view logic extracted to `list-view.tsx` component

### Removed from v2 Spec
- `CurrentTimeIndicator.tsx` — built-in via `nowIndicator: true`
- `@dnd-kit/core` + `@dnd-kit/utilities` — built-in via `Interaction` plugin
- `@types/react-big-calendar` — not needed
- `react-big-calendar` — replaced by `@event-calendar/core`
