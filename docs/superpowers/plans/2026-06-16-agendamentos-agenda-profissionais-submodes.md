# Agendamentos Agenda/Profissionais Submodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Agenda | Profissionais` submodes inside `Dia`, `Semana`, and `Mês`, keeping chronological reading intact while enabling grouped-by-professional reading in each time scope.

**Architecture:** Keep `view` unchanged. Add lightweight `layoutMode` state for `day`, `week`, `month`; expose it in `CalendarToolbar`; branch rendering in each view; reuse grouping rules from the existing professionals work where possible; keep standalone `view === 'professionals'` unchanged for now.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand, Tailwind, existing calendar grid components.

**Agent Orchestration:** Supervisor-Workers — state/toolbar, day, week, month, and verification can be split cleanly.

---

## File Structure

### Modify
- `src/components/calendar/utils/types.ts`
- `src/components/calendar/store/calendar-store.ts`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/views/DayView.tsx`
- `src/components/calendar/views/WeekView.tsx`
- `src/components/calendar/views/MonthView.tsx`
- `src/components/calendar/views/ProfessionalsView.tsx` if helper reuse is needed
- `src/components/calendar/events/EventCard.tsx`

### Test
- `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
- add focused tests under `src/components/calendar/__tests__/` if needed for toolbar/day/week/month grouped behavior

---

### Task 1: Add submode state

**Files:**
- Modify: `src/components/calendar/utils/types.ts`
- Modify: `src/components/calendar/store/calendar-store.ts`
- Test: `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`

- [ ] Write failing test for `layoutMode` default and setter.
- [ ] Run focused test; verify fail.
- [ ] Add `CalendarLayoutMode = 'agenda' | 'professionals'`.
- [ ] Add store state:
  - `layoutMode`
  - `setLayoutMode`
- [ ] Default to `agenda`.
- [ ] Re-run focused test; verify pass.
- [ ] Commit: `feat: add calendar layout mode state`

---

### Task 2: Add toolbar submode switcher

**Files:**
- Modify: `src/components/calendar/CalendarToolbar.tsx`
- Test: `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx` or new toolbar test

- [ ] Write failing test: submode control visible only for `day|week|month`.
- [ ] Run focused test; verify fail.
- [ ] Add segmented control `Agenda | Profissionais`.
- [ ] Hide control in `professionals` and `list` views.
- [ ] Keep control visually light.
- [ ] Re-run focused test; verify pass.
- [ ] Commit: `feat: add agenda professionals submode switcher`

---

### Task 3: Day view grouped-by-professional mode

**Files:**
- Modify: `src/components/calendar/views/DayView.tsx`
- Modify: `src/components/calendar/events/EventCard.tsx`
- Test: focused day-view test

- [ ] Write failing test: day grouped mode renders separate professional columns.
- [ ] Run focused test; verify fail.
- [ ] Branch `DayView` by `layoutMode`.
- [ ] Reuse grouped rendering path close to existing professionals layout.
- [ ] Ensure grouped cards omit dentist name inside column.
- [ ] Re-run focused test; verify pass.
- [ ] Commit: `feat: add grouped professionals day mode`

---

### Task 4: Week view grouped-by-professional mode

**Files:**
- Modify: `src/components/calendar/views/WeekView.tsx`
- Modify: helpers reused from `ProfessionalsView.tsx` if needed
- Test: focused week-view test

- [ ] Write failing test: grouped week mode preserves day context and separates by professional.
- [ ] Run focused test; verify fail.
- [ ] Branch `WeekView` by `layoutMode`.
- [ ] Implement grouped rendering that keeps weekly scope readable.
- [ ] Ensure professional separation is obvious, not mixed.
- [ ] Re-run focused test; verify pass.
- [ ] Commit: `feat: add grouped professionals week mode`

---

### Task 5: Month view grouped-by-professional mode

**Files:**
- Modify: `src/components/calendar/views/MonthView.tsx`
- Test: month-view grouped test

- [ ] Write failing test: month grouped mode groups day-cell events by professional.
- [ ] Run focused test; verify fail.
- [ ] Branch `MonthView` by `layoutMode`.
- [ ] Inside each day cell, group appointments by professional.
- [ ] Show per-professional mini-stack.
- [ ] Show per-professional overflow `+N`.
- [ ] Re-run focused test; verify pass.
- [ ] Commit: `feat: add grouped professionals month mode`

---

### Task 6: Shared grouped-card cleanup

**Files:**
- Modify: `src/components/calendar/events/EventCard.tsx`
- Test: existing scaling/card tests

- [ ] Add failing test if needed for grouped-mode content rules.
- [ ] Ensure grouped cards keep:
  - hour
  - patient
  - procedure
  - status/origin cue
- [ ] Ensure grouped cards drop dentist-name repetition.
- [ ] Re-run focused card/scaling tests.
- [ ] Commit: `refine: simplify grouped calendar cards`

---

### Task 7: Verification

**Files:** review only

- [ ] Run: `npm run lint`
- [ ] Run: `npx jest --no-coverage`
- [ ] Manually inspect `Dia`, `Semana`, `Mês` with both submodes.
- [ ] Confirm standalone `Profissionais` still works.
- [ ] Commit verification/fixes if needed.

---

## Tests

| Type | Tool | Scope |
|---|---|---|
| Unit/UI | Jest + RTL | store, toolbar, grouped rendering |
| Snapshot | optional | grouped month/day fragments if useful |
| Contract | no | no external HTTP change |
| E2E | deferred | only if user asks after implementation |

---

## Trade-offs

| Decision | Reason | Rejected |
|---|---|---|
| Keep standalone `Profissionais` | additive, lower risk | replacing it now |
| Add `layoutMode` instead of overloading `view` | cleaner state model | encoding submode into `view` |
| Month grouped stacks per day | preserves month readability | full scheduler columns in month |
| Reuse existing professionals logic | faster, less duplication | new grouping system from zero |

---

## Spec Coverage Check

- submode per view: covered
- keep existing top-level views: covered
- grouped day/week/month behavior: covered
- no dentist repetition in grouped cards: covered
- month per-professional overflow: covered
- standalone professionals preserved: covered
