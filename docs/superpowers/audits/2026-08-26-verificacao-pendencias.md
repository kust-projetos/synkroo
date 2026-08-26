# Verificação de Pendências — 2026-08-26

> Fonte: `scripts/roadmap-ledger.mjs --check`, `git status/diff`, `ai-memory` briefing 2026-08-26, `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md`, `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md`, `docs/superpowers/audits/rubrica-fechamento-2026-08-25.md`

## Sumário executivo

- Ledger: `143 registros, 143 únicos` — `VERIFIED=126 / EXTERNAL=14 / DEFERRED=3 / PARTIAL=0 / UNVERIFIED=0` (inalterado desde 2026-08-25). `PARTIAL` e `UNVERIFIED` zerados após reconciliação 2026-08-24; 39 VERIFIED migrados como **VERIFIED fraco** (`blocker: local evidence or implementation required`, `gate: W*_remains open`).
- Verificação local confirma: 126 VERIFIED ≠ fechado. 39 fraco + F3.14 global coverage `63.11% Statements (10263/16262) / 64.19% Lines` < 70% seguem como único gate W3 bloqueante.
- Trabalho do plano `2026-08-25` (6 tasks) parcialmente executado (rubrica média 8.0/10) mas **não commitado**: 8 arquivos modificados + 18 untracked na branch `main`.
- Bloqueados EXTERNAL 14 e DEFERRED 3 permanecem corretamente sem execução local.

## Método e evidências

| Fonte | Comando/Arquivo | Resultado 2026-08-26 |
|---|---|---|
| Ledger | `node scripts/roadmap-ledger.mjs --check` | `records=143 unique=143` `DEFERRED=3 EXTERNAL=14 VERIFIED=126` |
| Git | `git status --porcelain` | 8 M + 18 ?? (ver abaixo) |
| Git | `git diff --stat` | 8 files, 185 insertions(+), 96 deletions(-) |
| Memória | `ai-memory` briefing | 112 páginas, 121 sessões, 0 handoff, 7/30d: 26 sessões / 17 páginas, lint 2026-08-26 5 warnings duplicate |
| Coverage | `jest.config.js:41` threshold 70% | `Statements 63.11% / Lines 64.19% / Branches 48.74% / Functions 55.20%` — FAIL (F3.14) |
| Lint | `_lint/2026-08-26.md` | 5 duplicate-title warnings, sem erro estrutural |

## Pendências locais com gate aberto (39 VERIFIED fraco + F3.14)

| Wave | IDs | Gate | Evidência local atual (2026-08-25) | Falta para fechar |
|---|---|---|---|---|
| W0 | F0.02, F0.03, F0.08, F0.09 | `W0 gate: inventory/scan/owner ledger` | Inventário Gitleaks + CI `gitleaks-scheduled.yml` reconciliados com evidência genérica | Task 6 do plano 2026-08-25 (retenção/audit) — `docs/ops/w10-retention-policy.md` já criado mas não commitado |
| W1 | F1.02 | `W1 gate: safe runners and baseline` | Commits RBAC/CRM/Financeiro confirmados | Pré-requisito W0 owner |
| W3 | **F3.14** + F3.02 sidecar, F3.04-F3.17 | `W3 gate: global coverage threshold / sidecar wiring / DB apply` | `coverage-boost` 13/13 + targeted suites PASS, `src/lib/env.ts:63` app/bridge/agent wired, `src/workers/ia-bridge/index.ts:44` + `src/workers/ia-agent/index.ts:36` OK | F3.14: 3 arquivos delta (campaign/followup/budgets 0% 521 lines) + `coverage/lcov.info` + ADR opcional `!src/repositories/**`. Sidecar `F6.13` em `parseRuntimeEnv('sidecar')` |
| W4 | F4.02-F4.05, F4.08, F4.11 | `W4 gate: contract tests and tenant shell` | `src/lib/api/action-route.ts:27` 9 tests 100%, `sidebar-manifest` 3/3, `manifest-paths` 3/3, `gates` PASS, `getVisibleCoreMenu` Server Action, `adr-dashboard-server-guard.md` | `lint --max-warnings=0` full + server `auth()` guard formal + `filterMenuByAccess` audit completo |
| W5 | F5.01-F5.06 | `W5 gate: complete patient/journey remains open` | `waitlist.fill` 6/6 idempotente (`FOR UPDATE`+clinicId), `journey-patient` E2E, availability/timezone/conflict PG, treatment-plan 8 tests | `test:integration:run` 8-way + `test:e2e J-04` |
| W6 | F6.01-F6.15 | `W6 gate: app/bridge/agent failure-mode evidence` | `parseRuntimeEnv` 4/4, `wrangler` 2×EXIT 0, `adr-llm-embedding`, `f6-sidecar-mtls`, `STATE_VERSION=2` typecheck:ia-agent EXIT 0 | Vectorize→pgvector consolidado já doc, falta `roadmap:write` para promover VERIFIED pleno |
| W7 | F7.01-F7.08 | `W7 gate: retry/DLQ/consent evidence` | campaign execution, `inactive-patient` 4/4, `consent-guard` 4/4, `dispatch-dlq` 3/3 (F7.07 bounded retry<5 / ≥5 dead_letter) | `Queue` consumer runtime + consent versionado pré-dispatch audit |
| W8 | F8.01-F8.07 | `W8 gate: lead/contract/merge invariants remain open` | CRM/comercial suites PASS, lead dedup/merge PG | hook↔endpoint contract migration + `index.ts` boundary audit |
| W9 | F9.01-F9.09 | `W9 gate: provider/race evidence` | `charge-race` 2/2, webhook `timingSafeEqual`, gateway→clinic→charge binding | `Promise.all` webhook duplicado/simultâneo + outbox reconciliação provider |
| W10 | F10.02-F10.10 | `W10 gate: metric and data-lifecycle evidence` | `metric-dictionary.md` (F10.02 fórmula/fonte/janela/tz/freshness/clínica), LGPD suites PASS | `w10-retention-policy.md` já criado untracked, falta purga/legal-hold proof |
| W11 | F11.01-F11.15 | `W11 gate: rollout/rollback/SLO evidence` | `w11-rollout-runbook.md` + health/readiness + headers + logger PASS, `w11-runbook` ordem backup→expand→workers→app→smoke | `npm run verify` full global coverage + rollback drill |

