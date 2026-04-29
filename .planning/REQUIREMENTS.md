# Requirements: Synkroo CRM

**Defined:** 2026-04-24
**Core Value:** Clínicas conseguem gerenciar todo o relacionamento com pacientes — do primeiro contato à fidelização — em um único sistema integrado com WhatsApp e calendário.

## v1 Requirements

Requirements for milestone v0.2.0. Each maps to roadmap phases.

### Contacts (CONT)

- [x] **CONT-01**: User can view list of all contacts (patients + leads) with search and filters
- [x] **CONT-02**: User can view detailed contact profile with personal info (name, phone, email, CPF, birth date, notes)
- [x] **CONT-03**: User can create, edit, and archive contacts
- [x] **CONT-04**: User can tag contacts with custom categories
- [x] **CONT-05**: User can view unified interaction timeline per contact (appointments, messages, notes, treatments)
- [x] **CONT-06**: User can add notes to any contact

### Custom Fields (CF)

- [x] **CF-01**: User can define custom field definitions per specialty (text, number, date, select, checkbox)
- [x] **CF-02**: User can fill custom fields on contact profiles
- [x] **CF-03**: User can search and filter contacts by custom field values
- [x] **CF-04**: User can import/export custom field templates per specialty

### Pipeline (PIPE)

- [x] **PIPE-01**: User can view leads in Kanban board organized by pipeline stages
- [x] **PIPE-02**: User can drag-and-drop leads between pipeline stages
- [x] **PIPE-03**: User can create, edit, reorder, and delete pipeline stages (per clinic)
- [x] **PIPE-04**: User can set default pipeline stage templates (odontologia baseline)
- [ ] **PIPE-05**: User can capture leads from WhatsApp conversations automatically
- [x] **PIPE-06**: User can create leads manually with contact info and source tracking
- [x] **PIPE-07**: User can see lead score calculated from interactions and activities
- [x] **PIPE-08**: User can convert a lead to active patient when appointment is confirmed

### WhatsApp (WHATS)

- [x] **WHATS-01**: User can view WhatsApp conversation history within contact profile
- [x] **WHATS-02**: User can send WhatsApp messages directly from CRM contact view
- [x] **WHATS-03**: User can configure automatic appointment reminders (timing, message template)
- [x] **WHATS-04**: User can see reminder delivery status (sent, delivered, read)
- [x] **WHATS-05**: User can create WhatsApp campaign (reactivation, follow-up, birthday)
- [x] **WHATS-06**: User can define message templates with variable placeholders (name, date, time)
- [x] **WHATS-07**: User can schedule campaigns and track delivery metrics

### Patient Records (PRONT)

- [x] **PRONT-01**: User can create multi-session treatment plans for patients
- [x] **PRONT-02**: User can track treatment plan progress (sessions completed vs remaining)
- [x] **PRONT-03**: User can create treatment budgets with itemized procedures and costs
- [x] **PRONT-04**: User can define payment plans (installments, due dates)
- [x] **PRONT-05**: User can record payments and track outstanding balances
- [x] **PRONT-06**: User can view basic financial summary per patient (total billed, paid, owed)

### Calendar Integration (CAL)

- [x] **CAL-01**: User can book appointment directly from contact profile
- [x] **CAL-02**: User can book appointment from pipeline lead card
- [x] **CAL-03**: Calendar events are automatically linked to patient contacts
- [x] **CAL-04**: User can view patient upcoming and past appointments in contact profile
- [x] **CAL-05**: User can manage waitlist and auto-fill cancelled appointment slots

### Reports & Analytics (REPORT)

- [x] **REPORT-01**: User can view pipeline conversion rates by stage
- [x] **REPORT-02**: User can view average lead-to-patient conversion time
- [x] **REPORT-03**: User can identify inactive patients (no visits in X days)
- [x] **REPORT-04**: User can see upsell/upgrade opportunities based on treatment history
- [x] **REPORT-05**: User can view financial reports (revenue, payments, outstanding) by period
- [x] **REPORT-06**: User can export report data (CSV/PDF)

### LGPD Compliance (LGPD)

- [x] **LGPD-01**: User can record patient consent (data collection, marketing, WhatsApp communication)
- [x] **LGPD-02**: User can export all patient data in portable format (full data export)
- [x] **LGPD-03**: User can process data deletion requests (anonymization with audit trail)
- [x] **LGPD-04**: System maintains audit log of consent changes

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Multi-Clinic

- **MULTI-01**: User can manage multiple clinic locations with shared or separate pipelines
- **MULTI-02**: User can transfer patients between clinic locations
- **MULTI-03**: Admin can manage staff access per clinic with role-based permissions

### Patient Portal

