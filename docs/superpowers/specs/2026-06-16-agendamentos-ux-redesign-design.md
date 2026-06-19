# Agendamentos UX Redesign Design Spec

**Date:** 2026-06-16
**Status:** Draft for review
**Project:** Synkroo - Clínica Odontológica
**Scope:** `/dashboard/agendamentos`

---

## Context

The current agendamentos experience already has a functioning calendar shell with views for `day`, `week`, `month`, `professionals`, and `list`, backed by `CalendarLayout`, `CalendarToolbar`, Zustand URL state, and `useCalendarEvents`.

It does not yet express the actual product job clearly enough.

This page is not only for correcting work done by the AI agent. It also needs to be the main visual way for a non-technical clinic user to:

- understand their schedule quickly
- see what changed
- trust what the AI did
- make fast manual adjustments when needed

The redesign should keep the calendar as a first-class interface while making the page easier to read, easier to trust, and faster to act on.

---

## Problem Statement

The current experience is structurally capable but semantically generic.

Observed from the current route and components:

- `src/app/dashboard/agendamentos/page.tsx` mounts `CalendarLayout` with `ListView`
- `CalendarToolbar.tsx` gives all views equal weight, including `list`
- `CalendarLayout.tsx` switches views and dialogs correctly, but the page lacks a clear summary layer and AI-change layer
- `list-view.tsx` is readable, but optimized for record browsing more than visual schedule comprehension
- detail and create flows exist as full pages (`[id]/page.tsx`, `novo/page.tsx`), which increases context switching for common quick actions
- the dashboard layout supports mock mode and auth gating, but the agendamentos UI itself does not yet visibly explain AI-originated actions or their impact

As a result, the page risks feeling like a generic scheduling screen instead of a trustworthy calendar interface for leigo acompanhamento plus quick intervention.

---

## Goals

### Product Goals

1. Make the page easy for a leigo user to understand at a glance.
2. Preserve the calendar as the main interaction model.
3. Make quick manual intervention fast without forcing the user to talk to the AI.
4. Show clearly when an action came from the AI versus a manual change.
5. Show recent changes and their impact in human-readable form.

### UX Goals

1. `Dia` is the primary operational view.
2. `Semana` remains first-class and balances acompanhamento plus quick action.
3. `Mês` must show the appointments marked in each day, not only occupancy density.
4. `Profissionais` remains available as the operational distribution view.
5. Navigation between day, week, month, and professionals should feel like one coherent system.

### Implementation Goals

1. Reuse the existing calendar architecture where possible.
2. Prefer layered UI improvements before invasive behavior rewrites.
3. Reduce unnecessary full-page navigation for common edits and quick creates.
4. Keep URL-synced view/date state intact.

---

## Non-Goals

This redesign does not include:

- replacing the underlying calendar engine
- rebuilding auth or dashboard layout
- full audit-history architecture beyond UX-level recent change summaries
- recurring appointments
- cross-clinic scheduling
- removing week/month/professionals views
- forcing all edits into inline mode immediately

---

## Primary User Jobs

### Job 1: Acompanhar a agenda visualmente

The user should be able to open the page and answer:

- what do I have today?
- what changed?
- what needs attention?
- what is coming next?

### Job 2: Intervir rápido quando necessário

The user should be able to:

- move/reschedule quickly
- create an encaixe quickly
- open and adjust details quickly
- understand AI changes before acting

### Job 3: Confiar no sistema

The page should communicate:

- what was done by AI
- what was changed manually
- when something changed
- what impact that change had on the schedule

---

## UX Principles

1. **Understand first, act second.**
   The interface should explain the current schedule before asking the user to operate on it.

2. **Calendar stays primary.**
   This is not a record list with a calendar bolted on.

3. **Views differ by job, not by visual whim.**
   `Dia`, `Semana`, `Mês`, and `Profissionais` must each have a clear purpose.

4. **AI transparency is a product feature.**
   `IA` vs `Manual` is not metadata hidden in a detail page.

5. **Fast actions should preserve context.**
   Common edits should happen in-place or in a lightweight contextual surface.

6. **Leigo-first language.**
   Statuses, change summaries, and empty/error states should be understandable without technical knowledge.

---

## Information Architecture

The page should be composed as one consistent shell.

### 1. Header Layer

Always visible and structurally stable across views.

Contents:

- title: `Agendamentos`
- dynamic subtitle for current period
- period navigation: `Anterior`, `Hoje`, `Próximo`
- view switcher: `Dia`, `Semana`, `Mês`, `Profissionais`
- primary CTA: `Novo agendamento` or `Novo encaixe`

### 2. Summary Layer

New persistent summary bar below the header.

Contents:

- agenda summary for the current period
- recent AI/manual changes summary
- attention summary: conflicts, pending confirmations, critical changes

This is the fast-reading layer for leigo users.

### 3. Main Content Layer

Three-region model on large screens:

- lightweight left filter rail
- central calendar area
- right contextual panel

On smaller screens:

- left filters collapse
- right panel becomes drawer/sheet

