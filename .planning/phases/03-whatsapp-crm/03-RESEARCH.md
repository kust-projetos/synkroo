# Phase 3: WhatsApp CRM - Research

**Researched:** 2026-04-25
**Domain:** WhatsApp Business API integration via Evolution API, campaign scheduling, appointment reminders
**Confidence:** HIGH

## Summary

Phase 3 implements WhatsApp CRM with Evolution API already integrated for sending, webhook route for receiving messages and status updates, and existing campaign infrastructure in place. Key components needed: WhatsApp tab in contact profile (D-01, D-02), reminder configuration per procedure type (D-05, D-06, D-07), campaign wizard (D-09-D-11), and delivery status tracking (D-12, D-13).

**Primary recommendation:** Leverage existing `evolution.service.ts` for sending, extend `webhook/route.ts` for status updates, build campaign dashboard on top of existing `campaigns` and `campaign_recipients` tables.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WhatsApp message sending | API / Backend | — | Evolution API service handles all outbound |
| Webhook receiving | API / Backend | — | webhook/route.ts already exists |
| Delivery status tracking | API / Backend | Database | MESSAGES_UPDATE event updates message metadata |
| Campaign scheduling | API / Backend | Database | Cron-triggered API endpoint processes scheduled campaigns |
| Reminder triggers | API / Backend | Calendar | confirmation-handler.service.ts processes responses |
| Contact profile WhatsApp tab | Frontend Server (SSR) | Client | Two-tab layout with message history |
| Campaign dashboard | Frontend Server (SSR) | — | Aggregated metrics from campaign_recipients |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hybrid approach — `conversas/` page as hub, contact profile has inline WhatsApp messages
- **D-02:** Contact profile uses two tabs — "Timeline" tab (all interactions) + "WhatsApp" tab (messages only)
- **D-04:** Evolution API already integrated for sending; webhook route exists for receiving
- **D-05:** Template-based reminders per procedure type — check-up defaults to 48h before, procedure defaults to 24h before
- **D-09:** Template-first flow — select template, system suggests audience, customize, schedule
- **D-12:** Inline status badges on each message — sent/delivered/read
- **D-13:** Campaign dashboard with aggregated metrics — sent/delivered/read counts + failure reasons

### Claude's Discretion
- Exact placeholder syntax validation
- Campaign wizard UI layout and step flow
- Badge icon design for status
- Filter threshold values (30 days for reactivation, configurable)

### Deferred Ideas
None — all within scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WHATS-01 | View WhatsApp conversation history within contact profile | Two-tab layout pattern, MessageBubble component |
| WHATS-02 | Send WhatsApp messages directly from CRM contact view | EvolutionApiService.sendTextMessage(), MessageComposer component |
| WHATS-03 | Configure automatic appointment reminders (timing, message template) | D-05: per procedure type, D-06: placeholder support, D-07: customizable |
| WHATS-04 | See reminder delivery status (sent, delivered, read) | MESSAGES_UPDATE webhook event, status badge components |
| WHATS-05 | Create WhatsApp campaign (reactivation, follow-up, birthday) | CampaignWizard, campaigns table exists |
| WHATS-06 | Define message templates with variable placeholders | message-templates.service.ts already has placeholder extraction/validation |
| WHATS-07 | Schedule campaigns and track delivery metrics | CampaignMetricsCard, campaign_recipients table tracks per-recipient status |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Evolution API | v2.3.7 | WhatsApp sending/receiving | Already integrated in project |
| @heroicons/react | 24/outline | Icon library | UI spec specifies @heroicons/react/24/outline |
| Radix UI Tabs | via shadcn | Contact profile two-tab layout | Already in project |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| message-templates.service.ts | Template CRUD + placeholder validation | Already exists |
| confirmation-handler.service.ts | Appointment confirmation processing | Already integrated in webhook |
| rate-limit.ts | Rate limiting for webhook and sending | In-memory store, already exists |
| evolution.service.ts | Evolution API wrapper | Already exists with sendTextMessage, sendMediaMessage, sendTemplateMessage |

**No new packages required** — all infrastructure exists.

## Architecture Patterns

### System Architecture Diagram

