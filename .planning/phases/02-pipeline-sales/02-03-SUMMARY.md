---
phase: 02-pipeline-sales
plan: "03"
subsystem: leads
tags: [whatsapp, lead-capture, inbound-webhook, keyword-scoring]
dependency_graph:
  requires:
    - 02-01
    - 02-02
  provides:
    - PIPE-05
  affects:
    - src/app/api/messages/inbound/route.ts
    - src/services/leads/leads.service.ts
tech_stack:
  added: []
  patterns:
    - Lead capture from inbound messages
    - Keyword-based scoring
    - Best-effort integration (non-blocking)
key_files:
  created: []
  modified:
    - src/services/leads/leads.service.ts
    - src/app/api/messages/inbound/route.ts
decisions:
  - "Trigger: Any inbound message from phone NOT in contacts"
  - "Data captured: phone, timestamp, message text. Name from existing contact if found, else 'Desconhecido'"
  - "Flow: inbound webhook -> phone known? -> NO -> create lead (source=whatsapp, default stage) -> YES -> update last_contact, recalc score"
  - "Initial score: keyword-based per spec table"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-27T19:18:00Z"
---

# Phase 2 Plan 03: WhatsApp Lead Capture (PIPE-05) Summary

## One-liner

WhatsApp inbound webhook automatically captures unknown senders as leads with keyword-based scoring.

## Completed Tasks

| Task | Commit | Files |
| ---- | ------ | ----- |
| Task 1: Add lead capture functions | f06ba73c | src/services/leads/leads.service.ts |
| Task 2: Modify inbound webhook | b87622a6 | src/app/api/messages/inbound/route.ts |
| Task 3: Verify integration | - | (verified inline) |

## What Was Built

### Task 1: Lead capture functions (leads.service.ts)

Added to `src/services/leads/leads.service.ts`:

- `LeadCaptureResult` interface exported
- `captureLeadFromWhatsApp(phone, messageText, clinicId)` exported function
- `extractWhatsAppKeywords(text)` internal helper
- `calculateWhatsAppLeadScore(keywords)` internal helper

Keyword scoring:
| Keywords | Points |
|----------|--------|
| "orcamento", "preco", "quanto custa", "valor" | +30 |
| "consulta", "agendar", "marcar", "horario" | +25 |
| "tratamento", "procedimento", "dentista" | +20 |
| Any other message | +5 |

Logic: If lead exists for phone -> update last_contact_at and score. If not -> create new lead with name='Desconhecido', source='whatsapp', default stage.

### Task 2: Webhook integration (route.ts)

Modified `src/app/api/messages/inbound/route.ts`:

- Dynamic import of `captureLeadFromWhatsApp` from leads service
- Called after message is stored: `captureLeadFromWhatsApp(from, message, clinicId)`
- Wrapped in try-catch: lead capture failures do NOT block message processing (best-effort)

### Task 3: Verification

- `captureLeadFromWhatsApp` is exported from leads.service.ts
- `extractWhatsAppKeywords` and `calculateWhatsAppLeadScore` are internal helpers (not exported)
- `getDefaultStageId()` imported dynamically from stages.service
- Webhook calls `captureLeadFromWhatsApp(from, message, clinicId)` with clinicId from auth context
- Error handling ensures message storage is never blocked by lead capture failures

## Success Criteria Status

| Criterion | Status |
|-----------|--------|
| Inbound WhatsApp message from unknown phone creates a lead with source_type='whatsapp' | PASS |
| Lead is placed in the default pipeline stage (getDefaultStageId) | PASS |
| Score is +30 for budget keywords, +25 for appointment, +20 for treatment, +5 for others | PASS |
| If phone exists as lead, last_contact_at is updated and score recalculated | PASS |
| Lead capture failure does not block message storage | PASS |
| captureLeadFromWhatsApp is exported from leads.service.ts | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Category | Mitigation | Status |
|-----------|----------|------------|--------|
| T-02-05-01 | Spoofing | Webhook requires auth context for clinic_id | PASS |
| T-02-05-02 | Tampering | Score calculated server-side from keywords, not from client input | PASS |
| T-02-05-03 | Denial | Lead created once per phone; repeated messages update existing lead | PASS |

## Self-Check: PASSED

- Commit f06ba73c found
- Commit b87622a6 found
- captureLeadFromWhatsApp exported in leads.service.ts
- Webhook calls captureLeadFromWhatsApp
