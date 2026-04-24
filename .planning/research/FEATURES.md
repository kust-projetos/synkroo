# Feature Research

**Domain:** CRM for Dental Clinics (Brazilian market)
**Researched:** 2026-04-24
**Confidence:** MEDIUM (Capterra data HIGH confidence; Brazilian market specifics MEDIUM due to limited source access)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a dental CRM. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Contact/Patient Management | Every dental CRM has patient records. Dentists need name, phone, email, CPF, birth date, notes. | LOW | **DB exists:** `patients` table has all fields. Need CRM-style list/detail UI with search, filters, tags. |
| Appointment Scheduling | Core of any dental practice. Patients expect to book, reschedule, cancel. | LOW | **DB exists:** `appointments` table. Calendar UI exists (Month/Week/Day views). Need tighter CRM integration (book from contact view). |
| Appointment Confirmations & Reminders | Reduces no-shows by 30% (iClinic data). Patients expect automated reminders. | MEDIUM | **DB exists:** `follow_ups`, `follow_up_configs`, `appointments.confirmation_sent_at`. Need WhatsApp reminder automation UI + scheduler. |
| Patient History / Timeline | Dentists need to see all past interactions: appointments, messages, notes, treatments. | MEDIUM | **DB exists:** `appointments`, `messages`, `conversations`, `lead_activities`. Need unified timeline view aggregating all interactions per patient. |
| WhatsApp Messaging | Brazil's primary communication channel. 100% of Brazilian dental CRMs offer this. | LOW | **DB exists:** `conversations`, `messages`, `whatsapp_instances`. WhatsApp bot exists. Need in-app messaging UI integrated with contact view. |
| Pipeline / Sales Funnel | Every CRM has a pipeline. Dental clinics track leads from first contact to conversion. | MEDIUM | **DB exists:** `leads` table with status pipeline (new > contacted > qualified > proposal > negotiation > converted > lost). Need Kanban board UI + drag-and-drop. |
| Lead Capture & Scoring | Clinics need to capture leads from WhatsApp, web, referrals and prioritize follow-up. | MEDIUM | **DB exists:** `leads` with score (0-100), temperature (cold/warm/hot), source tracking. Need lead capture form + scoring automation. |
| Search & Filters | Users need to find patients, leads, appointments by name, phone, status, date. | LOW | Supabase queries with indexes already exist. Need UI filter components (search bar, status filters, date range). |
| Procedure Catalog | Clinics need a list of procedures with prices and durations for scheduling and billing. | LOW | **DB exists:** `procedures` table with name, price, duration, category. Need CRUD UI. |
| Financial Overview (Cash Flow) | Clinic owners need to see revenue, expenses, pending payments. | MEDIUM | Dashboard with charts exists. Need per-patient financial history (budgets, paid/unpaid). |
| Multi-user / Role-based Access | Clinics have owners, admins, dentists, receptionists with different permissions. | LOW | **DB exists:** `users` with `user_role` enum. RLS policies exist. Need UI to manage team members. |

### Differentiators (Competitive Advantage)

