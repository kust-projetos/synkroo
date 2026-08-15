# Reconciliação da tranche F2/F3/F4/F11 — 2026-08-15

Status conservador: `VERIFIED` significa prova local do requisito delimitado; `PARTIAL` mantém residual de wiring, banco real, cobertura ou provider; `OPEN/BLOCKED` não foi mascarado. Esta matriz não fecha ondas nem ações externas.

| ID | Status | Evidência | Residual |
|---|---|---|---|
| F2.01 | VERIFIED | `f2-01-authjs-boundary.md` | Nenhum no escopo unitário |
| F2.02 | VERIFIED | `f2-02-signup-production.md` | Deploy/runtime externo não executado |
| F2.03–F2.08 | PARTIAL | `f2-03-f2-08-core-actions.md`, `f2-isolated-integration.md` | Isolated DB integration PASS; concurrent race suites still required |
| F2.09 | VERIFIED | `f2-09-f2-10-session-revocation.md` | Mutação automática é F2.11 |
| F2.10 | VERIFIED | `f2-09-f2-10-session-revocation.md` | Mutação automática é F2.11 |
| F2.11 | PARTIAL | `f2-11-revocation-primitive.md`, `f2-11-signout-revocation.md` | Password-change mutation/coverage remains open |
| F2.12 | VERIFIED | `f2-12-audit-redaction.md` | Allowlist por action continua necessária |
| F2.13 | VERIFIED | `f2-13-asaas-webhook.md`, `f2-isolated-integration.md` | Provider/deploy smoke remains external |
| F2.14 | PARTIAL | `f2-14-hyperdrive-contract.md`, `f2-14-db-health-primitive.md`, `f2-14-db-health-rpc.md` | Worker-level smoke/deploy remains external |
| F2.15 | VERIFIED | `f2-15-public-routes.md` | Provider/runtime smoke externo não executado |
| F2.16 | VERIFIED | `f2-16-csrf-origin.md` | Matrix cobre middleware custom auth |
| F2.17 | VERIFIED | `f2-17-redirect-sanitization.md` | Navegação E2E ainda não executada |
| F2.18 | VERIFIED | `f2-18-agent-permissions.md` | Seed/runtime integration separado |
| F3.01 | PARTIAL | `f3-01-email-normalization.md` | Dev DB bloqueado por duplicate preflight; owner remediation necessária |
| F3.02 | PARTIAL | `f3-02-runtime-env.md`, `f3-02-agent-bootstrap.md`, `f3-02-bridge-bootstrap.md` | App/sidecar wiring and runtime smoke remain open |
| F3.03 | PARTIAL | `f3-03-auth-secret-startup.md` | Broader runtime smoke remains open |
| F3.04 | PARTIAL | drizzle-kit check; `0022_far_stature.sql` | Duplicate cleanup requires owner-approved remediation |
| F3.05 | PARTIAL | `f3-05-appointment-indexes.md` | DB apply and scale-plan evidence remain open |
| F3.06 | PARTIAL | `f3-06-extension-order.md` | Migration apply remains owner-controlled |
| F3.07 | VERIFIED | `f3-07-rbac-backfill.md` | `--apply` externo não executado |
| F3.08 | PARTIAL | `f3-08-outbox-idempotency.md` | Queue/provider deployment não executado |
| F3.10 | VERIFIED | `f3-10-jest-jsdom.md` | Auditoria de dependências separada |
| F3.13 | PARTIAL | `f3-13-npm-audit.md` | 1 moderate + 1 low em waiver até 2026-09-15 |
| F3.14 | PARTIAL | `f3-14-verify-runner.md` | Coverage global abaixo de 70% |
| F3.15 | PARTIAL | `f3-15-ci-postgres17.md` | GitHub Actions remoto não executado |
| F4.01 | VERIFIED | `f4-01-api-response-contract.md` | F4.02–F4.04 migração de consumidores |
| F11.07 | VERIFIED | `f11-07-health-readiness.md` | SLO/alerting separado |
| F11.08 | VERIFIED | `f11-08-structured-logging.md` | Sink/collector externo não executado |
| F11.15 | VERIFIED | `f11-15-security-headers.md` | Headers em preview/production não smoke-testados |

## Tranche validation

`tranche-validation.md` registra 0 diagnostics LSP, tsc PASS, 69 testes Jest + 21 testes Node PASS e diff check PASS. O `npm run verify` completo ainda para corretamente no threshold de cobertura; isso permanece gate aberto.
