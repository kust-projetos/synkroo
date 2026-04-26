# Phase 5: Integration & Analytics - Research

**Researched:** 2026-04-26
**Domain:** Calendar-CRM integration, pipeline analytics, financial reporting, LGPD compliance
**Confidence:** HIGH

## Summary

Phase 5 weaves together the fragmented CRM pieces into a unified experience. Calendar events are already linked to patients via `appointments.patient_id` FK, but booking from contact/lead context does not exist. The `analytics.service.ts` provides appointment-level insights but lacks pipeline-specific conversion analytics. The `reports/export/route.ts` already has jsPDF + jspdf-autotable for CSV/PDF export across 5 data types. LGPD data portability and anonymization have no implementation yet.

**Primary recommendation:** Build on existing infrastructure (waitlist service, analytics service, export route) rather than creating parallel systems. Calendar booking from contacts needs a new "book appointment" action. Pipeline analytics needs new aggregation queries. Financial reports need a dedicated report service. LGPD needs a new compliance service.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Calendar booking from contact/lead | Frontend Server (Next.js) | API/Backend | Dialog pre-fills patient context, creates appointment |
| Appointment contact linking | Database (FK already exists) | API/Backend | appointments.patient_id already present |
| Contact appointment view | Frontend Server (Next.js) | API/Backend | Query appointments by patient_id |
| Waitlist auto-fill | API/Backend | Frontend Server | `waitlist.service.ts` has findMatchingWaitlist + notifyWaitlistPatient |
| Pipeline conversion analytics | API/Backend | Frontend Server | New aggregation queries on leads + appointments |
| Financial reports by period | API/Backend | Frontend Server | Budget + payment aggregation per period |
| CSV/PDF export | API/Backend | Frontend Server | `reports/export/route.ts` already has jsPDF |
| LGPD data export | API/Backend | Frontend Server | New endpoint aggregating all patient data |
| LGPD anonymization | API/Backend | Database | UPDATE with anonymized values + audit trail |

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 5. This is a greenfield research effort building on Phase 2, 3, and 4 foundations.

### Prior Phase Decisions That Apply

| From Phase | Decision | Applies To |
|------------|----------|------------|
| Phase 1 D3 | Timeline aggregates appointments, messages, lead_activities, patient_observations | CAL-04 (appointment view in contact) |
| Phase 2 D13 | Lead conversion trigger: procedure paid | CAL-02, REPORT-01 (conversion tracking) |
| Phase 2 D16 | pipeline_stages table with position, color, is_system | REPORT-01 (conversion by stage) |
| Phase 4 D15 | Sessions can be linked to existing appointments | CAL-03 (calendar events linked to patients) |
| Phase 4 D16 | Phase 5 handles bidirectional calendar-CRM linking | CAL-01, CAL-02, CAL-03 |
| Phase 4 D18 | Simple bar charts for financial summary (Recharts) | REPORT-05 (financial reports) |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | Book appointment directly from contact profile | New `bookAppointment` action pre-fills patient in AppointmentDialog |
| CAL-02 | Book appointment from pipeline lead card | New quick-book dialog on LeadCard, pre-fills lead name/phone |
| CAL-03 | Calendar events auto-linked to patient contacts | FK `appointments.patient_id` already exists; verify RLS allows link |
| CAL-04 | View patient upcoming/past appointments in contact profile | New `appointments` tab in contact detail panel |
| CAL-05 | Manage waitlist with auto-fill cancelled slots | `waitlist.service.ts` exists; connect to appointment cancel flow |
| REPORT-01 | Pipeline conversion rates by stage | New `pipelineAnalytics.service.ts` with stage-level aggregation |
| REPORT-02 | Average lead-to-patient conversion time | Query: avg(converted_at - created_at) from leads where converted |
| REPORT-03 | Identify inactive patients | `reports/patients` already returns inactiveList |
| REPORT-04 | Upsell/upgrade opportunities | New treatment history analysis in analytics |
| REPORT-05 | Financial reports (revenue, payments, outstanding) by period | New `financialReports.service.ts` aggregating budgets + payments |
| REPORT-06 | Export report data (CSV/PDF) | Extend existing `reports/export` route with new type=financial |
| LGPD-02 | Export all patient data in portable format | New `lgpd.service.ts` export endpoint |
| LGPD-03 | Process data deletion with anonymization + audit trail | New `lgpd.service.ts` anonymize endpoint + audit_logs entry |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 | 15.1.0 | App Router + API routes | Project baseline |
| Supabase JS | 2.45.0 | Database access via typed client | Project baseline |
| Recharts | 3.8.1 | Bar charts for financial reports | Project baseline (already installed) |
| jspdf | 4.2.1 | PDF generation | Already installed for existing export route |
| jspdf-autotable | 5.0.7 | Tables in PDF | Already installed alongside jspdf |
| date-fns | 4.1.0 | Date manipulation | Project baseline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.23.8 | Schema validation for export/anonymize inputs | LGPD endpoint input validation |

