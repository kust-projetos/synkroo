# Custom Calendar View - Design Specification

**Date:** 2026-04-14
**Version:** 1.0
**Status:** Approved
**Author:** Claude Code

---

## 1. Overview

Rebuild the calendar view from scratch without `@event-calendar/core`, solving the overlapping cards problem when multiple appointments exist in the same time slot.

**Goals:**
- Cards stack vertically without overlapping
- Status-based colors (not dentist-based)
- Keep existing good components (MiniCalendar, filters, hooks)
- Support 4 views: Month, Week, Day, Professionals
- Drag-and-drop rescheduling

---

## 2. Design System

### 2.1 CSS Variables

```css
:root {
  --background: #ffffff;
  --foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --primary: #14b8a6;
  --primary-foreground: #ffffff;
  --secondary: #f59e0b;
  --secondary-foreground: #ffffff;
  --border: #e2e8f0;
  --ring: #14b8a6;
  --card: #ffffff;
  --card-foreground: #0f172a;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #09090b;
    --foreground: #fafafa;
    --muted: #18181b;
    --muted-foreground: #a1a1aa;
    --primary: #14b8a6;
    --primary-foreground: #0a0a0a;
    --border: #27272a;
    --card: #18181b;
    --card-foreground: #fafafa;
  }
}
```

### 2.2 Status Colors

| Status | Gradient | Badge | Text |
|--------|----------|-------|------|
| scheduled | `#f59e0b` → `#d97706` | `rgba(255,255,255,0.2)` | white |
| confirmed | `#14b8a6` → `#0d9488` | `#22c55e` | white |
| in_progress | `#22c55e` → `#16a34a` | `rgba(255,255,255,0.25)` | white |
| completed | `#9ca3af` → `#6b7280` | `rgba(255,255,255,0.15)` | white |
| cancelled | `#9ca3af` → `#6b7280` | `rgba(255,255,255,0.15)` | white |
| no_show | `#9ca3af` → `#6b7280` | `rgba(255,255,255,0.15)` | white |

### 2.3 Professional Colors

Each dentist has a unique color for identification in Professionals view:

| Initials | Color | CSS Class |
|----------|-------|-----------|
| CS | `#3b82f6` (blue) | `avatar-carlos` |
| AO | `#10b981` (emerald) | `avatar-ana` |
| FA | `#8b5cf6` (violet) | `avatar-felipe` |
| BR | `#ec4899` (pink) | `avatar-bianca` |

---

## 3. Layout Structure

### 3.1 Calendar Container

```
┌─────────────────────────────────────────────────────────────┐
│  TOOLBAR (px-4 py-3 border-b border-border bg-background)  │
│  [‹ ›] [Hoje] [Title]              [Tabs] [+ Novo]        │
├─────────────────────────────────────────────────────────────┤
│ ┌──────┬────────┬────────┬────────┬────────┬────────┬─────┐ │
│ │ TIME │  SEG   │  TER   │  QUA   │  QUI   │  SEX   │ ... │ │
│ │      │   13   │   14   │   15   │   16   │   17   │     │ │
│ ├──────┼────────┼────────┼────────┼────────┼────────┼─────┤ │
│ │08:00 │ [CARD] │        │ [CARD] │        │        │     │ │
│ │      │ [CARD] │        │        │        │        │     │ │
│ ├──────┼────────┼────────┼────────┼────────┼────────┼─────┤ │
│ │09:00 │        │ [CARD] │        │ [CARD] │        │     │ │
│ │      │        │        │        │        │        │     │ │
│ └──────┴────────┴────────┴────────┴────────┴────────┴─────┘ │
│  LEGEND (border-t bg-muted/30)                             │
│  [● Agendado] [● Confirmado] [● Em Andamento] [● Cancelado]│
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Time Column
- Width: `w-14` (56px)
- Background: `bg-muted`
- Time labels: `text-xs font-medium text-muted-foreground`
- Alinhado à direita com `text-right`

### 3.3 Day Headers
- Height: `h-12` (48px)
- Today: `bg-primary/5 text-primary border-b-2 border-primary`
- Regular: `bg-muted/50 text-foreground`
- Friday (SEX): `bg-primary/5 text-primary`

### 3.4 Time Slots
- Height: `h-20` (80px) - configurable per view
- Border bottom: `border-border`
- Relative positioning for cards

---

## 4. Components

### 4.1 Toolbar

**File:** `CalendarToolbar.tsx` (existing - no changes needed)

**Layout:**
```tsx
<div className="flex justify-between items-center px-4 py-3 border-b border-border bg-background">
  {/* Left: Navigation + Title */}
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" aria-label="Semana anterior">‹</Button>
    <Button variant="outline" size="sm" aria-label="Próxima semana">›</Button>
    <Button variant="outline" size="sm" onClick={onToday}>Hoje</Button>
    <h2 className="text-sm font-semibold ml-2">{title}</h2>
    {isLoading && <Spinner />}
  </div>
  {/* Right: View Tabs + New Button */}
  <div className="flex items-center gap-3">
    <ViewTabs />
    <Button size="sm" onClick={onNewAppointment}>+ Novo</Button>
  </div>
