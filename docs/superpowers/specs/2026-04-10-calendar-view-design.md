# Calendar View Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Phase:** Phase 1 (Calendar UI) — Phase 2 (Google Calendar integration) is separate

---

## Overview

Replace the current flat list-by-day appointments page with a Google Calendar-style scheduling interface. Three views (month/week/day), filtering by dentist and specialty, drag-and-drop rescheduling, click-to-create, and click-to-edit. Uses `@hello-pangea/calendar` with `date-fns` localizer.

The existing list view is preserved as a toggle option ("Lista" | "Calendário").

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
│   ├── ScheduleCalendar.tsx        — @hello-pangea/calendar wrapper
│   │   ├── EventCard.tsx           — custom event renderer (patient + procedure + status)
│   │   └── AvailabilityOverlay.tsx — background slots from working_hours
│   ├── AppointmentDialog.tsx       — modal for create/edit
│   │   ├── CreateMode.tsx          — date/time/dentist pre-filled from click
│   │   └── EditMode.tsx            — existing data + contextual actions
│   └── hooks/
│       ├── useCalendarEvents.ts    — fetch + transform to Calendar.Event[]
│       ├── useOptimisticUpdate.ts  — optimistic drag/drop with rollback
│       └── useDentistColors.ts     — assign and cache colors per dentist
src/app/dashboard/agendamentos/list-view.tsx       (extracted current page — preserved)
```

---

## Dependencies

```json
{
  "@hello-pangea/calendar": "^0.1.x",
  "date-fns": "^4.1.0"  // already installed
}
```

No `moment` — use `date-fns` localizer from `@hello-pangea/calendar`.

---

## Data Flow

### Loading Events

```
1. URL state: { view, date, dentistIds, specialty }
2. Compute date range from view + date
   - Month: first/last day of month (padded to week boundaries)
   - Week: Mon-Sun of current week
   - Day: 00:00-23:59 of selected date
3. GET /api/appointments?clinic_id=X&start_date=Y&end_date=Z&dentist_ids=A,B
4. Transform response → Calendar.Event[] via useCalendarEvents hook
5. Each event gets: id, title (patient name), start, end, resource (dentist, procedure, status)
```

### Drag & Drop (Optimistic)

```
1. User drags event to new slot
2. Optimistic: update local state immediately
3. Background: PUT /api/appointments/[id]/reschedule { scheduled_at, duration_minutes }
4. On success: revalidate cache (SWR/stale-while-revalidate)
5. On error: rollback visual state + show toast with error message
   - "Conflito de horário" for overlap
   - "Fora do horário de trabalho" for out-of-bounds
   - "Agendamento não pode ser alterado" for terminal statuses
```

### Click-to-Create

```
1. User clicks empty slot
2. Open AppointmentDialog in create mode
3. Pre-fill: date, time (slot start), duration (default 30min from clinic settings)
4. If dentist filter is single-select, pre-fill that dentist too
5. User fills: patient (search), procedure, notes
6. POST /api/appointments
7. On success: add to local state + close dialog
8. On error: show inline error in dialog
```

### Click-to-Edit

```
1. User clicks existing event
2. Open AppointmentDialog in edit mode
3. Show: patient info, date/time, duration, dentist, procedure, notes, status
4. Contextual actions by status:
   - scheduled → confirm, cancel
   - confirmed → start attendance, cancel, mark no-show
   - in_progress → complete
   - completed/cancelled/no_show → view only (read-only)