### 4. Contextual Action Layer

Quick interactions should happen via:

- drawer for quick edit
- drawer or modal for quick create / encaixe
- confirmation surface for rescheduling

---

## View Model

## Dia

**Primary job:** operational clarity + fast action.

This is the main view of the system.

### Requirements

- hour grid with clear slot readability
- visible current-time indicator
- appointments readable without opening detail
- empty slots visibly actionable
- quick actions available on hover/click
- AI/manual origin visible on the appointment item
- recent change summary visible on the item when applicable

### Appointment card content priority

1. patient name
2. time
3. professional
4. procedure
5. status
6. origin (`IA` / `Manual`)
7. short change summary

### Example change summary

- `Remarcado pela IA há 12 min`
- `Alterado manualmente há 5 min`
- `Mudou de 09:00 para 10:30`

### Interaction model

- click appointment -> open quick drawer
- click empty slot -> open quick create
- drag appointment -> open short confirmation before persisting

---

## Semana

**Primary job:** acompanhamento + quick action.

This view should remain first-class, not a secondary legacy mode.

### Requirements

- readable week overview
- enough card detail to identify appointments without overload
- same origin/status language as day view
- ability to act quickly without losing weekly context
- clicking a day or appointment should preserve flow into the same system

### Design intent

Week view should feel like a lighter, distributed version of day view, not a totally different product.

---

## Mês

**Primary job:** see the appointments marked in each day.

This is a key requirement from product direction.

### Requirements

- each day cell shows actual scheduled appointments, not only dots
- show up to 2 or 3 appointments directly in the cell
- show `+N` for overflow
- show discreet AI-change indicator when relevant
- clicking a day should open that day in a more detailed mode, preferably `Dia`

### Important constraint

Month view should prioritize legibility over heavy editing. It is mainly for visual follow-up and navigation into action.

---

## Profissionais

**Primary job:** operational distribution and encaixe.

### Requirements

- show load by professional clearly
- make free spaces useful and visible
- support rescheduling and slot-based creation behavior
- stay simpler than a hardcore admin grid

### Design intent

This is the strongest operational view after `Dia`, but still must use the same status/origin language.

---

## AI Transparency Model

The page must make AI-originated changes understandable.

### Origin System

Each appointment should support visible origin metadata:

- `IA`
- `Manual`

### Change Summary System

Each appointment may also expose a short recent change summary, for example:

- `Criado pela IA`
- `Remarcado pela IA há 12 min`
- `Ajustado manualmente às 10:05`

### Impact Summary

When a significant AI change occurred, the contextual panel or quick drawer should explain the impact in plain language:

- previous time -> new time
- previous professional -> new professional
- created free gap
- caused overlap/conflict
- changed status

### Product rule

The interface should help the user understand what changed before pushing them into correction.

---

## Filters and Navigation

### Filters

Keep filters lightweight and useful:

- professional
- status
- origin: all / IA / Manual
- optionally: only recent changes, only needs attention

Avoid turning the left rail into a dense ERP control surface.

### Period Navigation

Keep navigation consistent across all views:

- `Anterior`
- `Hoje`
- `Próximo`

Behavior changes by view, but placement and semantics should not.

---

## Interaction Flows

## Quick View / Quick Edit

Clicking an appointment should open a contextual drawer instead of forcing full-page navigation for common cases.

### Drawer contents

- patient
- current time
- status
- professional
- procedure
- notes
- origin
- short recent history
- actions

### Actions

- save changes
- confirm
- cancel
- reschedule
- open full detail page if needed

## Quick Create / Encaixe

Clicking an empty slot or pressing the primary CTA should allow a short creation flow.

### Requirements

- prefill time/date from context
- choose patient
- choose professional
- choose procedure
- save quickly
- keep full-page create flow as fallback for more complex cases

## Reschedule Confirmation

Dragging should not silently persist without confirmation.

The confirmation should show:

- patient
- old time
- new time
- professional
- concise confirm/cancel actions

---

## States

## Loading

Current loading is functional but generic.

The redesign should prefer:

- skeleton for summary bar
- skeleton for grid structure
- skeleton appointment cards

Spinner-only states should be minimized.

## Empty

Empty states should be view-aware.

Examples:

- `Nenhum agendamento neste dia`
- `Nenhum agendamento nesta semana`
- CTA for creating first appointment or encaixe

## Error

Errors should use plain language and fast retry paths.

Where relevant, distinguish:

- failed to load appointments
- failed to save change
- failed to update because of conflict

---

## Component Strategy

## Reuse as Base

These existing pieces should remain the base architecture:

