# Agendamentos Professionals Scaling Design Spec

**Date:** 2026-06-16
**Status:** Draft for review
**Project:** Synkroo - Clínica Odontológica
**Scope:** Professionals view scaling for `/dashboard/agendamentos`

---

## Context

The current professionals view uses one column per professional and reuses the same event card renderer as the other calendar modes. This works for a small number of professionals, but it breaks down visually when the number of professionals grows.

The user feedback is clear:

- the top summary UI should not dominate the page
- the main UX improvement should happen inside the calendar itself
- the grouping problem becomes much worse when the clinic has many professionals at once

This spec focuses only on scaling the `Profissionais` view.

---

## Problem Statement

With many professionals visible at once, the interface becomes a wall of narrow columns and low-information cards.

Current problems:

1. every professional is treated as equally visible at all times
2. cards get too narrow and start losing semantic clarity
3. the card repeats information that the column already communicates
4. the user cannot quickly answer:
   - who is overloaded?
   - who is free next?
   - where can I fit an encaixe?
   - which columns need attention?
5. the visual unit remains the isolated appointment card, when the real operational unit at scale should be the professional column

---

## Goals

1. Make `Profissionais` the primary scalable grouping model.
2. Shift the visual unit from isolated cards to professional columns with meaningful summaries.
3. Keep cards compact and useful even when many professionals are visible.
4. Preserve quick intervention: open details, reschedule, create in empty slot.
5. Avoid reintroducing large top-heavy summary UI.

---

## Non-Goals

This spec does not redesign:

- the full day/week/month information architecture
- backend provenance or analytics models
- global dashboard shell
- list mode
- scheduling business rules

---

## Core Design Decision

At scale, the main grouping must be **by professional**.

The primary object on screen is not the appointment card alone. It is the **professional column**, with:

- identity
- load
- next free slot
- attention state
- appointments inside it

---

## Grouping Modes

Add explicit grouping modes for calendar work at scale.

### Default grouping
- `Profissionais`

### Secondary grouping
- `Horários`
- `Status` (optional, secondary)

### Rule
When the user is handling many professionals, the default should stay `Profissionais`.

---

## Density Modes

Add two density modes:

- `compact`
- `comfortable`

### Compact
Use when showing many professionals.

### Comfortable
Use when showing fewer professionals and more context is affordable.

---

## Scaling Thresholds

### Up to 5 professionals
- all visible
- comfortable density allowed
- no collapse needed

### 6 to 10 professionals
- all visible
- compact density default
- horizontal scroll allowed

### More than 10 professionals
- compact density required
- show a prioritized visible subset
- show remaining professionals behind a `+N profissionais` affordance

---

## Prioritization Rules for Many Professionals

When more than 10 professionals exist in the current scope, visible columns should be ordered by operational value.

Suggested priority order:

1. professionals with current or upcoming appointments
2. professionals with attention items
3. professionals with recent AI changes
4. manually pinned or selected professionals
5. remaining professionals hidden under overflow

---

## Professional Column Header

Each professional column should have a compact but meaningful header.

### Required content
- professional name
- specialty
- appointment count for current period/day
- next free slot
- small attention summary
- small AI-changes count when available

### Example
- `Dra. Ana`
- `Ortodontia`
- `12 ag.`
- `livre 10:30`
- `IA 2 • atenção 1`

### Visual behavior
- light background tint only
- no heavy card chrome
- clear vertical alignment
- fixed/sticky header inside the professionals grid if feasible

---

## Card Content Rules in Professionals Mode

The event card in professionals mode must become more compact and must stop repeating information that the column already owns.

### Remove from the card in professionals mode
- professional name

### Keep in the card
1. time
2. patient name
3. status and origin
4. short procedure name

### Example compact card
- `08:30 Maria S.`
- `IA • Confirmado`
- `Limpeza`

### Design rule
The card should be optimized for scan speed, not completeness.

---

## Empty Slot UX

Empty space in a professional column should help the user find encaixe opportunities.

### Required behavior
- empty slots remain clickable
- useful gaps should be easier to notice
- hover affordance can stay minimal

### Enhancement direction
- emphasize meaningful free gaps like 30m, 45m, 60m+
- do not make every empty slot visually loud

---

## Overflow Behavior

When more professionals exist than should be shown directly:

### Visible region
- prioritized columns remain in the main grid

### Overflow affordance
- compact trigger: `+8 profissionais`

### Expansion behavior
- open side sheet, popover, or alternate picker
- allow selecting more professionals to bring into the visible grid

---

## Toolbar Controls

The toolbar should expose only the controls needed for scale behavior.

### Add
- grouping mode selector
- density mode selector

### Keep minimal
These controls must not become large summary blocks.

---

## Data Model Additions

The UI layer should support scaled professionals behavior with lightweight additions.

### Store additions
- `groupMode`
- `densityMode`
- optional list of pinned/visible professional IDs

### Resource/derived view data
Each resource column needs derived summary data:
- appointment count
- next free slot
- AI change count
- attention count

These can be computed on the client initially.

---

## Interaction Model

### Click card
- open existing edit/details surface

### Click empty slot
- quick create / encaixe

### Switch density
- immediate UI-only change

### Expand overflow professionals
- reveal more columns without leaving the calendar context

---

## Risks

1. Too much information in the professional header could recreate the top-summary problem at column level.
2. Overflow rules that hide the wrong professionals would damage trust.
3. A compact card can become too minimal if status/origin are not visually distinct.
4. Horizontal scroll can still feel heavy if column width is not controlled well.

---

## Success Criteria

The scaled professionals view is successful when the user can quickly answer:

1. which professionals are busy?
2. which are free next?
3. where can I fit an encaixe?
4. which columns need attention?
5. what changed by AI?

without the calendar turning into a wall of unreadable narrow cards.

---

## Initial File Impact

### Likely existing files to modify
- `src/components/calendar/views/ProfessionalsView.tsx`
- `src/components/calendar/events/EventCard.tsx`
- `src/components/calendar/grid/EventLayer.tsx`
- `src/components/calendar/grid/TimeGrid.tsx`
- `src/components/calendar/CalendarToolbar.tsx`
- `src/components/calendar/store/calendar-store.ts`
- `src/components/calendar/utils/types.ts`

### Likely new tests
- `src/components/calendar/__tests__/ProfessionalsView.scaling.test.tsx`

---

## Recommendation

Implement this as a focused refinement, not another broad redesign pass.

Order:
1. state and toolbar controls
2. compact professional headers
3. professionals-mode card compaction
4. overflow logic for many professionals
5. focused tests and verification
