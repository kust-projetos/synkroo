# Roadmap: Synkroo CRM (v0.2.0)

## Overview

Transform Synkroo from a calendar/WhatsApp app into a complete CRM for dental clinics. The journey starts with database foundation fixes (RLS consolidation, pipeline_stages, LGPD consent), then delivers contacts and pipeline as the first user-facing CRM features, followed by WhatsApp integration, patient records with finance, and finally cross-module analytics with LGPD compliance. Each phase delivers a coherent, verifiable capability that builds on the previous one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Existing UI Baseline:** Dashboard already has pages for leads, pacientes, campanhas, conversas, lista-espera, dentistas, procedimentos. Phases 1-3 are EXTEND/REFACTOR, not greenfield builds.

- [x] **Phase 1: Foundation & Contacts** - RLS consolidation (5 fix migrations), schema additions (pipeline_stages, custom fields, consent), expand existing pacientes/leads pages with search, filters, tags, custom fields, and interaction timeline
- [x] **Phase 2: Pipeline & Sales** - Kanban board with drag-and-drop (@hello-pangea/dnd), custom pipeline stages, expand existing leads page with scoring and lead-to-patient conversion
- [x] **Phase 2.1: WhatsApp Lead Capture (PIPE-05)** - Automatic lead creation from inbound WhatsApp messages with keyword-based scoring
- [x] **Phase 3: WhatsApp CRM** - Expand existing conversas page with in-app messaging, expand existing campanhas page with reminders, templates, and campaign scheduling
- [x] **Phase 4: Patient Records & Finance** - Treatment plans with progress tracking, budgets with itemized procedures, payment plans, financial summary per patient
- [ ] **Phase 5: Integration & Analytics** - Calendar-CRM bidirectional linking, expand existing lista-espera with auto-fill, pipeline reports, financial reports (jspdf for PDF), LGPD data export/anonymization

## Phase Details

### Phase 1: Foundation & Contacts
**Goal**: Users can manage all contacts (patients and leads) in a unified interface with search, filters, custom tags, and a complete interaction timeline -- built on a consolidated, performant database foundation
**Depends on**: Nothing (first phase)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CF-01, CF-02, CF-03, CF-04, LGPD-01, LGPD-04
**Success Criteria** (what must be TRUE):
  1. User can view a searchable, filterable list of all contacts (patients + leads) with name, phone, email, and status
  2. User can open a contact profile showing personal info, custom fields, tags, and notes with full CRUD (create, edit, archive)
  3. User can see a chronological interaction timeline per contact aggregating appointments, messages, notes, and status changes
  4. User can define custom field definitions (text, number, date, select, checkbox), fill them on contacts, and search/filter by custom field values
  5. User can record patient consent (data collection, marketing, WhatsApp) and the system maintains an audit log of consent changes
**Plans**: 6 plans

Plans:
- [x] 01-01-PLAN.md -- Database migrations: RLS consolidation, pipeline_stages, custom fields, consents, clinic_tags
- [x] 01-02-PLAN.md -- Unified contacts API: service, routes, hooks for list/search/CRUD/notes
- [x] 01-03-PLAN.md -- Custom fields API: definitions CRUD, values read/write, search, import/export
- [x] 01-04-PLAN.md -- Timeline and consents API: aggregation service, consent management, hooks
- [x] 01-05-PLAN.md -- Contacts split-view UI: master-detail layout, list panel, detail panel, create dialog, tags
- [x] 01-06-PLAN.md -- Detail panel tabs UI: timeline, notes, custom fields, consent section

**UI hint**: yes

### Phase 2: Pipeline & Sales
**Goal**: Users can manage their sales pipeline visually with a customizable Kanban board, tracking leads from first contact to conversion with scoring and stage management
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-06, PIPE-07, PIPE-08
**Success Criteria** (what must be TRUE):
  1. User can view leads in a Kanban board organized by customizable pipeline stages and drag-and-drop leads between stages
  2. User can create, edit, reorder, and delete pipeline stages with a default odontologia template seeded for new clinics
  3. User can create leads manually with source tracking (WhatsApp capture deferred to Phase 3)
  4. User can see a lead score calculated from interactions and convert a lead to active patient when an appointment is confirmed
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Database migration (leads.stage_id, source_type, score, calculate_lead_score function) + Stage service + Stage API routes
- [x] 02-02-PLAN.md -- Kanban board UI (useKanban hook, KanbanBoard, StageColumn, LeadCard components) + Lead stage DnD endpoint + Lead convert endpoint

**UI hint**: yes

