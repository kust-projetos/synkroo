# Phase 2: Pipeline & Sales - Research

**Phase:** 2-Pipeline & Sales
**Date:** 2026-04-24

---

## Domain Analysis

Phase 2 delivers: Kanban board CRM with drag-drop leads, custom pipeline stages, lead scoring, and lead-to-patient conversion.

**UI hint from ROADMAP:** yes — frontend-heavy phase.

---

## Technical Findings

### Kanban Board Implementation

**Library:** @hello-pangea/dnd (referenced in ROADMAP.md)
- Maintained fork of react-beautiful-dnd (Atlassian stopped maintaining in 2021)
- Works with React 18+ and TypeScript

**Supabase Realtime:**
- supabase.channel('pipeline') for live updates
- postgres_changes on leads and pipeline_stages tables
- On drag-end: PATCH leads.stage_id + optimistic update

### Lead Scoring (Hybrid Type + Recency)

**Formula:** score = sum(interaction_weight * e^(-0.1 * days_ago)) for last 30 days
**Weights:** WhatsApp=3, Llamada=2, Email=1, Visita=2
**Implementation:** DB function calculate_lead_score(lead_id) cached in leads.score

### Lead Source Auto-Detection

- WhatsApp: auto-detected if created during WhatsApp conversation
- Referral: leads.referred_by contact ID exists
- Others: manual selection at creation

### Conversion Trigger

- Auto: Any payment received on appointment (procedure paid)
- Manual: Always available from lead detail

### Pipeline Stages (7 default odontologia template)

Novo, Contatado, Qualificado, Proposta, Negociação, Convertido (system), Perdido (system)

---

## Database Schema

### Existing (from Phase 1)
- pipeline_stages table — already created with RLS
- leads table — has status column (needs stage_id FK migration)

### Phase 2 additions to leads:
- stage_id UUID REFERENCES pipeline_stages(id)
- source_type TEXT CHECK (whatsapp,manual,referral,website,paid_media)
- score DECIMAL(5,2) DEFAULT 0
- converted_at TIMESTAMPTZ
- converted_to_patient_id UUID

---

## Files to Create

src/app/dashboard/pipeline/page.tsx
src/components/pipeline/kanban-board.tsx, stage-column.tsx, lead-card.tsx, stage-manager.tsx
src/hooks/use-kanban.ts
src/services/pipeline/stages.service.ts, scoring.service.ts
supabase/migrations/XXX_add_leads_stage_id.sql

---

## Key Risks

1. Realtime latency → use optimistic updates
2. Score recalculation frequency → debounce triggers
3. Stage deletion → must move/remove leads first

*Research complete*