Features that set Synkroo apart from generic dental software. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Deep Calendar-CRM Integration | Most dental CRMs treat calendar and CRM as separate modules. Synkroo has native drag-and-drop calendar deeply connected to contacts and pipeline. | MEDIUM | Calendar already exists with drag-and-drop. Need bidirectional links: book appointment from lead, convert lead when appointment confirmed. |
| Customizable Pipeline Stages | Brazilian competitors (iClinic, Feegow) have fixed pipelines. Let clinics customize stages per their sales process. | HIGH | **New DB needed:** `pipeline_stages` table (per clinic). Modify leads to use dynamic stages instead of hardcoded enum. |
| Modular Patient Records (Custom Fields) | Different specialties (orthodontics, implantology, aesthetics) need different data fields. Let clinics define custom fields. | HIGH | **New DB needed:** `custom_field_definitions`, `custom_field_values` tables. JSONB-based approach on patients.settings or separate EAV table. |
| Automated WhatsApp Campaigns | Reactivation campaigns, post-consultation follow-ups, birthday messages. Most competitors charge extra for this. | MEDIUM | **DB exists:** `campaigns`, `campaign_recipients`, `follow_up_configs`. Need campaign builder UI + scheduler + template editor. |
| Treatment Plans with Progress Tracking | Track multi-session treatments (orthodontics, implants) with visual progress. | MEDIUM | **DB exists:** `treatment_plans`, `treatment_plan_items`. Need visual timeline/progress bar UI linked to appointments. |
| Budget/Quote Management | Create and send treatment budgets via WhatsApp with approval workflow. | MEDIUM | **DB exists:** `budgets`, `budget_items`. Need budget builder UI + WhatsApp sharing + status tracking. |
| AI-Powered Lead Scoring | Auto-score leads based on engagement (messages sent, appointments made, campaign responses). | HIGH | `lead_activities` exists. Need scoring algorithm + integration with WhatsApp engagement data. Defer to post-MVP. |
| Interaction Timeline (Unified) | Single view showing all touchpoints: WhatsApp messages, appointments, calls, notes, budget responses. | MEDIUM | Data exists across tables. Need aggregated query + chronological timeline UI component. |
| No-show Prediction | Use patient risk_score + historical data to flag likely no-shows. | HIGH | `patient_risk_scores` and `calculate_patient_risk_score()` function exist. Need UI indicators on calendar/appointments. |
| Waitlist Management | When cancellations happen, auto-fill from waitlist. | LOW | **DB exists:** `waitlist` table. Need waitlist UI + auto-notification when slot opens. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly avoid these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full Electronic Health Records (Prontuario CFM/PEC) | Dentists ask for "complete patient records" | Requires CFM (Conselho Federal de Medicina) compliance, digital signature standards, interoperability (HL7/FHIR). Massive regulatory burden, multi-year effort. Out of scope per PROJECT.md. | Modular custom fields for clinical notes. Let clinics define what they need without normative compliance. |
| Claims/Insurance Management | Clinics deal with dental insurance (unim, odontosystem) | Every insurance has different formats, rules, and APIs. Brazil-specific TISS standard is complex. Derails CRM focus into billing software territory. | Track insurance info as custom field. Export data for external billing systems. |
| Dental Charting (Odontograma) | Visual tooth-by-tooth charting is standard in dental software | Requires specialized SVG/Canvas components, dental terminology (FDI numbering), procedure-to-tooth mapping. Extremely niche, high effort, low CRM value. | Record procedures with tooth numbers in notes/custom fields. Defer charting to dedicated dental software integration. |
| Dental Imaging / X-ray Viewer | Dentists take and store radiographs digitally | Requires DICOM viewer, PACS integration, massive storage costs. Completely different domain from CRM. | Store image URLs/references. Integrate with existing imaging software via links. |
| Multi-tenant Complex Organization | "I have 5 clinics and want centralized management" | Current schema supports single clinic per account. Multi-org adds: cross-clinic patient sharing, centralized billing, org-level admin. Complex RBAC explosion. | Keep single-clinic focus. Each clinic = separate account. Add data export/import for multi-clinic users. |
| Built-in Teleconsulta (Video Calls) | Post-COVID demand for remote consultations | Requires WebRTC infrastructure, recording consent, LGPD compliance for video. High infrastructure cost, low usage in dental (hands-on procedures). | Integrate with external video tools (Google Meet links in appointments). |
| Complex Workflow Automation Builder | "Let me create if-then rules like Zapier" | Visual automation builders are a product unto themselves. High complexity, most clinics never use advanced automations. | Pre-built automation templates (post-consultation follow-up, birthday message, reactivation campaign). Configurable delays and templates. |
| E-Prescribing (Receita Digital) | Digital prescriptions are convenient | Requires CFM integration, digital signature certificates (ICP-Brasil), pharmacy integration. Regulatory heavy. | Prescription templates as documents. Clinics can print/PDF. |
| Social Media Integration (Instagram DMs) | Clinics receive patient inquiries via Instagram | Instagram API has strict rate limits, approval process, and frequent breaking changes. Low ROI for CRM features. | Deferred per PROJECT.md. Add after CRM is stable. |

## Feature Dependencies

```
[Contact Management (patients)]
    |--required-by--> [Pipeline / Sales Funnel (leads)]
    |                       |--required-by--> [Lead Scoring Automation]
    |                       |--required-by--> [Custom Pipeline Stages]
    |
    |--required-by--> [Interaction Timeline]
    |                       |--enhances--> [Lead Scoring Automation]
    |
    |--required-by--> [Treatment Plans]
    |                       |--required-by--> [Budget/Quote Management]
    |
    |--required-by--> [Campaign Management]
    |                       |--enhances--> [Lead Scoring Automation]
    |
    |--required-by--> [Custom Fields (Modular Records)]

[WhatsApp Messaging]
    |--required-by--> [Campaign Management]
    |--required-by--> [Appointment Reminders]
    |--enhances--> [Interaction Timeline]

[Calendar / Appointments]
    |--required-by--> [Appointment Reminders]
    |--required-by--> [Treatment Plan Progress]
    |--enhances--> [Pipeline (lead-to-appointment conversion)]

[Custom Pipeline Stages]
    |--enhances--> [Pipeline / Sales Funnel]

[Custom Fields]
    |--enhances--> [Modular Patient Records]
    |--conflicts--> [Fixed schema migrations] (avoid frequent schema changes)

[Budget/Quote Management]
    |--requires--> [Procedure Catalog]
    |--enhances--> [Pipeline (budget sent = proposal stage)]
```

