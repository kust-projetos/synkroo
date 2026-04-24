# Phase 1 CONTEXT: Foundation & Contacts

**Phase:** 01-foundation-contacts
**Created:** 2026-04-24
**Status:** Decisions captured, ready for research

---

## Decisions

### D1: Contact Layout — Unified Split-View

**Decision:** Single "Contatos" page showing patients + leads together with master-detail split-view.

**Details:**
- Left panel: searchable/filterable contact list
- Right panel: contact detail with sub-tabs (Timeline, Notas, Campos Customizados)
- Top tabs to filter by type: Todos | Pacientes | Leads
- "+" button to create new contact (patient or lead)
- Lead → Patient conversion happens inline in the detail panel
- Existing pages (`pacientes/`, `leads/`) will be replaced/refactored into this unified view

**Claude's Discretion:** Split-view responsive behavior (stack on mobile), column widths, animation details.

### D2: Custom Fields Storage — EAV with Typed Columns

**Decision:** Two-table EAV model with type-specific value columns.

**Schema:**
- `custom_field_definitions`: id, clinic_id, name, field_type (text|number|date|select|checkbox), options (JSONB for select choices), required, sort_order, is_active
- `custom_field_values`: id, definition_id, contact_id (polymorphic — references patient or lead), value_text TEXT, value_number NUMERIC, value_date DATE, value_boolean BOOLEAN, value_json JSONB

**Rationale:** Typed columns allow type-specific indexes and queries. JSONB value_json handles select and complex types. Better query performance than pure JSONB, more flexible than pure EAV with single value column.

**Claude's Discretion:** Index strategy (GIN on value_json, B-tree on value_text/value_date), migration naming.

### D3: Interaction Timeline — Card Feed with Type Filters

**Decision:** Feed of compact cards with filter chips by interaction type.

**Visual:** Each card shows type icon, description, relative date/time. Filter chips at top: All | Agendamentos | WhatsApp | Atividades | Notas.

**Data Sources (Phase 1):**
1. `appointments` — created, confirmed, cancelled, no_show events
2. `messages` (via `conversations`) — WhatsApp sent/received
3. `lead_activities` — calls, emails, meetings, status changes, qualification
4. `patient_observations` — manual notes added to contact

**Aggregation approach:** Server-side query with UNION ALL across sources, ordered by timestamp. Paginated with cursor-based loading (scroll infinite).

**Claude's Discretion:** Icon mapping per type, color scheme, pagination chunk size, cursor strategy.

### D4: Tags — Flat with Colors

**Decision:** Reuse existing `patients.tags TEXT[]` pattern, extend to leads. Add tag color support via `clinic_tags` metadata.

**Details:**
- Tags are flat (no hierarchy, no categories)
- Each clinic manages its own tag list (autocomplete from existing tags)
- Colors assigned per tag (stored in a `clinic_tags` reference or settings JSONB)
- GIN index already exists on patients.tags — extend to leads

**Claude's Discretion:** Color palette defaults, tag management UI location.

### D5: LGPD Consent — Dedicated Table with Profile Checkboxes

**Decision:** New `consents` table with per-purpose tracking and automatic audit log.

**Schema:**
- `consents`: id, clinic_id, contact_id, purpose (data_collection|marketing|whatsapp_communication), granted BOOLEAN, granted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, channel (web|whatsapp|manual), notes TEXT
- Audit via existing `audit_logs` table — every consent change logged

**UI:** Checkboxes in contact profile detail (Consent section). Three purposes with clear labels in Portuguese. Grant/revoke with timestamp tracking.

**Existing fields:** `patients.opt_out_marketing` and `patients.opt_out_reminders` will be migrated to consents table (data migration).

**Claude's Discretion:** Migration strategy for existing opt_out fields, consent UI layout details.

### D6: Search & Filters — Global Search + Sidebar Filters

**Decision:** Single search bar searching across name, phone, email, CPF. Sidebar/panel with advanced filters.

