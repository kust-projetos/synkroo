# Calendar View Design Specification

**Date:** 2026-04-13
**Updated:** 2026-04-14 (v3 - Incremental improvements over @event-calendar/core)
**Status:** Approved
**Project:** Synkroo - Clínica Odontológica

---

## Overview

The calendar uses `@event-calendar/core` as the underlying engine, customized with custom CSS and event rendering to achieve the desired visual design. This approach balances development speed with full visual control.

---

## Design Decisions

### Layout Type: Hybrid Week View

**Structure:**
- **Week Grid (compact):** Summary view showing all days of the week with time slots on the left axis
- **Day Expansion:** Click on any day header to expand and show a detailed list of appointments for that day
- **Toolbar:** Fixed navigation bar with view switcher (Month/Week/Day/Profissionais)

**Rationale:** Combines the quick visual scanning of a weekly grid (Google Calendar style) with the detailed information display of a list view. Users can see the week's occupation at a glance, then drill down into specific days.

---

## View Types

### View 1: Month (Mês)

**Purpose:** Overview of the entire month. See which days have appointments, identify busy days.

**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│ ◀  Abril 2026                                           │
├─────────────────────────────────────────────────────────┤
│ Seg   Ter   Qua   Qui   Sex   Sáb   Dom                 │
│                                                         │
│ [1]   [2]   [3]   [4]   [5]   [6]   [7]               │
│  ●●    ●      ●     ●●    ●           (indicators)    │
│                                                         │
│ [8]   [9]   [10]  [11]  [12]  [13]  [14]              │
│  ●     ●●     ●      ●     ●●●    ●                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Card Design (Month Cell):**
- Day number in top-left
- Colored dots indicate appointments (up to 3 dots per day)
- Dot colors = dentist colors (for quick identification of who's busy)
- "+X" indicator if more than 3 appointments
- Click on day → navigates to Week view with that day selected

**Information shown per day:**
- Up to 3 appointment indicators (colored dots)
- No patient names in month view (too crowded)

**States:**
- Today: teal background highlight
- Days with appointments: subtle indicator
- Weekend days: slightly muted background

---

### View 2: Week (Semana)

**Purpose:** Primary view for daily operations. See the week's schedule at a glance.

**Visual Design:**
```
┌────────────────────────────────────────────────────────────────┐
│ ◀  13 de Abril, 2026                           Mês Semana Dia Profissionais │
├────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│    │ SEG 13 │ TER 14 │ QUA 15 │ QUI 16 │ SEX 17 │ SÁB 18 │ DOM 19 │
├────┼────────┼────────┼────────┴────────┴────────┴────────┴────────┤
│07:00                                                                 │
│08:00│ [Card] │        │ [Card] │        │        │        │        │
│09:00│ [Card] │ [Card] │ [Card] │ [Card] │        │        │        │
│10:00│        │ [Card] │        │ [Card] │ [Card] │        │        │
│11:00│ [Card] │        │ [Card] │        │ [Card] │        │        │
│12:00│        │        │        │        │        │        │        │
│...  │        │        │        │        │        │        │        │
└────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
```

**Compact Card (Week View):**
```
┌─────────────────────────────┐
│ José Americo         ⏳ 30m│  ← Patient name (bold, 13px)
│ Avaliação Inicial          │  ← Procedure (11px, 90% opacity)
└─────────────────────────────┘
```

**Card Color = Status (NOT dentist):**
- Background: gradient based on status color
- No dentist name shown (column header identifies dentist in resourceTimeGridDay view only)
- Drag handle (⋮⋮) positioned top-right, subtle

**Interactions:**
- Click on card → opens AppointmentDialog (edit mode)
- Drag card → reschedule (drag and drop)
- Click on empty slot → creates new appointment
- Click on day header → expands day details below
- Many appointments in same slot → scrollable stack

**Card Details:**
| Field | Size | Style |
|-------|------|-------|
| Patient name | 13px | Bold, white |
| Procedure | 11px | Normal, 90% white |
| Status icon | 10px | Badge top-right |
| Duration | 10px | 75% white, next to status |

---

### View 3: Day (Dia)

**Purpose:** Detailed view of a single day. Maximum information density.

**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│ ◀  Segunda-feira, 13 de Abril de 2026        Mês Semana Dia Profissionais │
├─────────────────────────────────────────────────────────┤
│ 07:00                                                    │
│ 08:00  ┌─────────────────────────────────────────────┐   │
│        │ José Americo                           ⏳ 30m │   │
│        │ Avaliação Inicial                            │   │
│        │ Dr. Carlos Silva                       R$150 │   │
│        └─────────────────────────────────────────────┘   │
│ 08:30  ┌─────────────────────────────────────────────┐   │
│        │ Maria Santos                           ✓ 45m │   │
│        │ Clareamento Dental                          │   │
│        │ Dra. Ana Oliveira                      R$200 │   │
│        └─────────────────────────────────────────────┘   │
│ 09:15  ┌─────────────────────────────────────────────┐   │
│        │ Pedro Henrique                         ▶ 90m │   │
│        │ Tratamento de Canal                          │   │
│        │ Dr. Carlos Silva                      R$350 │   │
│        └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Expanded Card (Day View):**
- Full-width cards (no grid columns)
- Time shown on the left of each card
- Shows appointment VALUE (R$) in bottom-right
- Larger card dimensions than Week view
- Cannot drag to reschedule (use edit dialog)

**Differences from Week View:**
- Full-width cards
- Time shown on the left of each card
- Shows appointment VALUE (R$) in day view
- Larger card dimensions
- Shows dentist name
- Cannot drag to reschedule

---

### View 4: Professionals (Profissionais)

**Purpose:** See all appointments organized by dentist. Ideal for understanding each professional's schedule.

**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│  Profissionais                              Mês Semana Dia Profissionais │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┬──────────┐ │
│ │ Dr. Carlos│ Dra. Ana │ Dr. Felipe│ Dra. Bianca│ │
│ │  Silva    │ Oliveira │           │  Rocha    │ │
│ ├──────────┼──────────┼──────────┼──────────┤ │
│ │ 08:00 ✓ │ 08:30 ⏳ │ 09:00 ✓ │ 10:00 ✓ │ │
│ │ José     │ Maria    │ Carlos   │ Pedro    │ │
│ │ Avaliação│ Clareamento│ Limpeza │ Implante │ │
│ ├──────────┼──────────┼──────────┼──────────┤ │
│ │ 09:00 ⏳ │ 10:00 ✓ │ 10:30 ✕ │ 11:00 ⏳ │ │
│ │ Pedro    │ Ana      │ Roberto  │ Marcos   │ │
│ │ Canal    │ Prótese  │ (cancel)│ Prótese  │ │
│ └──────────┴──────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────────────┘

Legend: ✓ Confirmado  ⏳ Agendado  ▶ Em Andamento  ✕ Cancelado
```

**Column per Professional:**
- Header shows professional name + avatar with initials
- Time slots listed vertically
- Cards color-coded by STATUS (not dentist)
- Shows procedure name in each card
- Good for: seeing who's available, who's overloaded

**Card in Professionals View:**
```
┌───────────────────────┐
│ José Americo    ⏳   │
│ Avaliação        30m  │
│ R$ 150               │
└───────────────────────┘
```

---

## Visual Design

### Color Palette

#### Status-Based Card Colors (PRIMARY DECISION)

**Card background = Status color, NOT dentist color.**

| Status | Primary Color | Gradient End | Badge BG | Text/Border |
|--------|---------------|--------------|----------|-------------|
| Scheduled | `#F59E0B` (amber) | `#D97706` | `rgba(255,255,255,0.2)` | white |
| Confirmed | `#14B8A6` (teal) | `#0D9488` | `#22C55E` | white |
| In Progress | `#22C55E` (green) | `#16A34A` | `rgba(255,255,255,0.25)` | white |
| Completed | `#9CA3AF` (gray) | `#6B7280` | `rgba(255,255,255,0.15)` | white (60% opacity) |
| Cancelled | `#EF4444` (red) | `#DC2626` | `rgba(255,255,255,0.2)` | white (60% opacity) |
| No-show | `#EF4444` (red) | `#DC2626` | `rgba(255,255,255,0.2)` | white (60% opacity) |

#### Dentist Identification Colors (SECONDARY)

Used for: avatars, header backgrounds, month view dots, sidebar filter

| Dentist Index | Color | Hex |
|--------------|-------|-----|
| 1 | Blue | `#3B82F6` |
| 2 | Emerald | `#10B981` |
| 3 | Amber | `#F59E0B` |
| 4 | Red | `#EF4444` |
| 5 | Violet | `#8B5CF6` |
| 6 | Pink | `#EC4899` |
| 7 | Cyan | `#06B6D4` |
| 8 | Orange | `#F97316` |

#### System Colors

| Purpose | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Primary | `#14B8A6` | `#2DD4BF` |
| Background | `#FFFFFF` | `#0F172A` |
| Surface | `#F9FAFB` | `#1E293B` |
| Border | `#E5E7EB` | `#334155` |
| Text Primary | `#1F2937` | `#F8FAFC` |
| Text Secondary | `#6B7280` | `#94A3B8` |
| Text Tertiary | `#9CA3AF` | `#64748B` |

---

### Status Icons & Styles

| Status | Icon | Badge Style | Card Effect |
|--------|------|-------------|-------------|
| Scheduled | ⏳ | Semi-transparent white pill | Default |
| Confirmed | ✓ | Green pill (`#22C55E`) | Default |
| In Progress | ▶ | Light green pill | Pulse animation on card |
| Completed | ✓ | Gray pill (`#9CA3AF`) | 60% opacity |
| Cancelled | ✕ | Red pill (`#EF4444`) | 60% opacity + strikethrough |
| No-show | ✕ | Red pill (`#EF4444`) | 60% opacity + strikethrough |

---

## States

### Loading State

When data is being fetched, show skeleton cards:

```
┌─────────────────────────────┐
│ ████████████         ⏳   │
│ ████████                 │
└─────────────────────────────┘
```

- Skeleton uses animated shimmer effect
- Same dimensions as real cards
- 3-4 skeletons per visible slot

### Empty State

When no appointments for the selected period:

```
┌─────────────────────────────────────────┐
│                                         │
│         📅 Nenhum agendamento           │
│                                         │
│   Não há consultas para este período.   │
│   Clique em um horário para criar um.   │
│                                         │
└─────────────────────────────────────────┘
```

### Error State

When API call fails:

```
┌─────────────────────────────────────────┐
│                                         │
│         ⚠️ Erro ao carregar            │
│                                         │
│   Não foi possível obter os            │
│   agendamentos.                        │
│                                         │
│   [ Tentar novamente ]                 │
│                                         │
└─────────────────────────────────────────┘
```

### Optimistic Update State

When drag-and-drop is in progress:

1. Original card becomes semi-transparent (40% opacity)
2. Ghost card follows cursor at full opacity
3. On success: ghost replaces original
4. On failure: original snaps back, toast shows error

---

## Components

### 1. CalendarToolbar
- Navigation: Previous (‹), Next (›), Today button
- Current date display with locale format
- View switcher: Month | Week | Day | Profissionais buttons
- "Novo" (New) button for creating appointments
- Background: white with subtle border

### 2. MonthGrid
- Calendar month view with day cells
- Colored dot indicators per dentist
- Today highlight, weekend muted
- Click navigates to week view

### 3. WeekGrid
- 5-column grid (Mon-Fri) or 7-column (Mon-Sun) based on clinic settings
- Left sidebar: Time labels (configurable start/end)
- Configurable time slots: 15, 30, or 60 minute intervals
- Grid lines: subtle, doesn't compete with cards
- Cards colored by STATUS (not dentist)

### 4. DayView
- Single column list of appointments
- Time on left, full-width cards on right
- Shows appointment value
- Sorted by time

### 5. ProfessionalsGrid
- Column per dentist
- Time slots on left axis
- Status-colored cards within columns
- Filter by specialty possible
- Dentist identified by column header (avatar + name)

### 6. AppointmentCard
- Compact display in week/professionals view
- Full display in day view
- Shows: Patient name, procedure, status badge, duration
- Status badge with icon (top-right corner)
- Drag handle indicator (⋮⋮) in week view (top-right, subtle)
- Hover: subtle scale (1.02) + shadow increase
- Click: opens AppointmentDialog

### 7. DayExpansion
- Triggered by clicking day header in week view
- Shows full list of appointments for that day
- Each item shows: time, patient, procedure, dentist, status, value
- Scroll if many appointments
- Close by clicking header again or outside

### 8. AppointmentDialog
- Create mode: form with patient name, phone, dentist, procedure, date, time, duration, notes
- Edit mode: view all details, status action buttons (Confirm, Cancel, Start, Complete)
- Read-only for completed/cancelled/no-show statuses

### 9. LoadingSkeleton
- Animated shimmer effect
- Matches real card dimensions
- Shows during data fetching

### 10. EmptyState
- Centered message with icon
- Call-to-action button
- Contextual to current view

### 11. ErrorState
- Error message display
- Retry button
- Used in calendar and dialog

---

## Interaction Patterns

| Action | View | Behavior |
|--------|------|----------|
| **Click on month day** | Month | Navigate to Week view, day selected |
| **Click on card** | Week/Day/Prof | Open AppointmentDialog (edit mode) |
| **Drag card** | Week | Reorder/reschedule (drag and drop) |
| **Click on empty slot** | Week | Open AppointmentDialog (create mode with pre-filled date/time) |
| **Click on day header** | Week | Expand/collapse day details |
| **Click professional column** | Professionals | Filter to show only that professional |
| **Click navigation** | All | Move to prev/next week/month/day |

---

## Responsive Behavior

| Screen Size | Behavior |
|-------------|----------|
| Desktop (>1024px) | Full view with sidebar visible |
| Tablet (768-1024px) | Compressed grid, sidebar collapsible |
| Mobile (<768px) | Single day view default, view switcher at top |

---

## Configuration (per clinic)

- `slotDuration`: 15, 30, or 60 minutes
- `startTime`: First hour visible (e.g., 07:00)
- `endTime`: Last hour visible (e.g., 21:00)
- `workingDays`: Array of working days (default: [1,2,3,4,5])
- `showWeekends`: Boolean (default: true)

---

## Technical Approach

### Stack
- **Framework:** Next.js 15 with App Router
- **Calendar Engine:** `@event-calendar/core` v5.6 (customized via CSS + eventContent)
- **Styling:** Tailwind CSS + CSS custom properties + calendar-styles.css
- **State:** React hooks (useState, useMemo) + URL search params
- **Data Fetching:** TanStack Query (existing)
- **Drag & Drop:** @event-calendar/core Interaction plugin
- **Icons:** Lucide React + @heroicons/react (already in project)

### Customization Strategy

The `@event-calendar/core` library provides the underlying grid logic. Visual customization is achieved through:

1. **eventContent function:** Custom HTML rendering for event cards
2. **eventClassNames function:** Status-based CSS classes
3. **calendar-styles.css:** Override default library styles
4. **Dark mode:** CSS variables + `.dark` class overrides

### Architecture

```
src/
├── components/
│   └── calendar/
│       ├── CalendarLayout.tsx      # Main calendar layout
│       ├── ScheduleCalendar.tsx   # @event-calendar/core wrapper
│       ├── CalendarToolbar.tsx    # Navigation + view switcher
│       ├── CalendarSidebar.tsx    # Filters + mini calendar
│       ├── AppointmentDialog.tsx # Create/Edit modal
│       ├── EventCard.tsx         # eventContent + eventClassNames callbacks
│       ├── MiniCalendar.tsx       # Sidebar mini calendar
│       ├── DentistFilter.tsx     # Sidebar dentist filter
│       ├── SpecialtyFilter.tsx   # Sidebar specialty filter
│       ├── calendar-styles.css    # Custom styles + status colors
│       ├── utils/
│       │   └── dentist-colors.ts # Dentist color palette (for avatars/dots)
│       └── hooks/
│           ├── useCalendarState.ts   # URL-persisted state
│           ├── useCalendarEvents.ts  # Data fetching + transform
│           └── useOptimisticUpdate.ts # Drag/resize handlers
└── app/
    └── dashboard/
        └── agendamentos/
            ├── page.tsx           # Main page (toggle list/calendar)
            └── list-view.tsx      # List view alternative
```

### Data Flow

1. `useCalendarState` reads/writes URL params (view, date, dentist_ids, specialty)
2. `useCalendarEvents` fetches appointments from API based on URL params
3. Events are transformed to CalendarEvent format
4. **Card color = status color** (NOT dentist color)
5. Components render based on state; interactions call API and invalidate queries

### Color Assignment Logic

```typescript
// Card color = STATUS color
const STATUS_COLORS = {
  scheduled: { bg: '#F59E0B', bgEnd: '#D97706' },
  confirmed: { bg: '#14B8A6', bgEnd: '#0D9488' },
  in_progress: { bg: '#22C55E', bgEnd: '#16A34A' },
  completed: { bg: '#9CA3AF', bgEnd: '#6B7280' },
  cancelled: { bg: '#EF4444', bgEnd: '#DC2626' },
  no_show: { bg: '#EF4444', bgEnd: '#DC2626' },
}

// Dentist color = for AVATARS and dots only
const DENTIST_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', ...]
```

---

## Dentist Color Assignment

Colors are deterministically assigned based on dentist ID hash. Used for:
- Avatar background colors
- Month view appointment dots
- Sidebar dentist filter checkmarks

| Color | Hex | Usage |
|-------|-----|-------|
| Blue | `#3b82f6` | Dentist 1 |
| Emerald | `#10b981` | Dentist 2 |
| Amber | `#f59e0b` | Dentist 3 |
| Red | `#ef4444` | Dentist 4 |
| Violet | `#8b5cf6` | Dentist 5 |
| Pink | `#ec4899` | Dentist 6 |
| Cyan | `#06b6d4` | Dentist 7 |
| Orange | `#f97316` | Dentist 8 |

---

## Accessibility

| Element | ARIA | Keyboard |
|---------|------|----------|
| Calendar grid | role="grid" | Arrow keys navigate |
| Event card | role="button" aria-label="[Patient] - [Procedure] at [Time]" | Enter to open |
| Empty slot | aria-label="Create appointment at [Time]" | Enter to create |
| View switcher | role="tablist" | Arrow keys switch |
| Dialog | role="dialog" aria-modal="true" | Escape closes |

---

## Out of Scope (v1)

- Recurring appointments
- Multiple clinics view
- Waitlist integration in calendar
- SMS/WhatsApp reminder triggers
- Calendar print view
- Export to PDF/CSV

---

## Success Criteria

- [ ] Month view displays days with appointment indicators (dentist colors)
- [ ] Week grid displays appointments with correct STATUS-based colors
- [ ] Cards show patient name, procedure, duration, status badge
- [ ] Day view shows detailed list with appointment values
- [ ] Professionals view shows columns per dentist
- [ ] Click on card opens dialog with full details
- [ ] Drag and drop reschedules appointment (week view)
- [ ] Day expansion shows detailed list
- [ ] View switcher (Month/Week/Day/Profissionais) works
- [ ] Navigation (prev/next/today) updates view
- [ ] Dark mode renders correctly
- [ ] Mobile shows single-day view
- [ ] All status transitions work (confirm, cancel, start, complete)
- [ ] Loading skeleton shows during data fetch
- [ ] Empty state displays when no appointments
- [ ] Error state with retry when API fails
- [ ] Clinic settings control time slots and hours