### No New Dependencies Required
All required libraries already exist in package.json.

## Architecture Patterns

### System Architecture Diagram

```
[Contact Profile / Lead Card]
         │
         │ "Book Appointment" action
         ▼
[AppointmentDialog] ──pre-fills── [patient_id / lead name+phone]
         │
         │ POST /api/appointments
         ▼
[appointments table] ──FK──▶ [patients table]
         │
         │ appointment cancel
         ▼
[waitlist.service.ts] → findMatchingWaitlist() → notifyWaitlistPatient()
         │
         │
[Pipeline Board] ──stage data──▶ [pipelineAnalytics.service.ts]
         │                              │
         │                              │ stage_id aggregations
         │                              ▼
         │                    [pipeline_stages] + [leads conversions]
         │
[Contact Profile] ──appointments tab──▶ [appointments] filtered by patient_id
         │
         │
[Financial Tab] ──budget data──▶ [financialReports.service.ts]
         │                              │
         │                              │ budget + installment aggregation
         ▼                              ▼
[jspdf + jspdf-autotable] ◀── JSON ── [reports/export/route.ts]
         │
         ▼
[CSV / PDF download]

[LGPD Compliance] ──export──▶ [lgpd.service.ts]
         │                        │ aggregates ALL patient data
         │                        ▼
         │                 [JSON download]
         │
         │ ──anonymize──▶ [patients + related tables]
         │                        │ anonymized values (CPF, phone, email, etc.)
         │                        ▼
         │                 [audit_logs entry]
```

### Recommended Project Structure
```
src/
├── app/api/
│   ├── appointments/
│   │   └── [id]/book-from-contact/route.ts   # CAL-01, CAL-02
│   ├── pipeline/analytics/route.ts           # REPORT-01, REPORT-02
│   ├── reports/financial/route.ts            # REPORT-05
│   ├── reports/export/route.ts               # extend with type=financial
│   └── lgpd/
│       ├── export/route.ts                   # LGPD-02
│       └── anonymize/route.ts               # LGPD-03
├── services/
│   ├── pipeline/pipeline-analytics.service.ts  # REPORT-01, REPORT-02
│   ├── reports/financial-reports.service.ts   # REPORT-05
│   ├── lgpd/lgpd-compliance.service.ts         # LGPD-02, LGPD-03
│   └── waitlist/waitlist.service.ts           # already exists, CAL-05
└── components/
    ├── contacts/
    │   └── AppointmentsTab.tsx               # CAL-04
    └── pipeline/
        └── LeadBookDialog.tsx               # CAL-02
```

### Pattern 1: Pre-fill Dialog Pattern (CAL-01, CAL-02)
**What:** AppointmentDialog accepts optional `defaultPatientId` / `defaultLeadName` prop to pre-fill form before user edits.
**When to use:** When launching booking from any CRM context (contact, lead card, waitlist).
**Example:**
```typescript
// In contact profile "Book" button
<Button onClick={() => openDialog({ defaultPatientId: contact.id })}>

// In AppointmentDialog
const { defaultPatientId } = useCalendarStore().dialog
useEffect(() => {
  if (defaultPatientId) {
    // Fetch patient and pre-fill name, phone
  }
}, [defaultPatientId])
```