**Details:**
- Search bar: matches name (ILIKE), phone, email, CPF — uses existing `search-input.tsx`
- Filters: status (active/inactive/archived), type (patient/lead), tags (multi-select), last visit date range, custom field values
- Uses existing `filter-bar.tsx` component
- Supabase full-text or ILIKE for search (no external search service)

**Claude's Discretion:** Debounce timing, filter panel animation, empty state messaging.

---

## Database Changes Required

### New Tables
1. `pipeline_stages` — id, clinic_id, name, position INT, color, is_default BOOLEAN, is_system BOOLEAN (for new/converted/lost), created_at, updated_at
2. `custom_field_definitions` — as described in D2
3. `custom_field_values` — as described in D2
4. `consents` — as described in D5

### Modified Tables
1. `leads` — add `stage_id UUID REFERENCES pipeline_stages(id)`, keep `status` temporarily for migration, eventually drop CHECK constraint
2. `patients` — add `custom_fields JSONB DEFAULT '{}'` for quick-access cached values (optional optimization)
3. Both `patients` and `leads` — ensure `clinic_id` is indexed and present on all CRM-related tables

### Migrations
1. RLS consolidation: single `get_user_clinic()` helper, remove `get_current_clinic_id()`
2. Seed default pipeline stages for odontologia (new, contacted, qualified, proposal, negotiation, converted, lost)
3. Migrate `leads.status` → `leads.stage_id` with data preservation
4. Migrate `patients.opt_out_*` → `consents` table

---

## Reusable Assets (from Codebase)

| Asset | Location | Usage |
|-------|----------|-------|
| `data-table.tsx` | `components/ui/` | Contact list table |
| `search-input.tsx` | `components/ui/` | Global search bar |
| `filter-bar.tsx` | `components/ui/` | Sidebar filters |
| `detail-page.tsx` | `components/ui/` | Contact detail layout |
| `badge.tsx`, `status-badge.tsx` | `components/ui/` | Tags and status indicators |
| `dialog.tsx`, `sheet.tsx` | `components/ui/` | Create/edit forms |
| `tabs.tsx` | `components/ui/` | Type filter tabs |
| `empty-state.tsx` | `components/ui/` | No contacts state |
| `page-header.tsx` | `components/ui/` | Page header |
| Patients service | `services/patients/` | CRUD, tags, observations |
| Leads service | `services/leads/` | CRUD, scoring, stats |
| `createTypedClient()` | `lib/supabase/typed.ts` | RLS-enforced DB client |
| `getUserProfile()` | `lib/supabase/server.ts` | Auth + clinic context |

---

## Claude's Discretion

These implementation details are left to the researcher/planner:
- Split-view responsive behavior and breakpoints
- Column widths, animation, transition details
- Index strategy for custom_field_values
- Pagination chunk size for timeline
- Tag color palette defaults
- Migration naming and ordering
- Debounce timing for search
- Exact API route structure

---

## Deferred Ideas

None at this time. All scope stays within Phase 1 boundaries.

---

## Requirements Coverage

| Requirement | Decision |
|-------------|----------|
| CONT-01 (searchable list) | D1 (split-view) + D6 (global search + filters) |
| CONT-02 (detailed profile) | D1 (detail panel with info) |
| CONT-03 (CRUD) | D1 (create/edit/archive in detail panel) |
| CONT-04 (tags) | D4 (flat tags with colors) |
| CONT-05 (interaction timeline) | D3 (card feed, 4 sources) |
| CONT-06 (notes) | D3 (patient_observations as timeline source) |
| CF-01 (define custom fields) | D2 (definitions table + UI) |
| CF-02 (fill custom fields) | D2 (values table, detail panel) |
| CF-03 (search by custom fields) | D2 (typed columns) + D6 (filters) |
| CF-04 (import/export templates) | D2 (definitions exportable as JSON) |
| LGPD-01 (consent recording) | D5 (consents table + checkboxes) |
| LGPD-04 (audit log) | D5 (audit_logs integration) |

---

*Context captured: 2026-04-24*
*Next step: `/gsd-research-phase 1` or `/gsd-plan-phase 1`*