5. PUT /api/appointments/[id] for edits
6. POST /api/appointments/[id]/confirm etc. for status changes
```

---

## API Changes

### Extend Existing Endpoint (No New Route)

`GET /api/appointments` — add query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `dentist_ids` | string (comma-sep) | Filter by multiple dentists |
| `specialty` | string | Filter by dentist specialty |
| `include_joins` | boolean | Always return patient, dentist, procedure joins when true |

The calendar mode always passes `include_joins=true`. Response includes:
```json
{
  "appointments": [{
    "id": "uuid",
    "scheduled_at": "2026-04-10T09:00:00-03:00",
    "duration_minutes": 30,
    "status": "confirmed",
    "notes": "...",
    "patient": { "id": "uuid", "name": "Maria Silva" },
    "dentist": { "id": "uuid", "name": "Dr. João", "specialty": "Ortodontia" },
    "procedure": { "id": "uuid", "name": "Limpeza", "duration_minutes": 30 }
  }]
}
```

### Dentist Colors Endpoint

`GET /api/dentists` — already returns list. Client-side assigns colors from palette.

---

## Visual Design

### Color System

**Dentist colors** (8-color palette, cycled):
```
#3B82F6 (blue), #10B981 (emerald), #F59E0B (amber), #EF4444 (red),
#8B5CF6 (violet), #EC4899 (pink), #06B6D4 (cyan), #F97316 (orange)
```

**Status visualization** (applied on top of dentist color):

| Status | Border | Background | Opacity | Icon |
|--------|--------|-----------|---------|------|
| scheduled | dashed, blue-400 | dentist color, 10% tint | 85% | clock |
| confirmed | solid, emerald-400 | dentist color, 15% tint | 100% | check |
| in_progress | solid, emerald-400 + pulse | dentist color, 20% tint | 100% | play |
| completed | solid, gray-300 | dentist color, 5% tint | 70% | check-circle |
| cancelled | solid, red-300 + strikethrough | dentist color, 3% tint | 50% | x-circle |
| no_show | solid, red-400 | dentist color, 5% tint | 50% | exclamation |

### Event Card (in week/day views)

```
┌─────────────────────────────┐
│ ▊ 09:00 - 09:30             │ ← dentist color bar on left
│ Maria Silva                  │ ← patient name (bold)
│ Limpeza • Dr. João           │ ← procedure • dentist (muted)
└─────────────────────────────┘
```

### Month View Events

Compact: colored dot (dentist color) + patient initials + time.
Max 3 visible per day, "+N more" clickable to expand to day view.

---

## Filtering

| Filter | Type | Behavior |
|--------|------|----------|
| Dentist | Multi-checkbox | Each checkbox shows dentist name + colored dot + appointment count for visible range. Unchecking hides their events. |
| Specialty | Dropdown | Filters the dentist checkboxes to show only matching specialties. "Todas" = no filter. |
| Date | Mini-calendar | Clicking a date navigates calendar to that date. Selected date highlighted. |
| View | Segmented control | "Mês" / "Semana" / "Dia" toggle. Persists to URL params. |

Filters persist in URL search params for shareable/bookmarkable views.

---

## Responsive Behavior

| Breakpoint | Sidebar | Default View | Behavior |
|-----------|---------|-------------|----------|
| ≥1024px (desktop) | Fixed left, 280px | Week | Full calendar with sidebar |
| 768-1023px (tablet) | Collapsible overlay | Week | Sidebar behind hamburger button |
| <768px (mobile) | Drawer (swipe from left) | Day | Mini-calendar hidden, day view only |

### Mobile Adaptations

- View toggle hidden on mobile (locked to day view)
- Drag & drop disabled on touch (tap-to-edit only)
- Event cards expand to full width
- "Novo" button as FAB (floating action button) in bottom-right

---

## Timezone Handling

- Calendar displays in clinic timezone from `clinics.settings.timezone`
- Default: `America/Sao_Paulo`
- Fallback: browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Uses `date-fns-tz` for conversion (part of date-fns v4)
- All API times remain ISO 8601 with offset (`2026-04-10T09:00:00-03:00`)

---

## Availability Overlay

Shows working hours as subtle background shading:
- Available hours: white/light background
- Outside working hours: gray-100 background
- Lunch break: amber-50 background
- Uses `dentists.working_hours` JSONB when available
- Falls back to `clinics.settings.operating_hours` (existing default: 08:00-18:00, lunch 12:00-13:00, Mon-Fri)

When dragging, slots outside working hours reject the drop with visual feedback (red highlight).

---

## State Management

All calendar state lives in URL search params for shareability:

```
/dashboard/agendamentos?view=week&date=2026-04-10&dentists=uuid1,uuid2&specialty=Ortodontia
```

React Query (`@tanstack/react-query`, already installed) for data fetching:
- Query key: `['calendar-events', clinicId, startDate, endDate, dentistIds, specialty]`
- Stale time: 30 seconds (matches existing `useAppointments`)
- On mutation success: invalidate calendar query

---

## Error Handling

| Scenario | UI Response |
|----------|------------|
| Drag to occupied slot | Red highlight on target + toast "Conflito: horário já ocupado" + rollback |
| Drag outside work hours | Gray highlight + toast "Fora do horário de atendimento" + rollback |
| Drag completed/cancelled | Blocked entirely (cursor: not-allowed) |
| API error on create | Inline error in dialog, dialog stays open |
| API error on edit | Inline error in dialog, dialog stays open |
| Network error | Toast "Sem conexão. Tentando novamente..." + retry |
| Auth expired | Redirect to login (existing middleware handles this) |

---

## Performance Considerations

- **Date-range queries**: only fetch appointments for the visible range, not the entire month
- **Optimistic updates**: no waiting for API on drag/drop
- **Memoization**: event list memoized with `useMemo`, recompute only when filters change
- **Debounced filter**: specialty dropdown debounces 300ms before re-fetching
- **Code splitting**: `@hello-pangea/calendar` loaded dynamically (`next/dynamic`) since it's only needed on this page

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

---

## Files to Create/Modify

### New Files
- `src/components/calendar/CalendarLayout.tsx`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/CalendarSidebar.tsx`
- `src/components/calendar/MiniCalendar.tsx`
- `src/components/calendar/DentistFilter.tsx`
- `src/components/calendar/SpecialtyFilter.tsx`
- `src/components/calendar/ScheduleCalendar.tsx`
- `src/components/calendar/EventCard.tsx`
- `src/components/calendar/AvailabilityOverlay.tsx`
- `src/components/calendar/AppointmentDialog.tsx`
- `src/components/calendar/hooks/useCalendarEvents.ts`
- `src/components/calendar/hooks/useOptimisticUpdate.ts`
- `src/components/calendar/hooks/useDentistColors.ts`

### Modified Files
- `src/app/dashboard/agendamentos/page.tsx` — rewritten with view toggle
- `src/app/api/appointments/route.ts` — extend GET with `dentist_ids`, `specialty`, `include_joins`

### Preserved Files
- `src/app/dashboard/agendamentos/novo/page.tsx` — keep existing create flow
- `src/app/dashboard/agendamentos/[id]/page.tsx` — keep existing detail page
- Current list view logic extracted to `list-view.tsx` component