- `src/components/calendar/CalendarLayout.tsx`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/store/calendar-store.ts`
- `src/components/calendar/hooks/useCalendarEvents.ts`
- existing view components under `src/components/calendar/views/*`
- `src/app/dashboard/agendamentos/list-view.tsx` as a fallback/secondary mode if still needed
- full-page flows in:
  - `src/app/dashboard/agendamentos/[id]/page.tsx`
  - `src/app/dashboard/agendamentos/novo/page.tsx`

## Modify

### `CalendarToolbar`
Needs hierarchy improvements:

- stronger period navigation
- clearer current period label
- view switcher that still includes `Dia`, `Semana`, `Mês`, `Profissionais`
- de-emphasize `Lista` if retained
- stronger primary action placement

### `CalendarLayout`
Needs new orchestration responsibilities:

- mount summary layer
- mount contextual side panel / drawer
- preserve current view switching and dialogs

### Existing view components
Need visual and semantic upgrades:

- shared appointment card language
- shared origin/status patterns
- view-specific role clarity

## New Components

Likely additions:

- `ScheduleSummaryBar`
- `AppointmentOriginBadge`
- `AppointmentChangeSummary`
- `AppointmentQuickDrawer`
- `AiChangesPanel`
- `AttentionPanel`
- `QuickSlotCreate`

These should be small, focused, and reusable across views.

---

## Phased Implementation

## Phase 1: Structural UX clarity

Goal: make the page read correctly before deep interaction changes.

Deliverables:

- upgraded `CalendarToolbar`
- new `ScheduleSummaryBar`
- consistent status + origin + change summary language
- improved `DayView` visual hierarchy

## Phase 2: View refinement

Goal: make each view fulfill its product job.

Deliverables:

- refine `WeekView`
- redesign `MonthView` to show actual appointments per day cell
- refine `ProfessionalsView`

## Phase 3: Context-preserving actions

Goal: reduce full-page navigation for common actions.

Deliverables:

- `AppointmentQuickDrawer`
- `QuickSlotCreate`
- reschedule confirmation flow

## Phase 4: AI transparency layer

Goal: make AI activity understandable and reviewable.

Deliverables:

- `AiChangesPanel`
- `AttentionPanel`
- impact summaries in contextual surfaces

## Phase 5: Polish

Goal: remove unfinished feeling.

Deliverables:

- loading skeleton improvements
- empty/error state improvements
- responsive cleanup

---

## Risks

1. **Too much operational density.**
   Over-optimizing for power usage can make the page harder for leigo users.

2. **Too much simplification.**
   Hiding week/month/professionals depth would weaken the calendar model.

3. **Context fragmentation.**
   If quick drawer, full-page detail, quick create, and existing dialogs diverge too much, the experience becomes inconsistent.

4. **Fake AI transparency.**
   UX labels without reliable backing data will damage trust.

5. **Month cell overload.**
   Showing appointments in month view must remain readable.

---

## Open Questions

These should be resolved during implementation planning, not blocked at spec time.

1. Whether `Lista` remains a first-class visible view or moves to secondary/overflow access.
2. What backing data already exists for change provenance and recent-change timestamps.
3. Whether existing dialogs can evolve into the quick drawer model or should remain as fallback full interactions.
4. Whether drag-reschedule currently has enough metadata to produce a good before/after confirmation without extra fetches.

---

## Success Criteria

The redesign is successful when a non-technical user can:

1. open the page and understand the current period quickly
2. see what changed recently
3. distinguish `IA` from `Manual` origin clearly
4. use `Dia`, `Semana`, `Mês`, and `Profissionais` without relearning the interface
5. identify appointments in month view day cells
6. make a quick correction or encaixe without being forced into a long flow
7. understand the impact of AI changes before deciding to act

---

## Verification Strategy

### Product Verification

- manual walkthrough of day/week/month/professionals jobs
- visual review in mock mode or authenticated local mode
- confirm that month view shows real appointments per day cell
- confirm that AI change summaries are understandable in plain language

### Engineering Verification

- existing view/date URL sync remains correct
- no regression in current create/detail full-page flows
- responsive behavior remains usable
- drag/reschedule still works with confirmation layer

---

## Initial File Impact Map

### Existing files to inspect and likely touch

- `src/app/dashboard/agendamentos/page.tsx`
- `src/app/dashboard/agendamentos/list-view.tsx`
- `src/app/dashboard/agendamentos/loading.tsx`
- `src/app/dashboard/agendamentos/[id]/page.tsx`
- `src/app/dashboard/agendamentos/novo/page.tsx`
- `src/components/calendar/CalendarLayout.tsx`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/hooks/useCalendarEvents.ts`
- `src/components/calendar/store/calendar-store.ts`

### New files likely needed

- `src/components/calendar/ScheduleSummaryBar.tsx`
- `src/components/calendar/AppointmentOriginBadge.tsx`
- `src/components/calendar/AppointmentChangeSummary.tsx`
- `src/components/calendar/AppointmentQuickDrawer.tsx`
- `src/components/calendar/AiChangesPanel.tsx`
- `src/components/calendar/AttentionPanel.tsx`
- `src/components/calendar/QuickSlotCreate.tsx`

---

## Recommendation

Start implementation planning with Phase 1 plus the Day view work.

That gives the biggest visible improvement with the lowest architectural risk:

- better top-level comprehension
- clearer hierarchy
- visible AI/manual language
- stronger primary view

After that, refine the remaining views without changing the product direction again.
