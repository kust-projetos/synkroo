# Phase 1: Foundation & Contacts - Research

**Researched:** 2026-04-24
**Domain:** CRM Contacts, Custom Fields, LGPD Consents, Database Foundation
**Confidence:** HIGH

## Summary

Phase 1 builds the unified contacts interface and database foundation for the entire CRM. The project already has a working Next.js 15 + Supabase app with patients, leads, appointments, and calendar. The existing codebase uses a consistent pattern: API routes in `src/app/api/`, services in `src/services/`, TanStack Query hooks in `src/lib/hooks/use-queries.ts`, and Radix UI primitives in `src/components/ui/`. The database has 26 migrations with a multi-tenant `clinic_id` pattern and RLS policies using two competing helper functions (`get_current_clinic_id` and `get_user_clinic`) that must be consolidated.

The primary technical challenges are: (1) consolidating RLS helper functions before adding 4+ new CRM tables, (2) migrating `leads.status` CHECK constraint to a `pipeline_stages` FK without data loss, (3) implementing an EAV custom fields system with typed value columns that remains queryable, (4) building a timeline aggregation query with UNION ALL across 4 sources, and (5) creating a master-detail split-view UI using `react-resizable-panels`.

**Primary recommendation:** Start with database migrations and RLS consolidation (Wave 0), then build the split-view contacts page reusing existing UI primitives, then add timeline, custom fields, and consents incrementally.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D1: Contact Layout -- Unified Split-View**
- Single "Contatos" page showing patients + leads together with master-detail split-view
- Left panel: searchable/filterable contact list
- Right panel: contact detail with sub-tabs (Timeline, Notas, Campos Customizados)
- Top tabs to filter by type: Todos | Pacientes | Leads
- "+" button to create new contact (patient or lead)
- Lead to Patient conversion happens inline in the detail panel
- Existing pages (`pacientes/`, `leads/`) will be replaced/refactored into this unified view

**D2: Custom Fields Storage -- EAV with Typed Columns**
- `custom_field_definitions`: id, clinic_id, name, field_type (text|number|date|select|checkbox), options (JSONB), required, sort_order, is_active
- `custom_field_values`: id, definition_id, contact_id (polymorphic), value_text TEXT, value_number NUMERIC, value_date DATE, value_boolean BOOLEAN, value_json JSONB

**D3: Interaction Timeline -- Card Feed with Type Filters**
- Feed of compact cards with filter chips by interaction type
- 4 data sources: appointments, messages (conversations), lead_activities, patient_observations
- Server-side UNION ALL query, cursor-based pagination (scroll infinite)

**D4: Tags -- Flat with Colors**
- Reuse existing `patients.tags TEXT[]` pattern, extend to leads
- Tag color support via `clinic_tags` metadata
- GIN index on tags array

**D5: LGPD Consent -- Dedicated Table with Profile Checkboxes**
- `consents` table: id, clinic_id, contact_id, purpose, granted, granted_at, revoked_at, channel, notes
- Audit via existing `audit_logs` table
- Three purposes: data_collection, marketing, whatsapp_communication
- Migrate existing `patients.opt_out_*` fields to consents table

**D6: Search & Filters -- Global Search + Sidebar Filters**
- Search bar: matches name (ILIKE), phone, email, CPF
- Sidebar filters: status, type, tags (multi-select), last visit date range, custom field values
- Supabase full-text or ILIKE for search (no external search service)

### Claude's Discretion

- Split-view responsive behavior and breakpoints
- Column widths, animation, transition details
- Index strategy for custom_field_values
- Pagination chunk size for timeline
- Tag color palette defaults
- Migration naming and ordering
- Debounce timing for search
- Exact API route structure

### Deferred Ideas (OUT OF SCOPE)

