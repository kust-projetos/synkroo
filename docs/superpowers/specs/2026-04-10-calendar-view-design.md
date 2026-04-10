# Calendar View Design Spec

**Date:** 2026-04-10
**Status:** Approved (v2 — revised after review)
**Phase:** Phase 1 (Calendar UI) — Phase 2 (Google Calendar integration) is separate

---

## Overview

Replace the current flat list-by-day appointments page with a Google Calendar-style scheduling interface. Four views (month/week/day/resource), filtering by dentist and specialty, drag-and-drop rescheduling, click-to-create, and click-to-edit. Uses `react-big-calendar` with `date-fns` localizer and `@dnd-kit` for drag-and-drop.

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
│   ├── ScheduleCalendar.tsx        — react-big-calendar wrapper + DnD + slot config
│   ├── EventCard.tsx               — custom event component (patient + procedure + status)
│   ├── CurrentTimeIndicator.tsx    — red line showing current time
│   ├── AppointmentDialog.tsx       — modal for create/edit
│   │   ├── CreateMode.tsx          — date/time/dentist pre-filled from click
│   │   └── EditMode.tsx            — existing data + contextual actions
│   └── hooks/
│       ├── useCalendarEvents.ts    — fetch + transform to Calendar.Event[]
│       ├── useOptimisticUpdate.ts  — optimistic drag/drop with rollback
│       └── useCalendarState.ts     — URL params + navigation state
│   └── utils/
│       └── dentist-colors.ts       — pure function: getDentistColor(id, index) → string
src/app/dashboard/agendamentos/list-view.tsx       (extracted current page — preserved)
```

**Key change from v1:** `AvailabilityOverlay.tsx` removed (it's `slotPropGetter` config inside `ScheduleCalendar`, not a component). `useDentistColors` became a pure utility. Added `CurrentTimeIndicator`, `useCalendarState` hook, and `utils/` directory.

---

## Dependencies

```json
{
  "react-big-calendar": "^1.19.4",
  "@types/react-big-calendar": "^1.16.3",
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/utilities": "^3.2.2",
  "date-fns": "^4.1.0"
}
```

**Notes:**
- `react-big-calendar` has built-in `date-fns` localizer (import from `react-big-calendar/lib/localizers/date-fns`)
- `@dnd-kit` handles drag-and-drop (replaces `@hello-pangea/dnd` which is for list DnD, not calendar)
- No `moment` dependency
- No `date-fns-tz` needed — date-fns v4 has native TZ support via `TZDate` type
- Package must be loaded with `next/dynamic({ ssr: false })` — react-big-calendar uses `window` and breaks in SSR

---

## Calendar Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| Localizer | `dateFnsLocalizer` | Already installed, no moment |
| First day of week | Monday (1) | Brazilian convention |
| Time slot interval | 30 minutes | Matches existing scheduler default |
| Time range | 07:00 - 20:00 | Covers early/late appointments |
| Default view | Week | Most useful for clinics |
| Scroll to time | 08:00 | Start of business hours |
| Culture | `pt-BR` | Portuguese locale |
| Views | month, week, day, resource | Resource = columns per dentist |

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
4. Transform response → Calendar.Event[] via useCalendarEvents hook
5. Each event gets: id, title (patient name), start, end, resource (dentist id)
   Resource mapping: each dentist becomes a `resource` object with id, name, color
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
   - Is status editable? (completed/cancelled/no_show → reject, cursor: not-allowed)
   - Is target within working hours? (no → reject with red highlight)
   - Is target slot free? (checked client-side against loaded events)
3. Optimistic: update local state immediately
4. Background: PUT /api/appointments/[id]/reschedule { scheduled_at, duration_minutes }
5. On success: revalidate cache (invalidate React Query key)
6. On error: rollback visual state + show toast with error message
   - "Conflito de horario" for server-side overlap (race condition)
   - "Fora do horario de atendimento" for out-of-bounds
   - "Agendamento nao pode ser alterado" for terminal statuses
```

### Click-to-Create

```
1. User clicks empty slot
2. Open AppointmentDialog in create mode
3. Pre-fill: date, time (slot start), duration (30min default from procedure)
4. If single dentist selected in filter, pre-fill that dentist
5. User fills: patient (search by name/phone), procedure (auto-sets duration), notes
6. POST /api/appointments
7. On success: invalidate calendar query + close dialog
8. On error: show inline error in dialog
```

### Click-to-Edit

