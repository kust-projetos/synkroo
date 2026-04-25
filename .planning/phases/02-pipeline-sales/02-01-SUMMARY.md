---
phase: 02-pipeline-sales
plan: 01
subsystem: api
tags: [nextjs, supabase, pipeline, stages, lead-scoring, rls]

# Dependency graph
requires:
  - phase: 01-foundation-contacts
    provides: leads table, pipeline_stages table, createTypedClient(), getUserProfile()
provides:
  - leads.stage_id FK to pipeline_stages
  - Auto-score trigger on leads insert/update
  - 7-function pipeline stages service
  - 3 API routes for CRUD + reorder
affects: [pipeline-ui, leads-convert, kanban-board]

# Tech tracking
tech-stack:
  added: []
  patterns: [RLS-enforced service layer, auto-migration of leads to default stage, clinic ownership validation on reorder]

key-files:
  created:
    - supabase/migrations/20260425000001_add_leads_pipeline_columns.sql
    - src/services/pipeline/stages.service.ts
    - src/app/api/pipeline/stages/route.ts
    - src/app/api/pipeline/stages/[id]/route.ts
    - src/app/api/pipeline/stages/reorder/route.ts
  modified: []

key-decisions:
  - "is_default stage filtered from getPipelineStages user-visible list"
  - "deletePipelineStage auto-moves leads to default before deletion"
  - "reorderPipelineStages validates all stage IDs belong to user's clinic"

patterns-established:
  - "RLS-enforced service layer using createTypedClient()"
  - "Auto-migration pattern: leads moved to default stage before stage deletion"
  - "Clinic ownership validation before bulk operations"

requirements-completed: [PIPE-03, PIPE-04]

# Metrics
duration: 18min
completed: 2026-04-25
---

# Phase 2 Plan 1: Pipeline Stages Service + API Summary

**Leads stage_id FK with auto-score trigger, 7-function stages service, and CRUD+reorder API routes**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-25T00:00:00Z
- **Completed:** 2026-04-25T00:18:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Migration adds stage_id FK, auto-score triggers, and get_default_stage_id() helper
- Updated stages.service.ts with all 7 functions using createTypedClient() for RLS
- Created 3 API routes (list, create, update, delete, reorder) with auth enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: leads pipeline columns migration** - `8dfae99` (feat)
2. **Task 2: pipeline stages service update** - `d517d26` (feat)
3. **Task 3: pipeline stages API routes** - `299a931` (feat)

**Plan metadata:** `299a931` (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/20260425000001_add_leads_pipeline_columns.sql` - stage_id FK, auto-score triggers, default stage migration
- `src/services/pipeline/stages.service.ts` - 7 exported functions with RLS enforcement
- `src/app/api/pipeline/stages/route.ts` - GET (list) and POST (create) handlers
- `src/app/api/pipeline/stages/[id]/route.ts` - PATCH (update) and DELETE handlers with is_default protection
- `src/app/api/pipeline/stages/reorder/route.ts` - PATCH bulk reorder with clinic validation

## Decisions Made
- is_default stage excluded from user-visible getPipelineStages() results
- deletePipelineStage moves leads to default stage before deletion (not orphaned)
- reorderPipelineStages requires clinicId parameter for ownership validation

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

1. Migration adds stage_id, source_type, score, converted_at, converted_to_patient_id to leads table - DONE (source_type, score, converted_at, converted_to_patient_id already existed in 20260424000009 migration; stage_id added in this migration)
2. Database trigger auto-recalculates score - DONE (trigger_auto_score_lead with trg_lead_score_on_insert and trg_lead_score_on_update)
3. Default stage (is_default=true) exists for every clinic - DONE (get_default_stage_id function, migration moves leads to default)
4. deletePipelineStage moves leads to default stage before deleting - DONE (implemented in service)
5. reorderPipelineStages validates all stage IDs belong to user's clinic - DONE (implemented in service with clinic validation)
6. stages.service.ts exports all 7 functions with createTypedClient() for RLS - DONE (getPipelineStages, createPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages, seedDefaultPipelineStages, getDefaultStageId)
7. GET /api/pipeline/stages returns stages ordered by sort_order (is_default filtered out) - DONE
8. POST /api/pipeline/stages creates new stage with auto-assigned sort_order - DONE
9. DELETE /api/pipeline/stages/[id] moves leads to default and deletes - DONE
10. PATCH /api/pipeline/stages/reorder accepts array of {id, sort_order} with clinic validation - DONE

## Issues Encountered
None

## Next Phase Readiness
- Pipeline stages service complete, ready for leads pipeline UI
- Kanban board can now use stage_id for lead categorization
- Lead conversion (PIPE-05) can proceed with converted_at tracking

---
*Phase: 02-pipeline-sales*
*Completed: 2026-04-25*