# admindemo Large Seed Design

**Date:** 2026-06-15
**Owner:** planner
**Status:** proposed

## Objective
Populate real demo data for the `admindemo` account using the existing seed flow so DB-backed dashboard pages stop rendering empty states, with priority on **Lista de Espera** and **Pipeline/Leads**, plus other empty pages discovered during audit.

## Context
Current seed support is split across two existing paths:
- `scripts/seed-database.ts` seeds core clinic data (clinic, users, dentists, procedures, patients, schedule blocks, appointments).
- `src/app/api/seed/route.ts` already seeds extended CRM/demo data (`leads`, `leadActivities`, `campaigns`, `campaignRecipients`, `waitlist`, `patientFeedback`, `procedureGuidelines`, `scheduleBlocks`, `followUpConfigs`).

The user wants **real seeded data**, not UI fallback mocks, specifically for the `admindemo` account and at **large** scale.

## Audit Summary
Quick audit of empty-state entry points found likely DB-seedable demo pages that can benefit from denser seeded data:

### High-priority pages
1. `src/app/dashboard/lista-espera/page.tsx`
   - Reads `/api/waitlist`
   - Empty when `waitlist` rows are absent or too sparse
2. `src/app/dashboard/leads/page.tsx`
   - Reads lead queries/stats/notifications
   - Uses seeded `leads` and `leadActivities`
3. `src/components/pipeline/stage-column.tsx`
   - Shows `Nenhum lead` when stages/leads distribution is weak
4. `src/app/dashboard/campanhas/page.tsx`
   - Benefits from campaign + recipient density
5. `src/components/reports/pipeline-analytics-dashboard.tsx`
   - Needs enough leads/converted leads/inactive patients/upsell opportunities to avoid empty sections

### Secondary DB-backed pages likely improved by richer seed
- `src/app/dashboard/pacientes/inativos/page.tsx`
- `src/app/dashboard/atividades/page.tsx`
- `src/app/dashboard/tarefas/page.tsx` (only if backing data source exists and is seedable in current schema)
- `src/app/dashboard/conversas/page.tsx` (only if conversation tables are already in local DB flow)
- `src/app/dashboard/campanhas/[id]/page.tsx`

### Out of scope
Do **not** fake data for pages that depend on live external integrations or unclear non-seeded domains unless the underlying DB schema is already used in the current seed flow.
Examples likely out of scope unless easy and local:
- WhatsApp live inbox realism
- external delivery/engagement provider states
- any cloud/resource side effects outside DB

## Recommended Approach
Extend the **existing seed flow** rather than adding UI mocks or one-off local fixtures.

### Option A — Enrich only `src/app/api/seed/route.ts` (recommended)
Pros:
- Already owns waitlist/leads/campaigns/demo-style data
- Lowest blast radius
- Naturally aligned with `admindemo` demo account behavior

Cons:
- Core and extended seed logic stay split across two files

### Option B — Move everything into `scripts/seed-database.ts`
Pros:
- Single seed entry point long term

Cons:
- Bigger refactor
- Not needed for current goal

### Option C — New dedicated `admindemo-large` seed path
Pros:
- Explicit scenario control

Cons:
- More maintenance and duplication
- Higher risk of drift from default seed

### Recommendation
Use **Option A**. Add a clear `large` scenario layer to the existing API seed route and keep the base core seed untouched except where needed to guarantee relational consistency.

## Proposed Seed Design

### 1. Scope target
Seed data specifically for the demo clinic/account used by `admindemo`.

Implementation should resolve the clinic/user from existing seed clinic records, then create or upsert large-volume related records for that clinic.

### 2. Scale profile: `large`
The large profile should create dense but still readable data.

#### Waitlist
Target characteristics:
- 35–60 waitlist entries
- distribution across statuses: `waiting`, `notified`, `scheduled`, small tail of `expired`/`cancelled`
- broad priority spread with 20–30% urgent (priority `7+`)
- preferred dates across past few days and next 2–3 weeks
- mixed time windows and procedures
- linked to real seeded patients/dentists/procedures
- realistic notes for urgency, follow-up, reschedule reasons

#### Leads / Pipeline
Target characteristics:
- 80–140 leads
- balanced distribution across statuses:
  - `new`
  - `contacted`
  - `qualified`
  - `proposal`
  - `negotiation`
  - `converted`
  - `lost`
