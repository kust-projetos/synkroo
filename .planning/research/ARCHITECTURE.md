# Architecture Research: CRM Integration for Synkroo

**Domain:** CRM for dental clinics, integrated with existing calendar/WhatsApp app
**Researched:** 2026-04-24
**Confidence:** HIGH (based on thorough analysis of existing codebase patterns)

## System Overview

Synkroo already has substantial CRM-adjacent infrastructure. The architecture strategy is **extend, not rebuild**. The existing multi-tenant foundation (clinics, users with roles, patients, leads, appointments, conversations, treatment plans, budgets, campaigns) covers roughly 60% of a full CRM. The CRM milestone must fill the remaining gaps: customizable pipeline stages, unified contact management, structured interaction log, patient records with custom fields, and cross-module reporting.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│  Next.js 15 App Router (React 19) + Tailwind CSS + Radix UI         │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Dashboard│ Calendar │  Leads   │ Patients │Pipeline  │  Reports     │
│  /dash   │/agendam. │ /leads   │/paciente │ /pipeline│ /analytics   │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┤
│                      STATE MANAGEMENT LAYER                         │
│  Zustand (UI)          TanStack Query (server cache)                │
│  - calendar-store      - use-queries.ts (query keys + fetchers)    │
│  - [NEW] crm-store     - [NEW] CRM query hooks                     │
├─────────────────────────────────────────────────────────────────────┤
│                         API ROUTE LAYER                             │
│  /api/leads    /api/patients    /api/appointments   /api/campaigns  │
│  [NEW] /api/pipeline-stages    [NEW] /api/contacts                 │
│  [NEW] /api/interaction-log    [NEW] /api/custom-fields             │
│  [NEW] /api/crm/reports                                            │
├─────────────────────────────────────────────────────────────────────┤
│                       SERVICE LAYER                                 │
│  leads/  patients/  appointments/  followup/  budgets/  whatsapp/  │
│  [NEW] pipeline/   [NEW] contacts/   [NEW] interaction-log/        │
│  [NEW] custom-fields/   [NEW] reports/                              │
├─────────────────────────────────────────────────────────────────────┤
│                     DATA ACCESS LAYER                               │
│  Supabase Client (createTypedClient) + validateApiAuth()           │
│  RLS enforced via get_user_clinic() SECURITY DEFINER function       │
├─────────────────────────────────────────────────────────────────────┤
│                       DATABASE LAYER                                │
│  PostgreSQL (Supabase) — 18+ tables with clinic_id multi-tenancy   │
│  [NEW] pipeline_stages, contact_custom_fields, interaction_log      │
│  [MODIFIED] leads (add pipeline_stage_id), patients (add CRM cols) │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current State |
|-----------|----------------|---------------|
| API Routes (`/api/*`) | HTTP entry points, auth validation, request parsing, response formatting | Exists for leads, patients, appointments, etc. Follow same pattern |
| Services (`/services/*`) | Business logic, data transformation, cross-table operations | Exists for leads, patients, appointments. Extend for CRM |
| Zustand Stores | UI-only state (view selection, dialog open/close, filters) | calendar-store exists. Add crm-store for pipeline view state |
| TanStack Query Hooks (`use-queries.ts`) | Server state cache, deduplication, background refresh | Robust pattern exists with queryKeys factory. Add CRM keys |
| Zod Validations (`/lib/validations/*`) | Request body validation at API boundaries | Exists for leads, patients, appointments. Add pipeline, contacts |
| Supabase RLS | Row-level security via `get_user_clinic()` helper | Proven pattern with SECURITY DEFINER. Apply to new tables |

## Recommended Project Structure (Additions Only)