None at this time. All scope stays within Phase 1 boundaries.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | User can view list of all contacts (patients + leads) with search and filters | D1 split-view + D6 global search + existing `DataTable`, `SearchInput`, `FilterBar` components |
| CONT-02 | User can view detailed contact profile with personal info | D1 detail panel + existing `DetailPage` component pattern |
| CONT-03 | User can create, edit, and archive contacts | D1 create/edit in detail panel + existing API route pattern (`src/app/api/patients/`, `src/app/api/leads/`) |
| CONT-04 | User can tag contacts with custom categories | D4 flat tags + existing `patient-tags.service.ts` pattern + TEXT[] with GIN index |
| CONT-05 | User can view unified interaction timeline per contact | D3 card feed + UNION ALL across 4 tables + TanStack `useInfiniteQuery` |
| CONT-06 | User can add notes to any contact | D3 patient_observations as timeline source + existing service pattern |
| CF-01 | User can define custom field definitions per specialty | D2 EAV definitions table + Zod validation in API layer |
| CF-02 | User can fill custom fields on contact profiles | D2 values table with typed columns + detail panel sub-tab |
| CF-03 | User can search and filter contacts by custom field values | D2 typed columns enable indexed queries + D6 sidebar filters |
| CF-04 | User can import/export custom field templates per specialty | D2 definitions exportable as JSON |
| LGPD-01 | User can record patient consent | D5 consents table + profile checkboxes |
| LGPD-04 | System maintains audit log of consent changes | D5 audit_logs integration + trigger on consents table |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contact search & filtering | API / Backend | Database | Supabase query with ILIKE + TEXT[] contains; DB owns indexes |
| Contact list rendering | Browser / Client | -- | Client-side DataTable with server pagination |
| Master-detail split-view | Browser / Client | -- | react-resizable-panels manages panel state in browser |
| Custom field definitions CRUD | API / Backend | Database | API validates via Zod, DB stores with RLS |
| Custom field values storage | Database | API / Backend | EAV typed columns with DB-level indexes |
| Timeline aggregation | Database | API / Backend | UNION ALL query in DB, API adds cursor pagination |
| Consent recording & audit | Database | API / Backend | DB trigger for audit, API validates purpose enum |
| RLS enforcement | Database | -- | Supabase RLS policies with `get_user_clinic()` helper |
| Sidebar navigation update | Browser / Client | Frontend Server | Replace Pacientes/Leads entries with unified Contatos |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-resizable-panels | 4.10.0 | Split-view master-detail layout | Best React panel library: lightweight, accessible, persistent layout via `useDefaultLayout`. 5,230+ stars, actively maintained (last release 2026-04-11). [VERIFIED: npm registry + GitHub] |
| @tanstack/react-query | 5.100.1 | Server state management, infinite queries | Already in project at ^5.97.0. `useInfiniteQuery` for timeline cursor pagination. [VERIFIED: npm registry] |
| @radix-ui/react-tabs | 1.1.13 | Contact type filter tabs (Todos/Pacientes/Leads) | Already in project. Used for detail sub-tabs. [VERIFIED: package.json] |
| @supabase/supabase-js | 2.104.1 | Database client with RLS | Already in project at ^2.45.0. Needs update for latest features. [VERIFIED: npm registry] |
| zod | 3.23.8 (project) | API input validation | Already in project. Validate contact creation, custom field definitions, consent payloads. [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @heroicons/react | 2.2.0 | Timeline type icons, action icons | Already in project. Use for appointment/WhatsApp/note type icons in timeline. [VERIFIED: package.json] |
| class-variance-authority | -- | Component variant styling | Already in project for badge variants (tag colors). |
| next-themes | -- | Dark/light mode support | Already in project. All new components must support both modes. |
| @react-lgpd-consent/core | -- (optional) | LGPD consent banner (cookie-level) | Only if Phase 1 needs a cookie consent banner. Our consent tracking is custom (database-level). [VERIFIED: GitHub lucianoedipo/react-lgpd-consent, 7 stars, React 19 compatible] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-resizable-panels | allotment | allotment (1.20.5) last updated 2025-12-19, less frequent releases. react-resizable-panels (4.10.0) last updated 2026-04-11 with 4 releases in 3 weeks. react-resizable-panels has 5,230 stars vs allotment's lower visibility. react-resizable-panels has built-in `useDefaultLayout` persistence hook. [VERIFIED: npm registry timestamps] |
| react-resizable-panels | CSS resize | Native CSS resize is not accessible, has no persistence, and provides no programmatic control over min/max sizes. |
| ILIKE search | pg_trgm fuzzy search | pg_trgm needs extension enable (`CREATE EXTENSION pg_trgm`) and GIN trigram index. ILIKE with B-tree prefix index is sufficient for MVP contact count (<10K). Defer pg_trgm to when search needs fuzzy matching. [ASSUMED] |
| ILIKE search | Supabase full-text search (to_tsvector) | Full-text search requires tsvector columns or generated columns. Overkill for name/phone/email/CPF matching. ILIKE with proper indexes is simpler and handles the use case. [ASSUMED] |

**Installation:**
```bash
npm install react-resizable-panels
# @tanstack/react-query, zod, @radix-ui/react-tabs already installed
```

**Version verification:**
- react-resizable-panels: 4.10.0 [VERIFIED: npm registry, 2026-04-11]
- allotment: 1.20.5 [VERIFIED: npm registry, 2025-12-19]
- @tanstack/react-query: 5.100.1 [VERIFIED: npm registry, 2026-04-24]
- zustand: 5.0.12 [VERIFIED: npm registry, 2026-04-24]
- zod: 4.3.6 (latest) / 3.23.8 (project) [VERIFIED: npm registry, 2026-04-24]

## Open-Source Reference Implementations

### Category 1: Dental CRM / Clinic Management

| Repo | Stars | Stack | Relevance | URL |
|------|-------|-------|-----------|-----|
| HardikQuantumCybernetic/hardik-dental | 4 | React 18 + TypeScript + Supabase + Clerk | HIGH -- Same stack (React + TS + Supabase). Has patients, appointments, doctors, services, WhatsApp integration, admin dashboard. Schema directly referenceable. | https://github.com/HardikQuantumCybernetic/hardik-dental |
| Arfazrll/POLABDC | 3 | Next.js 14 + Express + Prisma + Supabase + Gemini AI | MEDIUM -- Dental SaaS with Next.js + Supabase. Uses Prisma instead of direct Supabase client. AI-powered features. | https://github.com/Arfazrll/POLABDC |
| SoulHiro/doutor-agenda | 4 | Next.js + Better Auth + Stripe | MEDIUM -- Medical clinic management in Portuguese. Has clinic/doctor/patient management, scheduling, Stripe subscriptions. | https://github.com/SoulHiro/doutor-agenda |

**Key patterns from hardik-dental (highest relevance):**
- Uses Supabase RLS on all tables with `FOR ALL USING (true)` admin policies (simpler than our clinic-scoped RLS)
- Has `patients`, `doctors`, `services`, `appointments`, `feedback` tables
- Migration structure: numbered UUID-based filenames (Supabase CLI format)
- Uses Vite (not Next.js) so page structure differs, but component patterns are transferable
- Services table with categories (preventive, restorative, endodontic, surgical, cosmetic, orthodontic) -- useful for odontologia defaults

### Category 2: Custom Fields (EAV Pattern)

| Repo | Stars | Stack | Relevance | URL |
|------|-------|-------|-----------|-----|
| LanternOps/breeze | -- | Drizzle ORM + TypeScript | HIGH -- Has `custom_field_definitions` with enum type (text/number/boolean/dropdown/date), `field_key`, `options` JSONB, `required`, `default_value`. Matches our D2 schema closely. | https://github.com/LanternOps/breeze |
| open-mercato/open-mercato | -- | MikroORM + TypeScript | HIGH -- EAV with typed columns: `value_text`, `value_multiline`, `value_int`, `value_float`, `value_bool`. Uses `entity_id` + `record_id` + `field_key` instead of `definition_id` FK. Multi-tenant with `organization_id` + `tenant_id`. | https://github.com/open-mercato/open-mercato |

**Key pattern from open-mercato (typed columns EAV):**
```sql
-- Their schema (simplified)
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,           -- Polymorphic entity type
  record_id TEXT NOT NULL,           -- Polymorphic entity ID
  organization_id UUID,              -- Multi-tenant
  field_key TEXT NOT NULL,           -- References custom_field_defs.key
  value_text TEXT,                   -- Typed column: string values
  value_multiline TEXT,              -- Typed column: long text
  value_int INT,                     -- Typed column: integer
  value_float REAL,                  -- Typed column: decimal
  value_bool BOOLEAN,                -- Typed column: boolean
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ             -- Soft delete
);
-- Indexes on field_key and (entity_id, record_id, organization_id)
```

**Key pattern from breeze (Drizzle ORM definition):**
```typescript
export const customFieldTypeEnum = pgEnum('custom_field_type', [
  'text', 'number', 'boolean', 'dropdown', 'date'
]);
export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  name: varchar('name', { length: 100 }).notNull(),
  fieldKey: varchar('field_key', { length: 100 }).notNull(),
  type: customFieldTypeEnum('type').notNull(),
  options: jsonb('options'),
  required: boolean('required').notNull().default(false),
  defaultValue: jsonb('default_value'),
});
```

**Validation of our D2 design:** Both open-mercato and breeze use the same typed-column EAV pattern we planned. Our schema is consistent with established patterns. Key difference: we add `value_date` and `value_json` columns which they lack, giving us better type coverage for date and multi-select fields.

### Category 3: Consent / LGPD

| Repo | Stars | Stack | Relevance | URL |
|------|-------|-------|-----------|-----|
| lucianoedipo/react-lgpd-consent | 7 | React + TypeScript | LOW -- Cookie consent banner library, not database-level consent. Useful only if we need a cookie banner. Our consent tracking is server-side. | https://github.com/lucianoedipo/react-lgpd-consent |
| UnclePhilburt/StudyFlowSuite | -- | Next.js + Supabase | MEDIUM -- Has Supabase `consent_logs` migration with RLS policies, user_id + legal_version tracking, audit indexes. Good reference for our consent audit pattern. | https://github.com/UnclePhilburt/StudyFlowSuite |

**Key pattern from StudyFlowSuite (Supabase consent with RLS):**
```sql
CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL,
  legal_version TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'download_consent',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- RLS: Users can only insert/view own logs
-- Service role has full access for admin audit
-- Includes compliance summary VIEW
```

### Category 4: Split-View Panel Library

| Library | Stars | Last Updated | Key Feature |
|---------|-------|-------------|-------------|
| react-resizable-panels (bvaughn) | 5,230 | 2026-04-11 | Built-in `useDefaultLayout` persistence, keyboard accessible, touch support. 4 releases in 3 weeks (active). [VERIFIED: npm + GitHub] |
| allotment (johnwalley) | -- | 2025-12-19 | React split-pane component. Last release 4+ months ago. No built-in persistence hook. [VERIFIED: npm registry] |
| react-panelgroup (DanFessler) | 256 | 2025-12-26 | Alternative, less popular. [VERIFIED: GitHub] |

**Recommendation confirmed: react-resizable-panels** -- Active maintenance (4 releases in last 3 weeks vs allotment's last release 4+ months ago), built-in persistence via `useDefaultLayout`, 5,230 stars, Context7 docs with 68 code snippets, keyboard accessible.

### Category 5: Next.js CRM Templates

| Repo | Stars | Notes | URL |
|------|-------|-------|-----|
| SubashSK777/Next-JS-CRM-Template | 2 | Minimal CRM template. Not feature-rich enough to reference. | https://github.com/SubashSK777/Next-JS-CRM-Template |

**Conclusion:** No mature Next.js CRM template found. The dental/clinic repos (hardik-dental, POLABDC, doutor-agenda) are better references since they have domain-specific schemas.

## Architecture Patterns

### System Architecture Diagram

```
[User Browser]
     |
     v
[Next.js App Router /dashboard/contatos]
     |
     +---> [ContactListPanel (left)]
     |       |  SearchInput + FilterBar + DataTable
     |       |  API: GET /api/contacts?search=...&type=...&tags=...
     |       v
     |    [Contact Detail Panel (right)]
     |       |  Tabs: Info | Timeline | Notas | Campos Customizados
     |       |
     |       +---> Tab: Info
     |       |       API: GET /api/contacts/:id
     |       |       API: PUT /api/contacts/:id (edit)
     |       |       API: GET /api/consents?contact_id=:id
     |       |
     |       +---> Tab: Timeline
     |       |       API: GET /api/contacts/:id/timeline?cursor=...&type=...
     |       |       Uses useInfiniteQuery + IntersectionObserver
     |       |
     |       +---> Tab: Notas
     |       |       API: GET/POST /api/contacts/:id/notes
     |       |
     |       +---> Tab: Campos Customizados
     |               API: GET /api/custom-fields/definitions
     |               API: GET/PUT /api/custom-fields/values?contact_id=:id
     |
     v
[Supabase PostgreSQL]
     |
     +---> RLS: (SELECT get_user_clinic(auth.uid())) = clinic_id
     |
     +---> Tables: patients, leads, appointments, lead_activities,
     |           conversations, messages, pipeline_stages (new),
     |           custom_field_definitions (new), custom_field_values (new),
     |           consents (new)
     |
     +---> Timeline Query: UNION ALL across 4 sources
              ordered by timestamp, cursor-paginated
```

### Recommended Project Structure

```
src/
  app/
    dashboard/
      contatos/                    # NEW: unified contacts page
        page.tsx                   # Split-view layout
        [id]/                      # Contact detail (used when no JS / deep link)
        layout.tsx                 # Optional: contacts-specific layout
    api/
      contacts/                    # NEW: unified contact API
        route.ts                   # GET (list) / POST (create)
        [id]/
          route.ts                 # GET / PUT / PATCH (archive)
          timeline/
            route.ts               # GET timeline with cursor pagination
          notes/
            route.ts               # GET / POST notes
      custom-fields/               # NEW: custom field definitions + values
        definitions/
          route.ts                 # GET / POST definitions
        values/
          route.ts                 # GET / PUT values for contact
      consents/                    # NEW: LGPD consent management
        route.ts                   # GET / POST / PATCH consents
  components/
    contacts/                      # NEW: contact feature components
      contact-list-panel.tsx       # Left panel: search + filters + list
      contact-detail-panel.tsx     # Right panel: tabs + content
      contact-split-view.tsx       # react-resizable-panels wrapper
      contact-info-tab.tsx         # Profile info + edit form
      contact-timeline-tab.tsx     # Timeline card feed with infinite scroll
      contact-notes-tab.tsx        # Notes list + add note
      contact-custom-fields-tab.tsx # Custom fields form
      contact-create-dialog.tsx    # Dialog for creating new contact
      contact-tags-input.tsx       # Tag autocomplete input
      timeline-card.tsx            # Individual timeline event card
      consent-section.tsx          # Consent checkboxes in profile
    ui/                            # EXISTING: reuse as-is
      data-table.tsx
      search-input.tsx
      filter-bar.tsx
      tabs.tsx
      badge.tsx
      ...
  services/
    contacts/                      # NEW: unified contact service
      contacts.service.ts          # Combined patient+lead queries
      timeline.service.ts          # UNION ALL aggregation query
      consents.service.ts          # Consent CRUD + audit trigger
    custom-fields/                 # NEW: custom fields service
      definitions.service.ts       # Field definition CRUD
      values.service.ts            # Field value read/write
  lib/
    hooks/
      use-queries.ts               # ADD: useContacts, useTimeline, useCustomFields, useConsents
    supabase/
      server.ts                    # EXISTING: no changes needed
      typed.ts                     # EXISTING: no changes needed
supabase/
  migrations/
    20260424000000_consolidate_rls_helpers.sql      # Drop get_current_clinic_id, keep get_user_clinic
    20260424000001_create_pipeline_stages.sql       # pipeline_stages table + seed defaults
    20260424000002_migrate_leads_status.sql          # leads.status -> leads.stage_id
    20260424000003_create_custom_fields.sql          # definitions + values tables
    20260424000004_create_consents.sql               # consents table + audit trigger
    20260424000005_create_clinic_tags.sql             # clinic_tags metadata table (colors)
    20260424000006_update_sidebar_rls_policies.sql   # Add RLS for new tables using consolidated helper
```

### Pattern 1: Master-Detail Split-View with react-resizable-panels

**What:** Two-panel layout with resizable divider, persistent sizing, responsive stacking on mobile.
**When to use:** The main contacts page.

```typescript
// Source: [Context7: react-resizable-panels docs]
'use client'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import { ContactListPanel } from './contact-list-panel'
import { ContactDetailPanel } from './contact-detail-panel'

export function ContactSplitView() {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'contacts-split-view',
    storage: localStorage,
  })

  return (
    <Group
      direction="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="contact-list" minSize="25%" defaultSize="35%">
        <ContactListPanel />
      </Panel>
      <Separator className="w-px bg-border" />
      <Panel id="contact-detail" minSize="40%" defaultSize="65%">
        <ContactDetailPanel />
      </Panel>
    </Group>
  )
}
```

**Responsive pattern:** On screens < 768px, switch to `direction="vertical"` or use URL-based navigation (Next.js dynamic route) instead of panels. Use `useMediaQuery` or CSS `@container` query. [ASSUMED -- Claude's discretion]

### Pattern 2: Timeline Aggregation with UNION ALL and Cursor Pagination

**What:** Single SQL query that aggregates interaction events from 4 tables, sorted chronologically with cursor-based pagination.
**When to use:** Contact timeline tab.

```sql
-- Timeline aggregation query (server-side, via Supabase RPC or API route)
-- Uses UNION ALL for type-discriminated rows with cursor pagination
(
  SELECT
    'appointment' as source,
    a.id::text as source_id,
    a.clinic_id,
    a.patient_id as contact_id,
    'patient' as contact_type,
    a.status as event_type,
    COALESCE(a.title, 'Agendamento') as description,
    a.scheduled_at as event_timestamp,
    jsonb_build_object('status', a.status, 'dentist_id', a.dentist_id) as metadata
  FROM appointments a
  WHERE a.patient_id = $1
    AND a.clinic_id = $2
    AND ($3::timestamptz IS NULL OR a.scheduled_at < $3)
)
UNION ALL
(
  SELECT
    'message' as source,
    m.id::text as source_id,
    c.clinic_id,
    -- resolve contact: message -> conversation -> patient/lead
    COALESCE(cp.patient_id, cl.lead_id)::text as contact_id,
    CASE WHEN cp IS NOT NULL THEN 'patient' ELSE 'lead' END as contact_type,
    m.direction as event_type,
    LEFT(m.content, 100) as description,
    m.created_at as event_timestamp,
    jsonb_build_object('direction', m.direction, 'message_type', m.message_type) as metadata
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  LEFT JOIN conversation_patients cp ON cp.conversation_id = c.id
  LEFT JOIN conversation_leads cl ON cl.conversation_id = c.id
  WHERE (cp.patient_id = $1 OR cl.lead_id = $1)
    AND c.clinic_id = $2
    AND ($3::timestamptz IS NULL OR m.created_at < $3)
)
UNION ALL
(
  SELECT
    'lead_activity' as source,
    la.id::text as source_id,
    l.clinic_id,
    l.id::text as contact_id,
    'lead' as contact_type,
    la.activity_type as event_type,
    la.description,
    la.performed_at as event_timestamp,
    la.metadata
  FROM lead_activities la
  JOIN leads l ON l.id = la.lead_id
  WHERE l.id = $1
    AND l.clinic_id = $2
    AND ($3::timestamptz IS NULL OR la.performed_at < $3)
)
UNION ALL
(
  SELECT
    'observation' as source,
    po.id::text as source_id,
    po.clinic_id,
    po.patient_id::text as contact_id,
    'patient' as contact_type,
    'note' as event_type,
    LEFT(po.content, 100) as description,
    po.created_at as event_timestamp,
    '{}'::jsonb as metadata
  FROM patient_observations po
  WHERE po.patient_id = $1
    AND po.clinic_id = $2
    AND ($3::timestamptz IS NULL OR po.created_at < $3)
)
ORDER BY event_timestamp DESC
LIMIT 20;
```

**Cursor strategy:** Use `event_timestamp + source_id` composite cursor. Encode as base64 string. The cursor `$3` is the `event_timestamp` of the last item in the previous page. For items with the same timestamp, use `source_id` as tiebreaker. [ASSUMED -- Claude's discretion on chunk size of 20]

### Pattern 3: EAV Custom Fields with Typed Columns

**What:** Two-table EAV model where values use typed columns for queryability.
**When to use:** Custom field definitions and per-contact values.

```sql
-- custom_field_definitions
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox')),
  options JSONB DEFAULT '[]',  -- For select type: [{label, value}]
  required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, name)
);

-- custom_field_values
CREATE TABLE custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,  -- Polymorphic: references patients.id OR leads.id
  contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('patient', 'lead')),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,  -- Denormalized for RLS
  value_text TEXT,
  value_number NUMERIC,
  value_date DATE,
  value_boolean BOOLEAN,
  value_json JSONB,  -- For select multi-value or complex types
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(definition_id, contact_id, contact_type)
);

-- Indexes for typed columns (query by custom field values)
CREATE INDEX idx_cfv_contact ON custom_field_values(contact_id, contact_type);
CREATE INDEX idx_cfv_text ON custom_field_values(definition_id, value_text) WHERE value_text IS NOT NULL;
CREATE INDEX idx_cfv_number ON custom_field_values(definition_id, value_number) WHERE value_number IS NOT NULL;
CREATE INDEX idx_cfv_date ON custom_field_values(definition_id, value_date) WHERE value_date IS NOT NULL;
CREATE INDEX idx_cfv_boolean ON custom_field_values(definition_id, value_boolean) WHERE value_boolean IS NOT NULL;
CREATE INDEX idx_cfv_json ON custom_field_values USING gin(value_json) WHERE value_json IS NOT NULL;
```

**Key insight:** The `clinic_id` is denormalized into `custom_field_values` to avoid joining through `custom_field_definitions` for RLS. This follows the established pitfall pattern from the codebase where child tables without `clinic_id` cause triple-nested RLS subqueries. [CITED: PITFALLS.md Pitfall 1]

**Cross-reference with open-mercato:** Our design adds `value_date DATE` and `value_json JSONB` beyond their `value_text`, `value_int`, `value_float`, `value_bool`. We also use `definition_id UUID FK` instead of `field_key TEXT`, which enforces referential integrity at the DB level. Both designs include partial indexes on typed columns.

### Pattern 4: RLS Consolidation (CRITICAL -- Must Be First Migration)

**What:** Drop `get_current_clinic_id()`, keep only `get_user_clinic()`, wrap in SELECT for initPlan caching.
**When to use:** First migration in this phase, before creating any new tables.

```sql
-- Source: [Context7: Supabase RLS performance docs]
-- Step 1: Update get_user_clinic to use the SELECT wrapping pattern
CREATE OR REPLACE FUNCTION public.get_user_clinic(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT clinic_id FROM users WHERE id = p_user_id;
$$;

-- Step 2: Drop get_current_clinic_id
DROP FUNCTION IF EXISTS public.get_current_clinic_id();

-- Step 3: Update all policies using the old function to use get_user_clinic
-- The key pattern for new table policies:
CREATE POLICY "Users can view X from their clinic" ON new_table
    FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic(auth.uid())));
-- Note: Wrapping in SELECT triggers initPlan caching per Supabase docs
```

### Pattern 5: Consents Table with Audit Trigger

**What:** Dedicated consent tracking with automatic audit logging via trigger.
**When to use:** LGPD compliance, consent grant/revoke.

```sql
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('patient', 'lead')),
  purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('data_collection', 'marketing', 'whatsapp_communication')),
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  channel VARCHAR(20) DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, contact_type, purpose)
);

-- Audit trigger: log every consent change
CREATE OR REPLACE FUNCTION log_consent_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (clinic_id, user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    COALESCE(NEW.clinic_id, OLD.clinic_id),
    auth.uid(),
    TG_OP,
    'consents',
    COALESCE(NEW.id, OLD.id)::text,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_consent_audit
  AFTER INSERT OR UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION log_consent_change();
```

**Cross-reference with StudyFlowSuite:** Their consent_logs uses `ip_address`, `user_agent`, `legal_version` columns we do not include. Our design focuses on per-purpose consent (data_collection/marketing/whatsapp) with grant/revoke timestamps, which is more appropriate for a dental CRM where consent is recorded by staff, not via web click-wrap. If web-based self-service consent is added later, extend with those columns.

### Pattern 6: Pipeline Stages Migration (CHECK -> FK)

**What:** Replace hardcoded `leads.status` CHECK constraint with `leads.stage_id` FK to `pipeline_stages`.
**When to use:** Database migration, preserve existing data.

```sql
-- Step 1: Create pipeline_stages table
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(7) DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,  -- new/converted/lost are system stages
  system_key VARCHAR(20),  -- 'new', 'converted', 'lost' for semantic meaning
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(clinic_id, name)
);

-- Step 2: Add stage_id column (nullable first, expand-contract pattern)
ALTER TABLE leads ADD COLUMN stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- Step 3: Seed default stages for each existing clinic
INSERT INTO pipeline_stages (clinic_id, name, position, system_key, is_system)
SELECT c.id, s.name, s.pos, s.key, s.is_sys
FROM clinics c
CROSS JOIN (VALUES
  ('new', 0, 'new', true),
  ('contacted', 1, NULL, false),
  ('qualified', 2, NULL, false),
  ('proposal', 3, NULL, false),
  ('negotiation', 4, NULL, false),
  ('converted', 5, 'converted', true),
  ('lost', 6, 'lost', true)
) AS s(name, pos, key, is_sys);

-- Step 4: Migrate existing leads.status -> leads.stage_id
UPDATE leads l
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE ps.clinic_id = l.clinic_id
  AND ps.system_key = l.status
  OR (ps.system_key IS NULL AND ps.name = l.status);

-- Step 5: Backfill leads that did not match by systemKey
UPDATE leads l
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE l.stage_id IS NULL
  AND ps.clinic_id = l.clinic_id
  AND ps.name = l.status;

-- Step 6 (deferred): Drop leads.status column after validation
-- ALTER TABLE leads DROP COLUMN status;
-- Keep status column during Phase 1 for rollback safety
```

### Anti-Patterns to Avoid

- **Querying EAV values without typed columns:** Pure JSONB `value` column makes type-specific indexes impossible. The typed column pattern (`value_text`, `value_number`, etc.) enables B-tree indexes per type. [CITED: PITFALLS.md Pitfall 5]
- **RLS with nested subqueries on new tables:** Every new CRM table must have `clinic_id` denormalized. Never use `lead_id IN (SELECT id FROM leads WHERE clinic_id IN (SELECT clinic_id FROM users))`. [CITED: PITFALLS.md Pitfall 1]
- **Timeline via N+1 API calls:** Do not make separate API calls for appointments, messages, activities, notes. Single UNION ALL query in the database. [CITED: PITFALLS.md Pitfall 8]
- **Hardcoded pipeline stages:** The existing `leads.status` CHECK constraint is technical debt. Do not add more hardcoded stages. [CITED: PITFALLS.md Pitfall 2]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Resizable split-view panels | Custom drag handler with mouse events | react-resizable-panels | Handles mouse, touch, keyboard, accessibility, min/max sizes, persistence. 68 code snippets in docs. 5,230 stars, actively maintained. [VERIFIED: Context7 + GitHub] |
| Infinite scroll pagination | Custom scroll event listener + state | TanStack Query `useInfiniteQuery` + IntersectionObserver | Handles page caching, prefetching, loading states, error retry. Already in project. [VERIFIED: Context7] |
| Tag autocomplete | Custom dropdown with filtering | Existing `patient-tags.service.ts` pattern + Radix Popover | getClinicTags() and getSuggestedTags() already implemented. Extend to leads. [VERIFIED: codebase] |
| Contact search | Custom search service | Supabase ILIKE + existing `SearchInput` component | ILIKE with B-tree index is sufficient for <10K contacts. `SearchInput` component exists. [VERIFIED: codebase] |
| Audit logging for consents | Custom log table + app-layer logging | PostgreSQL trigger -> existing `audit_logs` table | Triggers are reliable (cannot be bypassed by app bugs), and audit_logs table exists in schema. [VERIFIED: codebase] |
| Form validation | Manual if/else validation | Zod schemas | Already in project at ^3.23.8. Used for API input validation. [VERIFIED: package.json] |
| Custom field type coercion | Manual type checking in service | Typed columns in DB + Zod discriminated union | The DB schema enforces which value column to use per field_type. Zod validates input before upsert. [VERIFIED: open-mercato + breeze patterns] |

**Key insight:** The codebase has a consistent pattern of API routes + TanStack Query hooks. Do not introduce server actions or a different data fetching pattern. Follow the existing `fetcher<T>()` pattern in `use-queries.ts`. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: RLS Recursion on New CRM Tables

**What goes wrong:** Adding `custom_field_values`, `consents`, `pipeline_stages` without `clinic_id` denormalized will cause triple-nested RLS subqueries.
**Why it happens:** Following the existing `lead_activities` pattern which joins through `leads` to get `clinic_id`.
**How to avoid:** Every new table MUST have `clinic_id` as a direct column. Use `(SELECT get_user_clinic(auth.uid()))` pattern for policies.
**Warning signs:** Queries taking >500ms on contact list page. `EXPLAIN ANALYZE` showing subquery scans.

### Pitfall 2: Timeline UNION ALL Performance

**What goes wrong:** The 4-source UNION ALL with ORDER BY on the full result can be slow if any source table lacks proper indexes on the timestamp column.
**Why it happens:** Each subquery in the UNION ALL must sort before the final merge sort. Missing indexes cause sequential scans.
**How to avoid:** Ensure indexes on `appointments.scheduled_at`, `messages.created_at`, `lead_activities.performed_at`, `patient_observations.created_at`. Use `LIMIT` inside each subquery if needed.
**Warning signs:** Timeline tab taking >1 second to load. Contact detail page rendering in >500ms.

### Pitfall 3: leads.status Migration Data Loss

**What goes wrong:** The `leads.status -> stage_id` migration may leave NULL `stage_id` for leads whose status doesn't match any seeded stage.
**Why it happens:** Custom statuses added outside the CHECK constraint, or case sensitivity mismatch.
**How to avoid:** Add validation step: `SELECT COUNT(*) FROM leads WHERE stage_id IS NULL AND status IS NOT NULL`. Keep `status` column until validated. Use expand-contract migration pattern.
**Warning signs:** Leads with NULL stage_id appearing in contact list. Pipeline showing fewer leads than expected.

### Pitfall 4: EAV Custom Field Query Performance

**What goes wrong:** Searching contacts by custom field value requires pivoting the EAV table, which is slow without proper indexes.
**Why it happens:** Generic EAV queries do full table scans on `custom_field_values` for each filter.
**How to avoid:** Use partial indexes per typed column (already defined in Pattern 3 above). For the sidebar filter, query specific definitions with typed value columns directly.
**Warning signs:** Filter by custom field takes >2 seconds. Contact list page timing out when multiple filters active.

### Pitfall 5: Split-View URL State Management

**What goes wrong:** User shares a URL to a contact, but the split-view state (which contact is selected) is only in client state, so the recipient sees an empty detail panel.
**Why it happens:** Split-view components typically manage selected item in React state, not in URL.
**How to avoid:** Use URL search params or dynamic route segments for the selected contact ID. `?contact=uuid` or `/dashboard/contatos/[id]`. This enables deep linking, browser back/forward, and sharing.
**Warning signs:** Cannot link directly to a specific contact. Back button loses selection. Cannot share contact URLs.

### Pitfall 6: Consent Migration from opt_out Fields

**What goes wrong:** `patients.opt_out_marketing` and `patients.opt_out_reminders` use inverted logic (opt_out = true means no consent). Migration must invert the boolean.
**Why it happens:** The existing fields are negative (opted out) while the new consents table uses positive (granted).
**How to avoid:** Migration: `INSERT INTO consents (contact_id, contact_type, purpose, granted) SELECT id, 'patient', 'marketing', NOT opt_out_marketing FROM patients WHERE opt_out_marketing IS NOT NULL`. Test with data.
**Warning signs:** Patients who opted out of marketing appearing as having granted marketing consent.

## Code Examples

### TanStack Query: Timeline Infinite Query Hook

```typescript
// Source: [Context7: TanStack Query docs + existing use-queries.ts pattern]
import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

export function useContactTimeline(contactId: string, typeFilter?: string) {
  return useInfiniteQuery({
    queryKey: ['contacts', contactId, 'timeline', typeFilter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' })
      if (pageParam) params.set('cursor', pageParam)
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/contacts/${contactId}/timeline?${params}`)
      if (!res.ok) throw new Error('Failed to fetch timeline')
      return res.json() // { events: [...], nextCursor: string | null }
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!contactId,
    staleTime: 30_000, // 30 seconds -- timeline is semi-realtime
  })
}
```

### API Route: Unified Contact List

```typescript
// Source: [existing pattern from src/app/api/patients/route.ts]
import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'

