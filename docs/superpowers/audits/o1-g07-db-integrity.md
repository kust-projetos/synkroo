# O1-G07 — Database normalization, constraints and indexes

Date: 2026-08-20
Roadmap IDs: F3.01, F3.04–F3.07
Status: local preflight GREEN; owner-controlled duplicate remediation/migration apply remains `EVIDENCE_PENDING`.

## Preflight receipt

- `node --test scripts/__tests__/preflight-email-normalization.test.mjs` — PASS, 3/3 tests.
- `DATABASE_URL` set to validated loopback `synkroo_test`; `node scripts/preflight-email-normalization.mjs --json` — `database=synkroo_test`, `readOnly=true`, `duplicateGroups=0`.
- Query groups by `clinic_id, lower(btrim(email))`; output contains clinic IDs/counts only, never email values or PII.
- Same-clinic trim/case rejection and cross-clinic acceptance remain covered by `users-email-unique.integration.test.ts`.

## Migration/index inspection

- `0021_heavy_giant_girl.sql` creates the clinic/email unique index after duplicate preflight.
- `0022_far_stature.sql` aborts on normalized duplicates, then lower/trims email and recreates the expression unique index.
- `0023_appointment_query_indexes.sql` adds appointment reminder, appointment clinic/date/status and waitlist clinic/status/date indexes.
- No migration was generated or applied in this local preflight step. Extension/order and owner-controlled duplicate remediation remain O1-X03 work; no destructive SQL or staging DB was touched.
- `src/lib/db/schema/core.ts` and existing integration tests remain the source for the users clinic-email constraint.

## O1-X03 owner gate

| Field | Receipt |
|---|---|
| Class | R4 human migration/data gate |
| Preparation | Read-only duplicate preflight, migration SQL inspection, isolated `synkroo_test` proof and rollback packet. |
| Minimal action | Owner approves duplicate disposition, backup, staging `DATABASE_URL` target and expand/contract migration window. |
| Preconditions | Backup fingerprint, duplicate report without PII, extension catalog, rollback-compatible app version and explicit target. |
| Risk | Wrong target or unreviewed duplicate remediation can change tenant identity or block migration. |
| Rollback | Restore backup or roll forward with approved mapping; no destructive down migration after expand. |
| Receipt | Target class, duplicate counts/fingerprints, migration journal, extension/index catalog, app SHA and rollback result; no values. |
| Resume | Attach receipt, run staging preflight/apply/smoke and update F3.01/F3.04–F3.07 only with item-level evidence. |

## Residuals

F3.01 and F3.04–F3.07 remain `PARTIAL`/`EVIDENCE_PENDING` for owner-controlled duplicate remediation, migration apply, extension ordering and staging catalog proof. The local preflight is read-only and does not close those external gates.