```
src/
├── app/
│   ├── api/
│   │   ├── pipeline-stages/          # NEW: CRUD for configurable pipeline
│   │   │   └── route.ts
│   │   ├── contacts/                 # NEW: Unified contact search (leads + patients)
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── interactions/
│   │   │           └── route.ts
│   │   ├── custom-fields/            # NEW: Dynamic field definitions
│   │   │   └── route.ts
│   │   ├── interaction-log/          # NEW: Cross-module interaction timeline
│   │   │   └── route.ts
│   │   └── crm/
│   │       └── reports/              # NEW: CRM-specific reports
│   │           └── route.ts
│   └── dashboard/
│       ├── pipeline/                 # NEW: Kanban pipeline view
│       │   └── page.tsx
│       ├── contatos/                 # NEW: Unified contacts page
│       │   └── page.tsx
│       └── prontuarios/              # NEW: Patient records with custom fields
│           └── [id]/
│               └── page.tsx
│
├── components/
│   ├── crm/                          # NEW: CRM feature components
│   │   ├── pipeline/
│   │   │   ├── PipelineBoard.tsx     # Kanban board with drag-and-drop
│   │   │   ├── PipelineColumn.tsx    # Single stage column
│   │   │   ├── PipelineCard.tsx      # Contact/lead card in column
│   │   │   └── StageEditDialog.tsx   # Edit/reorder stages
│   │   ├── contacts/
│   │   │   ├── ContactsTable.tsx     # Searchable, filterable table
│   │   │   ├── ContactDetail.tsx     # Full contact profile
│   │   │   └── ContactMerge.tsx      # Deduplicate contacts
│   │   ├── interactions/
│   │   │   ├── InteractionTimeline.tsx  # Chronological activity log
│   │   │   └── AddInteractionDialog.tsx # Manual interaction entry
│   │   ├── custom-fields/
│   │   │   ├── CustomFieldRenderer.tsx  # Dynamic field display
│   │   │   └── CustomFieldEditor.tsx    # Admin field builder
│   │   └── reports/
│   │       ├── ConversionFunnel.tsx
│   │       ├── PipelineMetrics.tsx
│   │       └── ContactAnalytics.tsx
│   └── calendar/                     # EXISTING — modifications noted below
│       └── hooks/
│           └── useCalendarEvents.ts  # MODIFY: enrich with contact data
│
├── services/
│   ├── pipeline/                     # NEW
│   │   ├── pipeline.service.ts       # Stage CRUD, reordering
│   │   └── pipeline-move.service.ts  # Move contacts between stages
│   ├── contacts/                     # NEW
│   │   ├── contacts.service.ts       # Unified search across leads + patients
│   │   └── contact-merge.service.ts  # Deduplication logic
│   ├── interaction-log/              # NEW
│   │   └── interaction-log.service.ts # Log queries, timeline generation
│   ├── custom-fields/                # NEW
│   │   └── custom-fields.service.ts  # Field definition CRUD
│   └── reports/                      # NEW
│       └── crm-reports.service.ts    # Aggregation queries
│
├── lib/
│   ├── hooks/
│   │   └── use-queries.ts            # MODIFY: add CRM query keys + hooks
│   └── validations/
│       ├── pipeline.ts               # NEW
│       ├── contact.ts                # NEW
│       └── interaction.ts            # NEW
│
└── types/
    ├── crm.ts                        # NEW: shared CRM types
    └── pipeline.ts                   # NEW: pipeline-specific types
```

### Structure Rationale

- **`/components/crm/` as new top-level:** CRM is a major domain. Grouping all CRM components under one folder prevents scattering across existing component directories and makes the CRM module self-contained for future niche expansion.
- **`/services/pipeline/` separate from leads:** Pipeline stages are clinic-level configuration, not lead-specific. Separation allows stages to be reused for patients or future entity types.
- **`/services/contacts/` as unified layer:** Leads and patients already exist as separate tables. The contacts service provides a unified read model that merges both, avoiding breaking changes to existing lead/patient code.
- **`/app/dashboard/pipeline/` as new page:** Follows existing pattern (leads, pacientes, agendamentos) — each feature gets its own dashboard route.

## Database Schema Design

### New Tables

#### 1. `pipeline_stages` -- Configurable funnel stages

```sql
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,          -- ordering
    color VARCHAR(7) DEFAULT '#6B7280',            -- hex color for UI
    is_default BOOLEAN DEFAULT false,              -- stage for new items
    is_won BOOLEAN DEFAULT false,                  -- marks "converted" stage
    is_lost BOOLEAN DEFAULT false,                 -- marks "lost" stage
    entity_type VARCHAR(20) NOT NULL DEFAULT 'lead', -- 'lead' or 'patient'
    auto_actions JSONB DEFAULT '[]',               -- future: auto-nudge, auto-assign
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(clinic_id, name, entity_type)
);

CREATE INDEX idx_pipeline_stages_clinic ON pipeline_stages(clinic_id, entity_type, position);
```

**Why a separate table instead of enum:** The leads table currently uses a CHECK enum for status (`new, contacted, qualified, proposal, negotiation, converted, lost`). This is hardcoded and cannot be customized per clinic. A `pipeline_stages` table lets each clinic define their own stages. The existing `leads.status` column is migrated to reference `pipeline_stages.id` via a new `pipeline_stage_id` column.

