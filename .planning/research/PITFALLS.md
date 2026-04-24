# Pitfalls Research

**Domain:** Adding CRM features to an existing Next.js 15 + Supabase calendar/dental clinic app
**Researched:** 2026-04-24
**Confidence:** HIGH (codebase-verified RLS issues, Context7-verified Supabase docs, Evolution API docs)

## Critical Pitfalls

### Pitfall 1: RLS Policy Recursion and Performance Death Spiral

**What goes wrong:**
Adding CRM tables (contacts, pipeline, interactions, custom fields) multiplies the number of RLS policies. Each policy that queries the `users` table to resolve `clinic_id` creates a recursive loop. The codebase already has FOUR migration files fixing RLS recursion (`fix_rls_recursion`, `fix_all_rls`, `fix_rls_v2`, `fix_broken_rls`). Adding 10+ new CRM tables will make this catastrophic.

The `lead_activities` table already has RLS policies with 3-level nested subqueries:
```sql
-- Current leads RLS (subquery per row):
USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))

-- Current lead_activities RLS (triple nested!):
USING (lead_id IN (SELECT id FROM public.leads WHERE clinic_id IN
  (SELECT clinic_id FROM public.users WHERE id = auth.uid())))
```

Per Supabase docs (Context7-verified), join-based RLS policies can cause 9000ms queries vs 20ms with optimized IN clauses. The project also has TWO competing helper functions doing the same thing (`get_current_clinic_id` and `get_user_clinic`), which is a maintenance trap.

**Why it happens:**
Each new CRM table needs clinic-scoped access. Developers copy the pattern from existing tables without considering that every subquery runs per-row during RLS evaluation. The recursion is invisible in dev with 5 rows but kills performance at scale.

**How to avoid:**
1. Consolidate to ONE helper function: `get_user_clinic(UUID)` (already has `SECURITY DEFINER`, `STABLE`, `SET search_path`)
2. Drop `get_current_clinic_id()` -- it is redundant
3. Use `(SELECT get_user_clinic(auth.uid()))` pattern (wraps in SELECT for initPlan caching, per Supabase docs)
4. For child tables (like `lead_activities`), denormalize `clinic_id` into the table rather than joining through parent
5. Create a policy template and enforce it via code review

**Warning signs:**
- Queries that took 50ms suddenly take 2-5 seconds when you add 1000+ contacts
- `lead_activities` queries timing out when leads exceed 500 rows
- Multiple migration files with names like "fix_rls_*" (already present: 4 files)
- Two functions doing the same thing (`get_current_clinic_id` vs `get_user_clinic`)

**Phase to address:**
Phase 1 (Foundation) -- Before adding ANY new CRM tables. Consolidate RLS helper functions, establish the denormalized `clinic_id` pattern, and create a policy template. This is a prerequisite, not a "we will fix it later" item.

---

### Pitfall 2: Hardcoded Pipeline Status vs. Customizable Funnel

**What goes wrong:**
The leads table already has pipeline status as a hardcoded CHECK constraint:
```sql
status VARCHAR(20) DEFAULT 'new' CHECK (status IN
  ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'))
```
PROJECT.md explicitly requires "Pipeline de vendas com funil customizavel" and "Cada tipo de clinica tem etapas diferentes no pipeline." The current schema cannot deliver this. If you ship with hardcoded statuses, you will need a destructive migration to fix it later, breaking existing data.

**Why it happens:**
Hardcoded enums feel simpler to build initially. The CHECK constraint provides free validation. Developers underestimate how quickly clinics will request custom stages ("triagem", "retorno", "orcamento aprovado", etc.).

**How to avoid:**
1. Create a `pipeline_stages` table with `clinic_id`, `name`, `position`, `color`, `is_default`
2. Seed default stages per clinic during onboarding
3. Change `leads.status` to reference `pipeline_stages.id` or use a `stage_id UUID` FK
4. Keep a `system_stage` column for semantic meaning (new/converted/lost) but make display stages configurable
5. Build stage management UI as part of the pipeline feature, not as an afterthought

**Warning signs:**
- Feature requests for "can we rename the 'proposal' stage?" or "can we add 'aguardando documento'?"
- Conditional logic multiplying around specific status strings in frontend code
- Adding `IF status = 'negotiation'` checks scattered across services

