# Secret Scan Triage — 2026-07-25

## Scope

- Target: `d4e85ac`
- Gitleaks v8.24.2; history and tracked-tree scans use redacted reports retained in quarantine.
- This document intentionally excludes secret values, matches, and source excerpts.

## Verified tracked-tree fixtures/placeholders

| Rule | Path | Line | Classification | Justification |
|---|---|---:|---|---|
| curl-auth-header | `docs/CONFIGURACAO-LEMBRETES.md` | 62, 67 | Placeholder | Documentation uses explicit `seu-*` placeholder. |
| curl-auth-header | `docs/GUIA-CONFIGURACAO.md` | 176, 184 | Placeholder | Documentation uses explicit `seu-*` placeholder. |
| generic-api-key | `docs/superpowers/plans/2026-06-19-fechamento-fundacao-rbac.md` | 139 | Fixture | Documented test password. |
| generic-api-key | `src/components/pi-finance/__tests__/pi-finance-app.test.tsx` | 12 | Fixture | Deterministic localStorage-only UI test UUID. |
| generic-api-key | `src/components/pi-finance/__tests__/slice-c-drilldowns.test.tsx` | 81, 86 | Fixture | Deterministic localStorage-only UI test UUID. |
| generic-api-key | `src/lib/pi-finance/seed.ts` | 7 | Fixture | Seed UUID used only by the client-side localStorage demo; no API/backend authentication path. |
| stripe-access-token | `src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts` | 170 | Fixture | Literal is exercised only by `maskApiKey`. |
| generic-api-key | `src/modules/followup/__tests__/cron/integration.test.ts` | 17 | Fixture | Named mock cron secret in an integration test. |
| generic-api-key | `src/repositories/auth/__tests__/integration.test.ts` | 44 | Fixture | Documented test password. |

`.gitleaksignore` contains only the 12 exact tracked-tree fingerprints above.

## Unresolved history

Historical findings remain outside `.gitleaksignore`:

- GitHub PATs, Stripe/API/LLM tokens, a private key, and the prior fixed cron secret.
- Owner attestation: test credentials; revocation pending.
- Status: **promotion blocked** until each credential is revoked or rotated and the owner confirms completion.

## Evidence

- Sanitized inventory and redacted reports: `D:/projetos/_synkroo-quarantine/2026-07-23/gitleaks-portable-f2bd8d9/`.
- No history rewrite, broad rule disablement, path allowlist, or commit allowlist was used.
