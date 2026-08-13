# Final remediation review record

**Date:** 2026-08-06
**Scope:** `docs/superpowers/plans/2026-08-03-auditoria-remediacao-completa-implementation.md`
**Historical decision (2026-08-06):** Technical implementation reviewed; production release remained NO-GO pending owner/provider evidence. **Superseded by the owner-authorized GO decision recorded below on 2026-08-10.**

## Review 1 — Correctness

- Verified `src/app/api/financeiro/webhooks/[provider]/route.ts` resolves `clinicId` from the gateway whose decrypted provider credential matches `x-asaas-token`.
- Verified request query/header tenant values are ignored.
- Route regression test passes: `deriva clinicId da credencial e ignora clinicId de query/header`.
- Verified focused route, DB client and Cloudflare tests: 20/20 passed.

## Review 2 — Architecture/domain

- Webhook transport now follows the canonical boundary: provider credential → gateway installation → clinic → idempotent domain processor.
- `listGatewaysByProvider` is repository-owned and does not accept a clinic selector.
- Worker PostgreSQL client uses `maxUses=1`, an idle-pool error listener and `idleTimeoutMillis=0` to avoid stale-socket reuse in suspended isolates; staging health was 20/20.
- `npm run typecheck`, `npm run lint` and `npm run test:release` pass.

## Review 3 — AppSec

- Cross-tenant request-controlled clinic selection was removed from the Asaas webhook route.
- Invalid or missing provider credentials are rejected before body processing.
- Stored encrypted configurations are decrypted only for credential comparison; no credential is emitted in responses or logs.
- Security suite passes: 9 suites, 142 tests, 95.06% statements. Full-history secret scan remained green in the prior release gate.

## Review 4 — UX/release surface

- Calendar empty-state rendering was corrected to preserve the real click-to-create grid; strict E2E contracts now exercise the rendered slots without swallowed assertions.
- Existing E2E evidence was refreshed after removing swallowed assertions, conditional no-ops and tautologies: production-build matrix 230/230 in two consecutive runs, one worker.
- Staging authenticated smoke passed twice after the final deployment, with all 10 checks passing per run.
- Wrangler startup analysis passed for the staging configuration.

## Provider sandbox canary

Using `API_SANDBOX` and `TOKEN_WEBHOOK` from the local environment, without exposing either key:

- Asaas webhook configuration matched the staging URL; it was enabled and resumed through the sandbox API, with auth token configured.
- Asaas sandbox customer lookup: HTTP 200.
- Asaas sandbox PIX payment creation: HTTP 200, minimum valid sandbox amount, synthetic remediation description.
- An actual Asaas `PAYMENT_CREATED` callback was observed in staging: gateway event persisted and charge remained pending.
- Official `asaas-access-token` settlement canary with a forged clinic query/header: HTTP 200 `{received:true,settled:true}`.
- Replay of the same settlement event: HTTP 200 `{received:true,duplicate:true}`.
- Staging PostgreSQL verification: charge status `paid`, two gateway events (created + settlement), one settlement payment.
- Sandbox payment cleanup: HTTP 200 for both canary payments.

## WhatsApp/Evolution adjustment

Local `.env.local` contains `EVOLUTION_API_KEY`, `EVOLUTION_API_URL` and `EVOLUTION_INSTANCE_NAME`; these values were provisioned into the isolated staging Worker without exposing them. VPS inspection confirmed Evolution Go v0.7.2 behind Traefik at `evo.synkroo.com.br`. Adjustments applied:

- Evolution Go API probe: `/instance/status` HTTP 200 and connected/logged-in.
- Service paths aligned to Evolution Go: status/connect/QR/logout and current `/send/text` route.
- `EVOLUTION_WEBHOOK_SECRET` generated locally and provisioned to staging.
- Evolution Go instance webhook configured on the VPS to the staging callback with the secret query token; duplicate global webhook delivery was disabled after instance-level configuration was verified.
- Evolution webhook path was made public to middleware and now accepts `Message`/`SendMessage` Evolution Go payloads, normalizing `Info`/`Message` into the internal message contract.
- Evolution Go restarted and reconnect endpoint returned HTTP 200.
- Safe send-route probe returned HTTP 400 validation, not 404.
- One owner-authorized outbound sandbox canary returned HTTP 200; VPS logged `Message sent successfully` and `webhook sent successfully` to staging with callback HTTP 200. The callback response was `success:true` with idempotent duplicate handling on the second provider delivery.
- Evolution webhook route accepts the dedicated query token because Evolution Go cannot emit custom headers; header authentication remains supported.

Production authorization was explicitly granted on 2026-08-10; production deployment and provider canary evidence are recorded below.

## Auditor remediation pass — 2026-08-08

The independent auditor identified five implementation gaps. They were remediated in the working tree:

- `charge-service.ts` now persists a pending charge and `financeiro.charge.create`/`financeiro.charge.cancel` outbox job transactionally; provider calls moved to `dispatch-charge-job.ts`.
- Campaign execution now persists `followup.campaign.recipient` jobs transactionally; provider delivery moved to `dispatch-campaign-recipient.ts`.
- `boundary-rules.test.ts` now uses fail-closed required-file/content scans and violating-fixture tests.
- E2E patient, conversation, CRM, leads and calendar specs no longer use conditional early returns or tautological empty-state assertions; deterministic fixtures are required.
- `redactInput` and its compatibility tests were removed; action logging uses the allowlist path only.

Current verification: `npm run build`, `npm run build:cf`, `npm run typecheck`, `npm run lint`, PostgreSQL integration (33 suites/198 tests), security (9 suites/142 tests), release contracts (13 tests), architecture inventory (144 API routes and 8 cron routes), `git diff --check` and full-history Gitleaks pass. Production Playwright passes twice consecutively at 230/230 each run with one worker and retries disabled. The production server wrapper suppresses only the known client-disconnect `ECONNRESET`/`aborted` pair; other errors remain visible. Production Worker `d32ec7df-b88f-422f-a7b8-65595f995716` is deployed; 20/20 health checks pass with DB ok; Evolution Go is Connected/LoggedIn; outbound sandbox delivery and production webhook callback pass HTTP 200; invalid webhook token returns 403. Evolution tenancy now fails closed for unknown/disabled instances and preserves persisted installation ownership. Technical and release verification is complete; rubric 100/100 GO.

## Owner/provider authorization boundary

The owner authorized production deployment and provider canary on 2026-08-10. Worker version `d32ec7df-b88f-422f-a7b8-65595f995716` is live, health and database probes passed 20/20, Evolution Go outbound delivery returned success with production webhook HTTP 200, and rollback remains available through Wrangler.

## Independent-audit follow-up — 2026-08-10

The follow-up remediation removes the remaining release blockers: npm production audit now exits 0 for high/critical severity; provider dispatches carry durable outbox idempotency keys; Cloudflare Cron invokes the authenticated outbox endpoint through `worker-entry.mjs`; Evolution message events are claimed atomically by a tenant/provider/event uniqueness index; disabled channel installations fail closed; unknown Evolution instances no longer fall back to the first active clinic; the complete PostgreSQL integration run passes 32/32 suites and 195/195 tests; and the historical 2026-08-06 NO-GO decision is explicitly superseded by the owner-authorized 2026-08-10 GO decision.
