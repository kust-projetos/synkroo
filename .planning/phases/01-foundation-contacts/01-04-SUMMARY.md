---
phase: 01-foundation-contacts
plan: 04
status: completed
completed_at: 2026-04-24
---

## Summary: Timeline & Consents API

### Files Created

| File | Description |
|------|-------------|
| `src/services/contacts/timeline.service.ts` | Timeline aggregation across 4 sources with cursor pagination |
| `src/services/contacts/consents.service.ts` | LGPD consent CRUD with audit trigger logging |
| `src/app/api/contacts/[id]/timeline/route.ts` | GET timeline with cursor and source filter |
| `src/app/api/consents/route.ts` | GET/POST/PATCH for consent management |

### Hooks Added

- `useContactTimeline` - infinite query with cursor pagination
- `useContactConsents` - consent list query
- `useGrantConsent` - mutation with cache invalidation
- `useRevokeConsent` - mutation with cache invalidation

### Key Features

- **Timeline**: Aggregates appointments, messages, lead_activities, patient_observations
- **Cursor pagination**: base64url encoded `${timestamp}::${id}` format
- **Source filtering**: Filter timeline by source type (appointment/message/lead_activity/note)
- **Consents**: Grant/revoke with automatic audit via DB trigger
- **Multi-tenant**: All operations scoped by clinic_id from auth session

### Verified
- TypeScript compiles without errors
- All exports match plan requirements