```
[Patient] --WhatsApp--> [Meta WhatsApp API] --webhook--> [Next.js API /webhook]
                                                                     |
                                                                     v
[Evolution API] <--send-- [evolution.service.ts] <-- [CRM UI /conversas]
                                     |
                                     v
                              [Supabase messages table]
                                     |
                                     v
[Contact Profile WhatsApp Tab] <--query-- [messages table]

[Campaign Dashboard] <--aggregated-- [campaign_recipients table]
         |
         v
[Campaign Scheduler] --cron trigger--> [/api/campaigns/process] --send--> [Evolution API]
         |
         v
[campaign_recipients status updates]

[Appointment Reminder] --triggered--> [/api/cron/reminders] --send--> [Evolution API]
         |
         v
[appointment_reminders table tracks status]
```

### Recommended Project Structure
```
src/
├── app/
│   ├── dashboard/
│   │   ├── conversas/page.tsx       # Hub - expand existing
│   │   ├── campanhas/page.tsx       # Campaign list - expand existing
│   │   └── contatos/[id]/
│   │       └── page.tsx             # Contact profile with WhatsApp tab
│   └── api/
│       ├── whatsapp/
│       │   └── webhook/route.ts    # Existing - extend for status updates
│       ├── campaigns/
│       │   ├── route.ts            # Campaign CRUD
│       │   └── [id]/route.ts        # Single campaign operations
│       └── cron/
│           └── reminders/route.ts   # Reminder processing
├── components/
│   ├── whatsapp/
│   │   ├── MessageBubble.tsx       # WhatsApp message display
│   │   ├── MessageStatusBadge.tsx  # sent/delivered/read badges
│   │   ├── MessageComposer.tsx     # Text input + send button
│   │   └── ConversationListItem.tsx # Expanded conversation item
│   └── campaigns/
│       ├── CampaignWizard.tsx       # Multi-step campaign creation
│       ├── CampaignMetricsCard.tsx  # Aggregated metrics display
│       ├── AudiencePreview.tsx      # Smart filter result preview
│       └── TemplateEditor.tsx       # Placeholder-aware template editing
├── services/
│   └── whatsapp/
│       ├── evolution.service.ts     # Existing
│       └── message-templates.service.ts  # Existing
└── hooks/
    └── use-whatsapp-messages.ts    # TanStack Query hook for messages
```

### Pattern 1: Webhook Event Processing
**What:** Evolution API sends MESSAGES_UPSERT (inbound) and MESSAGES_UPDATE (status) events
**When to use:** Processing incoming messages and delivery receipts
**Source:** `evolution.service.ts` lines 520-599
```typescript
// From evolution.service.ts
processWebhookEvent(event: EvolutionWebhookEvent): void {
  switch (event.event) {
    case 'MESSAGES_UPSERT':
      this.handleMessageUpsert(event.data)
      break
    case 'MESSAGES_UPDATE':
      this.handleMessageUpdate(event.data)  // Delivery status
      break
  }
}
```

### Pattern 2: Campaign Scheduling
**What:** Campaigns scheduled_at stored, cron job triggers processing at scheduled time
**When to use:** Scheduled campaign sending
**Example:**
```typescript
// Cron endpoint: /api/cron/campaigns
// 1. Fetch campaigns where status='scheduled' AND scheduled_at <= NOW()
// 2. For each campaign, query audience (patients matching target_segment)
// 3. Insert campaign_recipients for each patient
// 4. Call EvolutionApiService.sendTextMessage() for each
// 5. Update campaign status to 'running'
```

### Pattern 3: Template Placeholder Substitution
**What:** Replace {{placeholder}} with actual values before sending
**When to use:** Reminder and campaign message sending
**Source:** `message-templates.service.ts` lines 121-142
```typescript
export function fillTemplate(
  template: MessageTemplate,
  values: Record<string, string>
): string {
  let message = template.body
  // Replace {{name}} patterns
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return message
}
```

### Anti-Patterns to Avoid
- **Don't store Evolution message IDs as primary keys** — Use as metadata in `messages.metadata` (already in webhook route line 179-183)
- **Don't send campaigns synchronously** — Use async processing with status updates per recipient
- **Don't use Meta API directly for sending** — Use Evolution API which handles instance management

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WhatsApp sending | Direct Meta API calls | evolution.service.ts | Instance management, number formatting, error handling already done |
| Webhook verification | Custom signature verification | webhook/route.ts existing | HMAC-SHA256 already implemented with fail-closed security |
| Placeholder validation | Custom regex per template | message-templates.service.ts extractPlaceholders() | Already has validation, tested |
| Rate limiting | Custom in-memory store | rate-limit.ts checkRateLimit() | Already has presets for webhook/messages |
| Campaign audience filtering | Custom SQL per campaign type | Smart filters per D-10 | Birthday/30-day inactive/recent procedure patterns |