### Pattern 2: Analytics Aggregation Service (REPORT-01, REPORT-02)
**What:** Service with pure functions that aggregate from multiple tables and return typed result objects.
**When to use:** Pipeline and financial analytics that need multi-table JOINs.
**Example:**
```typescript
// Source: new service pipeline-analytics.service.ts
export async function getConversionByStage(clinicId: string): Promise<StageConversion[]> {
  // JOIN leads + pipeline_stages + appointments
  // GROUP BY stage_id
  // RETURN conversion_rate, avg_time, total_leads per stage
}
```

### Pattern 3: LGPD Anonymization with Audit (LGPD-03)
**What:** Transaction that updates multiple tables with anonymized values and writes a single audit log entry.
**When to use:** Patient data deletion requests.
**Example:**
```typescript
// Source: lgpd-compliance.service.ts
export async function anonymizePatient(patientId: string, requestId: string): Promise<void> {
  // 1. UPDATE patients SET phone=anon_phone, email=NULL, cpf=NULL, name='ANONYMIZED'
  // 2. UPDATE appointments SET notes='[ANONYMIZED]'
  // 3. UPDATE budgets SET notes='[ANONYMIZED]'
  // 4. INSERT INTO audit_logs (action='patient_anonymized', metadata={requestId, original_id})
}
```

### Pattern 4: Extend Existing Export Route
**What:** Add new `case 'financial':` to the existing switch statement in `reports/export/route.ts`.
**When to use:** Adding new exportable report types.
**Example:** REPORT-05 adds financial report type to existing export infrastructure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Build PDF from scratch | `jspdf` + `jspdf-autotable` | Already installed, handles table layout, pagination, UTF-8 |
| CSV export | Build CSV serializer | `reports/export/route.ts` existing pattern | UTF-8 BOM, proper escaping, already working |
| Waitlist auto-fill logic | Build from scratch | `waitlist.service.ts` existing `findMatchingWaitlist` + `notifyWaitlistPatient` | Already implemented with WhatsApp notification |
| Appointment-patient linking | Add new linking table | FK `appointments.patient_id` already exists | FK enforces referential integrity |
| Inactive patient detection | New table | `reports/patients` route `inactiveList` | Already implemented |

## Common Pitfalls

### Pitfall 1: RLS Blocks Cross-Table Analytics Queries
**What goes wrong:** Pipeline analytics query joins leads + pipeline_stages + appointments but RLS on each table may silently filter results.
**Why it happens:** Each table has its own RLS policy; JOINs with multiple `clinic_id` references need careful verification.
**How to avoid:** Test all analytics queries with `createTypedClient()` (RLS-enforced) not raw admin client.
**Warning signs:** Analytics numbers don't match sum of individual table counts.

### Pitfall 2: jsPDF Autotable Page Breaks Mid-Row
**What goes wrong:** Large financial tables with many rows break across pages with headers ending up mid-content.
**Why it happens:** jspdf-autotable default behavior doesn't keep rows together.
**How to avoid:** Use `didParseCell` hook to color rows, set `showInEmptySpace: true` and `keepRowsTogether: true` in options.

### Pitfall 3: Appointment Cancel Doesn't Trigger Waitlist
**What goes wrong:** When an appointment is cancelled via the API, the waitlist auto-fill is not called.
**Why it happens:** Cancellation endpoint does not invoke `processWaitlistOnCancellation`.
**How to avoid:** Add `processWaitlistOnCancellation` call in `appointments/[id]/cancel/route.ts`.

### Pitfall 4: Financial Reports Double-Count Installments
**What goes wrong:** Financial report sums budget `final_value` AND `installments`, counting the same payment twice.
**Why it happens:** Budget total and installment payments are both included without checking if they're the same transaction.
**How to avoid:** Financial report should use `payments` table as source of truth for actual receipts, not budget values.

### Pitfall 5: LGPD Export Missing Related Tables
**What goes wrong:** Patient data export only includes `patients` table but not related appointments, budgets, conversations.
**Why it happens:** Export built for a single table without considering all data linked to the patient.
**How to avoid:** LGPD export must aggregate: patients + appointments + budgets + payments + conversations + timeline entries.