### Dependency Notes

- **Contact Management requires patients table:** Core entity that all CRM features link to. Already exists with proper schema and RLS.
- **Pipeline requires leads table:** Leads table already has status pipeline with activities. Custom stages add flexibility on top.
- **WhatsApp Messaging required by Campaigns:** Campaigns send via WhatsApp. Bot infrastructure exists; need campaign scheduler.
- **Calendar required by Reminders:** Reminders trigger based on appointment dates. Calendar + appointments already functional.
- **Custom Fields conflicts with Fixed Schema:** Avoid creating new columns per field. Use JSONB `metadata` on patients or a separate EAV table for extensibility without migrations.
- **Budget requires Procedure Catalog:** Budget items reference procedures for pricing. Procedures table exists with prices.

## MVP Definition

### Launch With (v1)

Minimum viable CRM -- what's needed to validate the product with pilot clinics.

- [ ] **Contact List & Detail View** -- Searchable patient list with detail page showing basic info + appointment history. Essential because dentists need to quickly find and view patients.
- [ ] **Pipeline Board (Kanban)** -- Visual sales pipeline using existing `leads` table stages. Drag-and-drop between stages. Essential because pipeline visibility is why clinics buy CRM software.
- [ ] **Lead Capture from WhatsApp** -- Auto-create leads when new WhatsApp contacts message the clinic. Essential because WhatsApp is the primary lead source for Brazilian dental clinics.
- [ ] **Appointment Reminders (WhatsApp)** -- Automated reminder messages before appointments. Essential because reducing no-shows is the #1 measurable ROI for clinics.
- [ ] **Interaction Timeline** -- Chronological view of all patient touchpoints (appointments, messages, notes). Essential because dentists need context before each consultation.

### Add After Validation (v1.x)

Features to add once core CRM is validated with pilot clinics.