</div>
```

### 4.2 View Tabs

```tsx
<div role="tablist" className="inline-flex border border-border rounded-lg overflow-hidden">
  <button role="tab" aria-selected={view === 'week'} className={tabClass}>Semana</button>
  <button role="tab" aria-selected={view === 'month'} className={tabClass}>Mês</button>
  <button role="tab" aria-selected={view === 'day'} className={tabClass}>Dia</button>
  <button role="tab" aria-selected={view === 'professionals'} className={tabClass}>Profissionais</button>
</div>
```

**Active tab:** `bg-primary text-primary-foreground`
**Inactive tab:** `bg-background text-muted-foreground hover:bg-muted/50`

### 4.3 Appointment Card

**File:** `EventCard.tsx` (update existing)

```tsx
interface AppointmentCardProps {
  appointment: {
    id: string
    title: string
    status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
    procedureName: string
    durationMinutes: number
    patientPhone?: string
  }
  style?: React.CSSProperties
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
}

function AppointmentCard({ appointment, style, onClick, onDragStart }: AppointmentCardProps) {
  const colors = STATUS_COLORS[appointment.status]
  const icon = STATUS_ICONS[appointment.status]
  const isCancelled = ['cancelled', 'no_show'].includes(appointment.status)

  return (
    <div
      className={cn(
        "absolute top-1 left-1 right-1 rounded-lg p-2 shadow-sm",
        "transition-transform duration-200 hover:scale-[1.02]",
        isCancelled && "opacity-70"
      )}
      style={{
        background: `linear-gradient(135deg, ${colors.bg}, ${colors.bgEnd})`,
        ...style
      }}
      onClick={onClick}
      draggable={appointment.status === 'scheduled' || appointment.status === 'confirmed'}
      onDragStart={onDragStart}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-xs font-semibold text-white truncate",
            isCancelled && "line-through"
          )}>
            {appointment.title}
          </div>
          <div className={cn(
            "text-[10px] text-white/85 mt-0.5 truncate",
            isCancelled && "line-through"
          )}>
            {appointment.procedureName}
          </div>
        </div>
        <span className={cn(
          "px-1.5 py-0.5 rounded-full text-[9px] text-white shrink-0",
          isCancelled ? "bg-white/15" : colors.badge
        )}>
          {icon} {appointment.durationMinutes}m
        </span>
      </div>
    </div>
  )
}
```

### 4.4 Time Slot

```tsx
interface TimeSlotProps {
  date: Date
  hour: number
  appointments: Appointment[]
  onAppointmentClick?: (id: string) => void
  onDrop?: (appointmentId: string, newDate: Date, newHour: number) => void
}

