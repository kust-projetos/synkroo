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

## Historical credentials

The owner explicitly confirmed revocation of the historical GitHub PATs, Stripe/API/LLM tokens, private key, prior fixed cron secret, and any real Pi Finance credential.

| Rule | Findings | Unique exact fingerprints | Resolution |
|---|---:|---:|---|
| `curl-auth-header` | 4 | included | Explicit placeholder or owner-attested revoked credential. |
| `generic-api-key` | 90 | included | Fixture/placeholder or owner-attested revoked credential. |
| `github-fine-grained-pat` | 8 | included | Owner-attested revoked. |
| `jwt` | 8 | included | Fixture/placeholder or owner-attested revoked credential. |
| `private-key` | 1 | included | Owner-attested revoked. |
| `stripe-access-token` | 5 | included | Fixture or owner-attested revoked. |

`.gitleaksignore` contains only the 63 unique historical fingerprints and the 12 verified tracked-tree fingerprints. No rule, path, commit, or history rewrite allowlist was used.

## Evidence

- Sanitized inventory and redacted reports: `D:/projetos/_synkroo-quarantine/2026-07-23/gitleaks-portable-f2bd8d9/`.
- No history rewrite, broad rule disablement, path allowlist, or commit allowlist was used.