**Phase to address:**
Phase 1 (Foundation) -- The pipeline_stages table must be created alongside or before the pipeline UI. Changing this later requires data migration on potentially thousands of leads.

---

### Pitfall 3: LGPD Compliance Gaps with Patient Data

**What goes wrong:**
The `patients` table already stores CPF (Brazilian national ID), phone, email, birth_date, and address. CRM features will add interaction history, lead scoring, conversation logs, and potentially treatment notes. Under LGPD (Lei Geral de Protecao de Dados), this is "dados pessoais sensíveis" for health data, requiring:
- Explicit consent per purpose (marketing vs. treatment)
- Data portability (export all patient data)
- Right to deletion ("direito ao esquecimento")
- Data minimization (only collect what is needed)
- breach notification within 72 hours
- Records of processing activities

Dental clinics are high-risk under LGPD because they process health data (special category under Art. 5, II). The ANS (Agencia Nacional de Saude Suplementar) and ANPD (Autoridade Nacional de Protecao de Dados) can impose fines up to 2% of revenue (capped at R$50 million per infraction).

**Why it happens:**
LGPD is treated as a "legal will handle it" concern rather than an engineering constraint. Developers add fields without consent tracking. WhatsApp conversations containing health information are stored without proper retention policies. The `deleted_at` soft-delete pattern is present but there is no cascading anonymization.

**How to avoid:**
1. Add a `consents` table: `patient_id`, `purpose` (marketing, treatment, communication), `granted_at`, `revoked_at`, `channel`
2. Implement data export endpoint early (LGPD Art. 18, V) -- JSON export of all patient data
3. Implement anonymization (not just soft-delete) for "right to be forgotten" requests
4. Add retention policies to conversation_logs and lead_activities (auto-anonymize after N days)
5. Audit WhatsApp message storage -- conversations containing health data need special handling
6. Add `lgpd_consent_required` flag to any CRM feature that sends marketing messages
7. Log all data access events for the "records of processing activities" requirement

**Warning signs:**
- Sending WhatsApp marketing messages without consent records
- No way to export all data for a specific patient
- Soft-deleted patients still referenced in reports/analytics
- Conversations stored indefinitely without retention policy

**Phase to address:**
Phase 1 (Foundation) -- Consent table and data export must exist BEFORE any CRM feature ships. Anonymization can be Phase 2, but consent tracking is non-negotiable for launch.

---

### Pitfall 4: WhatsApp Integration Brittleness with Evolution API

**What goes wrong:**
The app uses Evolution API (unofficial WhatsApp API based on Baileys), not the official WhatsApp Business API. This brings critical risks:
- **Session invalidation**: WhatsApp can invalidate sessions at any time, requiring re-scan. No warning.
- **Rate limiting/blacklisting**: Unofficial APIs have no guaranteed rate limits. Sending bulk CRM messages (reminders, campaigns) can get the clinic's number banned.
- **No message templates**: Official API has pre-approved message templates. Evolution API sends raw messages, risking spam flags.
- **Webhook reliability**: Evolution API webhooks can drop events. If a WhatsApp message is missed, the CRM interaction history becomes incomplete.
- **Multi-device session conflicts**: If a clinic staff member uses WhatsApp Web simultaneously, the Evolution API session can disconnect.

The codebase has a `campaigns` table referenced by `leads.campaign_id`, suggesting bulk messaging is planned. This is the highest-risk feature with an unofficial API.

**Why it happens:**
Evolution API works perfectly in development with 1-2 test messages. Problems only emerge at scale (50+ contacts, bulk reminders, campaigns). The unofficial API has no SLA, no support channel, and Meta can change the protocol without notice.

