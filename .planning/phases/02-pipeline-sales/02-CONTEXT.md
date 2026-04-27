# Phase 2: Pipeline & Sales - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage their sales pipeline visually with a customizable Kanban board, tracking leads from first contact to conversion with scoring and stage management.

**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08

**In scope:**
- Kanban board with horizontal columns (Trello-style)
- Drag-and-drop leads between stages
- CRUD pipeline stages (per clinic)
- Default odontologia template seeded for new clinics
- Lead capture from WhatsApp + manual + referral + website + paid media
- Lead scoring (hybrid: tipo + recência)
- Lead conversion trigger: procedimento pago

**Out of scope:**
- Multi-clinic management (MVP: one clinic per account)
- Complex pipeline analytics (basic lead score only)
</domain>

<decisions>
## Implementation Decisions

### Kanban Layout
- **D-01:** Kanban board using **horizontal columns** (Trello-style) — stages as columns, leads as cards
- **D-02:** Lead card displays: nome + data último contato + score (barra de progresso) + tags
- **D-03:** Column shows lead count and stage name
- **D-04:** Responsive: columns scroll horizontally on mobile; stack vertically if needed

### Lead Scoring
- **D-05:** Score = **hybrid (tipo + recência)** — interactions weighted by type AND decay over time
- **D-06:** Interaction weights: WhatsApp=3, Llamada=2, Email=1, Visita=2
- **D-07:** Recent interactions weigh more (time decay applied on top of type weight)
- **D-08:** Score displayed as **progress bar** (0-100%) on lead card
- **D-09:** Score calculated server-side using existing interaction data (Phase 1 timeline sources)

### Source Tracking
- **D-10:** Track ALL sources: WhatsApp, Manual, Referral, Website, Paid Media
- **D-11:** Source tracked **automatically** — WhatsApp auto-detected, others manual selection
- **D-12:** Source stored as enum field on lead (source_type TEXT CHECK)

### Lead Conversion
- **D-13:** Lead → Patient conversion trigger: **procedure paid** (any payment received on appointment)
- **D-14:** Manual conversion also available (user can convert anytime from lead detail)
- **D-15:** When converted: lead record archived, patient record created, stage_id → converted system stage

### Pipeline Stages
- **D-16:** Pipeline stages stored in `pipeline_stages` table (created in Phase 1 migration)
- **D-17:** Default odontologia template: Novo, Contatado, Qualificado, Proposta, Negociação, Convertido, Perdido
- **D-18:** Users can create, edit, reorder, delete stages (custom per clinic)
- **D-19:** System stages (converted, lost) cannot be deleted — only hidden
- **D-20:** Stage colors configurable per clinic

### Claude's Discretion
- Column widths and card spacing
- Drag animation and drop feedback
- Empty column state messaging
- Score bar color thresholds (green/yellow/red)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Context (decisions that apply)
- `.planning/phases/01-foundation-contacts/01-CONTEXT.md` — unified contact layout, interaction timeline data sources, tags pattern, LGPD consent table

### Requirements
- `.planning/REQUIREMENTS.md` §Pipeline (PIPE) — PIPE-01 through PIPE-08

### Database Schema
- `.planning/phases/01-foundation-contacts/01-CONTEXT.md` §Database Changes Required — `pipeline_stages` table definition (id, clinic_id, name, position, color, is_default, is_system)
- Phase 1 migration: seed default pipeline stages for odontologia

### UI Components (from Phase 1)
- `src/components/ui/badge.tsx` — for status indicators
- `src/components/ui/dialog.tsx`, `sheet.tsx` — for create/edit forms
- `src/components/ui/empty-state.tsx` — for empty column states

### Services (from Phase 1)
- `services/leads/` — existing lead CRUD, scoring, stats
- `services/patients/` — patient CRUD
- `lib/supabase/typed.ts` — createTypedClient() for RLS-enforced queries
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pipeline_stages` table: already defined in Phase 1 migration
- `lead_activities` table: existing interaction tracking
- `appointments` table: has payment status (paid/unpaid)
- `Badge` component: reuse for score bar color thresholds

### Integration Points
- Kanban board: new page at `/dashboard/pipeline` or integrated into `/dashboard/contatos`
- Lead card: links to existing contact detail (Phase 1 split-view)
- Scoring: reuses existing `leads.score` field and `LeadService.calculateScore()`
- Conversion: uses `patients` table + `leads.converted_at` timestamp

### Patterns to Reuse
- Split-view layout from D1 (contact list left, detail right)
- Tags with colors pattern from D4
- Card-based timeline from D3
</code_context>

<specifics>
## Specific Ideas

- Odontologia default template stages: Novo, Contatado, Qualificado, Proposta, Negociação, Convertido, Perdido
- Lead card: avatar circle (initials), name bold, last contact as "há 2 dias", score bar below, tags as small badges
- Score calculation: sum of (interaction_weight × time_decay_factor) for all interactions in last 30 days
- Source auto-detect: if lead created via WhatsApp conversation → source=whatsapp
</specifics>

<deferred>
## Deferred Ideas

### From Phase Discussion
- Lead priority levels (urgent/normal/slow) — could be added as second dimension (grid 2D)
- Pipeline analytics (conversion rate per stage, avg time in stage) — Phase 5 or later
- Automated reactivation campaigns for stale leads — Phase 3 (WhatsApp CRM)

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.
</deferred>

---

*Phase: 02-pipeline-sales*
*Context gathered: 2026-04-24*