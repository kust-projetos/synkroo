# Pendências — Plano de execução (2026-10-12)

Origem: verificação de pendências + Wave 1 (W1A/W1B/W1C read-only). Owner gates em spec-only.

## Estado 2026-10-13 (sessão autônoma)
- T1.1→PR #65, T1.2→PR #66, T1.4→PR #67 (todos com tsc+jest+eslint locais verdes; #65/#67 APPROVED security-reviewer; #66 CHANGES_REQUIRED→finding1 corrigido + finding2 resolvido via rebase).
- T1.6: #15+#16 MERGEADOS. #18 e #17 com conflito de lock resolvido manualmente (union: bump do PR + pins da main), CI re-rodando.
- T1.7: 4 stashes dropados (backup em `refs/backup/manual-20261012/stash-0` + backups pre-cleanup).
- T1.5 incluído no batch #66. T2.4: deprecate-not-delete (guard sem equivalente no módulo).
- T2.1→branch `feat/appointment-dialog-edit` (validado tsc+jest). T2.2→branch `test/e2e-gw02-flaky` (código pronto; E2E pendente browser).
- CI caveat: Build & Test flaky em #65 (2 runs, falhas distintas em áreas intocadas: financeiro E2E strict-violation + outbox integration timing).

## T1 — Correções seguras (nesta rodada)
| # | Item | Arquivos | Risk |
|---|---|---|---|
| T1.1 | #63 CSRF: normalizar loopback (`localhost`/`127.0.0.1`/`::1`) antes de comparar Origin | `src/lib/security/request-guards.ts` + testes | auth → security-reviewer |
| T1.2 | Fail-closed: `budget-followup.service.ts:20` catch→[] + ajuste em `dashboard/alerts.ts` | 2 arquivos | médio (contrato alerts) |
| T1.3 | `patients/inactive/route.ts:170` success parcial (`partial:true`) + paginação limitada | 1 arquivo | médio (contrato API) |
| T1.4 | Remover primitivas patients unscoped + escopar reads adjacentes (`getPatientPreferences`, `getLatestRiskScore`, `getRecentAppointments`, subquery appointments) | `src/repositories/patients/index.ts` | tenant → security-reviewer |
| T1.5 | `contacts.service.ts:85` catch→null (distinguir not-found vs DB down) | 1 arquivo | baixo |
| T1.6 | Dependabot: merge #15 → #16 → #18 (pós-rebase) | remoto | CI verde |
| T1.7 | Stashes: rescue @{0}, drop @{1..3} após `stash show` | git | baixo |

## T2 — Requer API/ambiente (nesta rodada, após T1)
| # | Item | Nota |
|---|---|---|
| T2.1 | AppointmentDialog edit-branch | verificar endpoint PUT/PATCH antes |
| T2.2 | #61: premissa errada (montado em `dashboard-layout.tsx:23,29`) — fixture multi-clínica + spec de visibilidade + comentar na issue | depende seed multi-clínica (B1) |
| T2.3 | #60: trocar `networkidle` por `domcontentloaded`+testid, remover `toPass`-click-loop | validar `--repeat-each=10` |
| T2.4 | Remover `services/installments/installment.service.ts` (sem callers) | mecânico |
| T2.5 | #17: re-rodar E2E / ler log | tranche separada |

## T3 — Spec-only, sem merge
- #19 (next 16): triar build log — next-auth v4 incompatível provável.
- #20 (zod 4): migração + trocar `zod-to-json-schema` — spec de migração.
- Owner gates (sem mutação): W12 execução real, switch prod, drill mensal, RPO/RTO, limiter distribuído, remoção fallback `../vps-hostinger/.env` (só após confirmar `SYNKROO_VPS_ENV` na VPS), D3 drill G3.

## Fechados sem código (Wave 1 provou)
- `validateTemplate` 3 vias: re-exports idênticos + parity test — nada a fazer.
- Núcleo money-path (roi/stats/analytics): já fail-closed/throw.
- Strangler budgets: path vivo via `modules/financeiro` — sem dreno.

## Gates
`lint` + `tsc --noEmit` + jest focado por tranche; tester valida T1; security-reviewer em T1.1+T1.4; reviewer em T1.2+T1.3+T1.5. E2E só T2.3/T2.2.