### Phase 2.1: WhatsApp Lead Capture (PIPE-05)
**Goal**: Leads are automatically created when an inbound WhatsApp message arrives from an unknown phone number, with keyword-based initial scoring
**Depends on**: Phase 2 (Kanban board must exist for leads to appear)
**Requirements**: PIPE-05
**Success Criteria** (what must be TRUE):
  1. Inbound WhatsApp webhook creates a lead automatically when sender phone is unknown
  2. Lead is assigned source_type='whatsapp' and placed in the default pipeline stage
  3. Initial score is calculated from message keywords (intention detection)
  4. If phone already exists as a contact, only last_contact is updated and score recalculated
**Plans**: 1 plan

Plans:
- [ ] 02-03-PLAN.md -- WhatsApp lead capture: inbound webhook modification, keyword scoring, lead creation service

**UI hint**: no

### Phase 3: WhatsApp CRM
**Goal**: Users can communicate with contacts via WhatsApp directly from the CRM, with automated appointment reminders and scheduled marketing campaigns
**Depends on**: Phase 1 (contacts needed for messaging context)
**Requirements**: WHATS-01, WHATS-02, WHATS-03, WHATS-04, WHATS-05, WHATS-06, WHATS-07, PIPE-05
**Success Criteria** (what must be TRUE):
  1. User can view WhatsApp conversation history within a contact profile and send messages directly from the CRM
  2. User can configure automatic appointment reminders with customizable timing and message templates containing variable placeholders (name, date, time)
  3. User can see reminder delivery status (sent, delivered, read) for each appointment
  4. User can create WhatsApp campaigns (reactivation, follow-up, birthday), schedule them, and track delivery metrics
  5. User can automatically capture leads from incoming WhatsApp conversations (PIPE-05, deferred from Phase 2)
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md -- WhatsApp tab in contact profile: MessageBubble, MessageStatusBadge, MessageComposer, useWhatsAppMessages hook
- [x] 03-02-PLAN.md -- Appointment reminder configuration: procedure-specific timing, template placeholders, settings page
- [x] 03-03-PLAN.md -- Campaign wizard with smart filters and campaign dashboard with metrics

**UI hint**: yes

### Phase 4: Patient Records & Finance
**Goal**: Users can manage multi-session treatment plans with progress tracking and handle financial workflows including budgets, payment plans, and payment recording
**Depends on**: Phase 1
**Requirements**: PRONT-01, PRONT-02, PRONT-03, PRONT-04, PRONT-05, PRONT-06
**Success Criteria** (what must be TRUE):
  1. User can create multi-session treatment plans for patients and track progress (sessions completed vs remaining) with visual indicators
  2. User can create treatment budgets with itemized procedures and costs, and define payment plans (installments, due dates)
  3. User can record payments against budgets and track outstanding balances per patient
  4. User can view a basic financial summary per patient showing total billed, total paid, and amount owed
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Database schema (installments, payments, treatment_plan FK) + Treatment Plan service + API routes
- [x] 04-02-PLAN.md -- Installment service + Payment service (D-09 auto-complete, D-11 budget status) + Financial Summary API
- [x] 04-03-PLAN.md -- Financial Tab UI (progress bars, budget detail panel, installment list, payment recorder, Recharts bars)

**UI hint**: yes

### Phase 5: Integration & Analytics
**Goal**: Users experience a seamlessly integrated CRM where calendar events link to contacts, and can access pipeline conversion analytics, financial reports, and LGPD compliance tools
**Depends on**: Phase 2, Phase 3, Phase 4
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04, CAL-05, REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, LGPD-02, LGPD-03
**Success Criteria** (what must be TRUE):
  1. User can book appointments directly from a contact profile or pipeline lead card, and calendar events are automatically linked to patient contacts
  2. User can view patient upcoming and past appointments in the contact profile and manage a waitlist that auto-fills cancelled slots
  3. User can view pipeline conversion rates by stage, average lead-to-patient conversion time, and identify inactive patients and upsell opportunities
  4. User can view financial reports (revenue, payments, outstanding) by period and export report data as CSV or PDF
  5. User can export all patient data in portable format (LGPD data portability) and process data deletion requests with anonymization and audit trail
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md -- Calendar-CRM linking: book from contact/lead, waitlist auto-fill, appointments tab
- [ ] 05-02-PLAN.md -- Analytics backend services: pipeline analytics + financial reports services
- [ ] 05-03-PLAN.md -- Analytics dashboards UI + LGPD export/anonymize dialogs

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 2.1 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Contacts | 6/6 | **COMPLETE** | 2026-04-24 |
| 2. Pipeline & Sales | 2/2 | **COMPLETE** | 2026-04-25 |
| 2.1 WhatsApp Lead Capture | 1/1 | **COMPLETE** | 2026-04-27 |
| 3. WhatsApp CRM | 3/3 | **COMPLETE** | 2026-04-25 |
| 4. Patient Records & Finance | 3/3 | **COMPLETE** | 2026-04-26 |
| 5. Integration & Analytics | 3/3 | **COMPLETE** | 2026-04-26 |

---
*Last updated: 2026-04-27*
