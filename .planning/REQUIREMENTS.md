# Requirements: Synkroo CRM

**Defined:** 2026-04-24
**Core Value:** Clínicas conseguem gerenciar todo o relacionamento com pacientes — do primeiro contato à fidelização — em um único sistema integrado com WhatsApp e calendário.

## v1 Requirements

Requirements for milestone v0.2.0. Each maps to roadmap phases.

### Contacts (CONT)

- [ ] **CONT-01**: User can view list of all contacts (patients + leads) with search and filters
- [ ] **CONT-02**: User can view detailed contact profile with personal info (name, phone, email, CPF, birth date, notes)
- [ ] **CONT-03**: User can create, edit, and archive contacts
- [ ] **CONT-04**: User can tag contacts with custom categories
- [ ] **CONT-05**: User can view unified interaction timeline per contact (appointments, messages, notes, treatments)
- [ ] **CONT-06**: User can add notes to any contact

### Custom Fields (CF)

- [ ] **CF-01**: User can define custom field definitions per specialty (text, number, date, select, checkbox)
- [ ] **CF-02**: User can fill custom fields on contact profiles
- [ ] **CF-03**: User can search and filter contacts by custom field values
- [ ] **CF-04**: User can import/export custom field templates per specialty

### Pipeline (PIPE)

- [ ] **PIPE-01**: User can view leads in Kanban board organized by pipeline stages
- [ ] **PIPE-02**: User can drag-and-drop leads between pipeline stages
- [ ] **PIPE-03**: User can create, edit, reorder, and delete pipeline stages (per clinic)
- [ ] **PIPE-04**: User can set default pipeline stage templates (odontologia baseline)
- [ ] **PIPE-05**: User can capture leads from WhatsApp conversations automatically
- [ ] **PIPE-06**: User can create leads manually with contact info and source tracking
- [ ] **PIPE-07**: User can see lead score calculated from interactions and activities
- [ ] **PIPE-08**: User can convert a lead to active patient when appointment is confirmed

### WhatsApp (WHATS)

- [ ] **WHATS-01**: User can view WhatsApp conversation history within contact profile
- [ ] **WHATS-02**: User can send WhatsApp messages directly from CRM contact view
- [ ] **WHATS-03**: User can configure automatic appointment reminders (timing, message template)
- [ ] **WHATS-04**: User can see reminder delivery status (sent, delivered, read)
- [ ] **WHATS-05**: User can create WhatsApp campaign (reactivation, follow-up, birthday)
- [ ] **WHATS-06**: User can define message templates with variable placeholders (name, date, time)
- [ ] **WHATS-07**: User can schedule campaigns and track delivery metrics

### Patient Records (PRONT)

- [ ] **PRONT-01**: User can create multi-session treatment plans for patients
- [ ] **PRONT-02**: User can track treatment plan progress (sessions completed vs remaining)
- [ ] **PRONT-03**: User can create treatment budgets with itemized procedures and costs
- [ ] **PRONT-04**: User can define payment plans (installments, due dates)
- [ ] **PRONT-05**: User can record payments and track outstanding balances
- [ ] **PRONT-06**: User can view basic financial summary per patient (total billed, paid, owed)

### Calendar Integration (CAL)

- [ ] **CAL-01**: User can book appointment directly from contact profile
- [ ] **CAL-02**: User can book appointment from pipeline lead card
- [ ] **CAL-03**: Calendar events are automatically linked to patient contacts
- [ ] **CAL-04**: User can view patient upcoming and past appointments in contact profile
- [ ] **CAL-05**: User can manage waitlist and auto-fill cancelled appointment slots

### Reports & Analytics (REPORT)

- [ ] **REPORT-01**: User can view pipeline conversion rates by stage
- [ ] **REPORT-02**: User can view average lead-to-patient conversion time
- [ ] **REPORT-03**: User can identify inactive patients (no visits in X days)
- [ ] **REPORT-04**: User can see upsell/upgrade opportunities based on treatment history
- [ ] **REPORT-05**: User can view financial reports (revenue, payments, outstanding) by period
- [ ] **REPORT-06**: User can export report data (CSV/PDF)

