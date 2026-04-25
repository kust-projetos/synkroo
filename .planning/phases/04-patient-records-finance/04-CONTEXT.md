# Phase 4: Patient Records & Finance - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can manage multi-session treatment plans with progress tracking and handle financial workflows including budgets, payment plans, and payment recording.

**Requirements:** PRONT-01, PRONT-02, PRONT-03, PRONT-04, PRONT-05, PRONT-06

**In scope:**
- Master treatment plan with sub-treatments
- Session progress tracking per sub-treatment
- Multiple practitioners per patient plan
- Single budget per master plan (not per sub-treatment)
- Manual installment amounts
- Auto-complete sessions when payment received
- Payment method tracking (Pix, credit card, etc.)
- Financial summary per patient in contact profile tab

**Out of scope:**
- Electronic health records (CFM/PEC compliance)
- Dental charting (odontograma)
- Payment gateway integration (Pix, credit card processing)
</domain>

<decisions>
## Implementation Decisions

### Treatment Plan Structure
- **D-01:** **Master plan with sub-treatments** — One master plan grouping all patient procedures, with sub-plans per treatment
- **D-02:** Sessions tracked **per sub-treatment** (done/total) — master plan aggregates all sub-treatment progress
- **D-03:** Multiple practitioners per patient plan — all appear on plan, one is "principal"
- **D-04:** Visual progress indicators per sub-treatment (progress bar) + master plan aggregate

### Budget Structure
- **D-05:** **One budget per master plan** (not per sub-treatment) — sub-treatments have referential costs only
- **D-06:** Budget includes: itemized procedures with costs, payment terms, due dates
- **D-07:** Budget can be accepted/rejected by patient (with accept/reject endpoints)

### Payment & Installments
- **D-08:** Installment amounts are **manual** — dentist enters exact amount per installment
- **D-09:** When payment received: **sessions auto-complete proportionally** (payment amount / session cost)
- **D-10:** Payment method recorded: Pix, credit card, debit card, cash, boleto, etc.
- **D-11:** Payment triggers: budget total paid → budget accepted status, sessions completed

### Financial Summary
- **D-12:** Financial summary in **contact profile tab** (same split-view pattern from Phase 1)
- **D-13:** Summary shows: total billed, total paid, amount owed per treatment plan
- **D-14:** Links to detailed budget and payment history from the summary tab

### Integration with Calendar
- **D-15:** Sessions can be linked to existing appointments (reuses appointment data)
- **D-16:** Phase 5 (Integration & Analytics) will handle bidirectional calendar-CRM linking

### Claude's Discretion
- Budget document layout and visual design
- Progress bar colors (green/yellow/red thresholds)
- Installment schedule UI (due date picker, amount inputs)
- Payment recording form layout
- Summary chart types (bars, lines, totals)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Contexts
- `.planning/phases/01-foundation-contacts/01-CONTEXT.md` — split-view layout pattern, contact detail tabs, timeline data sources
- `.planning/phases/02-pipeline-sales/02-CONTEXT.md` — lead card patterns, scoring display, Kanban board decisions

### Requirements
- `.planning/REQUIREMENTS.md` §Patient Records (PRONT) — PRONT-01 through PRONT-06

### Existing Code
- `src/services/budgets/budget.service.ts` — existing budget service with accept/reject/send endpoints
- `src/services/patients/` — patient CRUD, patient history service
- `src/components/ui/` — badge, dialog, sheet, tabs, empty-state components
- `src/app/api/budgets/[id]/accept/route.ts` — existing budget acceptance endpoint
- `src/app/api/budgets/[id]/reject/route.ts` — existing budget rejection endpoint
- `src/app/api/budgets/followup/route.ts` — budget follow-up endpoint

### UI Patterns (from Phase 1)
- `src/components/contacts/contact-split-view.tsx` — master-detail layout
- `src/components/contacts/contact-timeline-tab.tsx` — tab content pattern
- `src/components/ui/badge.tsx` — progress indicators
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `budget.service.ts`: already has budget CRUD, accept/reject logic, send functionality
- `patient-history.service.ts`: existing patient history tracking
- UI components: badge, dialog, sheet, tabs — all can be reused

### Integration Points
- Financial summary tab: adds to existing contact detail tab structure (Timeline, Notas, Custom Fields, Consent)
- Budget acceptance/rejection: existing endpoints can be extended
- Appointments table: sessions can link to existing appointments

### Patterns to Reuse
- Split-view from Phase 1 (contact list left, detail right with tabs)
- Tab-based detail panel (Timeline, Notas, etc.)
- Card-based progress indicators
</code_context>

<specifics>
## Specific Ideas

- Master plan: patient name, creation date, status (draft, active, completed, cancelled)
- Sub-treatment: name, practitioner(s), total sessions, completed sessions, status
- Budget: items table (procedure name, quantity, unit price, total), installments table (amount, due date, paid status)
- Payment recording: amount, date, method, which sessions it covers
- Financial summary: per-plan totals with drill-down to budget details
</specifics>

<deferred>
## Deferred Ideas

### From Phase Discussion
- Dental charting (odontograma) — different product category, future phase
- Payment gateway integration (Pix, credit card) — requires PCI compliance, future phase
- Electronic health records (CFM/PEC) — regulatory compliance, future phase
- 2D pipeline view (urgency × progress) — Phase 2 deferred idea
- Pipeline analytics — Phase 5 or later
</deferred>

---

*Phase: 04-patient-records-finance*
*Context gathered: 2026-04-25*