function TimeSlot({ date, hour, appointments, onAppointmentClick, onDrop }: TimeSlotProps) {
  return (
    <div
      className="h-20 border-b border-border relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const appointmentId = e.dataTransfer.getData('appointmentId')
        onDrop?.(appointmentId, date, hour)
      }}
    >
      {appointments.map((apt, index) => (
        <AppointmentCard
          key={apt.id}
          appointment={apt}
          style={{ top: `${index * 40}px`, zIndex: index + 1 }}
          onClick={() => onAppointmentClick?.(apt.id)}
        />
      ))}
    </div>
  )
}
```

### 4.5 Many Appointments Slot (Overflow)

When `appointments.length > 3`:

```tsx
function ManyAppointmentsSlot({ appointments, maxVisible = 3 }: TimeSlotProps) {
  const visibleAppointments = appointments.slice(0, maxVisible)
  const overflowCount = appointments.length - maxVisible
  const hasOverflow = overflowCount > 0

  return (
    <div className="h-[120px] border-b border-border slot-scroll overflow-y-auto">
      {visibleAppointments.map((apt, index) => (
        <AppointmentCard
          key={apt.id}
          appointment={apt}
          className="relative flex-shrink-0 mb-1"
        />
      ))}
      {hasOverflow && (
        <div className="text-center text-[10px] text-muted-foreground py-1">
          +{overflowCount} mais
        </div>
      )}
    </div>
  )
}
```

**CSS:**
```css
.slot-scroll {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.slot-scroll::-webkit-scrollbar {
  width: 4px;
}

.slot-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}
```

### 4.6 Professionals View Column

```tsx
interface ProfessionalColumnProps {
  professional: {
    id: string
    name: string
    specialty: string
    initials: string
    color: string
  }
  slots: Map<number, Appointment[]>
  onAppointmentClick?: (id: string) => void
}

function ProfessionalColumn({ professional, slots, onAppointmentClick }: ProfessionalColumnProps) {
  const headerClass = `h-14 p-2 text-center border-b-2 flex items-center justify-center gap-2`
  const colorMap: Record<string, string> = {
    '#3b82f6': 'header-carlos',
    '#10b981': 'header-ana',
    '#8b5cf6': 'header-felipe',
    '#ec4899': 'header-bianca',
  }

  return (
    <div className="flex-1 border-r border-border">
      {/* Header */}
      <div className={`${headerClass} ${colorMap[professional.color]}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold`}
             style={{ backgroundColor: professional.color }}>
          {professional.initials}
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-foreground">{professional.name}</div>
          <div className="text-[10px] text-muted-foreground">{professional.specialty}</div>
        </div>
      </div>

      {/* Time Slots */}
      {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(hour => (
        <TimeSlot
          key={hour}
          date={currentDate}
          hour={hour}
          appointments={slots.get(hour) || []}
          onAppointmentClick={onAppointmentClick}
        />
      ))}
    </div>
  )
}
```

---

## 5. Hooks (Existing - No Changes)

### 5.1 useCalendarState

**File:** `hooks/useCalendarState.ts`

Keeps URL params synchronized:
- `view` - current view
- `date` - selected date
- `dentistIds` - selected dentist filters
- `specialty` - selected specialty filter

### 5.2 useCalendarEvents

**File:** `hooks/useCalendarEvents.ts`

Fetches appointments from API:
- Input: clinicId, startDate, endDate, dentistIds, specialty
- Output: events, resources, isLoading, error, refetch, invalidateCalendar

**Extends `CalendarEvent` interface:**
```typescript
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
    durationMinutes: number
  }
}
```

---

## 6. Views

### 6.1 Week View

- Default view
- 5-7 day columns
- Time slots: `h-20` (80px)
- Cards stack vertically with absolute positioning

### 6.2 Month View

- Traditional month grid
- Day cells with appointment dots
- Click day to open Day view

### 6.3 Day View

- Single day with expanded time slots
- `h-24` (96px) per hour for better visibility

### 6.4 Professionals View

- One column per dentist
- Dentist header with avatar and specialty
- Shows workload distribution

---

## 7. Interactions

### 7.1 Click Appointment

Opens appointment detail dialog (existing `AppointmentDialog.tsx`)

### 7.2 Drag and Drop

```typescript
function onDragStart(e: React.DragEvent, appointment: Appointment) {
  e.dataTransfer.setData('appointmentId', appointment.id)
}

