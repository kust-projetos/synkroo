# Roadmap 143 Final Rubric — Esqueleto (R5 RUBRIC-DRAFTED)

**Status:** RUBRIC-DRAFTED — pendente owner GO/NO-GO (F12.08)
**Data:** 2026-08-26
**Candidato:** `f87bb8b9` (após `497428d9`, `3de875c8`, `5457ba8d`, `1d1182c9`)
**Ledger:** `docs/superpowers/audits/roadmap-143-ledger.json` — 143 unique, 126 VERIFIED / 14 EXTERNAL / 3 DEFERRED (pré-W12)
**Score alvo:** 92/100 — requer ≥90 + hard gates verdes (qualquer hard gate vermelho = NO-GO)

> Agente não decide GO. Owner registra decisão formal após scorecard.

## Hard gates (todos devem estar verdes)

- [ ] 143/143 unique, todos `VERIFIED` (nenhum `PARTIAL`/`UNVERIFIED`)
- [ ] `npm run roadmap:check` EXIT 0 + ledger com `command/output/commit/reviewer/risk/rollback` + external receipt onde EXTERNAL
- [ ] `npm run verify` verde: lint (`--max-warnings=0`), 4× typecheck (`app` + `ia-bridge` + `ia-agent` + `next`), coverage ≥70 (stmts/lines 70, branches 55, funcs 65 per ADR), `test:release` + `test:security`
- [ ] `test:integration:run` isolado `synkroo_test` 37/39 → 39/39 (availability flaky resolvido), `waitlist` 8-way `FOR UPDATE` 4/4 PASS
- [ ] `gitleaks` CI verde (`gitleaks-scheduled.yml` full-history) + `gitleaks --no-git` só gitignored rotacionados (0 após rotação)
- [ ] `drizzle-kit check` verde + `db:migrate` staging aplicado (B-MIGRATION-APPLY staging receipt)
- [ ] `wrangler deploy --dry-run --env staging` EXIT 0 (470 files, `HYPERDRIVE e0033...` sem `VECTORIZE`) + `/health` + `/api/internal/readiness` com `CRON_SECRET timingSafeEqual`
- [ ] J-01..J-12 sem baseline beta (F12.03) + `e2e/journey-patient.spec.ts` J-04 lista→detalhe→create→edit→dedup tenant isolation
- [ ] Outage drills F12.04 matriz aprovada + receipts (Evolution/LLM/DB/Queue/sidecar `PLAYWRIGHT_SECRET` mTLS+HMAC)
- [ ] Security/LGPD/tenancy hard gates: `f2-*-md` + `consent-guard.ts` + `legal_hold` + `audit` allowlist
- [ ] Pilot charter `synkroo-staging` + dataset `sha256` + `dr-1` + janela `2026-09-01T02:00Z` + backup `pg_dump` SHA

## Score breakdown (soma 100, alvo 92)

| Dimensão | Peso | Critério | Atual (draft) |
|---|---|---|---|
| Closure | 25 | 143 VERIFIED vs 126 | 22/25 (126/143 = 88%, falta W12 EXTERNAL 14) |
| Journeys | 15 | J-01..J-12 + dedup + waitlist idempotente | 10/15 (J-04 smoke local, falta piloto staging) |
| Security/tenancy/LGPD | 15 | F2.03-08 tenant, F2.11 revocation, F10 LGPD, audit redaction | 14/15 (mutation auth 60.24% residual) |
| Data/migrations/concurrency | 15 | F3.01 email uniq, F3.04-07 migrations, `FOR UPDATE` 8-way, legal_hold | 13/15 (local APPLIED, falta staging) |
| Tests/coverage/mutation/review | 15 | 70.41% stmts, Stryker 70.16% repo, 286 suites 2068 tests | 13/15 (branches 57.59, auth survivors 33) |
| Runtime/deploy/observability/rollback | 10 | Hyperdrive staging dry-run, health/readiness, SLO, version skew | 8/10 (dry-run OK, falta staging smoke) |
| Operation/pilot/traceability | 5 | W11 runbook, W12 charter, rubric, receipts | 4/5 (charter/matrix/rubric draftados) |
| **Total** | **100** |  | **84/100 draft** → **92/100 ao fechar W12 + hard gates** |

## Evidências atuais (sanitizadas)

- `gitleaks 8.30.1`, `wrangler 4.125.0`, `git log f87bb8b9`, `verify` 2068 tests 70.41%, `drizzle-kit check OK`, `waitlist` 37/39 (2 flaky availability), `wrangler dry-run` 3× EXIT 0, `.gitleaksignore` 83 (6 confirmed).
- `metric-dictionary.md` + `w10-retention-policy.md` + `w11-rollout-runbook.md` + `CONSENT-GUARD` + `COVERAGE-BOOST` verdes.

## Risco residual (owner aceita em GO)

- 14 EXTERNAL W12 (piloto/outage/training/scorecard/GO) — só owner autoriza.
- 2 suites flaky `availability/integration` (waitlist 37/39) — estabilizar antes de GO.
- Stryker auth survivors 33 + branches 57.59 — cobertos por integração mas não por mutation.
- Full-history `gitleaks` só em CI (local 180s timeout) — evidência vem de `gitleaks-scheduled.yml`.

## Rollback

- App/workers: `wrangler rollback --env staging` + redeploy SHA anterior
- DB: roll-forward (F11.14), nunca `down`; `pg_restore backup.sha256`
- Pilot: offboard `scripts/offboard-client.mjs --apply` + import-batch rollback

## Decisão (owner preenche)

| Campo | Valor |
|---|---|
| Decision | GO / NO-GO |
| Owner |  |
| Date |  |
| Candidate SHA | `f87bb8b9` (ou novo após fixes) |
| Score | /100 |
| Hard gates | todos verdes? |
| Accepted risks | lista acima + adicionais |
| Conditions |  |

**Se NO-GO:** reabrir owning goals, preservar READY work, não promover ledger.
