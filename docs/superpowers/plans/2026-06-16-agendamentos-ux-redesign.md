# Agendamentos UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/dashboard/agendamentos` so it works as a leigo-friendly visual schedule plus fast intervention surface, with `Dia`, `Semana`, `Mês`, and `Profissionais` kept first-class.

**Architecture:** Build on the existing calendar shell instead of replacing it. Add a summary layer, shared appointment display primitives, and a contextual quick-action layer, then refine each view in place so the route keeps its current URL/store/data flow while gaining clearer hierarchy and AI/manual transparency.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zustand, TanStack Query, Tailwind CSS, existing calendar grid components.

**Agent Orchestration:** Supervisor-Workers — the work splits naturally into toolbar/layout, shared appointment primitives, view refinements, and quick-action flows.

---

## File Structure

### Existing files to modify

- `src/components/calendar/utils/types.ts` — extend `CalendarEvent` with optional UI metadata for origin and change summaries.
- `src/components/calendar/hooks/useCalendarEvents.ts` — adapt fetched appointments into the richer event shape with safe fallbacks.
- `src/components/calendar/CalendarToolbar.tsx` — stronger hierarchy, primary action, lighter treatment of `Lista`.
- `src/components/calendar/CalendarLayout.tsx` — mount summary bar and contextual side panel while preserving view switching.
- `src/components/calendar/views/DayView.tsx` — primary operational view refresh.
- `src/components/calendar/views/WeekView.tsx` — hybrid acompanhamento + action refinement.
- `src/components/calendar/views/MonthView.tsx` — show real appointments in day cells, not just density.
- `src/components/calendar/views/ProfessionalsView.tsx` — improve operational readability.
- `src/components/calendar/AppointmentDialog.tsx` — align quick create/edit with redesigned interaction model.
- `src/components/calendar/RescheduleDialog.tsx` — strengthen before/after confirmation language.
- `src/app/dashboard/agendamentos/loading.tsx` — summary/grid-aware skeletons.

### New files to create

- `src/components/calendar/ScheduleSummaryBar.tsx`
- `src/components/calendar/AppointmentOriginBadge.tsx`
- `src/components/calendar/AppointmentChangeSummary.tsx`
- `src/components/calendar/AttentionPanel.tsx`
- `src/components/calendar/__tests__/AppointmentOriginBadge.test.tsx`
- `src/components/calendar/__tests__/AppointmentChangeSummary.test.tsx`
- `src/components/calendar/__tests__/ScheduleSummaryBar.test.tsx`

### Deferred files

These stay as fallback flows in this plan and are not rewritten immediately:

- `src/app/dashboard/agendamentos/list-view.tsx`
- `src/app/dashboard/agendamentos/[id]/page.tsx`
- `src/app/dashboard/agendamentos/novo/page.tsx`

---

### Task 1: Extend the calendar event UI model safely

**Files:**
- Modify: `src/components/calendar/utils/types.ts`
- Modify: `src/components/calendar/hooks/useCalendarEvents.ts`
- Test: `src/components/calendar/__tests__/useCalendarEvents-ui-shape.test.ts`

- [ ] **Step 1: Write the failing UI-shape test**

```tsx
import { describe, expect, it } from '@jest/globals'

describe('calendar event UI shape', () => {
  it('supports safe optional origin/change metadata', () => {
    const event = {
      id: 'apt-1',
      title: 'Maria',
      start: new Date('2026-06-16T09:00:00'),
      end: new Date('2026-06-16T09:30:00'),
      dentistId: 'dent-1',
      dentistName: 'Dra. Ana',
      procedureName: 'Avaliação',
      status: 'scheduled',
      durationMinutes: 30,
      origin: 'ai',
      changeSummary: 'Remarcado pela IA há 12 min',
      changeImpact: 'Abriu lacuna às 09:00',
    }

    expect(event.origin).toBe('ai')
    expect(event.changeSummary).toContain('IA')
    expect(event.changeImpact).toContain('lacuna')
  })
})
```

