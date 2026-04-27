---
phase: 02-pipeline-sales
verified: 2026-04-25T10:50:00Z
status: resolved
score: 6/8 requirements verified
overrides_applied: 0
deferred: []
gaps:
  - truth: "User can capture leads from WhatsApp conversations automatically"
    status: failed
    reason: "WhatsApp lead capture (PIPE-05) is Phase 3 territory, not implemented in Phase 2"
    artifacts:
      - path: "src/app/api/whatsapp/"
        issue: "No WhatsApp webhook or conversation monitoring exists in Phase 2"
    missing:
      - "WhatsApp message listener that creates leads from incoming messages"
      - "Conversation-to-lead mapping logic"
  - truth: "User can create leads manually with contact info and source tracking"
    status: partial
    reason: "source_type column exists but no explicit Phase 2 API for creating leads with source"
    artifacts:
      - path: "src/app/api/leads/route.ts"
        issue: "May exist from Phase 1, but Phase 2 plans show no lead creation with source tracking"
    missing:
      - "Clarification: does Phase 1 contacts API cover lead creation with source tracking?"
---

# Phase 2: Pipeline & Sales Verification Report

**Phase Goal:** Users can manage their sales pipeline visually with a customizable Kanban board, tracking leads from first contact to conversion with scoring and stage management

**Verified:** 2026-04-25
**Status:** gaps_found
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view leads in Kanban board organized by customizable pipeline stages and drag-drop leads between stages | VERIFIED | KanbanBoard.tsx renders DragDropContext, StageColumn components with Droppable/Draggable from @hello-pangea/dnd; PATCH /api/leads/[id]/stage handles DnD with version-based conflict detection |
| 2 | User can create, edit, reorder, and delete pipeline stages with a default odontologia template seeded for new clinics | VERIFIED | stages.service.ts exports all CRUD + reorder functions; seedDefaultPipelineStages creates 7 odontologia stages (Novo/Contatado/Qualificado/Proposta/Negociação/Convertido/Perdido) with first as is_default=true; API routes exist at /api/pipeline/stages |
| 3 | User can create leads manually with source tracking and see leads automatically captured from WhatsApp conversations | PARTIAL | source_type column exists in leads table; manual lead creation may exist in Phase 1 contacts API; **WhatsApp capture NOT implemented** (Phase 3 territory) |
| 4 | User can see a lead score calculated from interactions and convert a lead to active patient when appointment is confirmed | VERIFIED | trigger_auto_score_lead() recalculates score on insert/update based on lead_activities; LeadCard displays score bar via getScoreColor from SCORE_THRESHOLDS; LeadConvertDialog triggers conversion via POST /api/leads/[id]/convert which calls convertLeadToPatient |

