# F3.05 — Query-guided appointment indexes

Added three composite indexes aligned with observed agenda/reminder/waitlist filters:

- `appointments(clinic_id, scheduled_at, status)`
- `appointment_reminders(appointment_id, status)`
- `waitlist(clinic_id, status, preferred_date)`

Drizzle schema, generated migration `0023_appointment_query_indexes.sql`, journal and snapshot are synchronized. No database was connected or mutated.

| Verificação | Resultado |
|---|---|
| `npx drizzle-kit generate --name appointment_query_indexes` | PASS |
| `npx drizzle-kit check --config=drizzle.config.ts` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint schema | PASS |
| `git diff --check` | PASS |