#### 2. `contact_custom_fields` -- Dynamic field definitions

```sql
CREATE TABLE contact_custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(200) NOT NULL,             -- display name
    field_type VARCHAR(30) NOT NULL DEFAULT 'text', -- text, number, date, select, multiselect, boolean
    field_options JSONB DEFAULT '[]',               -- options for select/multiselect
    applies_to VARCHAR(20) NOT NULL DEFAULT 'both', -- 'lead', 'patient', 'both'
    is_required BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(clinic_id, field_name)
);
```

#### 3. `contact_custom_field_values` -- EAV pattern for dynamic data

```sql
CREATE TABLE contact_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES contact_custom_fields(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,              -- 'lead' or 'patient'
    entity_id UUID NOT NULL,                       -- FK to leads.id or patients.id
    value_text TEXT,
    value_number DECIMAL(15,4),
    value_date DATE,
    value_boolean BOOLEAN,
    value_json JSONB,                              -- for multiselect, complex types
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(field_id, entity_type, entity_id)
);

CREATE INDEX idx_custom_field_values_entity ON contact_custom_field_values(entity_type, entity_id);
CREATE INDEX idx_custom_field_values_field ON contact_custom_field_values(field_id);
CREATE INDEX idx_custom_field_values_clinic ON contact_custom_field_values(clinic_id);
```

**Why EAV (Entity-Attribute-Value) for custom fields:** Each clinic will define different fields (e.g., "insurance provider", "treatment preference", "referral source"). EAV is the standard pattern for user-defined schemas in PostgreSQL. JSONB on the patients table is an alternative, but EAV provides type safety, validation, and per-field querying. The tradeoff is slightly more complex queries -- mitigated by a database view that pivots custom fields into a JSONB result.

#### 4. `interaction_log` -- Unified activity timeline

```sql
CREATE TABLE interaction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,              -- 'lead', 'patient'
    entity_id UUID NOT NULL,                       -- FK to leads.id or patients.id
    interaction_type VARCHAR(50) NOT NULL,          -- call, whatsapp, email, appointment, note, status_change, budget_sent, treatment_started
    direction VARCHAR(10),                          -- 'inbound', 'outbound', null for system events
    summary TEXT,
    details JSONB DEFAULT '{}',                     -- type-specific metadata
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT now(),
    source_table VARCHAR(50),                      -- 'appointments', 'messages', 'lead_activities', etc.
    source_id UUID,                                -- id in the source table
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_interaction_log_entity ON interaction_log(entity_type, entity_id, performed_at DESC);
CREATE INDEX idx_interaction_log_clinic_type ON interaction_log(clinic_id, interaction_type);
CREATE INDEX idx_interaction_log_performed_at ON interaction_log(performed_at DESC);
```

**Why a new table instead of using `lead_activities`:** The `lead_activities` table only covers leads. Patients have interactions too (appointments, WhatsApp messages, feedback). The `interaction_log` is a unified timeline that aggregates from all source tables. Existing `lead_activities` continue to work but are mirrored into `interaction_log` via database triggers.

#### 5. Database view: `contact_details` -- Unified contact read model