export async function GET(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const type = searchParams.get('type') || 'all' // all | patient | lead
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const supabase = await createTypedClient()
  const clinicId = auth.profile!.clinic_id

  // Query patients and/or leads based on type filter
  // ... (follow existing patients API route pattern with ILIKE search)
}
```

### Service: Custom Field Value Upsert

```typescript
// Source: [pattern from patient-tags.service.ts, validated against open-mercato + breeze schemas]
import { createTypedClient } from '@/lib/supabase/typed'

export async function upsertCustomFieldValues(
  contactId: string,
  contactType: 'patient' | 'lead',
  values: Array<{ definitionId: string; value: unknown }>,
  clinicId: string
) {
  const supabase = await createTypedClient()

  const rows = values.map(({ definitionId, value }) => ({
    definition_id: definitionId,
    contact_id: contactId,
    contact_type: contactType,
    clinic_id: clinicId, // Denormalized for RLS
    value_text: typeof value === 'string' ? value : null,
    value_number: typeof value === 'number' ? value : null,
    value_date: value instanceof Date ? value.toISOString().split('T')[0] : null,
    value_boolean: typeof value === 'boolean' ? value : null,
    value_json: typeof value === 'object' && value !== null ? value : null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('custom_field_values')
    .upsert(rows, { onConflict: 'definition_id,contact_id,contact_type' })

  if (error) throw error
  return true
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `get_current_clinic_id()` | `get_user_clinic(auth.uid())` wrapped in SELECT | Migration 20260327000005 | Old function still exists in migration 20260327000003, must be dropped |
| Hardcoded leads.status CHECK | pipeline_stages FK | This phase | Enables customizable pipeline stages per clinic |
| Separate pacientes/leads pages | Unified contatos split-view | This phase | Single contact management interface |
| opt_out boolean fields | Dedicated consents table with audit | This phase | LGPD-compliant consent tracking |
| Offset pagination | Cursor-based pagination for timeline | This phase | Stable pagination for growing datasets |
| allotment / react-panelgroup | react-resizable-panels with useDefaultLayout | 2023-present | Most actively maintained split-view library for React |

**Deprecated/outdated:**
- `get_current_clinic_id()`: Redundant with `get_user_clinic()`. Causes confusion about which function to use. Must be dropped and all references updated. [VERIFIED: codebase grep]
- `leads.status VARCHAR(20) CHECK (...)`: Cannot be customized per clinic. Being replaced by `leads.stage_id -> pipeline_stages`. [VERIFIED: migration 20260327000600]
- `allotment`: Less actively maintained (last release Dec 2025). `react-resizable-panels` has more features and faster release cadence. [VERIFIED: npm registry]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ILIKE with B-tree index is sufficient for contact search at <10K records | Search (D6) | If clinics have >50K contacts, need pg_trgm or full-text search migration |
| A2 | `audit_logs` table exists and has the schema assumed in the consent trigger | Consents (D5) | If audit_logs schema differs, trigger will fail at migration time |
| A3 | `patient_observations` table exists with `patient_id`, `content`, `created_at`, `clinic_id` columns | Timeline (D3) | If table schema differs, UNION ALL query will fail |
| A4 | `conversation_patients` and `conversation_leads` junction tables exist | Timeline (D3) | If conversations link to contacts differently, message aggregation changes |
| A5 | react-resizable-panels works with Next.js 15 App Router and React 19 | Split-View (D1) | If incompatibility found, fallback to CSS-based layout |
| A6 | Timeline chunk size of 20 items per page is appropriate | Timeline (D3) | If too small, users see too many loading states; if too large, slow first paint |
| A7 | Debounce of 300ms is appropriate for contact search | Search (D6) | If too aggressive, missed keystrokes; if too slow, laggy UX |

## Open Questions

1. **patient_observations table schema**
   - What we know: Referenced in CONTEXT.md D3 as a timeline source. Not visible in initial_schema.sql (first 80 lines).
   - What's unclear: Exact column names, whether it has `clinic_id` denormalized.
   - Recommendation: Planner should verify table schema before writing timeline query. Check migrations for `patient_observations`.

2. **conversation_patients / conversation_leads junction tables**
   - What we know: Messages need to be linked back to contacts for timeline.
   - What's unclear: Whether these junction tables exist or if conversations link directly via `patient_id` / `lead_id`.
   - Recommendation: Verify conversation schema. The UNION ALL timeline query depends on this.

3. **audit_logs table schema**
   - What we know: Referenced in CONTEXT.md D5 for consent audit trail.
   - What's unclear: Column names and types for the trigger function.
   - Recommendation: Check existing migrations for audit_logs creation. Planner should verify before writing trigger.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | -- | -- |
| npm | Package install | Yes | -- | -- |
| Supabase CLI | DB migrations | Yes | -- | -- |
| PostgreSQL (via Supabase) | All DB operations | Yes | -- | -- |
| react-resizable-panels | Split-view | Needs install | 4.10.0 (latest) | CSS-based fallback |
| Next.js 15 | App Router | Yes | ^15.1.0 | -- |
| TanStack Query | Infinite queries | Yes | ^5.97.0 | -- |

**Missing dependencies with no fallback:**
- None -- all core dependencies available or installable.

**Missing dependencies with fallback:**
- react-resizable-panels: Not yet installed. Can be installed via `npm install react-resizable-panels`. CSS-based split layout as emergency fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest ^29.7.0 |
| Config file | Not found (may use defaults) |
| Quick run command | `npm test -- --related` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | Contact list with search and filters | integration | `npm test -- tests/api/contacts.test.ts` | No -- Wave 0 |
| CONT-02 | Contact detail profile rendering | unit | `npm test -- tests/contacts/detail.test.tsx` | No -- Wave 0 |
| CONT-03 | Contact CRUD operations | integration | `npm test -- tests/api/contacts-crud.test.ts` | No -- Wave 0 |
| CONT-04 | Tag management | unit | `npm test -- tests/services/tags.test.ts` | No -- Wave 0 |
| CONT-05 | Timeline aggregation query | integration | `npm test -- tests/api/timeline.test.ts` | No -- Wave 0 |
| CONT-06 | Note creation | integration | `npm test -- tests/api/notes.test.ts` | No -- Wave 0 |
| CF-01 | Custom field definition CRUD | integration | `npm test -- tests/api/custom-fields-defs.test.ts` | No -- Wave 0 |
| CF-02 | Custom field value upsert | unit | `npm test -- tests/services/custom-fields.test.ts` | No -- Wave 0 |
| CF-03 | Search by custom field values | integration | `npm test -- tests/api/contacts-search.test.ts` | No -- Wave 0 |
| LGPD-01 | Consent grant/revoke | integration | `npm test -- tests/api/consents.test.ts` | No -- Wave 0 |
| LGPD-04 | Consent audit logging | integration | `npm test -- tests/api/consents-audit.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test && npm run lint`
- **Phase gate:** Full suite green + manual split-view UI verification

### Wave 0 Gaps
- [ ] `tests/api/contacts.test.ts` -- covers CONT-01
- [ ] `tests/api/contacts-crud.test.ts` -- covers CONT-03
- [ ] `tests/api/timeline.test.ts` -- covers CONT-05
- [ ] `tests/api/consents.test.ts` -- covers LGPD-01, LGPD-04
- [ ] `tests/api/custom-fields-defs.test.ts` -- covers CF-01
- [ ] `tests/services/custom-fields.test.ts` -- covers CF-02
- [ ] Test setup verification: confirm Jest config works with new directories

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + existing middleware |
| V3 Session Management | yes | Supabase session cookies (existing) |
| V4 Access Control | yes | RLS policies with `get_user_clinic()` + clinic_id denormalization |
| V5 Input Validation | yes | Zod schemas on all API inputs |
| V6 Cryptography | yes | CPF stored in database (consider pgcrypto for encryption at rest) |
| V8 Data Protection | yes | LGPD compliance via consents table + audit logging |

### Known Threat Patterns for CRM/Healthcare Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via search params | Tampering | Parameterized queries via Supabase client (never raw SQL from user input) |
| Cross-clinic data leak | Information Disclosure | RLS with `get_user_clinic()` on every table. Test cross-clinic isolation. |
| Consent bypass (marketing without consent) | Repudiation | Check consent before any outbound message. Audit trail in audit_logs. |
| CPF exposure in API responses | Information Disclosure | Exclude CPF from list API responses. Only include in detail view for authorized roles. |
| Mass data extraction via API | Denial of Service | Rate limiting on API routes (existing `rate-limit.ts`). Pagination limits. |
| XSS via note content | Tampering | Sanitize HTML in notes. Use text-only storage for patient_observations. |

## Sources

### Primary (HIGH confidence)
- Context7 react-resizable-panels: PanelGroup, Panel, Separator, useDefaultLayout API (68 code snippets)
- Context7 Supabase RLS: Performance patterns, SECURITY DEFINER, SELECT wrapping for initPlan caching
- Context7 TanStack Query: useInfiniteQuery with cursor pagination, IntersectionObserver pattern
- Existing codebase migrations (26 files analyzed): RLS patterns, leads schema, pipeline stages needed
- Existing codebase services: patient-tags.service.ts pattern, typed client pattern
- npm registry: react-resizable-panels 4.10.0 (2026-04-11), allotment 1.20.5 (2025-12-19), version timestamps
- GitHub: bvaughn/react-resizable-panels (5,230 stars, actively maintained)

### Secondary (MEDIUM confidence)
- PITFALLS.md research (codebase-verified): RLS recursion, hardcoded pipeline, LGPD gaps
- FEATURES.md research: CRM feature landscape, competitive analysis
- GitHub repos: HardikQuantumCybernetic/hardik-dental (dental CRM with React+Supabase)
- GitHub repos: open-mercato/open-mercato (EAV typed columns migration, MikroORM)
- GitHub repos: LanternOps/breeze (custom field definitions schema, Drizzle ORM)
- GitHub repos: UnclePhilburt/StudyFlowSuite (Supabase consent_logs with RLS)
- GitHub repos: lucianoedipo/react-lgpd-consent (React 19 compatible LGPD library)
- GitHub repos: Arfazrll/POLABDC (dental SaaS, Next.js + Supabase)
- GitHub repos: SoulHiro/doutor-agenda (Portuguese medical clinic management, Next.js)

### Tertiary (LOW confidence)
- ILIKE sufficiency assumption for contact search at scale (no benchmark data)
- Web search was unavailable (API errors) -- some comparison data could not be verified from web sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified on npm registry and Context7
- Architecture: HIGH -- patterns follow existing codebase conventions and verified Supabase docs
- Pitfalls: HIGH -- codebase-verified RLS issues, existing migration history confirms patterns
- Custom field EAV: HIGH -- typed-column EAV validated against 2 independent open-source implementations (open-mercato, breeze)
- Split-view library: HIGH -- react-resizable-panels confirmed as best option via npm registry dates (4 releases in 3 weeks vs allotment's last release 4+ months ago)
- Consent pattern: MEDIUM -- based on StudyFlowSuite reference and LGPD library analysis, but no dental-specific LGPD implementation found
- Timeline query: MEDIUM -- UNION ALL pattern is standard but depends on verifying junction table schemas

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable domain, library versions may update)
