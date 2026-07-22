# E03 Cron Actions Closure Design

**Goal:** Make Follow-up cron execution tenant-safe through the Action Layer and align manual follow-up registration with its real feedback persistence contract.

## Scope

- `POST /api/cron/followups`
- Follow-up execution, inactivity detection and campaign actions/services
- `followup.registrarFollowup`
- Focused unit/route/integration tests

No Agents SDK, new scheduling table, Follow-up UI, or database migration.

## Tenant-safe execution

1. `executarFollowup`, `detectarInativos`, and `executarCampanhas` receive the current `ctx.clinicId` through their services.
2. Their services and legacy bridges accept `clinicId` and query/process only that clinic; public user actions therefore cannot process another tenant. This includes follow-up candidate queries, return-reminder candidate queries, inactive-patient selects/updates, and the fallback follow-up configuration query.
3. `processScheduledCampaigns(clinicId)` receives and logs the clinic id. It remains a no-op until campaign execution is separately implemented; this closure must not invent campaign processing.
4. The cron retains current CRON_SECRET, rate-limit and `assertModuleForJob` checks.
5. Cron enumerates only `clinics` where `deletedAt IS NULL`. For each clinic it builds an explicit trusted cron context whose `can` allowlist is exactly `followup:manage_followups` and `followup:manage_campaigns`; it does not use the Agent-role `buildSystemContext` defaults and does not use `can: () => true`.
6. It invokes each selected action once per clinic through `runAction`. The exact result is `{ task, clinicId, ok, data?: unknown, error?: string }`; one failure is appended and processing continues for remaining clinics and tasks.
7. `hot-leads` keeps its existing separate Comercial per-clinic flow.

## Manual registration contract

`patient_feedback` persists `clinicId`, `patientId`, optional `appointmentId`, feedback fields and `collectedAt`; it has no scheduling timestamp. Therefore `followup.registrarFollowup` remains a feedback action requiring `patientId`, optional `appointmentId`, feedback type/rating/NPS/comments. It moves its legacy import behind `followup-service`.

Before inserting feedback, the module service verifies that `patientId` belongs to `ctx.clinicId`; when supplied, `appointmentId` must also belong to that clinic and patient. Foreign or mismatched records return `not_found`. The historical `{ appointmentId, type, scheduledAt }` description is superseded because it requires queue/scheduling persistence outside this closure.

## Tests

- Action tests prove each execution action forwards only `ctx.clinicId`.
- Cron tests prove selected tasks invoke actions per non-deleted clinic with the explicit two-permission cron context, preserve task filtering, and isolate one-clinic action failure with the defined result shape.
- Registration tests prove the action calls the module service with `ctx.clinicId` and feedback payload; foreign/mismatched patient or appointment records return `not_found`.
- Existing cron auth, rate-limit and disabled-module behavior remain covered.

## Verification

1. Focused Follow-up action/cron tests pass.
2. `npm run test:integration:run -- src/modules/followup/__tests__/cron/integration.test.ts` passes when local PostgreSQL is available.
3. `npm run typecheck` passes.
4. No route imports a Follow-up service for task execution directly; cron only invokes defined actions.