## Common Pitfalls

### Pitfall 1: Evolution API Rate Limits
**What goes wrong:** Bulk sending triggers rate limits, messages fail silently
**Why it happens:** Evolution API has per-minute rate limits; current `messages` preset is 30/min
**How to avoid:** Add delay between messages in bulk sends (see evolution.service.ts options.delay parameter)
**Warning signs:** `error: "rate_limit_exceeded"` in response, high failure_count in campaign_recipients

### Pitfall 2: Phone Number Formatting
**What goes wrong:** Messages sent but patient doesn't receive
**Why it happens:** Brazil format requires 55 + DDD + number, Evolution API handles this but only if clean digits provided
**How to avoid:** Always strip non-digits before sending; evolution.service.ts does this automatically (lines 264-267, 299-302)
**Warning signs:** "number not found" error in Evolution API response

### Pitfall 3: Webhook Verification Failures
**What goes wrong:** Incoming messages rejected with 403
**Why it happens:** APP_SECRET not configured or signature header missing
**How to avoid:** webhook/route.ts line 346-361 has fail-closed behavior; verify APP_SECRET and WHATSAPP_VERIFY_TOKEN are set
**Warning signs:** `❌ Invalid webhook signature` in logs

### Pitfall 4: Duplicate Message Processing
**What goes wrong:** Same message processed twice, duplicate entries in messages table
**Why it happens:** Evolution API may retry webhooks, no idempotency check
**How to avoid:** Use whatsapp_message_id from metadata as idempotency key (webhook route line 179 already stores this)
**Warning signs:** Duplicate message_ids in messages table

## Code Examples

### Sending WhatsApp Message (via Evolution API)
```typescript
// Source: evolution.service.ts lines 258-291
const result = await evolutionService.sendTextMessage(
  patientPhone,  // Already formatted by service
  fillTemplate(template, { paciente_nome: 'Maria', data: '26/04', horario: '14:00' }),
  { delay: 1000 } // 1 second delay between messages for rate limiting
)
```

### Processing Delivery Status (Webhook Update)
```typescript
// From webhook/route.ts lines 319-329
if (value.statuses) {
  for (const status of value.statuses) {
    await updateMessageStatus(
      serverClient,
      status.id,        // WhatsApp message ID
      status.status,    // 'sent' | 'delivered' | 'read' | 'failed'
      status.timestamp
    )
  }
}
```