- [ ] **Custom Pipeline Stages** -- Let clinics rename/reorder pipeline stages. Trigger: clinics asking for stages that match their specific workflow.
- [ ] **Custom Fields (Modular Records)** -- Let clinics add custom fields to patient records. Trigger: orthodontists/implantologists needing specialty-specific data.
- [ ] **Campaign Builder** -- Create and schedule WhatsApp campaigns (reactivation, birthday, follow-up). Trigger: clinics wanting proactive patient outreach.
- [ ] **Treatment Plans** -- Multi-session treatment tracking with progress visualization. Trigger: practices with ongoing treatments (orthodontics, implants).
- [ ] **Budget/Quote Management** -- Create treatment budgets and send via WhatsApp. Trigger: clinics needing formal quote process for expensive procedures.
- [ ] **Financial Dashboard Enhancements** -- Per-patient revenue tracking, pending payments, budget status. Trigger: clinic owners wanting financial visibility.
- [ ] **Waitlist Auto-fill** -- Auto-notify waitlisted patients when cancellations happen. Trigger: clinics with high demand wanting to fill gaps.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **AI Lead Scoring** -- Auto-score based on engagement data. Defer: needs sufficient historical data first.
- [ ] **No-show Prediction** -- Flag likely no-shows based on risk score. Defer: needs training data from actual usage.
- [ ] **Multi-clinic Dashboard** -- Centralized view for multi-location practices. Defer: single-clinic focus first.
- [ ] **API / Webhooks** -- Allow integrations with external systems (accounting, imaging). Defer: validate internal features first.
- [ ] **Instagram DM Integration** -- Capture leads from Instagram. Defer: per PROJECT.md, after CRM is stable.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Contact List & Detail View | HIGH | LOW (DB exists) | P1 |
| Pipeline Board (Kanban) | HIGH | MEDIUM (UI work) | P1 |
| Lead Capture from WhatsApp | HIGH | MEDIUM (bot integration) | P1 |
| Appointment Reminders (WhatsApp) | HIGH | MEDIUM (scheduler + templates) | P1 |
| Interaction Timeline | HIGH | MEDIUM (aggregation query) | P1 |
| Search & Filters | HIGH | LOW (indexes exist) | P1 |
| Custom Pipeline Stages | MEDIUM | HIGH (new table + UI) | P2 |
| Custom Fields | MEDIUM | HIGH (EAV or JSONB + UI builder) | P2 |
| Campaign Builder | MEDIUM | MEDIUM (DB exists, need UI) | P2 |
| Treatment Plans | MEDIUM | MEDIUM (DB exists, need UI) | P2 |
| Budget/Quote Management | MEDIUM | MEDIUM (DB exists, need UI) | P2 |
| Financial Enhancements | MEDIUM | MEDIUM | P2 |
| Waitlist Auto-fill | LOW | LOW (DB exists) | P2 |
| AI Lead Scoring | LOW | HIGH | P3 |
| No-show Prediction | LOW | HIGH | P3 |
| Multi-clinic Dashboard | LOW | HIGH | P3 |
| API / Webhooks | LOW | MEDIUM | P3 |
| Instagram DM | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for CRM launch
- P2: Should have, add when possible (post-MVP validation)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | iClinic (BR) | Dentrix (US) | Synkroo Approach |
|---------|--------------|--------------|------------------|
| Calendar/Scheduling | Full agenda with colors per procedure, waitlist, recurring bookings | Full practice management with operatories | Existing calendar (Month/Week/Day + drag-and-drop). Add procedure colors and waitlist integration. |
| Patient Records | Customizable prontuario, CID-10, document templates, digital signature | Full EMR with charting, imaging, perio charting | Modular custom fields (not normative EMR). Focus on CRM data, not clinical records. |
| Reminders | SMS, email, WhatsApp confirmations. Auto-status change on patient response. | SMS, email confirmations. Patient portal. | WhatsApp-first reminders (Brazil's primary channel). Auto-update appointment status on reply. |
| Pipeline/Sales | Not a focus -- primarily clinical/practice management | Limited -- focused on scheduling and clinical | CRM-native pipeline with Kanban board. Lead scoring. Conversion tracking. This is our differentiator. |
| Campaigns | Email marketing campaigns, not WhatsApp | Patient engagement tools (reviews, recall) | WhatsApp campaigns with templates, scheduling, response tracking. |
| Financial | In-app billing, payment tracking, per-appointment revenue | Full billing, insurance claims, ERA/EOB | Budget/quote management + basic cash flow. No insurance claims processing. |
| WhatsApp | SMS/email confirmations only (basic WhatsApp) | Not common in US market | Deep WhatsApp integration: messaging, bots, campaigns, lead capture. Core differentiator in Brazilian market. |
| Mobile | Web-based, responsive | Desktop-first, some cloud | Web-based (Next.js PWA potential). Mobile-responsive. |

### Key Competitive Insights

1. **Brazilian market is WhatsApp-first.** iClinic charges extra for WhatsApp confirmations. Synkroo has native WhatsApp from day one. This is the biggest competitive advantage.

2. **No Brazilian dental CRM has a true sales pipeline.** iClinic, Feegow, and Simples Dental focus on clinical/practice management. None offer Kanban-style lead management. This gap is Synkroo's opportunity.

3. **Modular records beat monolithic EMR.** Building a full prontuario eletronico is a multi-year regulatory project. Custom fields let clinics define what they need without compliance overhead.

4. **Pricing in Brazilian market: R$99-R$299/month.** iClinic ranges from R$99 (Starter) to R$299 (Premium). Synkroo should target the R$149-R$249 range, justifying the CRM pipeline features that competitors lack.

## Sources

- **Capterra Dental Software Directory** (193 products analyzed, January 2026) -- https://www.capterra.com/dental-software/ -- HIGH confidence
- **iClinic Features Page** (Brazilian medical software, Afya group) -- https://www.iclinic.com.br/recursos -- HIGH confidence
- **Capterra Dental Buyers Guide** -- Typical features: appointment management, charting, claims, reminders, HIPAA compliance, imaging, patient records, scheduling, treatment planning -- HIGH confidence
- **Existing database schema analysis** -- 24 migration files analyzed showing complete data model -- HIGH confidence
- **Simples Dental** -- https://www.simplesdental.com/recursos -- NOT accessible (404 error) -- NO confidence
- **Doctoralia** -- https://www.doctoralia.com.br -- NOT accessible (404 error on software page) -- NO confidence
- **Brazilian dental CRM market analysis** -- WebSearch API unavailable, limited to accessible pages -- LOW confidence for market sizing

---
*Feature research for: Dental Clinic CRM (Synkroo)*
*Researched: 2026-04-24*