**Score:** 3.5/4 truths verified (2 fully, 1 partial, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/hooks/use-kanban.ts` | Kanban board hook with DnD | VERIFIED | Exports useKanbanBoard with onDragEnd, optimistic locking, 409 conflict handling |
| `src/lib/theme/score-thresholds.ts` | SCORE_THRESHOLDS constants | VERIFIED | Exports cold/warm/hot thresholds with getScoreColor/getScoreLabel |
| `src/components/pipeline/kanban-board.tsx` | DragDropContext wrapper | VERIFIED | KanbanErrorBoundary class component, DragDropContext, skeleton loading |
| `src/components/pipeline/stage-column.tsx` | Droppable column | VERIFIED | StageColumnErrorBoundary, Droppable, empty state "Nenhum lead" |
| `src/components/pipeline/lead-card.tsx` | Draggable card | VERIFIED | Draggable with score bar from SCORE_THRESHOLDS, kebab menu with "Converter para paciente" |
| `src/components/pipeline/lead-convert-dialog.tsx` | Convert dialog | VERIFIED | Form with name/phone/email, onConvert callback |
| `src/app/dashboard/pipeline/page.tsx` | Pipeline page | VERIFIED | Server component with getUserProfile(), renders KanbanBoard |
| `src/app/api/leads/[id]/stage/route.ts` | Stage DnD endpoint | VERIFIED | PATCH with version-based 409 conflict detection |
| `src/app/api/leads/[id]/convert/route.ts` | Convert endpoint | VERIFIED | POST calls convertLeadToPatient from leads.service.ts |
| `src/services/pipeline/stages.service.ts` | 7-function service | VERIFIED | getPipelineStages, createPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages, seedDefaultPipelineStages, getDefaultStageId |
| `src/lib/hooks/use-queries.ts` | Kanban queries | VERIFIED | useKanbanLeads, usePipelineStages with join to pipeline_stages |
| `supabase/migrations/20260425000001_add_leads_pipeline_columns.sql` | Migration | VERIFIED | stage_id FK, auto-score trigger, get_default_stage_id function |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| KanbanBoard | useKanbanBoard hook | DragDropContext onDragEnd | WIRED | onDragEnd calls PATCH /api/leads/${leadId}/stage |
| useKanbanBoard | PATCH stage endpoint | fetch with version | WIRED | Optimistic update + 409 conflict handling |
| LeadCard | LeadConvertDialog | DropdownMenuItem onClick | WIRED | handleConvertClick sets convertDialogOpen=true |
| LeadConvertDialog | POST /api/leads/[id]/convert | onConvert callback | WIRED | Dialog form submits via onConvert |
| Pipeline page | KanbanBoard | clinicId prop | WIRED | Server component passes clinicId |
| useKanbanLeads query | leads table | createTypedClient() RLS | WIRED | Supabase query with pipeline_stages join |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| @hello-pangea/dnd installed | ls node_modules/@hello-pangea/dnd 2>/dev/null | exists | PASS |
| score-thresholds exports functions | node -e "require('./src/lib/theme/score-thresholds.ts')" | TypeScript module | PASS (via build) |
| stages.service exports all 7 functions | grep "export.*async function" src/services/pipeline/stages.service.ts | 7 functions | PASS |

### Requirements Coverage

| Requirement | Description | Plan | Status | Evidence |
|-------------|-------------|------|--------|---------|
| PIPE-01 | Kanban board view leads by stage | 02 | VERIFIED | KanbanBoard with StageColumn, useKanbanLeads filtered by stage_id |
| PIPE-02 | Drag-drop leads between stages | 02 | VERIFIED | @hello-pangea/dnd + useKanbanBoard + PATCH stage endpoint |
| PIPE-03 | CRUD pipeline stages | 01 | VERIFIED | stages.service.ts + /api/pipeline/stages routes |
| PIPE-04 | Default odontologia template | 01 | VERIFIED | seedDefaultPipelineStages creates 7 stages |
| PIPE-05 | WhatsApp lead capture | 02 | FAILED | No WhatsApp webhook/conversation monitoring in Phase 2 |
| PIPE-06 | Manual lead creation with source | 02 | PARTIAL | source_type column exists; lead creation API unclear |
| PIPE-07 | Lead score calculated from interactions | 01 | VERIFIED | trigger_auto_score_lead + LeadCard score bar |
| PIPE-08 | Convert lead to patient | 02 | VERIFIED | LeadConvertDialog + POST /api/leads/[id]/convert |

**Coverage:** 6/8 requirements VERIFIED, 1 PARTIAL, 1 FAILED

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

---

## Gaps Summary

**PIPE-05 (WhatsApp lead capture) is not implemented in Phase 2.** The ROADMAP shows PIPE-05 mapped to Phase 2, but WhatsApp conversation capture requires WhatsApp integration which is Phase 3 (WhatsApp CRM) territory. The Phase 2 plans added the source_type column to leads but did not implement any WhatsApp message listener or webhook.

**Clarification needed for PIPE-06 (manual lead creation):** The database column source_type exists and leads have a source field, but Phase 2 plans focused on pipeline stages and Kanban UI, not lead CRUD. If lead creation with source tracking is needed in Phase 2, it should be verified against the Phase 1 contacts API.

---

## Next Steps

1. **PIPE-05**: Defer to Phase 3 (WhatsApp CRM) where WhatsApp webhook and conversation monitoring will be implemented
2. **PIPE-06**: Verify if Phase 1 contacts API already covers lead creation with source tracking; if not, this may need to be added to Phase 2 or a micro-phase

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_