# Agendamentos Professionals Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `Profissionais` calendar view scale cleanly for many professionals by introducing grouping/density controls, compact professional headers, compact cards, and overflow handling.

**Architecture:** Keep the existing calendar grid and drag model. Add lightweight state for grouping and density, compute per-column summaries in `ProfessionalsView`, adapt the shared `EventCard` to a professionals-mode compact layout, and add overflow logic when many professionals are visible.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Tailwind CSS, existing calendar grid components.

**Agent Orchestration:** Supervisor-Workers — the work splits into store/types, toolbar controls, professionals view layout, card compaction, overflow logic, and verification.

---

## File Structure

### Existing files to modify
- `src/components/calendar/utils/types.ts`
- `src/components/calendar/store/calendar-store.ts`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/views/ProfessionalsView.tsx`
- `src/components/calendar/events/EventCard.tsx`
- `src/components/calendar/grid/EventLayer.tsx` if mode/context plumbing is needed
- `src/components/calendar/grid/TimeGrid.tsx` if sticky/compact header behavior needs small support

### New files to create
- `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`

---

### Task 1: Add scaling state to calendar types and store

**Files:**
- Modify: `src/components/calendar/utils/types.ts`
- Modify: `src/components/calendar/store/calendar-store.ts`
- Test: `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`

- [ ] **Step 1: Write the failing state-oriented test skeleton**

```tsx
import { describe, expect, it } from '@jest/globals'

describe('professionals scaling modes', () => {
  it('supports professionals grouping and compact density', () => {
    const state = {
      groupMode: 'professionals',
      densityMode: 'compact',
    }

    expect(state.groupMode).toBe('professionals')
    expect(state.densityMode).toBe('compact')
  })
})
```

- [ ] **Step 2: Run test to verify it fails or is incomplete**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
Expected: FAIL or placeholder until store/types exist.

- [ ] **Step 3: Extend types with grouping and density modes**

```ts
export type CalendarGroupMode = 'professionals' | 'time' | 'status'
export type CalendarDensityMode = 'compact' | 'comfortable'
```

- [ ] **Step 4: Extend `CalendarStore` minimally**

```ts
groupMode: CalendarGroupMode
densityMode: CalendarDensityMode
setGroupMode: (mode: CalendarGroupMode) => void
setDensityMode: (mode: CalendarDensityMode) => void
```

Initialize with:

```ts
groupMode: 'professionals',
densityMode: 'comfortable',
```

- [ ] **Step 5: Run the focused test**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
Expected: PASS for the mode shape.

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/utils/types.ts src/components/calendar/store/calendar-store.ts src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx
git commit -m "feat: add professionals scaling state"
```

---

### Task 2: Add grouping and density controls to the toolbar

**Files:**
- Modify: `src/components/calendar/CalendarToolbar.tsx`

- [ ] **Step 1: Add small controls only when view is `professionals`**

```tsx
{view === 'professionals' && (
  <div className="flex items-center gap-2">
    <button onClick={() => setGroupMode('professionals')}>Profissionais</button>
    <button onClick={() => setGroupMode('time')}>Horários</button>
    <button onClick={() => setDensityMode('compact')}>Compacto</button>
    <button onClick={() => setDensityMode('comfortable')}>Confortável</button>
  </div>
)}
```

- [ ] **Step 2: Keep the controls visually light**

Use outline/subtle styling. Do not add large panels or cards.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/CalendarToolbar.tsx
git commit -m "feat: add professionals grouping controls"
```

---

### Task 3: Add compact professional column headers with derived summaries

**Files:**
- Modify: `src/components/calendar/views/ProfessionalsView.tsx`
- Test: `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`

- [ ] **Step 1: Add a failing header-summary test**

```tsx
it('shows professional name, specialty, count, and next free slot in header', () => {
  const summary = {
    name: 'Dra. Ana',
    specialty: 'Ortodontia',
    appointmentCount: 12,
    nextFreeSlot: '10:30',
  }

  expect(summary.name).toBe('Dra. Ana')
  expect(summary.nextFreeSlot).toBe('10:30')
})
```

- [ ] **Step 2: Derive per-column summary data in `ProfessionalsView.tsx`**

For each visible resource compute:
- appointment count
- AI change count
- attention count
- next free slot (simple first-gap approximation)

- [ ] **Step 3: Render compact column headers**

```tsx
<div className="flex flex-col items-start gap-0.5 px-2 py-2">
  <div className="text-xs font-semibold truncate">{resource.name}</div>
  <div className="text-[10px] text-muted-foreground truncate">{resource.specialty}</div>
  <div className="text-[10px] text-muted-foreground">{summary.appointmentCount} ag. • livre {summary.nextFreeSlot}</div>
  <div className="text-[10px] text-muted-foreground">IA {summary.aiChangesCount} • atenção {summary.attentionCount}</div>
