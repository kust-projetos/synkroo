# Technology Stack - CRM Features

**Project:** Synkroo CRM Milestone (v0.2.0)
**Researched:** 2026-04-24
**Context:** Adding CRM features to an existing Next.js 15 + Supabase calendar/kanban app for dental clinics.

---

## Critical Finding: Substantial Foundation Already Exists

Before recommending additions, the existing codebase already contains significant CRM infrastructure:

**Database tables:** `clinics`, `patients`, `leads`, `lead_activities`, `appointments`, `follow_ups`, `campaigns`, `conversations`, `messages`, `dentists`, `procedures`, `schedule_blocks`, `knowledge_base`

**Services built:** Leads service, patient management (dedup, history, tags, preferences), follow-up service, campaign service, reminder service, WhatsApp multi-provider (Evolution API + Business API + Playwright), analytics (attendance metrics, no-show prediction, ROI), budget service, queue system, multi-agent AI orchestration, RAG/embedding, memory management (L1-L5 layers)

**UI pages built:** Dashboard, leads (list/detail/new), patients (list/detail/edit/new/inactive), campaigns, conversations, dentists, procedures, analytics, waitlist, settings, appointments

**UI components built:** Calendar (Month/Week/Day + drag-and-drop), data-table, filter-bar, stats-grid, charts (day-of-week, trends, hourly), chat-widget, notification system, all Radix UI primitives

**What is actually MISSING or needs upgrade:**
1. No drag-and-drop Kanban/pipeline board component
2. No dynamic form builder for custom patient/lead fields
3. No react-hook-form integration (forms are currently unmanaged or hand-rolled)
4. No scheduled automation engine (pg_cron + Edge Functions not yet wired)
5. Reporting needs expansion (recharts already installed but underutilized)

---

## Recommended Stack Additions

### Form Management (NEW)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hook-form` | ^7.73.0 | Performant form state management for all CRM forms | Zero to minimal re-renders, built-in validation, `useFieldArray` for dynamic custom fields, proven at scale. The project has complex forms (lead creation, patient registration, campaign setup) that currently lack structured form management. |
| `@hookform/resolvers` | ^5.2.0 | Connect react-hook-form to Zod schemas | Project already uses Zod (^3.23.8) for validation. This bridges form state to existing schemas so validation is defined once and used everywhere. |

**Confidence:** HIGH - Context7 verified react-hook-form v7.66+ with Zod resolver integration and `useFieldArray` for dynamic fields.

### Kanban / Pipeline Board (NEW)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@hello-pangea/dnd` | ^18.0.0 | Drag-and-drop for the sales pipeline Kanban board | Maintained fork of react-beautiful-dnd. Simpler API than dnd-kit for the Kanban column-to-column pattern the CRM needs. Supports vertical lists within columns, cross-column dragging, and keyboard accessibility. The pipeline view is column-based (status stages) with cards moving between them - exactly the pattern this library was designed for. |

**Why not dnd-kit (^6.3.0):** dnd-kit is more powerful and flexible, but its lower-level API requires significantly more boilerplate for the standard Kanban pattern. The project already uses `@event-calendar/core` for calendar drag-and-drop, so `@hello-pangea/dnd` covers the pipeline use case without overlap. If custom collision detection or complex multi-axis drag is needed later, dnd-kit can be introduced then.

**Confidence:** HIGH - Context7 verified both libraries. @hello-pangea/dnd v18 is actively maintained.

### Automation Engine (Infra, not a library)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase `pg_cron` extension | Built-in | Schedule recurring CRM automations (reminders, follow-ups, lead scoring) | Already available in Supabase PostgreSQL. Verified via Context7: `cron.schedule()` + `net.http_post()` can trigger Edge Functions on cron schedules. No new dependency needed. |
| Supabase Edge Functions (Deno) | Built-in | Execute automation logic (reminder dispatch, lead scoring recalculation, follow-up triggers) | Already available in Supabase infrastructure. The project has the service layer (`reminders`, `followup`, `leads`) but no cron triggers wiring them to scheduled execution. |

**No new library needed.** The automation engine is a pattern using existing Supabase infrastructure:
- `pg_cron` for scheduling SQL that calls Edge Functions
- Edge Functions for business logic execution
- Supabase Realtime for pushing updates to the UI

**Confidence:** HIGH - Context7 verified pg_cron + net.http_post pattern for Supabase.

### Reporting Enhancements (Already Installed)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `recharts` | ^3.8.1 (installed) | CRM dashboards, funnel visualization, conversion analytics | Already installed. Context7 confirmed FunnelChart support (for sales pipeline visualization), ComposedChart (multi-metric dashboards), Treemap (procedure/category breakdowns), and all standard chart types. No new charting library needed. |

**No new dependency.** Recharts 3.x covers all CRM reporting needs: funnel charts for pipeline conversion, bar/line charts for trend analysis, pie charts for source distribution, area charts for revenue over time.

**Confidence:** HIGH - Context7 verified recharts v3.2+ FunnelChart, Sankey, Treemap support.