- [ ] **Step 2: Run test to verify it fails on missing file/type support**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/useCalendarEvents-ui-shape.test.ts`
Expected: FAIL if the new test file or type support is missing.

- [ ] **Step 3: Extend the `CalendarEvent` type minimally**

```ts
export type AppointmentOrigin = 'ai' | 'manual'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  dentistId: string
  dentistName: string
  dentistSpecialty?: string
  procedureName: string
  procedureCategory?: string
  status: AppointmentStatus
  durationMinutes: number
  notes?: string | null
  origin?: AppointmentOrigin
  changeSummary?: string
  changeImpact?: string
}
```

- [ ] **Step 4: Map safe fallback metadata in `useCalendarEvents.ts`**

```ts
return {
  id: apt.id,
  title: apt.patients?.name || 'Paciente',
  start,
  end,
  dentistId: apt.dentists?.id || '',
  dentistName: apt.dentists?.name || 'Sem dentista',
  dentistSpecialty: apt.dentists?.specialty || undefined,
  procedureName: apt.procedures?.name || '',
  procedureCategory: apt.procedures?.category || undefined,
  status: apt.status as CalendarEvent['status'],
  durationMinutes: apt.duration_minutes,
  notes: apt.notes,
  origin: undefined,
  changeSummary: undefined,
  changeImpact: undefined,
}
```

- [ ] **Step 5: Run the focused test**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/useCalendarEvents-ui-shape.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/utils/types.ts src/components/calendar/hooks/useCalendarEvents.ts src/components/calendar/__tests__/useCalendarEvents-ui-shape.test.ts
git commit -m "feat: extend calendar event ui metadata"
```

---

### Task 2: Add shared appointment primitives for origin and change summaries

**Files:**
- Create: `src/components/calendar/AppointmentOriginBadge.tsx`
- Create: `src/components/calendar/AppointmentChangeSummary.tsx`
- Test: `src/components/calendar/__tests__/AppointmentOriginBadge.test.tsx`
- Test: `src/components/calendar/__tests__/AppointmentChangeSummary.test.tsx`

- [ ] **Step 1: Write the failing badge tests**

```tsx
import { render, screen } from '@testing-library/react'
import { AppointmentOriginBadge } from '../AppointmentOriginBadge'

it('renders IA label for ai origin', () => {
  render(<AppointmentOriginBadge origin="ai" />)
  expect(screen.getByText('IA')).toBeInTheDocument()
})

it('renders Manual label for manual origin', () => {
  render(<AppointmentOriginBadge origin="manual" />)
  expect(screen.getByText('Manual')).toBeInTheDocument()
})
```

```tsx
import { render, screen } from '@testing-library/react'
import { AppointmentChangeSummary } from '../AppointmentChangeSummary'

it('renders nothing when summary is absent', () => {
  const { container } = render(<AppointmentChangeSummary />)
  expect(container).toBeEmptyDOMElement()
})

it('renders change text when provided', () => {
  render(<AppointmentChangeSummary summary="Remarcado pela IA há 12 min" />)
  expect(screen.getByText(/Remarcado pela IA/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/AppointmentOriginBadge.test.tsx src/components/calendar/__tests__/AppointmentChangeSummary.test.tsx`
Expected: FAIL because the components do not exist yet.

- [ ] **Step 3: Implement `AppointmentOriginBadge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import type { AppointmentOrigin } from './utils/types'

export function AppointmentOriginBadge({ origin }: { origin?: AppointmentOrigin }) {
  if (!origin) return null

  const label = origin === 'ai' ? 'IA' : 'Manual'
  const className = origin === 'ai'
    ? 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-200'
    : 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200'

  return <Badge className={className}>{label}</Badge>
}
```

- [ ] **Step 4: Implement `AppointmentChangeSummary.tsx`**

```tsx
export function AppointmentChangeSummary({ summary }: { summary?: string }) {
  if (!summary) return null

  return (
    <p className="text-xs text-muted-foreground truncate" title={summary}>
      {summary}
    </p>
  )
}
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/AppointmentOriginBadge.test.tsx src/components/calendar/__tests__/AppointmentChangeSummary.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/AppointmentOriginBadge.tsx src/components/calendar/AppointmentChangeSummary.tsx src/components/calendar/__tests__/AppointmentOriginBadge.test.tsx src/components/calendar/__tests__/AppointmentChangeSummary.test.tsx
git commit -m "feat: add shared appointment origin primitives"
```

---

### Task 3: Rebuild the page shell with a summary layer and improved toolbar hierarchy

**Files:**
- Modify: `src/components/calendar/CalendarToolbar.tsx`
- Create: `src/components/calendar/ScheduleSummaryBar.tsx`
- Modify: `src/components/calendar/CalendarLayout.tsx`
- Test: `src/components/calendar/__tests__/ScheduleSummaryBar.test.tsx`

- [ ] **Step 1: Write the failing summary bar test**

