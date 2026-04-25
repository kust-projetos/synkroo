# Phase 3: WhatsApp CRM - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can communicate with contacts via WhatsApp directly from the CRM, with automated appointment reminders and scheduled marketing campaigns.

**Requirements:** WHATS-01, WHATS-02, WHATS-03, WHATS-04, WHATS-05, WHATS-06, WHATS-07

**In scope:**
- In-CRM WhatsApp messaging (view history + send messages)
- Two-tab contact profile (Timeline + WhatsApp)
- Hybrid hub: conversas/ page as central hub + inline messages in contact profile
- Automatic appointment reminders with template-based configuration
- Reminder templates per procedure type (check-up → 48h, procedure → 24h)
- Reminder templates with placeholders ({{paciente_nome}}, {{data}}, {{horario}}, {{dentista}})
- WhatsApp campaigns (reactivation, follow-up, birthday)
- Template-first campaign creation with smart audience filters
- Campaign scheduling with metrics tracking
- Delivery status (sent, delivered, read) in both inline badges and campaign dashboard

**Out of scope:**
- Full multi-channel messaging (only WhatsApp for now)
- AI-generated message content (template-based only)
- Complex segmentation builder (smart filters per type only)
</domain>

<decisions>
## Implementation Decisions

### Messaging Integration
- **D-01:** Hybrid approach — `conversas/` page as hub, contact profile has inline WhatsApp messages
- **D-02:** Contact profile uses two tabs — "Timeline" tab (all interactions) + "WhatsApp" tab (messages only)
- **D-03:** Timeline unificada exists in Phase 1 (D3); new WhatsApp tab is additional, not replacement
- **D-04:** Evolution API already integrated for sending; webhook route exists for receiving

### Reminder Configuration
- **D-05:** Template-based reminders per procedure type — check-up defaults to 48h before, procedure defaults to 24h before
- **D-06:** Reminder templates support placeholders: {{paciente_nome}}, {{data}}, {{horario}}, {{dentista}}
- **D-07:** Clinics can customize template text; placeholders validated at save time
- **D-08:** Reminder triggered automatically when appointment is confirmed/scheduled

### Campaign Creation
- **D-09:** Template-first flow — select template, system suggests audience, customize, schedule
- **D-10:** Smart filters per campaign type:
  - Birthday → patients with birthday this week
  - Reactivation → patients inactive 30+ days
  - Follow-up → patients with recent procedure completed
- **D-11:** Campaign wizard: type → audience → template → schedule → confirm

### Delivery Status
- **D-12:** Inline status badges on each message — ✓ sent, ✓✓ delivered, 👁 read
- **D-13:** Campaign dashboard with aggregated metrics — sent/delivered/read counts + failure reasons
- **D-14:** Both inline + campaign-level tracking

### Claude's Discretion
- Exact placeholder syntax validation
- Campaign wizard UI layout and step flow
- Badge icon design for status
- Filter threshold values (30 days for reactivation, configurable)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Context (decisions that apply)
- `.planning/phases/01-foundation-contacts/01-CONTEXT.md` — split-view layout (D1), timeline aggregation (D3), tags pattern (D4)
- Timeline must aggregate: appointments, messages, lead_activities, patient_observations

### Phase 2 Context (Kanban)
- `.planning/phases/02-pipeline-sales/02-CONTEXT.md` — horizontal layout pattern, minimal UI preference

### Requirements
- `.planning/REQUIREMENTS.md` §WhatsApp (WHATS-01 through WHATS-07)

### Existing Code
- `src/app/api/whatsapp/webhook/route.ts` — Meta webhook verification + message reception
- `src/services/whatsapp/evolution.service.ts` — getEvolutionService() for sending messages
- `src/services/whatsapp/message-templates.service.ts` — placeholder validation, template CRUD
- `src/app/dashboard/conversas/page.tsx` — existing conversations page (expand for hub)
- `src/app/dashboard/campanhas/page.tsx` — existing campaigns page (expand for campaigns)
- `src/app/api/whatsapp/lead-capture/route.ts` — stub for PIPE-05 (Phase 2)

### UI Components (from Phase 1)
- `src/components/ui/tabs.tsx` — for contact profile two-tab layout
- `src/components/ui/badge.tsx` — for status indicators
- `src/components/ui/dialog.tsx` — for campaign wizard
- `src/components/ui/empty-state.tsx` — for empty states

### Services (from Phase 1)
- `services/leads/` — lead CRUD and scoring
- `services/patients/` — patient CRUD
- `lib/supabase/typed.ts` — createTypedClient() for RLS-enforced queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `webhook/route.ts`: Meta webhook verification + message parsing already implemented
- `evolution.service.ts`: getEvolutionService() for sending messages with instance management
- `message-templates.service.ts`: placeholder extraction + validation already done
- `conversas/page.tsx`: existing conversation list (15360 chars) — expand as hub
- `campanhas/page.tsx`: existing campaign page (11609 chars) — expand for campaign creation
- `lead-capture/route.ts`: stub endpoint ready for Phase 3 implementation

### Established Patterns
- Split-view with tabs: reuse from Phase 1 contact detail
- Badge system: reuse for delivery status indicators
- Wizard flow: modal-based step wizard

### Integration Points
- WhatsApp messages → contact profile (via messages table)
- Reminders → appointments confirmation flow (confirmation-handler.service.ts)
- Campaign metrics → campaign_recipients table (already exists)
</code_context>

<specifics>
## Specific Ideas

- WhatsApp tab in contact profile shows only WhatsApp messages (separate from timeline)
- Smart filter for reactivation: "inactive 30+ days" — configurable threshold
- Smart filter for birthday: patients WHERE birth_date month = current_month
- Status badges: ✓ (enviado), ✓✓ (entregue), 👁 (lido)
- Template placeholder validation: regex `^[a-zA-Z0-9_]+$`
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 03-whatsapp-crm*
*Context gathered: 2026-04-25*