# Pilot Scorecard — F12.07 DRY-RUN 2026-08-26 21:55Z

**Candidato:** `d54eb874` `05ce1c01` fix(middleware) `892581b5` staging `476 files` `Node22 wrangler 4.125.0`
**Ledger:** `143 unique 126 VERIFIED / 14 EXTERNAL→12 EXTERNAL live staging / 3 DEFERRED` `scripts/roadmap-ledger.mjs:113`
**CI:** `33012481771 success 05ce1c01 8m57s` `33015622234 success d54eb874 9m33s` `Secret Scan + Build & Test + CF Build & Dry Run` verdes

## 1. Defects
- Unit/integration `286 suites 2068 passed 70.43% stmts` `jest.config.js:41` `coverage 70/70/55/65` + `test:integration:run 39/39` `vector+btree_gist` `FOR UPDATE` `waitlist 4/4` `availability 39/39` flaky 37/39 resolvido `1361e380` `1559084c` `h23`
- E2E `e2e/journey-patient.spec.ts:30 2 tests J-04` listed `npx playwright test --list`; `Production E2E continue-on-error true success` CI
- Journey `J-04` `lista→detalhe→create→edit→dedup tenant isolation` smoke local; `J-01..J-12` dry-run staging `synkroo-staging` health 200 sem baseline beta — execução completa pendente janela `2026-09-01T02:00Z` owner
- Defects abertos: 0 críticos; residual `availability` já estabilizado

## 2. Segurança / Tenancy / LGPD
- `gitleaks 8.30.1` `detect --log-opts="--all" --redact` `0 committed` `18 --no-git` gitignored `gitleaks.toml` `gitleaks-scheduled.yml` `B-SECRET-ROTATION PREPARED` `CRON_SECRET vL9u****` rotacionado staging `55bd77e7→892581b5`
- `F2.03-08` tenant `assertClinicScope` 12 actions `FOR UPDATE` `F2.11` revocation `timingSafeEqual` `60.24% auth` `33 survivors` documentado `F2.06` webhook `channel_installations` `F2.15` public routes `F2.16` CSRF `F2.17` redirect `F2.18` agent `[]`
- LGPD `F10.07` `src/services/api-handlers/lgpd/anonymize.ts:44 db.transaction` + `F10.10` `legal_hold src/modules/operacional/schema/patients.ts:30` + `audit allowlist` + `redaction` `f11-08-structured-logging.md` + `w10-retention-policy.md` 90d/30d/2a/1a/7d
- Headers `F11.15` `next.config.ts:17` `CSP default-src 'self' frame-ancestors 'none'` `HSTS max-age=31536000` `nosniff` `DENY` `strict-origin-when-cross-origin` `Permissions-Policy` `src/__tests__/security/headers.test.ts:4` live staging `curl 200`

## 3. SLO / Observabilidade / Runtime
- `health 200 latency 131-344` `database ok` `environment ok` `HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6` `src/services/api-handlers/health.ts:5`
- `readiness 200 {"status":"ready"} 401 wrong/no-auth` `timingSafeEqual src/app/api/internal/readiness/route.ts:5 src/middleware.ts:14` `vL9u****`
- `wrangler deploy --env staging 892581b5` `476 files 23319 KiB` `bridge b40a81ac` `agent ee88f1a2` `Worker Startup 39 ms` `versions list --env staging` `rollback` `w11-rollout-runbook.md`
- `Queue/outbox` `dispatch-dlq 3/3 dead_letter ≥5` `F7.07` `outbox 221/226` `charge-race 2/2` `F9.06` atomic `financeiro-repository.ts:402`
- `metric-dictionary.md` `w11-rollout-runbook.md` SLO `auth DB webhook queue agent provider sidecar` — baseline `health 131-344` sem breach

## 4. Operação / Piloto / Rastreabilidade
- Provision `synkroo-staging` `docs/ops/pilot-charter.md:1` `sha256:1f2566cf9d4757f1abef08146978c55fcb55a2995d5c91deffc2d99a93de4a53` `10 lines` `dr-1` `2026-09-01T02:00Z` `drizzle-kit check Everything's fine`
- Import `docs/pilot/approved-import.csv` `11 lines` `legal_hold` `consent v1` `optOut true` Fernanda Lima `consent-guard.ts` `F7.08`
- Outage `docs/ops/outage-drill-receipts.md:1` 6 drills dry-run `Evolution LLM DB Queue sidecar consent` `PLAYWRIGHT_SECRET mTLS+HMAC` `consent-guard assertConsentVersion`
- A11y/perf `docs/ops/pilot-a11y-perf.md:1` `123/123 pages` `CSP/HSTS` `manifest-paths.test` `clinic-selector 3 tests` `Recharts`
- Training `docs/ops/pilot-training-log.md:1` `dr-1` feedback placeholder sem scope creep
- Rollback `wrangler rollback --env staging` + `pg_restore` `F11.14 roll-forward` `backup-2026-08-26.sql sha256`

**Riscos residuais dry-run:** `14 EXTERNAL→12 EXTERNAL` W12 requer execução real `J-01..J-12` + drills injeção `2026-09-01T02:00Z` owner; `auth survivors 33` + `branches 57.59` cobertos por integração.

*Gerado 21:55Z dry-run — inputs reais pendentes janela piloto.*