### Data Table Enhancement (NEW)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tanstack/react-table` | ^8.21.0 | Advanced table features for CRM lists (sorting, filtering, pagination, row selection) | The project has a basic `data-table.tsx` component. TanStack Table provides headless utilities for complex CRM list views: multi-column sorting, faceted filters, row selection for bulk actions, virtual scrolling for large datasets. Essential for leads list, patient list, and interaction history. |

**Confidence:** HIGH - TanStack Table v8 is the standard for React data tables. Headless approach integrates with existing Tailwind + Radix styling.

---

## What NOT to Add

| Rejected | Category | Reason |
|----------|----------|--------|
| `@dnd-kit/core` | DnD | Overkill for standard Kanban. @hello-pangea/dnd covers the pipeline pattern with less complexity. |
| `whatsapp-web.js` | WhatsApp | Project already has Evolution API integration (production-grade). Adding whatsapp-web.js would be redundant and less reliable than Evolution API. |
| `@whiskeysockets/baileys` | WhatsApp | v7.0.0-rc.9 is still in RC. Evolution API already wraps Baileys internally. No reason to add direct dependency. |
| `formidable` / `react-final-form` | Forms | react-hook-form dominates in performance and React 19 compatibility. These are legacy choices. |
| `chart.js` / `nivo` / `victory` | Charts | Recharts already installed and covers all CRM visualization needs. Adding another charting library creates inconsistency. |
| `bull` / `bullmq` | Queue | Project already has a custom queue service (`src/services/queue/`). pg_cron + Edge Functions handles scheduled tasks. BullMQ would add Redis dependency unnecessarily. |
| `nodemailer` | Email | Not in scope for this milestone. WhatsApp is the primary communication channel. |
| Custom form builder SDK | Forms | react-hook-form + Zod + useFieldArray provides dynamic fields without a heavyweight form builder dependency. Custom field storage is a JSONB column pattern in PostgreSQL, not a frontend library. |
| Dental-specific API (e.g., Dentalink, DOC.me) | Integration | Out of scope per PROJECT.md. Modular patient records with custom fields is the approach, not dental-specific API integrations. |

---

## Existing Stack (No Changes Needed)

These are already in the project and sufficient for CRM features:

| Technology | Version | CRM Role |
|------------|---------|----------|
| `zod` | ^3.23.8 | Schema validation for all CRM entities (leads, patients, campaigns) |
| `zustand` | ^5.0.12 | Client-side UI state (pipeline view filters, selected leads, form drafts) |
| `@tanstack/react-query` | ^5.97.0 | Server state management (contacts, leads, interactions, reports) |
| `date-fns` | ^4.1.0 | Date manipulation for scheduling, follow-ups, reporting periods |
| `lucide-react` | ^1.7.0 | Icons for CRM UI |
| `cmdk` | ^1.1.1 | Command palette for quick CRM navigation |
| `jspdf` + `jspdf-autotable` | ^4.2.1 / ^5.0.7 | PDF export for reports and patient records |
| `@radix-ui/*` | Various | All UI primitives needed (Dialog, Select, Tabs, Popover, etc.) |
| `next-themes` | ^0.4.6 | Dark mode for CRM dashboards |

---

## Installation

```bash
# New dependencies for CRM features
npm install react-hook-form @hookform/resolvers @hello-pangea/dnd @tanstack/react-table

# Verify versions
npm ls react-hook-form @hookform/resolvers @hello-pangea/dnd @tanstack/react-table
```

Total new dependencies: **4 packages** (plus their type dependencies, all zero-config with existing Tailwind/Radix setup).

---

## Database Additions Needed (Not Libraries)

The CRM milestone requires new tables/columns, not new databases or ORMs:

| Addition | Purpose |
|----------|---------|
| `pipeline_stages` table | Customizable sales funnel stages per clinic (position, name, color, probability) |
| `custom_fields` table | Modular fields for patient records (field_name, field_type, field_options, clinic_id) |
| `custom_field_values` table | EAV pattern for storing custom field data per patient |
| `automations` table | Automation rules (trigger, conditions, actions) for reminder/follow-up configuration |
| `interaction_log` table | Unified timeline of all patient/lead interactions (calls, messages, appointments, no-shows) |
| `pipeline_stages` column on `leads` | Replace hardcoded `status` VARCHAR with FK to customizable stages |

These are PostgreSQL/Supabase migrations, not new technology dependencies.

---

## Sources

- Context7: react-hook-form v7.66+ documentation (useFieldArray, zodResolver integration)
- Context7: @hello-pangea/dnd v18 (Kanban board patterns, Droppable/Draggable API)
- Context7: dnd-kit v6.3 (Sortable, multi-list scenarios - evaluated, not chosen)
- Context7: Supabase pg_cron (cron.schedule + net.http_post pattern)
- Context7: recharts v3.2+ (FunnelChart, ResponsiveContainer, all chart types)
- npm registry: version checks for all candidate libraries
- Project source: package.json, migrations/, services/, components/ analysis