**How to avoid:**
1. Implement robust session health monitoring (check connection status every 5 minutes, alert on disconnect)
2. Add message queue with retry logic (don't send directly from webhook handler)
3. Rate-limit outbound messages (max 5/minute for individual, 1/minute for bulk)
4. Store message status as a state machine: queued -> sending -> sent -> delivered -> read -> failed
5. Design the campaign system to be provider-agnostic (abstract behind a `MessageProvider` interface) so you can migrate to official API later
6. Never auto-retry failed messages more than 3 times -- flag for manual review
7. Add "session disconnected" alert to the dashboard UI

**Warning signs:**
- Messages silently failing without error feedback
- Campaign sends that show "sent" but contacts never received them
- Session requiring QR re-scan more than once per week
- Webhook events arriving out of order or with duplicate message IDs

**Phase to address:**
Phase 2 (WhatsApp CRM integration) -- Message queue and status tracking must exist before any bulk messaging. Session monitoring should be Phase 1 since it protects existing calendar reminders.

---

### Pitfall 5: Over-Engineering Custom Fields (Prontuario Modular)

**What goes wrong:**
PROJECT.md requires "Prontuario modular com campos customizaveis." The classic over-engineering trap is to build an EAV (Entity-Attribute-Value) system or a full JSONB schema with dynamic validation. This leads to:
- Impossible-to-query patient records ("find all patients allergic to latex")
- No type safety on custom fields
- Complex form rendering logic that breaks with edge cases
- Performance degradation as JSONB documents grow large
- Reports that cannot aggregate over custom fields

**Why it happens:**
"Customizable fields" sounds like it needs a generic dynamic system. Developers reach for JSONB or EAV before understanding what dental clinics actually need. The reality is that 80% of dental clinics need the same 15-20 fields with maybe 5 clinic-specific additions.

**How to avoid:**
1. Start with a well-defined core schema for dental patient records (medical history, allergies, medications, previous treatments)
2. Use a structured JSONB column (`custom_fields JSONB`) for clinic-specific additions ONLY, not for core data
3. Build a "field registry" table that defines available custom fields per clinic with types, validation rules, and display order
4. Keep the most common query fields as real columns (allergies, medications, emergency contact)
5. Do NOT build a generic EAV system. If a clinic needs a field badly enough, add it as a real column.

**Warning signs:**
- Custom field system taking more than 2 weeks to build
- Query patterns like `SELECT * FROM patients WHERE custom_fields->>'allergy' = 'latex'`
- Form builder UI being built before any dental professional has specified what fields they need
- More than 3 levels of JSONB nesting

**Phase to address:**
Phase 2 (Patient Records) -- Core schema first, custom fields as additive. Do not start with the field registry; start with the hard-coded dental fields and add configurability only when real clinics request it.

---

### Pitfall 6: Scope Creep Through Pipeline Customization

**What goes wrong:**
"Funil customizavel" opens the door to building a generic workflow engine. Before long, you are building:
- Conditional stage transitions ("can only move to 'negotiation' if 'proposal' was sent")
- Automation triggers per stage ("when lead moves to 'hot', send WhatsApp")
- Assignment rules ("auto-assign leads from Instagram to receptionist")
- Stage-specific forms and required fields
- Audit trail for stage changes

Each of these is a significant feature. Building them all at once ensures none work well.

**Why it happens:**
The line between "customizable pipeline" and "workflow engine" is blurry. Once users see drag-and-drop stages, they expect drag-and-drop rules. Each request feels small in isolation but compounds into a full workflow builder.

**How to avoid:**
1. MVP pipeline: drag stages to reorder, rename stages, add/remove stages. Period.
2. Defer automation triggers to a dedicated "Automations" phase
3. Defer conditional transitions until users explicitly request them
4. Defer assignment rules to a dedicated feature
5. Track stage changes in `lead_activities` (already exists) for future audit trail

**Warning signs:**
- Pipeline PR touching more than 5 files
- Feature requests for "if/then" logic on stage transitions in MVP
- Spending more time on pipeline configuration UI than on pipeline usage
- Building a rule engine before validating that clinics need conditional transitions

**Phase to address:**
Phase 1 (Pipeline MVP) -- Strictly limit to stage CRUD + drag reorder + visual funnel. Document deferred features explicitly in PROJECT.md Out of Scope.

---

### Pitfall 7: Migration Conflicts with Existing Production Data

**What goes wrong:**
The database already has 19 migration files. Tables `events`, `patients`, `users`, `leads`, `appointments`, `dentists` exist with data. Adding CRM features requires:
- Altering existing tables (adding columns to `patients`, `leads`)
- Creating new tables that reference existing ones
- Updating RLS policies on existing tables
- Possibly changing enum values

Running these migrations on a database with real clinic data can cause:
- Foreign key violations if new NOT NULL columns are added without defaults
- RLS policy failures if policies are dropped and recreated while users are active
- Data loss if enum values are removed that existing rows reference
- Performance degradation if large tables are altered without CONCURRENTLY

**Why it happens:**
Solo developers often test migrations only on local dev databases with seed data. Production data has edge cases: NULL values in unexpected places, orphaned references from manual edits, larger tables causing lock timeouts during ALTER TABLE.

**How to avoid:**
1. Always add new columns as nullable with defaults, never NOT NULL without a safe default
2. Use `IF EXISTS` / `IF NOT EXISTS` in all migration SQL (already partially done)
3. Test migrations against a production-like dataset (use `seed-scale-data.js` to create scale)
4. Never DROP and recreate RLS policies in the same migration -- use CREATE OR REPLACE where possible, or separate drop/create into sequential steps
5. Add new tables and columns BEFORE removing old ones (expand-contract pattern)
6. Write a rollback migration for every forward migration

**Warning signs:**
- Migrations that take more than 5 seconds locally
- ALTER TABLE on tables with more than 10K rows without CONCURRENTLY
- Dropping columns or changing NOT NULL constraints
- Multiple RLS policy drops in a single migration

**Phase to address:**
Every phase -- This is a continuous concern. Establish migration review checklist in Phase 1 and enforce it.

---

### Pitfall 8: Denormalization vs. Normalization in Contact History

**What goes wrong:**
CRM requires a unified "interaction history" showing all touchpoints: appointments, WhatsApp messages, calls, notes, status changes, payments. The existing schema has these scattered across `appointments`, `lead_activities`, `conversation_messages`, and future tables. Two failure modes:
- **Over-normalized**: 5 JOINs to render a patient timeline, queries taking seconds
- **Over-denormalized**: Duplicating data across tables, sync failures, stale data

The `lead_activities` table already uses JSONB `metadata` for arbitrary context, which is a good pattern but needs consistency.

**Why it happens:**
Developers either normalize everything (academic purity) or denormalize everything (performance fear). Neither extreme works for CRM timelines that need both consistency and speed.

**How to avoid:**
1. Create a unified `timeline_events` materialized view (or table) that aggregates from all sources
2. Each source table (appointments, messages, lead_activities) owns its data
3. Timeline view uses UNION ALL with type discriminators, not polymorphic associations
4. For heavy read paths (patient detail page), cache timeline in TanStack Query with invalidation on mutations
5. Do NOT create a single monolithic `interactions` table that duplicates source data

**Warning signs:**
- Patient detail page making 5+ API calls to assemble timeline
- Timeline rendering in more than 500ms
- Stale data appearing after updates (cache invalidation gaps)
- A single "interactions" table with 20+ nullable columns for different event types

**Phase to address:**
Phase 2 (Patient Records / History) -- Design the timeline query pattern before building the UI. Validate with 1000+ interaction records.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded pipeline stages in CHECK constraint | Quick validation, no extra table | Cannot customize per clinic, migration to fix is destructive | Never -- already technical debt that must be addressed |
| RLS with nested subqueries instead of denormalized `clinic_id` | Avoids schema changes to child tables | O(n*m) query cost, performance death at scale | Never for CRM tables -- denormalize `clinic_id` from the start |
| Storing WhatsApp messages in raw JSONB without schema | Flexible, no migration needed | Cannot query by message type, no analytics, LGPD retention impossible | MVP only -- add schema within first CRM iteration |
| Soft-delete (`deleted_at`) without cascading anonymization | Easy undo, data recovery | LGPD violation (data still exists), stale data in reports, search results show deleted patients | MVP only -- add anonymization job in Phase 2 |
| Two competing RLS helper functions (`get_current_clinic_id` and `get_user_clinic`) | Both work independently | Confusion about which to use, different behavior if they diverge | Never -- consolidate immediately |
| `lead_activities.metadata JSONB DEFAULT '{}'` without schema | Flexible metadata storage | No validation, inconsistent data shapes, cannot build queries on metadata fields | Acceptable IF documented schema is enforced at application layer |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Evolution API webhooks | Processing messages synchronously in webhook handler -- if DB is slow, webhook times out and Evolution retries, causing duplicates | Queue messages immediately (insert to `inbound_messages` table), process asynchronously. Use idempotency key on WhatsApp message ID |
| Evolution API session | Assuming session stays connected -- no health check or reconnection logic | Poll `/instance/connectionState` every 5 min. Show connection status in dashboard. Auto-reconnect on disconnect. Alert on repeated failures |
| Evolution API + CRM campaigns | Sending all campaign messages at once (burst) -- number gets banned | Queue with exponential backoff. Max 1 message per 10 seconds for bulk. Random delay between messages. Stop on first error |
| Supabase Realtime + CRM | Subscribing to all table changes for live updates -- with 10 CRM tables, this is 10+ subscriptions overwhelming the client | Subscribe to specific clinic-scoped channels. Use Postgres LISTEN/NOTIFY for targeted updates. Only subscribe to tables visible on current screen |
| Calendar + CRM leads | `leads.converted_appointment_id` creates tight coupling -- appointment deletion or reschedule can orphan the reference | Use soft-delete on appointments (already has status). Add FK with SET NULL. Track conversion in `lead_activities` as audit trail, not just FK |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS subquery per row on CRM tables with 10K+ contacts | Contact list page takes 5-10s to load, dashboard stats timeout | Denormalize `clinic_id` into every table. Use `(SELECT get_user_clinic(auth.uid()))` pattern. Add composite indexes on `(clinic_id, status)` | 1,000+ contacts per clinic |
| Lead statistics view (aggregate query) recalculated on every page load | Dashboard slow, admin panel unusable | Materialize the `lead_statistics` view or cache with periodic refresh. Use `CREATE MATERIALIZED VIEW` with `REFRESH CONCURRENTLY` | 500+ leads per clinic |
| Contact search without full-text index | Search bar laggy, users complain about finding patients | Add GIN index on name/phone/email. Use `pg_trgm` for fuzzy matching. Consider ` Supabase` full-text search | 5,000+ contacts |
| WhatsApp message history without pagination | Conversation view loads entire history, OOM on long conversations | Cursor-based pagination (keyset on `created_at`). Load last 50 messages, paginate up | 500+ messages per conversation |
| N+1 queries loading patient detail with timeline | Patient page makes separate queries for appointments, messages, activities, notes | Single timeline query with UNION ALL. Use DataLoader pattern for nested relations | 100+ interactions per patient |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No consent tracking before WhatsApp marketing messages | LGPD fine up to 2% revenue (R$50M cap). Each unsolicited message is a separate violation. | `consents` table required before any campaign feature. Verify consent before every outbound message |
| CPF stored without encryption at rest | Data breach exposes national IDs. LGPD Art. 46 requires "technical and administrative measures" | Store CPF encrypted (`pgcrypto.encrypt`). Decrypt only in API layer. Never expose in frontend payloads. Consider hashing if CPF is only used for deduplication |
| WhatsApp webhook endpoint without HMAC verification | Attackers can inject fake messages, modify appointment confirmations, exfiltrate conversation data | Validate webhook signature (Evolution API supports `webhook.headers.jwt_key`). Reject unsigned requests |
| Service role key used for CRM operations bypassing RLS | Data leak across clinics. Any API route using service role key ignores all RLS policies | Audit all uses of `SUPABASE_SERVICE_ROLE_KEY`. Use only for admin operations and background jobs. CRM CRUD should use user-scoped client with RLS |
| No audit trail for data access | LGPD Art. 37 requires records of processing activities. Cannot prove compliance if audited | Log all access to patient data. Store access logs with user_id, action, timestamp, patient_id. Retain for required period |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| CRM separate from calendar (different pages, no linking) | Users context-switch between calendar and contacts. "Is this lead the same person I have an appointment with?" | Every contact shows recent appointments. Every appointment links to contact. Calendar event card shows patient CRM status |
| Pipeline with too many stages in MVP | Users overwhelmed, stages not matching their workflow, they stop using the pipeline | Start with 4-5 default stages. Let users customize AFTER they use the defaults. "We will add your stages" is better than "configure your pipeline" |
| Generic "Contact" model without dental context | Dental clinics think in terms of "patients" and "leads", not "contacts". Generic CRM feels wrong. | Use domain-specific language: "Pacientes" (active), "Leads" (prospective), "Inativos" (churned). The UI should feel like a dental tool, not Salesforce |
| No WhatsApp context in CRM | User sees a lead in the CRM, has to open WhatsApp separately to follow up. No message history in contact view | Embed recent WhatsApp messages in contact detail. "Send WhatsApp" button on every lead/patient. Show last message preview in contact list |
| Bulk actions without confirmation | User accidentally sends campaign to wrong segment. No undo. | Confirmation dialog with recipient count. Preview of first message. "Undo" window (30 seconds). Test mode that sends only to self |

## "Looks Done But Isn't" Checklist

- [ ] **RLS policies:** Every new table has RLS enabled AND policies defined -- verify with `\d+ tablename` in psql, not just the migration file
- [ ] **Clinic isolation:** Test that Clinic A cannot see Clinic B's data -- seed two clinics and verify cross-access fails
- [ ] **Pipeline customization:** Changing a stage name updates existing leads, not just new ones
- [ ] **WhatsApp session:** Reconnection works after phone restart, not just after server restart
- [ ] **Data export:** Export produces valid JSON with ALL related data (patient + appointments + messages + leads), not just the patient record
- [ ] **Consent revocation:** Revoking consent stops all outbound messages, including queued ones
- [ ] **Soft delete cascade:** Deleting a patient anonymizes their data in reports, lead_activities, and message history, not just sets `deleted_at`
- [ ] **Campaign sending:** Campaign respects rate limits and stops on first error, not fire-and-forget
- [ ] **Search:** Contact search works with partial name, phone number, and email, not just exact match
- [ ] **Timeline:** Patient timeline shows events in correct chronological order across all sources, not just by type

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS recursion on new CRM tables | MEDIUM | Drop policies, create consolidated helper function, recreate policies with denormalized `clinic_id`. 1-2 days. |
| Hardcoded pipeline stages needing customization | HIGH | Create `pipeline_stages` table, data migration from string status to FK, update all services and queries. 3-5 days. Data migration is risky. |
| LGPD compliance gap discovered late | HIGH | Retroactive consent collection (email/WhatsApp blast asking for consent), data audit, possible breach notification. Legal + engineering, 2-4 weeks. |
| WhatsApp number banned from bulk messaging | MEDIUM | Cannot recover the number. Must switch to new number, re-notify all contacts. Consider migrating to official Business API. 1-2 weeks. |
| Custom fields built as EAV | HIGH | Migrate EAV rows to structured JSONB or real columns. Rewrite all query logic. Rebuild form rendering. 1-2 weeks. |
| Migration breaks production data | HIGH | Restore from backup, fix migration, re-apply. Data loss depends on backup frequency. 1-3 days + data audit. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS recursion/performance | Phase 1: Foundation | Run EXPLAIN ANALYZE on contact list query with 10K rows. Confirm <100ms. |
| Hardcoded pipeline stages | Phase 1: Foundation | Pipeline stages table exists. Default stages seeded. Leads table uses stage_id, not hardcoded status. |
| LGPD compliance | Phase 1: Foundation (consent table) / Phase 2 (anonymization) | Consent table exists before any messaging feature. Data export endpoint tested with real data. |
| WhatsApp brittleness | Phase 2: WhatsApp CRM | Message queue implemented. Session monitoring in dashboard. Rate limiting enforced. |
| Custom field over-engineering | Phase 2: Patient Records | Core dental fields as real columns. Custom fields as JSONB with registry. No EAV. |
| Pipeline scope creep | Phase 1: Pipeline MVP | Pipeline has only stage CRUD + reorder. No rules engine. Deferred features in PROJECT.md Out of Scope. |
| Migration conflicts | Every phase | Migration tested against `seed-scale-data.js` dataset. Rollback migration exists for every forward migration. |
| Contact history performance | Phase 2: Patient Records | Timeline query returns 500 events in <200ms. No N+1 queries. |

## Sources

- Supabase RLS Performance docs (Context7-verified): https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx
- Evolution API Webhook docs (Context7-verified): https://context7.com/evolutionapi/evolution-api/llms.txt
- Supabase Migration docs (Context7-verified): https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/local-development/overview.mdx
- Existing codebase migrations (4 RLS fix files confirming recursion pattern)
- LGPD Art. 5 (personal data definitions), Art. 18 (data subject rights), Art. 37 (processing records), Art. 46 (security measures)

---
*Pitfalls research for: Adding CRM to existing Synkroo calendar app*
*Researched: 2026-04-24*
