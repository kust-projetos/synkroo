# Roadmap: Synkroo CRM (v0.2.0)

## Overview

Transform Synkroo from a calendar/WhatsApp app into a complete CRM for dental clinics. The journey starts with database foundation fixes (RLS consolidation, pipeline_stages, LGPD consent), then delivers contacts and pipeline as the first user-facing CRM features, followed by WhatsApp integration, patient records with finance, and finally cross-module analytics with LGPD compliance. Each phase delivers a coherent, verifiable capability that builds on the previous one.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Existing UI Baseline:** Dashboard already has pages for leads, pacientes, campanhas, conversas, lista-espera, dentistas, procedimentos. Phases 1-3 are EXTEND/REFACTOR, not greenfield builds.

- [ ] **Phase 1: Foundation & Contacts** - RLS consolidation (5 fix migrations), schema additions (pipeline_stages, custom fields, consent), expand existing pacientes/leads pages with search, filters, tags, custom fields, and interaction timeline
- [ ] **Phase 2: Pipeline & Sales** - Kanban board with drag-and-drop (@hello-pangea/dnd), custom pipeline stages, expand existing leads page with scoring and lead-to-patient conversion
- [ ] **Phase 3: WhatsApp CRM** - Expand existing conversas page with in-app messaging, expand existing campanhas page with reminders, templates, and campaign scheduling
- [ ] **Phase 4: Patient Records & Finance** - Treatment plans with progress tracking, budgets with itemized procedures, payment plans, financial summary per patient
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
**Plans**: TBD

**UI hint**: yes

### Phase 2: Pipeline & Sales
**Goal**: Users can manage their sales pipeline visually with a customizable Kanban board, tracking leads from first contact to conversion with scoring and stage management
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08
**Success Criteria** (what must be TRUE):
  1. User can view leads in a Kanban board organized by customizable pipeline stages and drag-and-drop leads between stages
  2. User can create, edit, reorder, and delete pipeline stages with a default odontologia template seeded for new clinics
  3. User can create leads manually with source tracking and see leads automatically captured from WhatsApp conversations
  4. User can see a lead score calculated from interactions and convert a lead to active patient when an appointment is confirmed
**Plans**: TBD

**UI hint**: yes

### Phase 3: WhatsApp CRM
**Goal**: Users can communicate with contacts via WhatsApp directly from the CRM, with automated appointment reminders and scheduled marketing campaigns
**Depends on**: Phase 1 (contacts needed for messaging context)
**Requirements**: WHATS-01, WHATS-02, WHATS-03, WHATS-04, WHATS-05, WHATS-06, WHATS-07
**Success Criteria** (what must be TRUE):
  1. User can view WhatsApp conversation history within a contact profile and send messages directly from the CRM
  2. User can configure automatic appointment reminders with customizable timing and message templates containing variable placeholders (name, date, time)
  3. User can see reminder delivery status (sent, delivered, read) for each appointment
  4. User can create WhatsApp campaigns (reactivation, follow-up, birthday), schedule them, and track delivery metrics
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Contacts | 0/TBD | Not started | - |
| 2. Pipeline & Sales | 0/TBD | Not started | - |
| 3. WhatsApp CRM | 0/TBD | Not started | - |
| 4. Patient Records & Finance | 0/TBD | Not started | - |
| 5. Integration & Analytics | 0/TBD | Not started | - |