```sql
CREATE OR REPLACE VIEW contact_details AS
SELECT
    'lead' AS contact_type,
    l.id AS contact_id,
    l.clinic_id,
    l.name,
    l.phone,
    l.email,
    l.source,
    l.status,
    l.temperature,
    l.score,
    l.pipeline_stage_id,
    ps.name AS pipeline_stage_name,
    l.assigned_to,
    l.last_contact_at,
    l.next_followup_at,
    l.created_at,
    l.updated_at,
    COALESCE(
        jsonb_object_agg(
            cf.field_name,
            CASE
                WHEN cfv.value_text IS NOT NULL THEN to_jsonb(cfv.value_text)
                WHEN cfv.value_number IS NOT NULL THEN to_jsonb(cfv.value_number)
                WHEN cfv.value_date IS NOT NULL THEN to_jsonb(cfv.value_date)
                WHEN cfv.value_boolean IS NOT NULL THEN to_jsonb(cfv.value_boolean)
                WHEN cfv.value_json IS NOT NULL THEN cfv.value_json
                ELSE NULL
            END
        ) FILTER (WHERE cf.id IS NOT NULL),
        '{}'::jsonb
    ) AS custom_fields,
    -- Aggregated interaction counts
    COALESCE(il_stats.interaction_count, 0) AS interaction_count,
    COALESCE(il_stats.last_interaction_at, l.last_contact_at) AS last_interaction_at
FROM leads l
LEFT JOIN pipeline_stages ps ON l.pipeline_stage_id = ps.id
LEFT JOIN contact_custom_field_values cfv ON cfv.entity_type = 'lead' AND cfv.entity_id = l.id
LEFT JOIN contact_custom_fields cf ON cfv.id = cfv.field_id AND cf.is_active = true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS interaction_count, MAX(performed_at) AS last_interaction_at
    FROM interaction_log il WHERE il.entity_type = 'lead' AND il.entity_id = l.id
) il_stats ON true
WHERE l.deleted_at IS NULL
GROUP BY l.id, ps.name, il_stats.interaction_count, il_stats.last_interaction_at

UNION ALL

SELECT
    'patient' AS contact_type,
    p.id AS contact_id,
    p.clinic_id,
    p.name,
    p.phone,
    p.email,
    NULL AS source,
    'active' AS status,                           -- derived from last_visit_at
    NULL AS temperature,
    0 AS score,
    NULL AS pipeline_stage_id,
    NULL AS pipeline_stage_name,
    NULL AS assigned_to,
    NULL AS last_contact_at,
    NULL AS next_followup_at,
    p.created_at,
    p.updated_at,
    COALESCE(
        jsonb_object_agg(
            cf.field_name,
            CASE
                WHEN cfv.value_text IS NOT NULL THEN to_jsonb(cfv.value_text)
                WHEN cfv.value_number IS NOT NULL THEN to_jsonb(cfv.value_number)
                WHEN cfv.value_date IS NOT NULL THEN to_jsonb(cfv.value_date)
                WHEN cfv.value_boolean IS NOT NULL THEN to_jsonb(cfv.value_boolean)
                WHEN cfv.value_json IS NOT NULL THEN cfv.value_json
                ELSE NULL
            END
        ) FILTER (WHERE cf.id IS NOT NULL),
        '{}'::jsonb
    ) AS custom_fields,
    COALESCE(il_stats.interaction_count, 0) AS interaction_count,
    COALESCE(il_stats.last_interaction_at, p.last_visit_at) AS last_interaction_at
FROM patients p
LEFT JOIN contact_custom_field_values cfv ON cfv.entity_type = 'patient' AND cfv.entity_id = p.id
LEFT JOIN contact_custom_fields cf ON cfv.id = cfv.field_id AND cf.is_active = true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS interaction_count, MAX(performed_at) AS last_interaction_at
    FROM interaction_log il WHERE il.entity_type = 'patient' AND il.entity_id = p.id
) il_stats ON true
WHERE p.deleted_at IS NULL
GROUP BY p.id, il_stats.interaction_count, il_stats.last_interaction_at;
```

### Modified Tables (Migrations)

```sql
-- Add pipeline_stage_id to leads (nullable for backward compat, replaces status enum)
ALTER TABLE leads ADD COLUMN pipeline_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- Add CRM-relevant columns to patients
ALTER TABLE patients ADD COLUMN lifecycle_stage VARCHAR(30) DEFAULT 'active';
-- lifecycle_stage: 'lead', 'active', 'inactive', 'churned', 'reactivated'

-- Add interaction count cache columns for fast listing
ALTER TABLE leads ADD COLUMN interaction_count INTEGER DEFAULT 0;
ALTER TABLE patients ADD COLUMN interaction_count INTEGER DEFAULT 0;
```

### Triggers for Interaction Log Sync