- **PORTAL-01**: Patient can view own appointments and treatment plans
- **PORTAL-02**: Patient can request appointment rescheduling
- **PORTAL-03**: Patient can download own treatment documents

### AI Features

- **AI-01**: System suggests optimal follow-up timing based on patient behavior patterns
- **AI-02**: System predicts no-show risk for upcoming appointments
- **AI-03**: System generates personalized campaign messages

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full Electronic Health Records (Prontuario CFM/PEC) | Requires CFM compliance, digital signature, HL7/FHIR interoperability — multi-year regulatory project |
| Dental Charting (Odontograma) | Clinical feature requiring specialized UI and dental terminology — different product category |
| Insurance Claims Processing | Insurance integration is complex domain with payer-specific rules — different product category |
| DICOM Imaging Integration | Requires specialized infrastructure for medical imaging storage and viewing |
| Instagram Integration | Future feature after CRM is stable — requires Meta API integration |
| Call Center Integration | Future feature — depends on voice infrastructure |
| Agent SDK (AI Agents) | Future feature — depends on CRM + structured data being available first |
| Payment Gateway (Pix/Credit Card) | Financial processing requires PCI compliance — integrate with existing providers later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1: Foundation & Contacts | Complete |
| CONT-02 | Phase 1: Foundation & Contacts | Complete |
| CONT-03 | Phase 1: Foundation & Contacts | Complete |
| CONT-04 | Phase 1: Foundation & Contacts | Complete |
| CONT-05 | Phase 1: Foundation & Contacts | Complete |
| CONT-06 | Phase 1: Foundation & Contacts | Complete |
| CF-01 | Phase 1: Foundation & Contacts | Complete |
| CF-02 | Phase 1: Foundation & Contacts | Complete |
| CF-03 | Phase 1: Foundation & Contacts | Complete |
| CF-04 | Phase 1: Foundation & Contacts | Complete |
| LGPD-01 | Phase 1: Foundation & Contacts | Complete |
| LGPD-04 | Phase 1: Foundation & Contacts | Complete |
| PIPE-01 | Phase 2: Pipeline & Sales | Complete |
| PIPE-02 | Phase 2: Pipeline & Sales | Complete |
| PIPE-03 | Phase 2: Pipeline & Sales | Complete |
| PIPE-04 | Phase 2: Pipeline & Sales | Complete |
| PIPE-05 | Phase 2: Pipeline & Sales | Deferred to Phase 3 |
| PIPE-06 | Phase 2: Pipeline & Sales | Complete |
| PIPE-07 | Phase 2: Pipeline & Sales | Complete |
| PIPE-08 | Phase 2: Pipeline & Sales | Complete |
| WHATS-01 | Phase 3: WhatsApp CRM | Complete |
| WHATS-02 | Phase 3: WhatsApp CRM | Complete |
| WHATS-03 | Phase 3: WhatsApp CRM | Complete |
| WHATS-04 | Phase 3: WhatsApp CRM | Complete |
| WHATS-05 | Phase 3: WhatsApp CRM | Complete |
| WHATS-06 | Phase 3: WhatsApp CRM | Complete |
| WHATS-07 | Phase 3: WhatsApp CRM | Complete |
| PRONT-01 | Phase 4: Patient Records & Finance | Complete |
| PRONT-02 | Phase 4: Patient Records & Finance | Complete |
| PRONT-03 | Phase 4: Patient Records & Finance | Complete |
| PRONT-04 | Phase 4: Patient Records & Finance | Complete |
| PRONT-05 | Phase 4: Patient Records & Finance | Complete |
| PRONT-06 | Phase 4: Patient Records & Finance | Complete |
| CAL-01 | Phase 5: Integration & Analytics | Complete |
| CAL-02 | Phase 5: Integration & Analytics | Complete |
| CAL-03 | Phase 5: Integration & Analytics | Complete |
| CAL-04 | Phase 5: Integration & Analytics | Complete |
| CAL-05 | Phase 5: Integration & Analytics | Complete |
| REPORT-01 | Phase 5: Integration & Analytics | Complete |
| REPORT-02 | Phase 5: Integration & Analytics | Complete |
| REPORT-03 | Phase 5: Integration & Analytics | Complete |
| REPORT-04 | Phase 5: Integration & Analytics | Complete |
| REPORT-05 | Phase 5: Integration & Analytics | Complete |
| REPORT-06 | Phase 5: Integration & Analytics | Complete |
| LGPD-02 | Phase 5: Integration & Analytics | Complete |
| LGPD-03 | Phase 5: Integration & Analytics | Complete |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Complete: 39
- Deferred: 1 (PIPE-05 → Phase 3)

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-27 after v0.2.0 milestone completion*