### LGPD Compliance (LGPD)

- [ ] **LGPD-01**: User can record patient consent (data collection, marketing, WhatsApp communication)
- [ ] **LGPD-02**: User can export all patient data in portable format (full data export)
- [ ] **LGPD-03**: User can process data deletion requests (anonymization with audit trail)
- [ ] **LGPD-04**: System maintains audit log of consent changes

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
| CONT-01 | Phase 1: Foundation & Contacts | Pending |
| CONT-02 | Phase 1: Foundation & Contacts | Pending |
| CONT-03 | Phase 1: Foundation & Contacts | Pending |
| CONT-04 | Phase 1: Foundation & Contacts | Pending |
| CONT-05 | Phase 1: Foundation & Contacts | Pending |
| CONT-06 | Phase 1: Foundation & Contacts | Pending |
| CF-01 | Phase 1: Foundation & Contacts | Pending |
| CF-02 | Phase 1: Foundation & Contacts | Pending |
| CF-03 | Phase 1: Foundation & Contacts | Pending |
| CF-04 | Phase 1: Foundation & Contacts | Pending |
| LGPD-01 | Phase 1: Foundation & Contacts | Pending |
| LGPD-04 | Phase 1: Foundation & Contacts | Pending |
| PIPE-01 | Phase 2: Pipeline & Sales | Pending |
| PIPE-02 | Phase 2: Pipeline & Sales | Pending |
| PIPE-03 | Phase 2: Pipeline & Sales | Pending |
| PIPE-04 | Phase 2: Pipeline & Sales | Pending |
| PIPE-05 | Phase 2: Pipeline & Sales | Pending |
| PIPE-06 | Phase 2: Pipeline & Sales | Pending |
| PIPE-07 | Phase 2: Pipeline & Sales | Pending |
| PIPE-08 | Phase 2: Pipeline & Sales | Pending |
| WHATS-01 | Phase 3: WhatsApp CRM | Pending |
| WHATS-02 | Phase 3: WhatsApp CRM | Pending |
| WHATS-03 | Phase 3: WhatsApp CRM | Pending |
| WHATS-04 | Phase 3: WhatsApp CRM | Pending |
| WHATS-05 | Phase 3: WhatsApp CRM | Pending |
| WHATS-06 | Phase 3: WhatsApp CRM | Pending |
| WHATS-07 | Phase 3: WhatsApp CRM | Pending |
| PRONT-01 | Phase 4: Patient Records & Finance | Pending |
| PRONT-02 | Phase 4: Patient Records & Finance | Pending |
| PRONT-03 | Phase 4: Patient Records & Finance | Pending |
| PRONT-04 | Phase 4: Patient Records & Finance | Pending |
| PRONT-05 | Phase 4: Patient Records & Finance | Pending |
| PRONT-06 | Phase 4: Patient Records & Finance | Pending |
| CAL-01 | Phase 5: Integration & Analytics | Pending |
| CAL-02 | Phase 5: Integration & Analytics | Pending |
| CAL-03 | Phase 5: Integration & Analytics | Pending |
| CAL-04 | Phase 5: Integration & Analytics | Pending |
| CAL-05 | Phase 5: Integration & Analytics | Pending |
| REPORT-01 | Phase 5: Integration & Analytics | Pending |
| REPORT-02 | Phase 5: Integration & Analytics | Pending |
| REPORT-03 | Phase 5: Integration & Analytics | Pending |
| REPORT-04 | Phase 5: Integration & Analytics | Pending |
| REPORT-05 | Phase 5: Integration & Analytics | Pending |
| REPORT-06 | Phase 5: Integration & Analytics | Pending |
| LGPD-02 | Phase 5: Integration & Analytics | Pending |
| LGPD-03 | Phase 5: Integration & Analytics | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after roadmap creation*