function onDrop(e: React.DragEvent, date: Date, hour: number) {
  const appointmentId = e.dataTransfer.getData('appointmentId')
  // Call API to reschedule
  rescheduleAppointment(appointmentId, date, hour)
}
```

### 7.3 Click Time Slot

Opens "New Appointment" dialog with pre-filled date/time.

### 7.4 Navigation

- `‹ ›` buttons: navigate prev/next period
- "Hoje" button: return to current date

---

## 8. Accessibility

### 8.1 ARIA Labels

```tsx
<button aria-label="Semana anterior">‹</button>
<button aria-label="Próxima semana">›</button>
<button aria-label="Ir para hoje">Hoje</button>
<button aria-label="Criar novo agendamento">+ Novo</button>
```

### 8.2 Tab Navigation

```tsx
<div role="tablist">
  <button role="tab" aria-selected={true}>Semana</button>
  <button role="tab" aria-selected={false}>Mês</button>
</div>
```

### 8.3 Focus States

```css
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

---

## 9. File Structure

```
src/components/calendar/
├── CalendarLayout.tsx       # Main layout (existing)
├── CalendarToolbar.tsx      # Navigation + tabs (existing)
├── CalendarSidebar.tsx       # Mini calendar + filters (existing)
├── MiniCalendar.tsx          # Mini calendar (existing)
├── DentistFilter.tsx        # Dentist checkboxes (existing)
├── SpecialtyFilter.tsx        # Specialty dropdown (existing)
├── ScheduleCalendar.tsx      # Main calendar (TO UPDATE)
├── AppointmentDialog.tsx     # Dialog (existing)
├── EventCard.tsx            # Appointment card (TO UPDATE)
├── calendar-styles.css       # Global styles (TO UPDATE)
│
├── views/
│   ├── WeekView.tsx         # NEW
│   ├── MonthView.tsx         # NEW
│   ├── DayView.tsx           # NEW
│   └── ProfessionalsView.tsx # NEW
│
├── components/
│   ├── TimeSlot.tsx         # NEW
│   ├── AppointmentCard.tsx   # NEW (extracted from EventCard)
│   ├── TimeColumn.tsx        # NEW
│   ├── DayHeader.tsx          # NEW
│   └── ProfessionalHeader.tsx # NEW
│
├── hooks/
│   ├── useCalendarState.ts   # Existing (no changes)
│   ├── useCalendarEvents.ts  # Existing (no changes)
│   └── useCalendarNavigation.ts # NEW
│
└── utils/
    ├── date-utils.ts         # NEW
    ├── appointment-utils.ts  # NEW
    └── dentist-colors.ts    # Existing
```

---

## 10. Implementation Priority

1. **Phase 1:** Extract components (AppointmentCard, TimeSlot, etc.)
2. **Phase 2:** Implement WeekView with stacked cards
3. **Phase 3:** Add scroll overflow for many appointments
4. **Phase 4:** Implement MonthView, DayView
5. **Phase 5:** Implement ProfessionalsView
6. **Phase 6:** Add drag-and-drop
7. **Phase 7:** Polish animations and transitions

---

## 11. Dependencies

**Existing:**
- React 18+
- date-fns
- @tanstack/react-query
- @heroicons/react
- Tailwind CSS
- shadcn/ui components

**New:**
- `@dnd-kit/core` (for drag and drop, optional - can use native HTML5 DnD)

---

## 12. Success Criteria

- [ ] No overlapping cards when multiple appointments in same slot
- [ ] Cards stack vertically with proper overflow handling
- [ ] Status colors are consistent (not dentist colors on cards)
- [ ] All 4 views work correctly
- [ ] Dark mode support
- [ ] Accessibility: keyboard navigation, screen reader support
- [ ] Drag and drop rescheduling works
- [ ] URL params remain synchronized