## Code Examples

### CAL-01/02: Pre-fill AppointmentDialog from Contact

```typescript
// Source: appointment-dialog.tsx existing pattern + CAL-01 requirement
// In useCalendarStore, add to dialog state:
interface CalendarDialogState {
  // ... existing fields
  defaultPatientId?: string
  defaultLeadName?: string
  defaultLeadPhone?: string
}

// Book button in contact profile
const openBookingDialog = (patientId: string) => {
  openDialog({ mode: 'create', defaultPatientId: patientId })
}

// In AppointmentDialog useEffect:
useEffect(() => {
  if (dialog.defaultPatientId) {
    // Fetch patient by ID and pre-fill form.patientName, form.patientPhone
    supabase.from('patients').select('name, phone').eq('id', dialog.defaultPatientId).single()
  }
}, [dialog.defaultPatientId])
```

### REPORT-01: Pipeline Conversion by Stage

```typescript
// Source: new pipeline-analytics.service.ts
export async function getConversionByStage(clinicId: string) {
  const supabase = await createTypedClient()
  
  // Get leads count and conversions per stage
  const { data } = await supabase
    .from('leads')
    .select(`
      stage_id,
      pipeline_stages!inner(name, position, color),
      converted_at
    `)
    .eq('clinic_id', clinicId)
  
  // Group by stage, calculate:
  // - total leads
  // - converted count
  // - conversion rate
  // - avg time to conversion (where converted)
}
```

### LGPD-02: Data Export Structure