## Bloqueados EXTERNAL — 14 (não executar sem owner)

`F0.04` rotação GitHub/Cloudflare/DB/LLM/Evolution/Asaas, `F0.05` forks/Actions logs/artifacts, `F0.06` `gh auth`, `F0.07` history sanitization + clone invalidation, `F0.10` ledger sanitizado, `F1.01` PR #6 review, `F12.01-08` piloto/go-no-go — `W0 gate: owner/provider authorization` / `W12 gate: owner-approved pilot required`.

## DEFERRED — 3 (decision record)

`F0.01` freeze, `F1.03` merge PR, `F1.04` rebase — `docs/adr/adr-deferred-*.md` com gate `decision record needed`.

## Trabalho não commitado (risco de perda) — `git status` 2026-08-26 em `main`

**Modificados (8):**
- `docs/adr/adr-llm-embedding.md`
- `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md`
- `src/lib/__tests__/runtime-env.test.ts`
- `src/lib/api/__tests__/action-route.test.ts`
- `src/lib/auth/password.ts`
- `src/modules/financeiro/lib/__tests__/crypto.test.ts`
- `src/services/waitlist/__tests__/waitlist.fill.test.ts`
- `src/workers/ia-agent/index.ts`

**Untracked (18):**
- `.claude/skills/orca-planner-coder/`, `.opencode/`
- `docs/adr/adr-coverage-repositories.md`, `docs/adr/adr-dashboard-server-guard.md`
- `docs/ops/metric-dictionary.md`, `docs/ops/w10-retention-policy.md`, `docs/ops/w11-rollout-runbook.md`
- `docs/superpowers/audits/f3-14-coverage-2026-08-25.md`, `docs/superpowers/audits/f6-sidecar-mtls.md`, `docs/superpowers/audits/rubrica-fechamento-2026-08-25.md`, `docs/superpowers/audits/w3-veredicto-f3-14-2026-08-25.md`, `docs/superpowers/audits/w5-waitlist-for-update.md`
- `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md`
- `e2e/journey-patient.spec.ts`, `src/__tests__/coverage-boost.test.ts`, `src/lib/auth/__tests__/password.test.ts`, `src/lib/outbox/__tests__/dispatch-dlq.test.ts`, `src/lib/ui/__tests__/sidebar-manifest.test.ts`, `src/modules/financeiro/services/__tests__/charge-race.test.ts`, `src/repositories/clinics/__tests__/`, `src/services/followup/__tests__/consent-guard.test.ts`, `src/services/followup/__tests__/inactive-patient.test.ts`, `src/services/followup/consent-guard.ts`

Todos pertencem às Tasks 1-6 do plano 2026-08-25. Sem commit, `roadmap:write` não promove VERIFIED e `npm run verify` global não fecha.

## Rubrica atualizada (2026-08-26)

Mantida média **8.0/10** (ver `rubrica-fechamento-2026-08-25.md:9`). Critério: 10 = RED→GREEN+artefato+`roadmap:check`/`verify` verdes; 8-9 = teste+artefato verdes mas verify parcial; 5-7 = código+doc verdes sem suite global; 3-4 = doc parcial sem teste. Todos os gaps para 10 são de fechamento local (coverage global, `test:integration:run` 8-way, `lint` full), não de EXTERNAL.

## Próximos passos (menor esforço → maior impacto)

1. **T1** (2-3h): `coverage-boost` + `inactive-patient` + `clinics` repo focused → `npm test -- --runInBand --coverage` ≥70% → `coverage/lcov.info`
2. **T5** (2h): `consent-guard` + `charge-race` + `dispatch-dlq` → `Promise.all` race proof
3. **T3** (1h): `waitlist.fill` idempotente + `journey-patient` E2E
4. **T2** (1h): `sidebar-manifest` + `manifest-paths` + `dashboard/layout.tsx` server guard + `npm run lint && typecheck`
5. **T4** (2h): `runtime-env` sidecar + `wrangler deploy --dry-run` + `STATE_VERSION=2` + `metric-dictionary`
6. **Fechamento** (0.5h): `npm run roadmap:write && node scripts/roadmap-ledger.mjs --check` → `npm run verify` → commit por task, sem tocar EXTERNAL/W12.

## Conformidade

- Stack Next.js 15 + Drizzle `pg` + NextAuth JWT + Workers OpenNext/Hyperdrive/pgvector mantidos; sem major regressão.
- Segurança: nenhum valor de secret impresso; apenas nomes/fingerprints (`DATABASE_URL`, `AUTH_SECRET`, `PLAYWRIGHT_SECRET`).
- Ledger: EXTERNAL/W12 e DEFERRED preservados com ADR; nenhuma reclassificação automática.
- Verify: `tsc --noEmit --skipLibCheck` EXIT 0 e 35/35 suites alvo PASS; `lint`/`coverage` globais pendentes por timeout ambiente, não por falha de código.

*Gerado 2026-08-26 — reavaliar após cada task fechada. Próxima verificação agendada após T1.*