```
1. User clicks existing event
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

The fourth view mode: **Resource**. Displays each dentist as a vertical column (like Google Calendar's "Schedule" view or "Resource" view). This is the most useful view for multi-dentist clinics.

```
|  Horario  |  Dr. Joao  |  Dra. Maria  |  Dr. Pedro  |
|-----------|------------|--------------|-------------|
|  08:00    | [Evento]   |              | [Evento]    |
|  08:30    |            | [Evento]     |             |
|  09:00    | [Evento]   |              |             |
|  ...      |            |              |             |
```

Implementation:
- Uses react-big-calendar's built-in `resources` and `resourceIdAccessor` props
- Only dentists active in the filter are shown as columns
- Max 5 columns visible; beyond that, horizontal scroll
- On mobile: resource view hidden (replaced by day view with dentist filter)

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

**Status visualization** (applied on top of dentist color):

| Status | Border | Background | Opacity | Effect |
|--------|--------|-----------|---------|--------|
| scheduled | dashed, blue-400 | dentist color, 10% tint | 85% | — |
| confirmed | solid, emerald-400 | dentist color, 15% tint | 100% | — |
| in_progress | solid, emerald-500 | dentist color, 20% tint | 100% | subtle left-to-right shimmer |
| completed | solid, gray-300 | dentist color, 5% tint | 70% | — |
| cancelled | solid, red-300 | dentist color, 3% tint | 50% | strikethrough on text |
| no_show | solid, red-400 | dentist color, 5% tint | 50% | — |

**Note on `in_progress`:** v1 spec had "pulse" animation which is visually distracting in a calendar grid. Replaced with subtle shimmer (CSS `background-position` animation on a gradient).

### Event Card (in week/day/resource views)

```
┌─────────────────────────────┐
│ ▊ 09:00 - 09:30             │ ← dentist color bar on left (3px)
│ Maria Silva                  │ ← patient name (font-medium)
│ Limpeza                      │ ← procedure name (text-muted)
└─────────────────────────────┘
```

Note: dentist name removed from card in week/day/resource views since it's implied by column or color. Only shown in month view.

### Month View Events

Compact: colored dot (dentist color) + patient name truncated + time.
Max 3 visible per day cell, "+N more" link expands to day view.

### Current Time Indicator

Horizontal red line (`h-0.5 bg-red-500`) positioned at the current time in week/day/resource views. Updates every minute via `setInterval`. Hidden in month view. Uses absolute positioning relative to the time gutter.

---

## Filtering

| Filter | Type | Behavior |
|--------|------|----------|
| Dentist | Multi-checkbox | Each checkbox shows dentist name + colored dot + appointment count. Unchecking hides their events and removes their resource column. |
| Specialty | Dropdown | Filters dentist checkboxes to only matching specialties. "Todas" = no filter. |
| Date | Mini-calendar | Clicking a date navigates calendar to that date. Selected date highlighted with ring. |
| View | Segmented control | "Mes" / "Semana" / "Dia" / "Profissionais" toggle. Persists to URL params. |

### Default Values

| Param | Default | Reason |
|-------|---------|--------|
| `view` | `week` | Most useful overview for clinics |
| `date` | Today | Current date |
| `dentists` | All active | Show everyone by default |
| `specialty` | `""` (all) | No filter by default |

Filters persist in URL search params for shareable/bookmarkable views:
```
/dashboard/agendamentos?view=week&date=2026-04-10&dentists=uuid1,uuid2&specialty=Ortodontia
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
- Drag & drop disabled on touch devices (tap-to-edit only)
- Event cards expand to full width
- "Novo" button as FAB (floating action button) in bottom-right
- Mini-calendar hidden on mobile (date picker via dialog instead)
- Resource view replaced by day view with dentist filter active

---

## Timezone Handling

- Calendar displays in clinic timezone from `clinics.settings.timezone`
- Default: `America/Sao_Paulo`
- Fallback: browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- date-fns v4 has native TZ support via `TZDate` type — no separate `date-fns-tz` package needed
- All API times remain ISO 8601 with offset (`2026-04-10T09:00:00-03:00`)

---

## Availability Overlay (slotPropGetter)

Configured inside `ScheduleCalendar` via react-big-calendar's `slotPropGetter` prop:

- **Available hours** (07:00-20:00 workdays): white/light background
- **Outside working hours**: `bg-gray-100 dark:bg-gray-800` — non-interactive
- **Lunch break** (12:00-13:00): `bg-amber-50 dark:bg-amber-950/20` — available but highlighted
- Uses `dentists.working_hours` JSONB when available
- Falls back to `clinics.settings.operating_hours` (default: 08:00-18:00, lunch 12:00-13:00, Mon-Fri)
- When dragging, slots outside working hours reject the drop with red highlight + snap-back animation

---

## State Management

### URL State (via `useCalendarState` hook)

```typescript
// URL params managed by the hook
interface CalendarURLState {
  view: 'month' | 'week' | 'day' | 'resource'
  date: string         // YYYY-MM-DD
  dentists: string     // comma-separated UUIDs
  specialty: string    // specialty name or empty
}
```

Hook syncs bidirectionally: URL → state on mount, state → URL on change.

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
| Drag to occupied slot | Red highlight on target + toast "Conflito: horario ja ocupado" + rollback |
| Drag outside work hours | Gray highlight + toast "Fora do horario de atendimento" + rollback |
| Drag completed/cancelled | Blocked entirely (event not draggable, `isDraggable` returns false) |
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
- **Optimistic updates**: no waiting for API on drag/drop
- **Memoization**: event list memoized with `useMemo`, recompute only when filters change
- **Debounced filter**: specialty dropdown debounces 300ms before re-fetching
- **Code splitting**: `react-big-calendar` loaded via `next/dynamic({ ssr: false })` — only loaded on this page
- **Prefetch**: adjacent week prefetched on idle for smooth navigation
- **Event transform**: `useCalendarEvents` memoizes the API → Calendar.Event[] transform

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

### New Files (12)
- `src/components/calendar/CalendarLayout.tsx`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/CalendarSidebar.tsx`
- `src/components/calendar/MiniCalendar.tsx`
- `src/components/calendar/DentistFilter.tsx`
- `src/components/calendar/SpecialtyFilter.tsx`
- `src/components/calendar/ScheduleCalendar.tsx`
- `src/components/calendar/EventCard.tsx`
- `src/components/calendar/CurrentTimeIndicator.tsx`
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
