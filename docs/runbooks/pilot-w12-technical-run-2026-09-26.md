# Pilot W12 — Technical Run Local (2026-09-26)

TASK_ID: W3-W12-TECH (+ execução J-04 pelo Planner). Execução local, sem VPS/produção, sem commit, sem segredos reais.
Base: charter `docs/ops/pilot-charter.md` (janela 2026-09-01T02:00Z — VENCIDA, reagendamento = decisão do owner).

| J-item | O que foi executado | Comando | Resultado | Evidência |
|---|---|---|---|---|
| J-04 | E2E ciclo agenda/waitlist | `npx playwright test e2e/journey-patient.spec.ts` (tester + Planner) | NÃO EXECUTÁVEL NESTE AMBIENTE | `browserType.launch: spawn UNKNOWN` em `e2e/global-setup.ts:19`, reproduzido 2/2 (tester) e 1/1 (Planner); binário `chromium_headless_shell-1217` existe mas o sandbox não faz spawn. Evidência de registro: CI production-mode E2E 100% verde em 2026-09-25 (run `36200521937`: 229 passed / 5 skipped / 0 failed), que inclui este spec |
| J-04 (proxy) | Services waitlist/patients/appointments (dedup + fill idempotente) | `npx jest --runInBand --no-coverage src/services/waitlist/__tests__ src/services/patients/__tests__ src/services/appointments/__tests__` | PASS | 8 suites / 70 tests |
| J-10 | Fault-injection local (suites do gap-audit 2026-07-29) | `npx jest --runInBand --no-coverage src/core/ia-channel/__tests__/agent-invoker.test.ts src/core/ia-agent/__tests__/orchestrator-failures.test.ts src/modules/atendimento/services/__tests__/channel.test.ts src/__tests__/api/health/route.test.ts` | PASS | 4 suites / 31 tests (gap-audit: 24) + `npm run db:health` → `Database healthy` |
| J-11 | Import dry-run real (sem `--apply`, sem DB) | `npx tsx scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv` | PASS | `dry-run, totalRows: 10, accepted: 10, rejected: 0, legalHold: true, sha256: 499bb074164c83b207f79ee48d4019755c93e57311ac6b5be75c059423e89386, No data inserted` |
| J-11 (unit) | apply/replay/rollback/fail-closed | `npm run test:release` | PASS | 61/61 (inclui apply transacional, replay idempotente, rollback, fail-closed sem `DATABASE_URL`) |
| J-12 | Export/anonymize: 401 sem auth (sem consumir quota) + rate limit pós-auth | jest `src/services/contacts/__tests__` + `lgpd/export` + `lgpd/anonymize` + `reports/export` + inspeção `src/services/api-handlers/lgpd/{export,anonymize}.ts` | PASS (handler-level) | 6 suites / 39 tests; `checkRateLimit` + `apiRateLimited` (429) após `buildUserContext` (401) |
| J-09 | Métricas locais (analytics/reports) | `npx jest --runInBand --no-coverage src/services/analytics/__tests__ src/services/reports/__tests__ src/services/api-handlers/reports/__tests__` | PASS | 6 suites / 50 tests (inclui T5 tenant-scoped) |

Total Jest nesta sessão: 24 suites / 190 tests, 0 fail (+ `test:release` 61/61). Sem regressões.

## Pendente de owner/credenciais (inalterado)

J-03/05/06/07, outage drills F12.04 em staging, J-11 apply/replay/rollback em staging, J-12 destruição sob retenção em staging, training (F12.06), scorecard (F12.07), GO/NO-GO (F12.08), F12.01/02 provisionamento/import gerenciados. **Janela de 2026-09-01T02:00Z vencida — reagendamento é decisão do owner.**
