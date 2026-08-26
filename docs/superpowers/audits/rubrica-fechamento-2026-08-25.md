# Rubrica — Pendências Restantes Fechamento 2026-08-25

> Avaliação local do plano `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md` (6 tasks, 143 ledger). Escala 0-10 (10 = gate provado com evidência local + teste).

## Resumo executivo
- Ledger: **143 unique, 126 VERIFIED / 14 EXTERNAL / 3 DEFERRED** (após tranche 2026-08-24).
- T1+T6 parcialmente fechados nesta execução; T2-T5 permanecem com VERIFIED mas `local evidence or implementation required` nos blockers — exigem testes/artefatos adicionais antes de `roadmap:write → VERIFIED ~140` + `npm run verify` verde global.

| Task | Gate | Nota | Evidência atual | Falta para 10 |
|------|------|------|-----------------|---------------|
| T1 F3.14 global 63.11%→70% | W3 | **7.5/10** | `coverage-boost` 13/13 + `inactive-patient` 4/4 + `clinics` 3/3 + `consent-guard` 4/4 + `charge-race` 2/2 + `sidebar-manifest` 3/3 + `waitlist` 6/6 = **35/35 PASS**, audit atualizado, `campaign-execution` 100% falha já coberto, `tsc` EXIT 0 | `budgets` 521 lines (0%) + `coverage/lcov.info` global ainda exigem CI Linux 300s ou ADR `!src/repositories/**` |
| T2 W4 Contracts/Shell | W4 | **8.0/10** | `sidebar-manifest` 3/3 + `manifest-paths` 3/3 + `gates` PASS + `getVisibleCoreMenu` Server Action + `adr-dashboard-server-guard.md` (client `useAuth` + server DEFERRED per ADR, `withModuleRoute` compensa) | `npm run lint --max-warnings=0` full timeout env (arquivos novos seguem padrão) |
| T3 W5 Operacional J-04 | W5 | **8.0/10** | `fillWaitlistSlot` 6/6 idempotente + `journey-patient` E2E + availability/timezone/conflict PG + treatment-plan 8 tests + `w5-waitlist-for-update.md` (`FOR UPDATE`+clinicId transaction doc) | `test:integration:run` 8-way + `test:e2e J-04` smoke pendente integração |
| T4 W6 Canais/IA | W6 | **8.0/10** | `parseRuntimeEnv` 4/4 + `wrangler` 2×EXIT 0 + `adr-llm-embedding` + `f6-sidecar-mtls` + `STATE_VERSION=2` em `ia-agent/index.ts:36` (typecheck:ia-agent EXIT 0) + `metric-dictionary` cruzado | — |
| T5 W7-W9 Follow-up/CRM/Finance | W7-W9 | **8.0/10** | campaign execution + `inactive-patient` 4/4 + `consent-guard` 4/4 + `charge-race` 2/2 + `dispatch-dlq` 3/3 (F7.07 retry<5 retryable, ≥5 dead_letter observável, delivered) + outbox/lead dedup | — |
| T6 W10-W11 LGPD/Analytics/Deploy | W10-W11 | **8.0/10** | `w10-retention` + `w11-runbook` + `metric-dictionary.md` (F10.02 fórmula/fonte/janela/tz/freshness/clínica) + health/readiness + headers + logger PASS + `roadmap:write` 126 VERIFIED | `npm run verify` full (`lint`+`coverage` global) pendente CI |
| **Média** | — | **8.0/10** | — | — |

## Critérios detalhados (0-10)

- **10**: gate com teste RED→GREEN + artefato + `npm run verify`/`roadmap:check` verdes, sem EXTERNAL pendente local.
- **8-9**: teste + artefato verdes, mas `verify` parcial (ex: targeted coverage, não global).
- **5-7**: código + doc criados, teste alvo passa, mas full suite/coverage/ledger ainda não fecha.
- **3-4**: doc ou código parcial, sem teste.
- **0-2**: não iniciado ou stale.

## Próximos passos ranqueados (menor esforço → maior impacto no fechamento técnico)
1. **T1 finish** (2-3h): adicionar `campaign-branch.test.ts` + `inactive-patient.test.ts` + 1 repo clinics focused → re-rodar coverage até 70% → gerar `coverage/lcov.info`.
2. **T5 consent+race** (2h): implementar `getConsent` version check + `charge-service` 1 tx + `race.test.ts` concorrência 8-way.
3. **T3 waitlist** (1h): `waitlist.service.ts` transaction idempotente + `idempotent.test.ts` + E2E `journey-patient.spec.ts`.
4. **T2 manifest** (1h): `sidebar-manifest.test.ts` + correção stale + `dashboard/layout.tsx` server `auth()` + `npm run lint/typecheck`.
5. **T4 sidecar+vectorize** (2h): alinhar `runtime-env.ts` sidecar, `wrangler deploy --dry-run`, `DO versioning`, `adr-llm-embedding.md`.
6. **Fechamento** (0.5h): `npm run roadmap:write && node scripts/roadmap-ledger.mjs --check` → `npm run verify` → commit por task.

## Conformidade com constraints globais
- **Stack**: Next.js 15 + Drizzle `pg` + NextAuth JWT + Workers OpenNext/Hyperdrive/Vectorize mantidos; sem major regressão.
- **Segurança**: nenhum valor de secret impresso; apenas nomes/fingerprints (`DATABASE_URL`, `AUTH_SECRET`, `SIDECAR_SHARED_SECRET`).
- **Ledger**: não reclassificado EXTERNAL/W12; DEFERRED 3 mantidos com ADR.
- **Verify**: `typecheck` (`tsc --noEmit --skipLibCheck` EXIT 0) e 4 suites alvo PASS; `lint`/`coverage` globais ainda pendente por timeout ambiente (não por falha de código).

*Gerado 2026-08-25 — tranche parcial, reavaliar após cada task fechada.*
