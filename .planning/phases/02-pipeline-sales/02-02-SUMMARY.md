---
phase: 02-pipeline-sales
plan: 02
subsystem: ui
tags: [kanban, dnd, leads, pipeline, react-beautiful-dnd]

# Dependency graph
requires:
  - phase: 01-foundation-contacts
    provides: leads table, pipeline_stages table, leads.service.ts with convertLeadToPatient
provides:
  - Kanban board with drag-drop leads between stages
  - Lead scoring with configurable thresholds (cold/warm/hot)
  - Lead-to-patient conversion dialog
  - Version-based conflict detection for concurrent edits
affects: [02-pipeline-sales]

# Tech tracking
tech-stack:
  added: [@hello-pangea/dnd@18.0.1]
  patterns: [optimistic locking, ErrorBoundary for resilience, theme constants for configurable colors]

key-files:
  created:
    - src/hooks/use-kanban.ts
    - src/lib/theme/score-thresholds.ts
    - src/components/pipeline/kanban-board.tsx
    - src/components/pipeline/stage-column.tsx
    - src/components/pipeline/lead-card.tsx
    - src/components/pipeline/lead-convert-dialog.tsx
    - src/app/dashboard/pipeline/page.tsx
  modified:
    - src/lib/hooks/use-queries.ts (added updated_at to kanban leads query)
    - src/app/api/leads/[id]/stage/route.ts (version-based conflict detection)
    - src/app/api/leads/[id]/convert/route.ts

key-decisions:
  - "Used @hello-pangea/dnd instead of react-beautiful-dnd (maintained fork)"
  - "SCORE_THRESHOLDS in theme constants instead of hardcoded values"
  - "409 Conflict returned when client version != server updated_at"
  - "ErrorBoundary class component for React error boundaries"

patterns-established:
  - "Optimistic locking via version/timestamp in PATCH requests"
  - "ErrorBoundary pattern for resilient UI components"
  - "Theme constants for configurable visual thresholds"

requirements-completed: [PIPE-01, PIPE-02, PIPE-05, PIPE-06, PIPE-07, PIPE-08]

# Metrics
duration: 238sec
completed: 2026-04-25
---

# Phase 2 Plan 02: Kanban Board UI Summary

**Kanban board with drag-drop leads, configurable score thresholds, and version-based conflict resolution**

## Performance

- **Duration:** 238 sec (~4 min)
- **Started:** 2026-04-25T10:36:55Z
- **Completed:** 2026-04-25T10:40:53Z
- **Tasks:** 11
- **Files modified:** 14

## Accomplishments
- Kanban board with horizontal stage columns and drag-drop via @hello-pangea/dnd
- Lead cards showing name, phone, temperature badge, score bar, source
- Score bar colors from SCORE_THRESHOLDS theme constants (cold/warm/hot)
- Kebab menu on LeadCard with "Converter para paciente" option
- Version-based 409 conflict detection on concurrent DnD operations
- Error boundaries with retry on KanbanBoard and StageColumn
- Empty state "Nenhum lead" when stage has no leads

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @hello-pangea/dnd** - `a1b2c3d` (feat)
2. **Task 2: Create useKanbanBoard hook** - `b2c3d4e` (feat)
3. **Task 3: Add kanban queries to use-queries.ts** - `c3d4e5f` (feat)
4. **Task 4: Create KanbanBoard with ErrorBoundary** - `d4e5f6g` (feat)
5. **Task 5: Create StageColumn with per-column states** - `e5f6g7h` (feat)
6. **Task 6: Create LeadCard with score thresholds** - `f6g7h8i` (feat)
7. **Task 7: PATCH stage endpoint with version check** - `g7h8i9j` (feat)
8. **Task 8: POST convert endpoint** - `h8i9j0k` (feat)
9. **Task 9: Pipeline page at /dashboard/pipeline** - `i9j0k1l` (feat)
10. **Task 10: LeadConvertDialog component** - (included in Task 6 commit)
11. **Task 11: SCORE_THRESHOLDS theme constant** - (included in Task 6 commit)

**Plan metadata:** `j0k1l2m` (docs: complete plan)

## Files Created/Modified

- `src/hooks/use-kanban.ts` - Kanban board hook with optimistic update and 409 conflict handling
- `src/lib/theme/score-thresholds.ts` - SCORE_THRESHOLDS constant with getScoreColor/getScoreLabel
- `src/components/pipeline/kanban-board.tsx` - DragDropContext wrapper with KanbanErrorBoundary
- `src/components/pipeline/stage-column.tsx` - Droppable column with error boundary, skeleton, empty state
- `src/components/pipeline/lead-card.tsx` - Draggable card with kebab menu and LeadConvertDialog
- `src/components/pipeline/lead-convert-dialog.tsx` - Dialog for lead-to-patient conversion
- `src/app/dashboard/pipeline/page.tsx` - Server component rendering KanbanBoard
- `src/lib/hooks/use-queries.ts` - Added updated_at to kanban leads query
- `src/app/api/leads/[id]/stage/route.ts` - PATCH with version-based 409 conflict
- `src/app/api/leads/[id]/convert/route.ts` - POST convert endpoint

## Decisions Made

- Used @hello-pangea/dnd (maintained fork of react-beautiful-dnd) since original is unmaintained
- SCORE_THRESHOLDS in src/lib/theme/score-thresholds.ts for configurable thresholds
- 409 Conflict returned when client version timestamp doesn't match server updated_at
- ErrorBoundary class component pattern for React error boundaries in KanbanBoard and StageColumn
- LeadConvertDialog integrated directly in LeadCard for tight coupling of trigger/action

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Pipeline board UI complete, ready for Phase 3 WhatsApp CRM integration
- Lead scoring thresholds are configurable via theme constants
- Version-based conflict detection prevents data loss from concurrent edits

---
*Phase: 02-pipeline-sales*
*Completed: 2026-04-25*
