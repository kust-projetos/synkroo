---
phase: 3
plan: 01
subsystem: whatsapp-crm
tags: [whatsapp, crm, contacts, messaging]
dependency_graph:
  requires: []
  provides: [WHATS-01, WHATS-02, WHATS-04]
  affects: [src/components/contacts/contact-detail-panel.tsx]
tech_stack:
  added: [MessageBubble, MessageStatusBadge, MessageComposer, useWhatsAppMessages, WhatsAppTab]
  patterns: [TanStack Query polling, mutation pattern, component composition]
key_files:
  created:
    - src/components/whatsapp/message-bubble.tsx
    - src/components/whatsapp/message-status-badge.tsx
    - src/components/whatsapp/message-composer.tsx
    - src/lib/hooks/use-whatsapp-messages.ts
    - src/app/api/messages/whatsapp/route.ts
  modified:
    - src/components/contacts/contact-detail-panel.tsx
    - src/lib/hooks/use-queries.ts
decisions:
  - Use 30-second polling interval for real-time message updates
  - WhatsApp tab shows teal accent color for active state
  - Empty state when contact has no phone or no messages
  - Enter key submits message in composer
metrics:
  duration: "~8 minutes"
  completed: "2026-04-25T00:00:00.000Z"
  tasks_completed: 6
  files_created: 5
  files_modified: 2
---

# Phase 3 Plan 01: WhatsApp CRM - Contact Messaging Summary

## Objective

Add WhatsApp tab to contact profile and create messaging components. Users can view WhatsApp conversation history and send messages directly from the CRM contact view.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create MessageBubble component | d4e2e96 | src/components/whatsapp/message-bubble.tsx |
| 2 | Create MessageStatusBadge component | d4e2e96 | src/components/whatsapp/message-status-badge.tsx |
| 3 | Create useWhatsAppMessages hook | 5397655 | src/lib/hooks/use-whatsapp-messages.ts, src/lib/hooks/use-queries.ts |
| 4 | Create MessageComposer component | fa20c40 | src/components/whatsapp/message-composer.tsx |
| 5 | Add WhatsApp tab to ContactDetailPanel | 210e53b | src/components/contacts/contact-detail-panel.tsx |
| 6 | Create GET /api/messages/whatsapp endpoint | a106446 | src/app/api/messages/whatsapp/route.ts |

## Key Implementation Details

### MessageBubble Component
- Inbound messages: left-aligned, card background with border
- Outbound messages: right-aligned, primary background
- Shows timestamp in bottom-right corner
- Displays MessageStatusBadge for outbound messages when showStatus=true

### MessageStatusBadge Component
- sent: CheckIcon + "Enviado"
- delivered: ChecksIcon + "Entregue"
- read: EyeIcon + "Lido" (secondary variant)
- failed: XCircleIcon + "Falhou" (destructive variant)

### useWhatsAppMessages Hook
- queryKey: ['whatsapp-messages', contactId]
- Polls every 30 seconds for real-time updates
- useSendWhatsAppMessage mutation uses existing /api/messages/send endpoint
- Invalidates query cache on success

### WhatsApp Tab Integration
- Added "WhatsApp" trigger with teal accent (data-[state=active]:text-teal-600)
- WhatsAppTab component renders message list + MessageComposer
- Empty state: "Nenhuma conversa ainda" heading when no messages
- Loading spinner during message fetch

## Commits

- d4e2e96: feat(03-01): create WhatsApp message UI components
- 5397655: feat(03-01): create useWhatsAppMessages hook with query keys
- fa20c40: feat(03-01): create MessageComposer component
- 210e53b: feat(03-01): add WhatsApp tab to ContactDetailPanel
- a106446: feat(03-01): create GET /api/messages/whatsapp endpoint

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] All 6 tasks committed individually
- [x] MessageBubble renders inbound/outbound with timestamp
- [x] MessageStatusBadge shows correct icons and Portuguese labels
- [x] useWhatsAppMessages polls every 30 seconds
- [x] MessageComposer has "Enviar mensagem" CTA with Enter key submission
- [x] WhatsApp tab added to ContactDetailPanel with teal accent
- [x] GET /api/messages/whatsapp returns messages by contact phone
