---
phase: 3
slug: whatsapp-crm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (via npm test) |
| **Config file** | jest.config.js / tsconfig.json |
| **Quick run command** | `npm test -- --testPathPattern="whatsapp\|campaign"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="whatsapp\|campaign" --silent`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | WHATS-01 | unit | `npm test -- MessageBubble.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-02 | 03-01 | 1 | WHATS-04 | unit | `npm test -- MessageStatusBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-03 | 03-01 | 1 | — | unit | `npm test -- useWhatsAppMessages.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-04 | 03-01 | 1 | WHATS-02 | unit | `npm test -- evolution.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-05 | 03-01 | 1 | WHATS-01 | e2e | `npx playwright test whatsapp-tab.spec.ts` | ❌ W0 | ⬜ pending |
| 03-01-06 | 03-01 | 1 | WHATS-01, WHATS-04 | integration | `npm test -- webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 03-02 | 2 | WHATS-03 | unit | `npm test -- ReminderConfigCard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-02 | 03-02 | 2 | WHATS-03 | unit | `npm test -- TemplateEditor.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-03 | 03-02 | 2 | WHATS-06 | unit | `npm test -- templates.test.ts` | ✅ | ⬜ pending |
| 03-02-04 | 03-02 | 2 | WHATS-03 | integration | `npm test -- reminders.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-05 | 03-02 | 2 | WHATS-03 | unit | `npm test -- procedure-reminder-config.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-06 | 03-02 | 2 | WHATS-03, WHATS-06 | integration | `npm test -- reminder-scheduling.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03-03 | 2 | WHATS-05 | unit | `npm test -- CampaignWizard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03-03 | 2 | WHATS-05 | unit | `npm test -- AudiencePreview.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03-03 | 2 | WHATS-07 | unit | `npm test -- CampaignMetricsCard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-04 | 03-03 | 2 | WHATS-05 | unit | `npm test -- segments.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-05 | 03-03 | 2 | WHATS-07 | integration | `npm test -- campaign-processing.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-06 | 03-03 | 2 | WHATS-07 | e2e | `npx playwright test campaigns.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/whatsapp/MessageBubble.test.tsx` — WHATS-01
- [ ] `src/components/whatsapp/MessageStatusBadge.test.tsx` — WHATS-04
- [ ] `src/hooks/use-whatsapp-messages.test.ts` — WHATS-01, WHATS-04
- [ ] `src/components/whatsapp/MessageComposer.test.tsx` — WHATS-02
- [ ] `src/components/whatsapp/ConversationListItem.test.tsx` — WHATS-01
- [ ] `src/app/api/whatsapp/webhook/webhook.test.ts` — WHATS-04
- [ ] `src/services/campaigns/campaigns.test.ts` — WHATS-05, WHATS-07
- [ ] `src/services/reminders/reminders.test.ts` — WHATS-03
- [ ] `src/components/campaigns/CampaignWizard.test.tsx` — WHATS-05
- [ ] `src/components/campaigns/AudiencePreview.test.tsx` — WHATS-05
- [ ] `src/components/campaigns/CampaignMetricsCard.test.tsx` — WHATS-07

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WhatsApp message delivery (sent/delivered/read) | WHATS-04 | Requires live Evolution API instance | Check MessageStatusBadge updates within 30s of sending test message |
| Campaign broadcast delivery | WHATS-07 | Requires real phone numbers | Verify sent/delivered counts in campaign dashboard after test campaign |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