- temperature mix: cold / warm / hot
- multiple sources: WhatsApp, Instagram, Web, Referral, Campaign
- enough converted/lost history to make analytics meaningful
- each lead gets 1–5 activities based on lifecycle stage
- enough follow-up dates and score variance to populate notifications/stats/cards

#### Campaigns
Target characteristics:
- 10–18 campaigns
- mixed statuses: draft, scheduled, running, paused, completed
- recipients linked to patients and/or leads where supported
- enough sent/responded/converted counts to make list/details non-empty

#### Inactive patients / patient-derived pages
Target characteristics:
- preserve or create enough patients with older `lastVisitAt`
- ensure spread across inactivity segments (30/60/90/180)
- enough appointment history so patient/profile pages do not look hollow

#### Optional seedable pages from audit
Only include if schema + route already exist and are simple to support in current flow:
- activity feed rows
- tasks rows
- conversation rows

If these require new domain modeling or external behavior simulation, keep them out of this change and report them separately.

## Data Architecture

### Seed layering
1. **Base seed**
   - clinic
   - admin user / `admindemo`
   - dentists
   - procedures
   - patients
   - appointments
2. **Extended large demo seed**
   - waitlist
   - leads
   - lead activities
   - campaigns
   - campaign recipients
   - feedback/guidelines/configs already supported
3. **Audit-driven enrichments**
   - only for DB-backed pages proven empty due to missing seed data

### Idempotency rules
Seed must remain safe to re-run.
Recommended strategy:
- delete/replace only scenario-owned demo rows for that clinic before inserting
- avoid duplicating rows on repeated runs
- keep cleanup scoped to the clinic and seeded tables

### Scenario control
Introduce a scenario selector in the seed flow, even if only `large` is used now.
Suggested shape:
- default: current/medium-like behavior preserved
- explicit `large`: dense dataset for `admindemo`

This keeps future expansion (`small`, `xlarge`) possible without redesign.

## File Impact

### Primary files
- `src/app/api/seed/route.ts`
  - main implementation for large demo dataset
- `scripts/seed-database.ts`
  - only if needed to guarantee core relational volume for patients/appointments before extended seed

### Likely read/validation paths
- `src/app/dashboard/lista-espera/page.tsx`
- `src/app/dashboard/leads/page.tsx`
- `src/components/pipeline/stage-column.tsx`
- `src/components/reports/pipeline-analytics-dashboard.tsx`
- `src/app/dashboard/campanhas/page.tsx`
- related repositories/routes for waitlist/leads/campaigns/patients

### Possible test files
- route-level tests for `/api/seed` if present or added
- focused regression tests around generated counts/shape only if practical

## Error Handling
- If clinic for `admindemo`/demo seed is missing, return explicit error instead of partial seed
- If required related entities are missing (patients, dentists, procedures), fail fast or create dependencies first
- Seed summary should report per-domain inserted/error counts clearly

## Testing Strategy

### Functional verification
After seeding, verify:
1. `lista de espera` has visible volume and mixed statuses
2. `leads/pipeline` has dense stage distribution
3. `campanhas` is populated
4. `pacientes inativos` still has data
5. pipeline analytics sections no longer show empty states where DB-backed data exists

### CLI / app verification
- run the seed flow for the demo clinic
- open `admindemo`
- inspect the priority pages above

### TDD expectation for implementation
Before changing seed logic, add/adjust focused tests for seed helpers or route behavior where feasible. If the current seed route is lightly tested, keep tests focused on deterministic helper behavior and idempotent scenario selection rather than full DB end-to-end simulation.

## Risks
- Over-seeding can make pages noisy or slow if counts are too high
- Splitting core seed and extended seed can hide dependencies if large scenario assumes patients/dentists/procedures that base seed did not create
- Some empty pages from the audit may belong to unsupported domains; forcing them into this scope would create brittle fake behavior

## Non-goals
- No UI fallback mocks
- No redesign of dashboard pages
- No external integration simulation beyond existing local DB-backed models
- No broad refactor of all seed infrastructure unless required by a concrete blocker

## Success Criteria
- `admindemo` sees non-empty, believable data on waitlist and pipeline pages
- other audited DB-backed empty pages gain meaningful seeded data where supported
- seed remains idempotent
- implementation stays within current seed architecture with minimal blast radius

## Open Decisions Resolved
- Real data vs UI fallback: **real data**
- Target account: **admindemo**
- Scale: **large**
- Scope expansion: **include other DB-backed empty pages found in audit**