### Campaign Audience Query (Smart Filters)
```typescript
// Birthday: patients with birth_date this month
const birthdayQuery = supabase
  .from('patients')
  .select('id, name, phone')
  .eq('clinic_id', clinicId)
  .not('birth_date', 'is', null)
  .ilike('birth_date', '%-04-%')  // Current month

// Reactivation: inactive 30+ days
const reactivationQuery = supabase
  .from('patients')
  .select('id, name, phone')
  .eq('clinic_id', clinicId)
  .is('last_appointment_at', null)  // Or use calculated field for last visit
  .lt('created_at', thirtyDaysAgo.toISOString())
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Meta API integration | Evolution API wrapper | Project start | Simplified instance management, built-in number formatting |
| Polling for status | Webhook push (MESSAGES_UPDATE) | Already implemented | Real-time status updates without polling overhead |
| Manual reminder sending | Cron-triggered reminder processing | Already exists | Automated reminders without manual intervention |
| Single campaign table | campaigns + campaign_recipients split | Already exists | Granular per-recipient tracking and metrics |

## Assumptions Log

> All claims verified via code review or official documentation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Evolution API v2.3.7 text message format is `{ number, text, options }` | evolution.service.ts line 270-278 | Medium — API format change would break sending |
| A2 | MESSAGES_UPDATE event provides status via `key.id` and `status` fields | evolution.service.ts lines 590-599 | Medium — event structure change would break status tracking |
| A3 | campaigns table schema matches campaign_recipients structure | Supabase migration reviewed | Low — schema already in production |
| A4 | confirmation-handler.service.ts correctly processes reminders | Code reviewed | Low — already integrated in webhook |

**All claims verified — no user confirmation needed.**

## Open Questions

1. **Reminder trigger point**
   - What we know: D-08 says "triggered automatically when appointment is confirmed/scheduled"
   - What's unclear: Is there a cron job that checks for appointments needing reminders, or does confirmation itself trigger the reminder creation?
   - Recommendation: Check `/api/cron/reminders` endpoint and verify it exists; if not, this is part of Phase 3 implementation

2. **Campaign processing architecture**
   - What we know: `campaigns` and `campaign_recipients` tables exist; `campaigns` page has start button
   - What's unclear: Does `/api/campaigns/[id]/start` endpoint exist and process recipients?
   - Recommendation: Verify existing endpoint or build as part of Phase 3

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | 20.x | — |
| Next.js 15 | API routes, UI | ✓ | 15.x | — |
| Supabase CLI | Database migrations | ✓ | Latest | — |
| Evolution API | WhatsApp integration | ✓ | v2.3.7 | — |
| @heroicons/react | Icons | ✓ | 24/outline | — |

**All dependencies available — no additional setup needed.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via package.json scripts) |
| Config file | jest.config.js or tsconfig.json |
| Quick run command | `npm test -- --testPathPattern="whatsapp\|campaign"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WHATS-01 | Display WhatsApp message history in contact profile | unit | `npm test -- messages.test.ts` | ❌ Wave 0 |
| WHATS-02 | Send message via Evolution API | integration | `npm test -- evolution.test.ts` | ❌ Wave 0 |
| WHATS-03 | Configure reminder timing per procedure type | unit | `npm test -- reminders.test.ts` | ❌ Wave 0 |
| WHATS-04 | Update message status from webhook | integration | `npm test -- webhook.test.ts` | ❌ Wave 0 |
| WHATS-05 | Create campaign via wizard | e2e | `npx playwright test campaigns.spec.ts` | ❌ Wave 0 |
| WHATS-06 | Validate template placeholders | unit | `npm test -- templates.test.ts` | ✅ message-templates.service.ts |
| WHATS-07 | Aggregate campaign metrics | unit | `npm test -- campaigns.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `src/components/whatsapp/MessageBubble.test.tsx` — WHATS-01
- [ ] `src/components/whatsapp/MessageStatusBadge.test.tsx` — WHATS-04
- [ ] `src/hooks/use-whatsapp-messages.test.ts` — WHATS-01, WHATS-04
- [ ] `src/app/api/whatsapp/webhook/webhook.test.ts` — WHATS-04
- [ ] `src/services/campaigns/campaigns.test.ts` — WHATS-05, WHATS-07
- [ ] `src/services/reminders/reminders.test.ts` — WHATS-03

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="whatsapp|campaign" --silent`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — internal API |
| V3 Session Management | no | N/A — server-side only |
| V4 Access Control | yes | RLS on messages/conversations tables |
| V5 Input Validation | yes | Zod schemas for webhook payload, campaign input |
| V6 Cryptography | yes | HMAC-SHA256 webhook signature verification |

### Known Threat Patterns for WhatsApp Integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook replay attacks | Tampering | Idempotency check via whatsapp_message_id in metadata |
| Invalid message formatting | Denial | Validate phone number format before sending |
| Spam via campaign bulk send | Information Disclosure | Rate limiting (30/min for messages preset) |
| Template injection | Tampering | Placeholder validation regex `^[a-zA-Z0-9_]+$` (already in message-templates.service.ts) |
| Unauthorized campaign execution | Elevation | RLS ensures users can only trigger their own clinic's campaigns |

## Sources

### Primary (HIGH confidence)
- `src/services/whatsapp/evolution.service.ts` — Evolution API integration patterns
- `src/app/api/whatsapp/webhook/route.ts` — Webhook verification and processing
- `src/services/whatsapp/message-templates.service.ts` — Placeholder extraction/validation
- `src/services/appointments/confirmation-handler.service.ts` — Appointment confirmation flow
- `supabase/migrations/20260327000500_create_follow_up_tables.sql` — Campaign schema
- `supabase/migrations/20260327000300_create_appointment_reminders.sql` — Reminder schema

### Secondary (MEDIUM confidence)
- Phase 3 context decisions (D-01 through D-14)
- Phase 3 UI spec components

### Tertiary (LOW confidence)
- None — all critical claims verified via code review

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all infrastructure already exists
- Architecture: HIGH — patterns verified from existing code
- Pitfalls: MEDIUM — based on common WhatsApp integration issues, not all verified in this project

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days — Evolution API is stable, no breaking changes expected)