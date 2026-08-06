# Final remediation review record

**Date:** 2026-08-05
**Scope:** `docs/superpowers/plans/2026-08-03-auditoria-remediacao-completa-implementation.md`
**Decision:** Technical implementation reviewed; production release remains NO-GO pending owner/provider evidence.

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
- Evolution Go `WEBHOOK_URL` configured on the VPS to the staging callback with the secret query token.
- Evolution Go restarted and reconnect endpoint returned HTTP 200.
- Safe send-route probe returned HTTP 400 validation, not 404.
- Evolution webhook route now accepts the dedicated query token because Evolution Go cannot emit custom headers; header authentication remains supported.

No outbound WhatsApp message was sent because no recipient was authorized for the canary. Production approval remains absent.

## Owner/provider authorization boundary

The owner authorized isolated staging resources on the VPS, isolated Cloudflare resources, local secret prompting, synthetic seed data and the sandbox canary in the active session. No production mutation or production approval was authorized or executed. Therefore this record does not claim production readiness.