```sql
-- Mirror lead_activities into interaction_log
CREATE OR REPLACE FUNCTION sync_lead_activities_to_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO interaction_log (clinic_id, entity_type, entity_id, interaction_type, summary, details, performed_by, performed_at, source_table, source_id)
    SELECT l.clinic_id, 'lead', NEW.lead_id, NEW.activity_type, NEW.description, NEW.metadata, NEW.performed_by, NEW.performed_at, 'lead_activities', NEW.id
    FROM leads l WHERE l.id = NEW.lead_id
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_lead_activities
    AFTER INSERT ON lead_activities
    FOR EACH ROW EXECUTE FUNCTION sync_lead_activities_to_log();

-- Mirror appointment status changes into interaction_log
CREATE OR REPLACE FUNCTION sync_appointments_to_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO interaction_log (clinic_id, entity_type, entity_id, interaction_type, summary, performed_by, performed_at, source_table, source_id)
        VALUES (NEW.clinic_id, 'patient', NEW.patient_id, 'appointment_created', 'Appointment scheduled', NULL, NEW.created_at, 'appointments', NEW.id);
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO interaction_log (clinic_id, entity_type, entity_id, interaction_type, summary, details, performed_by, performed_at, source_table, source_id)
        VALUES (NEW.clinic_id, 'patient', NEW.patient_id, 'appointment_status_change',
                'Status: ' || OLD.status || ' -> ' || NEW.status,
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'scheduled_at', NEW.scheduled_at),
                NULL, now(), 'appointments', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_appointments
    AFTER INSERT OR UPDATE OF status ON appointments
    FOR EACH ROW EXECUTE FUNCTION sync_appointments_to_log();

-- Mirror conversations/messages into interaction_log
CREATE OR REPLACE FUNCTION sync_messages_to_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO interaction_log (clinic_id, entity_type, entity_id, interaction_type, direction, summary, details, performed_at, source_table, source_id)
    SELECT c.clinic_id,
           CASE WHEN c.patient_id IS NOT NULL THEN 'patient' ELSE 'lead' END,
           COALESCE(c.patient_id, l.id),
           'whatsapp_message',
           NEW.direction,
           LEFT(NEW.content, 200),
           jsonb_build_object('message_type', NEW.message_type, 'conversation_id', NEW.conversation_id),
           NEW.created_at,
           'messages', NEW.id
    FROM conversations c
    LEFT JOIN leads l ON l.phone = c.external_id AND c.patient_id IS NULL
    WHERE c.id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Policies for New Tables

Follow the existing proven pattern using `get_user_clinic()`:

```sql
-- Pipeline Stages
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline stages from their clinic" ON pipeline_stages
    FOR SELECT USING (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can manage pipeline stages from their clinic" ON pipeline_stages
    FOR ALL USING (clinic_id = public.get_user_clinic(auth.uid()))
    WITH CHECK (clinic_id = public.get_user_clinic(auth.uid()));

-- Contact Custom Fields
ALTER TABLE contact_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view custom fields from their clinic" ON contact_custom_fields
    FOR SELECT USING (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Admins can manage custom fields" ON contact_custom_fields
    FOR ALL USING (
        clinic_id = public.get_user_clinic(auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    )
    WITH CHECK (
        clinic_id = public.get_user_clinic(auth.uid())
        AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    );

CREATE POLICY "Users can view custom field values from their clinic" ON contact_custom_field_values
    FOR SELECT USING (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can manage custom field values from their clinic" ON contact_custom_field_values
    FOR ALL USING (clinic_id = public.get_user_clinic(auth.uid()))
    WITH CHECK (clinic_id = public.get_user_clinic(auth.uid()));

-- Interaction Log
ALTER TABLE interaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interaction log from their clinic" ON interaction_log
    FOR SELECT USING (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can manage interaction log from their clinic" ON interaction_log
    FOR ALL USING (clinic_id = public.get_user_clinic(auth.uid()))
    WITH CHECK (clinic_id = public.get_user_clinic(auth.uid()));

-- Grant on the view
GRANT SELECT ON contact_details TO authenticated;
```

## Architectural Patterns

### Pattern 1: Service Layer Pattern (Existing -- Follow It)

**What:** All business logic lives in `/services/`. API routes are thin wrappers that parse requests, call services, and format responses. Components never access Supabase directly.

**When to use:** Every feature. This is the established pattern in Synkroo.

**Trade-offs:** Extra indirection layer, but enables testability and keeps API routes clean.

**Example (from existing leads pattern):**
```typescript
// services/pipeline/pipeline.service.ts
export async function getPipelineStages(clinicId: string, entityType: string) {
  const supabase = createTypedClient()
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('entity_type', entityType)
    .order('position', { ascending: true })

  if (error) throw new DatabaseError('Failed to fetch pipeline stages', error)
  return data
}

// app/api/pipeline-stages/route.ts
export async function GET(request: NextRequest) {
  const authResult = await validateApiAuth()
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
  }
  const { searchParams } = new URL(request.url)
  const stages = await getPipelineStages(authResult.profile!.clinic_id, searchParams.get('entity_type') || 'lead')
  return NextResponse.json({ stages })
}
```

### Pattern 2: TanStack Query Factory (Existing -- Extend It)

**What:** Centralized query key factory in `use-queries.ts` with typed fetcher. Each entity gets list + detail keys. Cache invalidation via query key matching.

**When to use:** All server data fetching from components.

**Trade-offs:** Single file grows large. Acceptable for now; split into `use-crm-queries.ts` when it exceeds 300 lines.

**Example (extend existing pattern):**
```typescript
// lib/hooks/use-queries.ts -- additions
export const queryKeys = {
  // ... existing keys ...
  pipelineStages: (clinicId: string, entityType?: string) =>
    ['pipeline-stages', clinicId, entityType] as const,
  contacts: (params?: string) => ['contacts', params] as const,
  contactDetail: (type: string, id: string) => ['contacts', type, id] as const,
  interactionLog: (entityType: string, entityId: string) =>
    ['interaction-log', entityType, entityId] as const,
  customFields: (clinicId: string) => ['custom-fields', clinicId] as const,
  crmReports: (params?: string) => ['crm-reports', params] as const,
}

export function usePipelineStages(clinicId: string, entityType = 'lead') {
  return useQuery({
    queryKey: queryKeys.pipelineStages(clinicId, entityType),
    queryFn: () => fetcher(`/api/pipeline-stages?entity_type=${entityType}`),
    staleTime: 5 * 60 * 1000, // stages rarely change
  })
}

export function useInteractionLog(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.interactionLog(entityType, entityId),
    queryFn: () => fetcher(`/api/interaction-log?entity_type=${entityType}&entity_id=${entityId}`),
    enabled: !!entityId,
  })
}
```

### Pattern 3: Trigger-Based Event Sync (New)

**What:** Database triggers automatically mirror events from existing tables (appointments, messages, lead_activities) into the unified `interaction_log`. No application code changes needed for existing features.

**When to use:** Whenever you need a unified timeline across modules that were built independently.

**Trade-offs:** Database triggers are harder to debug than application code. Mitigated by keeping triggers simple (INSERT only, no complex logic) and logging failures.

### Pattern 4: View-Based Read Model (New)

**What:** The `contact_details` database view provides a unified query interface across leads and patients with custom fields pivoted into JSONB. Components query one view instead of joining multiple tables.

**When to use:** When you need a unified contact list that spans multiple entity tables.

**Trade-offs:** Views add query overhead. For the MVP scale (hundreds to low thousands of contacts per clinic), this is negligible. If performance degrades at scale, replace with a materialized view refreshed on write.

## Data Flow

### CRM Contact Detail Page

```
User navigates to /dashboard/contatos/[id]
    |
    v
ContactDetail.tsx (component)
    |-- useContactDetail(type, id)     --> GET /api/contacts/[id]?type=lead
    |-- useInteractionLog(type, id)    --> GET /api/interaction-log?entity_type=lead&entity_id=...
    |-- useCustomFieldValues(type, id) --> included in contact detail response
    |-- usePatientAppointments(id)     --> GET /api/appointments?patient_id=... (existing)
    |
    v
Service Layer
    contacts.service.ts --> queries contact_details view
    interaction-log.service.ts --> queries interaction_log table
    |
    v
Supabase (RLS filters by clinic_id via get_user_clinic())
```

### Pipeline Kanban Board

```
User opens /dashboard/pipeline
    |
    v
PipelineBoard.tsx (component)
    |-- usePipelineStages(clinicId, 'lead')  --> GET /api/pipeline-stages?entity_type=lead
    |-- usePipelineContacts(clinicId)        --> GET /api/contacts?view=pipeline
    |
    v  (user drags card from one column to another)
    |
    v
onMoveContact(contactId, fromStageId, toStageId)
    |-- PATCH /api/leads/[id] { pipeline_stage_id: toStageId }
    |       --> leads.service.ts --> UPDATE leads SET pipeline_stage_id = ...
    |       --> TRIGGER fires: inserts into interaction_log (status_change)
    |       --> TanStack Query invalidates: pipelineStages, contacts
    |
    v
UI updates (optimistic update via useMutation + onMutate)
```

### Calendar <-> CRM Integration

```
User double-clicks appointment in calendar (existing behavior)
    |
    v
AppointmentDialog opens (existing component -- MODIFY)
    |-- [NEW] "View Patient/Contact" link in dialog header
    |-- [NEW] Last 3 interactions shown below appointment details
    |       --> useInteractionLog('patient', patientId)
    |
    v  (user clicks "View Contact")
    |
    v
Navigates to /dashboard/contatos/[patientId]?type=patient
    |-- Shows full interaction timeline, custom fields, appointments history
```

### Key Data Flows

1. **Lead enters system** (via WhatsApp bot or manual entry) -> `leads` table INSERT -> trigger fires -> `interaction_log` gets 'lead_created' entry -> contact appears in pipeline Kanban
2. **WhatsApp message received** -> `messages` table INSERT -> trigger fires -> `interaction_log` gets 'whatsapp_message' entry -> contact's `last_interaction_at` updates in view
3. **Appointment completed** -> `appointments` status UPDATE -> trigger fires -> `interaction_log` gets 'appointment_status_change' entry -> patient lifecycle_stage re-evaluated
4. **Lead converted to patient** -> `leads.status = 'converted'` + `leads.patient_id = new_patient_id` -> patient appears in contacts -> all prior lead interactions linked via source_id chain
5. **Custom field update** -> `contact_custom_field_values` UPSERT -> contact_details view reflects new value immediately

## Integration Points: New vs Modified

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| PipelineBoard | `/components/crm/pipeline/` | Kanban drag-and-drop board |
| PipelineColumn | `/components/crm/pipeline/` | Single pipeline stage column |
| PipelineCard | `/components/crm/pipeline/` | Contact card within column |
| ContactsTable | `/components/crm/contacts/` | Unified searchable contact list |
| ContactDetail | `/components/crm/contacts/` | Full contact profile with timeline |
| InteractionTimeline | `/components/crm/interactions/` | Chronological activity log |
| CustomFieldRenderer | `/components/crm/custom-fields/` | Dynamic field display/input |
| ConversionFunnel | `/components/crm/reports/` | Lead conversion visualization |
| PipelineMetrics | `/components/crm/reports/` | Pipeline health dashboard |
| CRM Store (Zustand) | `/components/crm/store/` or inline | Pipeline view state, filters |

### Modified Existing Components

| Component | Change | Risk |
|-----------|--------|------|
| `AppointmentDialog.tsx` | Add "View Contact" link + last 3 interactions | LOW -- additive only |
| `useCalendarEvents.ts` | Optionally enrich events with contact lifecycle_stage | LOW -- optional field |
| `use-queries.ts` | Add CRM query keys and hooks | LOW -- additive only |
| `/lib/validations/lead.ts` | Add `pipeline_stage_id` to schema | LOW -- optional field |
| Dashboard sidebar (`sidebar.tsx`) | Add Pipeline and Contacts nav items | LOW -- additive only |
| `dashboard-layout.tsx` | Remove hardcoded `DEMO_CLINIC_ID` -- use auth context | MEDIUM -- affects all pages |

### New API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/pipeline-stages` | GET, POST | List/create stages |
| `/api/pipeline-stages/[id]` | PATCH, DELETE | Update/delete stage |
| `/api/contacts` | GET | Unified search (leads + patients) |
| `/api/contacts/[id]` | GET | Contact detail with custom fields |
| `/api/interaction-log` | GET, POST | List/add interactions |
| `/api/custom-fields` | GET, POST | Manage field definitions |
| `/api/custom-fields/[id]` | PATCH, DELETE | Update/delete field |
| `/api/crm/reports` | GET | CRM analytics |

### New Database Objects

| Object | Type | Purpose |
|--------|------|---------|
| `pipeline_stages` | TABLE | Configurable funnel stages per clinic |
| `contact_custom_fields` | TABLE | Dynamic field definitions |
| `contact_custom_field_values` | TABLE | EAV storage for custom data |
| `interaction_log` | TABLE | Unified activity timeline |
| `contact_details` | VIEW | Unified contact read model |
| `sync_lead_activities_to_log()` | FUNCTION + TRIGGER | Mirror lead_activities into interaction_log |
| `sync_appointments_to_log()` | FUNCTION + TRIGGER | Mirror appointment changes into interaction_log |
| `sync_messages_to_log()` | FUNCTION + TRIGGER | Mirror messages into interaction_log |
| Default pipeline stages seed | SEED DATA | Standard stages for new clinics |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 contacts/clinic | Current architecture is ideal. View-based queries, trigger sync, standard indexes. |
| 500-5K contacts/clinic | Add pagination to all contact queries. Consider materialized view for `contact_details` with refresh on write. Add composite indexes on `(clinic_id, pipeline_stage_id)` for leads. |
| 5K+ contacts/clinic | Replace `contact_details` view with a denormalized `contacts` table maintained by triggers. Add full-text search with `tsvector` on contact name/phone. Consider separate read replica for reports. |

### Scaling Priorities

1. **First bottleneck:** `contact_details` view performance with many custom fields. Fix: materialized view or denormalized cache column with JSONB.
2. **Second bottleneck:** `interaction_log` table growth. Fix: partition by `clinic_id` or by month. Add archiving for interactions older than 2 years.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying existing lead/patient table schemas heavily

**What people do:** Add 20 new columns to `leads` or `patients` for CRM fields.
**Why it is wrong:** Schema changes on core tables are risky. Hard to customize per clinic. Migration pain.
**Do this instead:** Use the `contact_custom_fields` EAV pattern for all user-defined fields. Only add index-friendly cache columns (like `interaction_count`) to core tables.

### Anti-Pattern 2: Application-level event sync instead of database triggers

**What people do:** Write application code that inserts into `interaction_log` every time a service method runs.
**Why it is wrong:** Forgets edge cases (direct SQL updates, batch operations, missed code paths). Creates dual-write consistency issues.
**Do this instead:** Database triggers guarantee every INSERT/UPDATE is captured regardless of how the data changes. Keep triggers simple (INSERT only into log table).

### Anti-Pattern 3: Merging leads and patients into one table

**What people do:** Create a single `contacts` table that replaces both `leads` and `patients`.
**Why it is wrong:** Leads have different fields (score, temperature, source) from patients (cpf, birth_date, risk_score). Merging them forces nullable columns or JSONB sprawl. Breaks all existing code that references `leads` and `patients` tables.
**Do this instead:** Keep existing tables. Use the `contact_details` view for unified reads. The view provides the unified interface without breaking the existing schema.

### Anti-Pattern 4: Building pipeline as a separate entity from leads

**What people do:** Create a `pipeline_entries` table that duplicates lead data.
**Why it is wrong:** Data duplication, sync issues, cache invalidation complexity.
**Do this instead:** Add `pipeline_stage_id` to `leads` directly. The pipeline is a view on leads, not a separate data structure. This is simpler and avoids sync issues.

## Build Order (Dependency-Aware)

```
Phase 1: Foundation (no UI dependencies)
  1.1  Database migration: pipeline_stages table + RLS + seed data
  1.2  Database migration: interaction_log table + RLS
  1.3  Database migration: contact_custom_fields + contact_custom_field_values + RLS
  1.4  Database triggers: sync_lead_activities, sync_appointments, sync_messages
  1.5  Database migration: ALTER leads ADD pipeline_stage_id
  1.6  Database view: contact_details
  1.7  Regenerate database.types.ts
  1.8  Zod validations: pipeline.ts, contact.ts, interaction.ts
  1.9  Services: pipeline.service.ts, interaction-log.service.ts, custom-fields.service.ts

Phase 2: API Layer (depends on Phase 1)
  2.1  API routes: /api/pipeline-stages (CRUD)
  2.2  API routes: /api/interaction-log (GET, POST)
  2.3  API routes: /api/custom-fields (CRUD)
  2.4  API routes: /api/contacts (GET - unified search)
  2.5  TanStack Query hooks in use-queries.ts

Phase 3: Pipeline UI (depends on Phase 2)
  3.1  PipelineBoard + PipelineColumn + PipelineCard components
  3.2  Zustand crm-store (pipeline view state)
  3.3  StageEditDialog (admin: create/reorder stages)
  3.4  Dashboard sidebar: add Pipeline nav item
  3.5  Dashboard page: /dashboard/pipeline

Phase 4: Contacts UI (depends on Phase 2)
  4.1  ContactsTable component (search, filter, sort)
  4.2  ContactDetail component with tabs (info, interactions, appointments)
  4.3  InteractionTimeline component
  4.4  CustomFieldRenderer + CustomFieldEditor
  4.5  Dashboard sidebar: add Contacts nav item
  4.6  Dashboard page: /dashboard/contatos

Phase 5: Calendar Integration (depends on Phase 4)
  5.1  Modify AppointmentDialog: add "View Contact" link
  5.2  Modify AppointmentDialog: show last 3 interactions
  5.3  Dashboard page: /dashboard/prontuarios/[id] (patient records)

Phase 6: Reports & Automations (depends on Phases 3-5)
  6.1  API route: /api/crm/reports
  6.2  Service: crm-reports.service.ts
  6.3  ConversionFunnel, PipelineMetrics components
  6.4  Dashboard page: enhance /dashboard/analytics with CRM metrics
```

## Sources

- Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security (verified 2026-04-24)
- Existing Synkroo codebase: migrations, services, API routes, components analyzed in full
- Existing patterns: `get_user_clinic()` SECURITY DEFINER, `validateApiAuth()`, `queryKeys` factory, Zustand calendar-store

---
*Architecture research for: CRM integration into Synkroo (Next.js 15 + Supabase)*
*Researched: 2026-04-24*