```tsx
import { render, screen } from '@testing-library/react'
import { ScheduleSummaryBar } from '../ScheduleSummaryBar'

it('renders period, change, and attention summaries', () => {
  render(
    <ScheduleSummaryBar
      periodLabel="Hoje"
      appointmentCount={12}
      aiChangesCount={3}
      manualChangesCount={1}
      attentionCount={2}
    />
  )

  expect(screen.getByText(/12 agendamentos/i)).toBeInTheDocument()
  expect(screen.getByText(/3 alterações da IA/i)).toBeInTheDocument()
  expect(screen.getByText(/2 itens de atenção/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ScheduleSummaryBar.test.tsx`
Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Implement `ScheduleSummaryBar.tsx`**

```tsx
import { Card } from '@/components/ui/card'

interface ScheduleSummaryBarProps {
  periodLabel: string
  appointmentCount: number
  aiChangesCount: number
  manualChangesCount: number
  attentionCount: number
}

export function ScheduleSummaryBar(props: ScheduleSummaryBarProps) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-3">
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">{props.periodLabel}</p>
        <p className="text-2xl font-semibold">{props.appointmentCount} agendamentos</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Mudanças recentes</p>
        <p className="text-lg font-semibold">{props.aiChangesCount} alterações da IA</p>
        <p className="text-sm text-muted-foreground">{props.manualChangesCount} manuais</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Atenção</p>
        <p className="text-lg font-semibold">{props.attentionCount} itens de atenção</p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Refactor `CalendarToolbar.tsx` to de-emphasize `Lista` and add primary CTA**

```tsx
const PRIMARY_VIEWS: CalendarView[] = ['day', 'week', 'month', 'professionals']

const SECONDARY_VIEWS: CalendarView[] = ['list']
```

```tsx
<button className="px-3 py-1.5 text-sm font-semibold rounded-md bg-teal-600 text-white hover:bg-teal-700">
  Novo agendamento
</button>
```

Keep `Lista` available, but visually secondary.

- [ ] **Step 5: Mount the summary bar in `CalendarLayout.tsx` with safe placeholder counts**

```tsx
<ScheduleSummaryBar
  periodLabel={title}
  appointmentCount={events.length}
  aiChangesCount={events.filter((event) => event.origin === 'ai').length}
  manualChangesCount={events.filter((event) => event.origin === 'manual').length}
  attentionCount={events.filter((event) => event.status === 'scheduled').length}
/>
```

Use safe counts first. Real attention heuristics can improve later.

- [ ] **Step 6: Run the focused test**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ScheduleSummaryBar.test.tsx`
Expected: PASS

- [ ] **Step 7: Manual verify in dev**

Run: `npm run dev`
Expected: toolbar hierarchy is clearer, `Lista` is secondary, summary layer appears below header.

- [ ] **Step 8: Commit**

```bash
git add src/components/calendar/CalendarToolbar.tsx src/components/calendar/CalendarLayout.tsx src/components/calendar/ScheduleSummaryBar.tsx src/components/calendar/__tests__/ScheduleSummaryBar.test.tsx
git commit -m "feat: add agendamentos summary shell"
```

---

### Task 4: Refresh `DayView` as the primary operational view

**Files:**
- Modify: `src/components/calendar/views/DayView.tsx`
- Modify: supporting event card renderer files under `src/components/calendar/grid/` or `src/components/calendar/events/` as needed
- Test: `src/components/calendar/__tests__/DayView.behavior.test.tsx`

- [ ] **Step 1: Write a focused rendering test for origin and summary visibility**

```tsx
it('shows origin and change summary on appointments in day view', () => {
  render(
    <DayView
      date={new Date('2026-06-16T00:00:00')}
      events={[{
        id: 'apt-1',
        title: 'Maria',
        start: new Date('2026-06-16T09:00:00'),
        end: new Date('2026-06-16T09:30:00'),
        dentistId: 'dent-1',
        dentistName: 'Dra. Ana',
        procedureName: 'Avaliação',
        status: 'scheduled',
        durationMinutes: 30,
        origin: 'ai',
        changeSummary: 'Remarcado pela IA há 12 min',
      }]}
    />
  )
})
```