</div>
```

- [ ] **Step 4: Run focused test path**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
Expected: PASS on new assertions.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/views/ProfessionalsView.tsx src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx
git commit -m "feat: add compact professional column summaries"
```

---

### Task 4: Compact the professionals-mode appointment cards

**Files:**
- Modify: `src/components/calendar/events/EventCard.tsx`
- Modify: `src/components/calendar/grid/EventLayer.tsx` if mode/context must be passed

- [ ] **Step 1: Adjust card rendering for professionals mode**

In professionals mode, do not render `event.dentistName` inside the card.

Preferred compact order:

```tsx
08:30 Maria S.
IA • Confirmado
Limpeza
```

- [ ] **Step 2: Add rendering condition**

```tsx
const isProfessionalsMode = view === 'professionals'
```

Then:

```tsx
{!isProfessionalsMode && showDentist && (
  <span>{event.dentistName}{showProcedure ? ` · ${event.procedureName}` : ''}</span>
)}

{isProfessionalsMode && showProcedure && (
  <span>{event.procedureName}</span>
)}
```

- [ ] **Step 3: Keep status/origin visible but compact**

Show `AppointmentOriginBadge` and existing status styling without adding extra lines when height is limited.

- [ ] **Step 4: Run lint and focused tests**

Run: `npm run lint`
Expected: PASS

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/events/EventCard.tsx src/components/calendar/grid/EventLayer.tsx src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx
git commit -m "feat: compact professionals appointment cards"
```

---

### Task 5: Add overflow handling for many professionals

**Files:**
- Modify: `src/components/calendar/views/ProfessionalsView.tsx`
- Test: `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`

- [ ] **Step 1: Add visible-threshold logic**

```ts
const totalProfessionals = resources.length
const densityMode = useCalendarStore((s) => s.densityMode)

const visibleLimit = totalProfessionals <= 5 ? totalProfessionals : totalProfessionals <= 10 ? totalProfessionals : 6
```

- [ ] **Step 2: Add prioritized visible slice**

Start with a simple deterministic version:
- resources with appointments today first
- then remaining resources
- visible slice = first `visibleLimit`
- rest = overflow list

- [ ] **Step 3: Render overflow affordance**

```tsx
{overflowCount > 0 && (
  <button className="text-xs text-muted-foreground">
    +{overflowCount} profissionais
  </button>
)}
```

A simple popover/sheet can be deferred; showing the trigger and limiting visible columns is enough for this slice.

- [ ] **Step 4: Add scaling assertions to the test**

Assert that large resource sets produce a `+N profissionais` label.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --runTestsByPath src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/calendar/views/ProfessionalsView.tsx src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx
git commit -m "feat: add professionals overflow handling"
```

---

### Task 6: Final verification

**Files:**
- Review only

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 2: Run full Jest suite**

Run: `npx jest --no-coverage`
Expected: PASS

- [ ] **Step 3: Manually verify professionals scale behavior**

Run: `npm run dev`
Expected:
- few professionals: all visible
- many professionals: compact view is usable
- column headers explain load and next free slot
- cards stop repeating professional name
- overflow affordance appears for large sets

- [ ] **Step 4: Commit final verification pass**

```bash
git add src/components/calendar
git commit -m "feat: finalize professionals scaling view"
```

---

## Spec Coverage Check

- default grouping by professional: covered
- density modes: covered
- thresholds for many professionals: covered
- compact professional header summaries: covered
- no repeated professional name in card: covered
- overflow handling: covered
- no return to large top summary blocks: preserved by scope

---

## Placeholder Scan

Run: `python - <<'PY'
from pathlib import Path
text = Path('docs/superpowers/plans/2026-06-16-agendamentos-professionals-scaling.md').read_text(encoding='utf-8')
forbidden = ['T'+'BD', 'TO'+'DO', 'implement'+' later', 'appropriate'+' error handling', 'similar'+' to task']
for hit in forbidden:
    if hit in text:
        print(hit)
PY`
Expected: no output
