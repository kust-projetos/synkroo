# Phase 5: Integration & Analytics - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users experience a seamlessly integrated CRM where calendar events link to contacts, and can access pipeline conversion analytics, financial reports, and LGPD compliance tools.

**Requirements:** CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, LGPD-02, LGPD-03

**In scope:**
- Book appointment from contact profile with patient data pre-filled
- Book appointment directly from lead (no prior conversion needed)
- Calendar events auto-linked to patient contacts via patient_id FK
- Appointments tab in contact profile (upcoming/past)
- Waitlist auto-fill on appointment cancellation
- Pipeline analytics dashboard (conversion by stage, avg conversion time, inactive patients, upsell)
- Financial reports dashboard (revenue, payments, outstanding by period)
- Report export (CSV/PDF)
- LGPD data export and anonymization

**Out of scope:**
- Multi-clinic management
- Complex pipeline analytics beyond stage conversion rates
</domain>

<decisions>
## Implementation Decisions

### Calendar Booking from Contact
- **D-01:** **Book from contact profile only** — "Novo Agendamento" button pre-fills patient name + phone
- **D-02:** **Book lead directly** — leads without patient can have appointment created directly (no prior conversion needed)
- **D-03:** Same `AppointmentDialog` handles both patient and lead context — pre-fill via `defaultPatientId` / `defaultLeadName` in calendar store

### Appointments Tab in Contact Profile
- **D-04:** **Separate tab** in contact detail panel — tabs: Timeline | Notas | Campos Customizados | Consentimento | Agendamentos
- **D-05:** Tab shows upcoming + past appointments with status badges
- **D-06:** "Novo Agendamento" button at top right of tab content

### Waitlist Auto-fill
- **D-07:** **Auto-fill on cancellation** — when appointment cancels, system automatically books matching waitlist patient
- **D-08:** System uses `findMatchingWaitlist` + `notifyWaitlistPatient` from existing waitlist service
- **D-09:** Auto-fill happens server-side in cancel route, no manual approval needed

### Analytics UI Location
- **D-10:** **Both locations:**
  - Pipeline/financial as tabs in contact profile (quick view)
  - `/dashboard/relatorios` page for full pipeline + financial dashboards
- **D-11:** Pipeline analytics shows: conversion by stage, avg conversion time, inactive patients, upsell opportunities
- **D-12:** Financial reports show: revenue, payments, outstanding by period (month/quarter/year)

### Report Export
- **D-13:** Extend existing `reports/export/route.ts` with `case 'financial':`
- **D-14:** Export formats: CSV (default), PDF (via existing jspdf + jspdf-autotable)

### LGPD Compliance
- **D-15:** LGPD export dialog in contact profile — aggregates all patient data (appointments, budgets, payments, consents)
- **D-16:** LGPD anonymize requires typed confirmation ("CONFIRMAR") — creates audit log entry
- **D-17:** Anonymize scope: patients + appointments(notes) + budgets(notes) + leads(contact info)

### Claude's Discretion
- Exact colors for funnel chart bars (reuse stage colors from pipeline_stages)
- Toast messages for waitlist auto-fill (copy)
- Specific thresholds for inactive patients (90 days) and upsell (30 days)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior Phase Contexts
- `.planning/phases/01-foundation-contacts/01-CONTEXT.md` — split-view layout, contact detail tabs
- `.planning/phases/02-pipeline-sales/02-CONTEXT.md` — lead conversion trigger, scoring display
- `.planning/phases/04-patient-records-finance/04-CONTEXT.md` — financial summary, budget structure

### Requirements
- `.planning/REQUIREMENTS.md` §Calendar (CAL), §Reports (REPORT), §LGPD

### Existing Code
- `src/services/waitlist/waitlist.service.ts` — findMatchingWaitlist + notifyWaitlistPatient
- `src/components/calendar/AppointmentDialog.tsx` — existing booking dialog pattern
- `src/app/api/reports/export/route.ts` — existing export infrastructure (jspdf + jspdf-autotable)
- `src/components/contacts/contact-split-view.tsx` — master-detail layout
- `src/components/charts/CashFlowChart.tsx` — Recharts usage pattern
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppointmentDialog.tsx`: can extend with pre-fill props (defaultPatientId, defaultLeadName)
- `calendar-store.ts`: add pre-fill fields to dialog state
- `CashFlowChart.tsx`: reuse for pipeline funnel and financial bar charts
- `contact-split-view.tsx`: reuse for analytics dashboards

### Integration Points
- Cancel route: `src/app/api/appointments/[id]/cancel/route.ts` — hook waitlist auto-fill here
- Contact appointments: new `src/app/api/contacts/[id]/appointments/route.ts`
- Export route: extend existing `src/app/api/reports/export/route.ts`
</code_context>

<specifics>
## Specific Ideas

- Lead card: "Agendar" button pre-fills lead name + phone, allows booking without conversion
- Waitlist auto-fill: toast notification when auto-fill succeeds
- Financial charts: simple bar charts (revenue, payments, outstanding) with period selector
</specifics>

<deferred>
## Deferred Ideas

- LGPD settings page (currently dialog-based, may need dedicated page in future)
- Complex pipeline analytics (beyond stage conversion rates)
- Multi-clinic management
</deferred>

---

*Phase: 05-integration-analytics*
*Context gathered: 2026-04-26*