- [ ] **Step 2: Run the test to capture the current gap**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/DayView.behavior.test.tsx`
Expected: FAIL or incomplete rendering.

- [ ] **Step 3: Update the appointment card renderer used by `DayView`**

Render card content in this order:

```tsx
<div className="space-y-1">
  <div className="flex items-center justify-between gap-2">
    <p className="font-medium truncate">{event.title}</p>
    <AppointmentOriginBadge origin={event.origin} />
  </div>
  <p className="text-sm text-muted-foreground truncate">{event.procedureName} • {event.dentistName}</p>
  <AppointmentChangeSummary summary={event.changeSummary} />
</div>
```

- [ ] **Step 4: Make empty slots look actionable**

Use hover affordance like:

```tsx
<div className="opacity-0 group-hover:opacity-100 text-xs text-teal-600 font-medium">
  + Criar encaixe
</div>
```

- [ ] **Step 5: Run the focused day view test**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/DayView.behavior.test.tsx`
Expected: PASS

- [ ] **Step 6: Manual verify in browser**

Run: `npm run dev`
Expected: `Dia` reads clearly, origin is visible, empty slots invite action.

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar/views/DayView.tsx src/components/calendar/grid src/components/calendar/events src/components/calendar/__tests__/DayView.behavior.test.tsx
git commit -m "feat: refresh day view for quick intervention"
```

---

### Task 5: Refine `WeekView` and `MonthView` without demoting them

**Files:**
- Modify: `src/components/calendar/views/WeekView.tsx`
- Modify: `src/components/calendar/views/MonthView.tsx`
- Test: `src/components/calendar/__tests__/MonthView.day-cell.test.tsx`

- [ ] **Step 1: Write the failing month-cell test**

```tsx
it('shows real appointment rows inside a month day cell', () => {
  render(
    <MonthView
      date={new Date('2026-06-01T00:00:00')}
      events={[
        {
          id: 'apt-1',
          title: 'Maria',
          start: new Date('2026-06-12T09:00:00'),
          end: new Date('2026-06-12T09:30:00'),
          dentistId: 'dent-1',
          dentistName: 'Dra. Ana',
          procedureName: 'Avaliação',
          status: 'scheduled',
          durationMinutes: 30,
        },
      ]}
    />
  )

  expect(screen.getByText(/09:00 - Maria/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test to verify the month requirement gap**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/MonthView.day-cell.test.tsx`
Expected: FAIL if the cell does not yet show the required appointment row.

- [ ] **Step 3: Refine `WeekView.tsx` to reuse the same shared primitives as day view**

Render the same appointment metadata in a denser layout:

```tsx
<AppointmentOriginBadge origin={event.origin} />
<AppointmentChangeSummary summary={event.changeSummary} />
```

Keep the weekly layout lighter than day view.

- [ ] **Step 4: Refine `MonthView.tsx` to keep actual appointment rows visible in each day cell**

Preserve and polish the existing mini-card approach:

```tsx
<div className="truncate">{formatTime(event.start)} - {event.title}</div>
```

Keep `MAX_VISIBLE_EVENTS = 3`, preserve `+N mais`, and add discreet AI-change indicator when `event.origin === 'ai'`.

- [ ] **Step 5: Run the focused month test**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/MonthView.day-cell.test.tsx`
Expected: PASS

- [ ] **Step 6: Manual verify `Semana` and `Mês`**

Run: `npm run dev`
Expected:
- `Semana` still feels first-class
- `Mês` shows actual appointments in cells
- no view feels like a dead-end

- [ ] **Step 7: Commit**

```bash
git add src/components/calendar/views/WeekView.tsx src/components/calendar/views/MonthView.tsx src/components/calendar/__tests__/MonthView.day-cell.test.tsx
git commit -m "feat: refine week and month schedule views"
```

---

### Task 6: Refine `ProfessionalsView` and align quick action surfaces

**Files:**
- Modify: `src/components/calendar/views/ProfessionalsView.tsx`
- Modify: `src/components/calendar/RescheduleDialog.tsx`
- Modify: `src/components/calendar/AppointmentDialog.tsx`

- [ ] **Step 1: Add origin/change summary support to the professionals event rendering path**

Reuse the same card primitives:

```tsx
<AppointmentOriginBadge origin={event.origin} />
<AppointmentChangeSummary summary={event.changeSummary} />
```

- [ ] **Step 2: Improve `RescheduleDialog.tsx` language to show before/after clearly**

Add explicit copy like:

```tsx
<div className="text-xs text-muted-foreground">De: {originalDateStr} às {originalTimeStr}</div>
<div className="text-xs font-medium text-teal-600">Para: {formatDisplayDate(rescheduleInfo.targetDateKey)} às {hour}:{minute}</div>
```

- [ ] **Step 3: Align `AppointmentDialog.tsx` with quick-create expectations**

Keep the dialog, but make the create path feel short:

```tsx
<DialogTitle>{isCreate ? 'Novo agendamento' : 'Editar agendamento'}</DialogTitle>
```

Prefer only the essential fields above the fold: patient, date/time, professional, procedure.

- [ ] **Step 4: Manual verify `Profissionais` and quick flows**

Run: `npm run dev`
Expected:
- professionals view stays operational
- reschedule confirmation is human-readable
- quick create remains short

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/views/ProfessionalsView.tsx src/components/calendar/RescheduleDialog.tsx src/components/calendar/AppointmentDialog.tsx
git commit -m "feat: align professionals and quick action flows"
```

---

### Task 7: Polish loading, empty, and error states

**Files:**
- Modify: `src/app/dashboard/agendamentos/loading.tsx`
- Modify: `src/components/calendar/CalendarLayout.tsx`
- Modify: view-specific empty states if needed

- [ ] **Step 1: Replace spinner-only loading with shell-aware skeletons**

Use skeletons for:

```tsx
<Skeleton className="h-24 w-full rounded-xl" />
<Skeleton className="h-[500px] w-full rounded-xl" />
```

- [ ] **Step 2: Add clearer empty-state copy per view**

Examples:

```tsx
const EMPTY_MESSAGES = {
  day: 'Nenhum agendamento neste dia',
  week: 'Nenhum agendamento nesta semana',
  month: 'Nenhum agendamento neste mês',
  professionals: 'Nenhum agendamento para os profissionais neste período',
}
```

- [ ] **Step 3: Add conflict-oriented error copy where reschedule/save fails**

Use explicit copy like:

```ts
showToast('Não foi possível salvar a mudança por conflito de horário.', 'warning')
```

- [ ] **Step 4: Manual verify states**

Run: `npm run dev`
Expected: page no longer relies on isolated spinner states, and empty/error copy is human.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/agendamentos/loading.tsx src/components/calendar/CalendarLayout.tsx src/components/calendar/views src/components/calendar/RescheduleDialog.tsx
git commit -m "feat: polish agendamentos states"
```

---

### Task 8: Final verification

**Files:**
- Review only: all modified files above

- [ ] **Step 1: Run focused frontend tests**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/AppointmentOriginBadge.test.tsx src/components/calendar/__tests__/AppointmentChangeSummary.test.tsx src/components/calendar/__tests__/ScheduleSummaryBar.test.tsx src/components/calendar/__tests__/DayView.behavior.test.tsx src/components/calendar/__tests__/MonthView.day-cell.test.tsx src/components/calendar/__tests__/useCalendarEvents-ui-shape.test.ts`
Expected: PASS

- [ ] **Step 2: Run broader test suite for appointments risk area**

Run: `npm test -- --runTestsByPath src/__tests__/api/appointments/conflict-detection.test.ts src/services/appointments/__tests__/appointment-actions.service.test.ts`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Manual product verification**

Run: `npm run dev`
Checklist:
- `Dia` is clearly the strongest view
- `Semana` still feels first-class
- `Mês` shows actual appointments in day cells
- `Profissionais` is operational
- origin `IA` vs `Manual` is visible when available
- summary bar helps leigo understanding
- quick actions preserve context

- [ ] **Step 5: Commit final pass**

```bash
git add src/components/calendar src/app/dashboard/agendamentos/loading.tsx
git commit -m "feat: finalize agendamentos ux redesign"
```

---

## Spec Coverage Check

- leigo acompanhamento: covered by summary bar, clearer header, better empty/loading/error states
- quick intervention: covered by day view refresh, quick create/edit, reschedule confirmation
- AI/manual transparency: covered by shared primitives and event UI metadata
- `Semana` first-class: explicitly refined, not demoted
- `Mês` showing actual appointments: explicit month-cell task and test
- `Profissionais` operational: explicit refinement task

---

## Placeholder Scan

Reject any unfinished filler language before execution.

Run: `python - <<'PY'
from pathlib import Path
text = Path('docs/superpowers/plans/2026-06-16-agendamentos-ux-redesign.md').read_text(encoding='utf-8')
forbidden = ['T'+'BD', 'TO'+'DO', 'implement'+' later', 'appropriate'+' error handling', 'similar'+' to task']
for hit in forbidden:
    if hit in text:
        print(hit)
PY`
Expected: no output