```typescript
// Source: lgpd-compliance.service.ts
export async function exportPatientData(patientId: string) {
  const [patient, appointments, budgets, payments, consents] = await Promise.all([
    supabase.from('patients').select('*').eq('id', patientId).single(),
    supabase.from('appointments').select('*').eq('patient_id', patientId),
    supabase.from('budgets').select('*').eq('patient_id', patientId),
    supabase.from('payments').select('*').eq('patient_id', patientId),
    supabase.from('consents').select('*').eq('contact_id', patientId),
  ])
  
  return {
    exportedAt: new Date().toISOString(),
    patient: patient.data,
    appointments: appointments.data,
    budgets: budgets.data,
    payments: payments.data,
    consents: consents.data,
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Appointments unlinked from contacts | `appointments.patient_id` FK exists | Phase 1+2 | Linking now possible without new schema |
| Lead conversion via status field | `leads.stage_id` FK to pipeline_stages | Phase 2 migration | Conversion tracked by stage |
| Export built per-feature | Single `reports/export` route handles all types | Phase 3/4 | New exports just add a case to switch |
| Waitlist exists but disconnected | `waitlist.service.ts` has find+notify | Phase 1 | Connect to cancel flow, not rebuild |

**Deprecated/outdated:**
- `leads.status` CHECK constraint (replaced by `stage_id` FK in Phase 2 migration)
- `appointments.total_value` used for financial — budgets and installments are the proper financial record (Phase 4)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `appointments.patient_id` FK is enforced and RLS allows linking from calendar | CAL-03 | If RLS blocks it, need policy update |
| A2 | Waitlist service `findMatchingWaitlist` returns correct priority ordering | CAL-05 | If priority logic is wrong, auto-fill fills wrong patients |
| A3 | `reports/patients` inactiveList covers all inactive patients | REPORT-03 | If the query misses some, inactive detection is incomplete |
| A4 | jsPDF 4.2.1 + jspdf-autotable 5.0.7 are compatible versions | REPORT-06 | If autotable breaks on new jspdf, need version adjustment |

## Open Questions

1. **Lead to patient conversion creates new patient or links to existing?**
   - What we know: `leads.converted_to_patient_id` FK exists on leads table
   - What's unclear: Whether Phase 2 actually creates a new patient record or links to existing
   - Recommendation: Verify Phase 2 implementation before building analytics on conversion

2. **Financial report source of truth: budgets or appointments?**
   - What we know: Phase 4 added `budgets` with `final_value` and `installments`
   - What's unclear: Should financial revenue report use `appointments.total_value` (if set) or `budgets.final_value`?
   - Recommendation: Use `payments` table as source for actual received amounts, budgets for expected amounts

3. **LGPD anonymization scope**
   - What we know: Need to anonymize patient data and maintain audit trail
   - What's unclear: Which tables need anonymizing (just patients? appointments notes? all related?)
   - Recommendation: Anonymize patients + appointments(notes) + budgets(notes) + leads(contact info)

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all required tools are already in the project: Supabase, Next.js, jsPDF, Recharts).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with @testing-library |
| Config file | jest.config.ts (if exists) or package.json jest block |
| Quick run command | `npm test -- --testPathPattern="services/(pipeline\|financial\|lgpd)"` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | Book from contact pre-fills patient | unit | `npm test -- --testPathPattern="AppointmentDialog"` | needs new |
| CAL-04 | Appointments tab shows patient history | unit | `npm test -- --testPathPattern="appointments.*service"` | needs new |
| CAL-05 | Waitlist notified on cancel | unit | `npm test -- --testPathPattern="waitlist"` | exists |
| REPORT-01 | Conversion by stage returns correct rates | unit | `npm test -- --testPathPattern="pipeline-analytics"` | needs new |
| REPORT-02 | Avg conversion time calculated | unit | `npm test -- --testPathPattern="pipeline-analytics"` | needs new |
| REPORT-05 | Financial report by period | unit | `npm test -- --testPathPattern="financial-reports"` | needs new |
| LGPD-02 | Export returns all patient data | unit | `npm test -- --testPathPattern="lgpd"` | needs new |
| LGPD-03 | Anonymize updates records + audit | unit | `npm test -- --testPathPattern="lgpd"` | needs new |

### Wave 0 Gaps
- [ ] `src/services/pipeline/__tests__/pipeline-analytics.service.test.ts` — covers REPORT-01, REPORT-02
- [ ] `src/services/reports/__tests__/financial-reports.service.test.ts` — covers REPORT-05
- [ ] `src/services/lgpd/__tests__/lgpd-compliance.service.test.ts` — covers LGPD-02, LGPD-03
- [ ] `src/components/contacts/__tests__/appointments-tab.test.tsx` — covers CAL-04

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (existing) |
| V3 Session Management | yes | Supabase Auth (existing) |
| V4 Access Control | yes | RLS enforced via createTypedClient() |
| V5 Input Validation | yes | Zod schemas for all API inputs |
| V6 Cryptography | yes | PII anonymization uses anonymized values, not encryption |

### LGPD-Specific Threats

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Data export exposes full patient record to unauthorized user | Information Disclosure | RLS enforces clinic_id boundary; export checks auth |
| Anonymization leaves partial identifiers | Information Disclosure | Anonymize ALL PII fields (name, phone, email, CPF) not just some |
| Audit log itself contains the data being audited | Information Disclosure | Audit log stores request_id and original record_id, not PII |

## Sources

### Primary (HIGH confidence)
- `src/services/analytics/analytics.service.ts` — existing analytics patterns
- `src/services/waitlist/waitlist.service.ts` — waitlist auto-fill already implemented
- `src/app/api/reports/export/route.ts` — jsPDF + jspdf-autotable already in use
- `supabase/migrations/20260424000002_create_pipeline_stages.sql` — pipeline_stages schema
- `supabase/migrations/20260424000009_add_leads_pipeline_columns.sql` — leads stage_id, score, converted_at
- `supabase/migrations/20260327000600_create_leads_table.sql` — lead_activities + lead_statistics view

### Secondary (MEDIUM confidence)
- `src/app/api/reports/patients/route.ts` — inactive patient detection pattern
- `src/components/calendar/AppointmentDialog.tsx` — existing booking dialog pattern

### Tertiary (LOW confidence)
- jsPDF + jspdf-autotable compatibility — [ASSUMED] based on both being recent versions already in package.json

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — builds on existing patterns and services
- Pitfalls: MEDIUM — some assumptions about RLS behavior need verification

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days — stable domain)
