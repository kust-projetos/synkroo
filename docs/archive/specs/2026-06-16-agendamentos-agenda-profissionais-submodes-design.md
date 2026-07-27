# Agendamentos Agenda/Profissionais Submodes Design Spec

**Date:** 2026-06-16  
**Status:** Draft for review  
**Project:** Synkroo  
**Scope:** `/dashboard/agendamentos`

---

## Context

User feedback changed focus again.

Current problem is not only card styling. Main problem is visual organization.

User wants each main calendar view to support two reading modes:
- `Agenda`
- `Profissionais`

This avoids forcing all grouped reading into one standalone `Profissionais` screen.

---

## Problem Statement

Today the calendar mixes too much information in a single reading mode.

Pain points:
1. appointments feel visually crowded
2. grouped-by-professional reading is isolated in one view instead of being available inside each time scope
3. in grouped reading, the professional should own the column/group, not the individual card
4. month view needs grouped stacks, not full scheduler columns

---

## Goals

1. Keep main views `Dia`, `Semana`, `Mês`, `Profissionais` available.
2. Add per-view submode `Agenda | Profissionais` to `Dia`, `Semana`, `Mês`.
3. Preserve current chronological reading in `Agenda`.
4. Add grouped-by-professional reading in `Profissionais` without losing current time scope.
5. Reduce visual clutter by removing repeated dentist info inside grouped cards.

---

## Non-Goals

This slice does not:
- remove standalone `Profissionais` view
- redesign backend scheduling rules
- change dialogs/CRUD flows deeply
- redesign list mode
- add analytics/top summary cards back

---

## Core Design Decision

Top-level view and grouping mode must be separate concerns.

### Keep
- `view: day | week | month | professionals | list`

### Add
- `layoutMode: agenda | professionals`

Rule:
- `layoutMode` applies only when `view` is `day`, `week`, or `month`
- standalone `view === 'professionals'` stays additive for now

---

## Toolbar Model

### Main switcher
- `Dia`
- `Semana`
- `Mês`
- `Profissionais`
- `Lista`

### Submode switcher
Visible only in:
- `Dia`
- `Semana`
- `Mês`

Labels:
- `Agenda`
- `Profissionais`

### Defaults
- default submode: `Agenda`
- switching main view should preserve last chosen submode unless explicitly reset later

---

## View Behavior

## Dia

### Agenda
Standard day time-grid behavior.

### Profissionais
- same selected day
- one column per professional
- appointments rendered inside professional column
- dentist name belongs to header, not card body

---

## Semana

### Agenda
Standard weekly chronological layout.

### Profissionais
- same weekly scope
- preserve day context
- each day must expose grouped reading by professional
- grouped reading may be rendered as nested professional blocks inside each day column or equivalent structure, but professional separation must stay visually obvious

---

## Mês

### Agenda
Standard month cell layout.

### Profissionais
- keep month grid
- inside each day cell, appointments must be grouped by professional before rendering
- use grouped mini-stacks per professional
- overflow must be per professional group, not one flat mixed list

Full-width scheduler columns are not required in month mode.

---

## Card Rules in Grouped Mode

When `layoutMode === 'professionals'`:
- card shall not repeat professional name inside its own group/column
- card shall keep:
  - hour
  - patient
  - procedure
  - status/origin cues
- card shall optimize scan speed over completeness

---

## Group Header Rules

When grouped mode is active, each professional group should show:
- professional name
- optional specialty when space allows
- appointment count when useful
- overflow indicator when needed

Headers must stay light. No heavy shell cards.

---

## Overflow Rules

### Day / Week grouped mode
- overflow handled by column width, compaction, or existing scale rules
- professional separation has priority over verbose content

### Month grouped mode
- each professional group inside day cell may show limited visible appointments
- remaining appointments use `+N`
- overflow count belongs to that professional group only

---

## Data/State Changes

### Store additions
- `layoutMode: 'agenda' | 'professionals'`
- `setLayoutMode(mode)`

### Existing state kept
- `view`
- `groupMode`
- `densityMode`

Note:
- `groupMode`/`densityMode` for standalone professionals scaling remain separate from new cross-view submode.

---

## Requirements

- REQ-1: When user is in `Dia`, `Semana`, or `Mês`, the calendar shall expose submode switcher `Agenda | Profissionais`.
- REQ-2: When user selects `Agenda`, the system shall preserve current chronological rendering for that view.
- REQ-3: When user selects `Profissionais` in `Dia`, the system shall render appointments grouped by professional for the selected day.
- REQ-4: When user selects `Profissionais` in `Semana`, the system shall preserve weekly time context and visually separate appointments by professional.
- REQ-5: When user selects `Profissionais` in `Mês`, the system shall group each day cell's appointments by professional before rendering cards.
- REQ-6: While grouped mode is active, the system shall not repeat professional name inside cards already rendered inside that professional's own group.
- REQ-7: If a professional has more appointments than fit in grouped month cell space, then the system shall show per-professional overflow affordance.

---

## Risks

1. Reusing standalone professionals logic too directly in week/month may create awkward layouts.
2. Too much chrome in grouped headers could recreate clutter.
3. Toolbar may become busy if submode controls are oversized.
4. Month grouped mode needs strict compact rules or cells will explode vertically.

---

## Success Criteria

Success means user can choose:
- chronological reading via `Agenda`
- operational reading via `Profissionais`

And in grouped mode:
- appointments no longer feel thrown together
- professional separation is immediately visible
- month cells remain readable
- cards stop repeating unnecessary dentist info

---

## Likely File Impact

- `src/components/calendar/store/calendar-store.ts`
- `src/components/calendar/utils/types.ts`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/views/DayView.tsx`
- `src/components/calendar/views/WeekView.tsx`
- `src/components/calendar/views/MonthView.tsx`
- `src/components/calendar/views/ProfessionalsView.tsx`
- `src/components/calendar/events/EventCard.tsx`
- `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`
- new focused tests for toolbar/day/week/month grouped mode
