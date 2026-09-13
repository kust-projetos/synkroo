# Rubrica Final — Tranche Auditoria → Remediação Synkroo — 2026-09-04

> **Tranche:** `docs/superpowers/plans/2026-09-02-synkroo-audit-remediation-plan.md` (T0–T10)
> **Data:** 2026-09-04
> **Fontes:** `docs/agent/2026-09-02-T0-receipt-baseline-tranche-auditoria-remediacao.md` (T0) · `docs/agent/2026-09-04-T10-receipt-auditoria-remediacao.md` (T10, §§1–16) · `reports/backend-security-audit-2026-09-04-coder1.md` (Coder1) · `auditoria_consolidada_synkroo.md` (somente leitura, não sobrescrita)
> **HEAD:** `78868048` em `main` — nenhum commit/push nesta tranche; **nesta sessão Coder1** nenhum deploy/migration compartilhada/segredos
> **Histórico autorizado fora desta sessão:** T23 aplicou V025 em alvo remoto explicitamente declarado não produtivo (`pi_financeiro`) com backup, checksum e sem deploy de produção — ver T10 §16
> **Princípio:** nenhuma mudança preexistente foi reatribuída; `git diff` da §1 do T10 é o delta atribuível

## 1. Objetivo

Consolidar rubrica objetiva da tranche com critérios, evidência, score e gates com exit codes, explicitando bloqueios residuais e fora de escopo, sem alterar código.

## 2. Critérios e evidência

| # | Critério (plano §1/§4) | Evidência citada no receipt | Status |
|---|---|---|---|
| 1 | Webhooks WhatsApp/Instagram e widget chegam ao handler sem 307 privado | `middleware.security` + `harness` 33/33 PASS; `SIGNED_TRANSPORT` + `PUBLIC_EXACT` exatos; `whatsapp/webhook` e `instagram/webhook` HMAC antes de rate-limit; `widget/messages` token antes de limiter | **GREEN** |
| 2 | Crons autenticados não bloqueados por tráfego anônimo | `cron/{reminders,smart-triggers,crm-duplicates,followups,cleanup}` validam `CRON_SECRET` com `timingSafeEqual` antes de `checkRateLimit`; teste 20×401 + válida não 429 em `followups` e `crm-duplicates` | **GREEN** |
| 3 | Export LGPD de A nunca contém dados de B; `redactAgentQueues` fail-closed | `lgpd-service.test.ts` + `t3.integration` — filtro `actionLogs` por vínculo verificável; `catch` distingue `does not exist` vs falha real (`throw ActionError`) | **GREEN** (unit); integração real GREEN em `synkroo_test` 256/256 |
| 4 | Pagamentos manuais e gateway idempotentes, sem overpayment, com CAS | `payment-service.t4` saldo sob `transaction` + `toCents` BigInt + `remainingCents`; `financeiro-repository` `processGatewayEventAtomically` dedup `externalEventId`, `isPartial`/`isFullOrOver`, `terminal` e CAS `eq(status, ...)`; parcial não marca `paid` | **GREEN** (unit); integração concorrente GREEN em `synkroo_test` |
| 5 | Settings preserva `whatsapp_phone_number_id` e chaves desconhecidas | `clinics/settings.t5` — merge server-side `existingSettings` + `incomingSettings`; só toca `settings` column se `settings`/`appointment_durations` enviados | **GREEN** |
| 6 | Relatório pacientes não materializa clínica toda em JS | `reports/patients.t5` — paginação SQL `NOT EXISTS ... appointments.clinicId` com `LIMIT 50`/`offset`, sem `allPatients` em memória | **GREEN** |
| 7 | Agenda 409/500 mantém modal aberta; conversas com rollback/polling | `AppointmentDialog.t6` — `response.ok` + toast + `invalidateQueries` só após sucesso; `conversas/page.t6` + `use-queries.t6` — rollback otimista + retry + `refetchInterval` | **GREEN** |
| 8 | Leads `?filter=hot`, config reload, financeiro `canManageBudget`, sidebar RBAC | `page.t7` leads/config/financeiro + `sidebar.t7` — `?filter=hot` server-side, reload preserva settings, `canManageBudget` real, `getVisibleCoreMenu` RBAC | **GREEN** |
| 9 | Rotas legadas sensíveis sob `requires` + tenant opaco 404 | `t8-matrix` 52/52 PASS; `grep validateApiAuth()` sem arg → 0 handlers sensíveis restantes; `budgets/[id]/accept,reject` retornam `not_found` opaco | **GREEN** |
| 10 | Cobertura alinhada, ARIA e harness sem tautologia | `jest.config.js` branches 55/functions 65/lines 70/statements 70 alinhado a `AGENTS.md`; `middleware.harness` sem `can:()=>true`; `toast.tsx` `role`/`aria-live`; `MonthView` `role="grid"`/`gridcell` + teclado | **GREEN** |
| 11 | Instagram boundary — tenancy server-side, sem `getDb` no entrypoint | T2→T6: `route.ts` removido `getDb`/`channelInstallations` direto; `resolveInstagramInstallation` em `conversations-repository.ts` com `provider=instagram,enabled=true` + fallback; `boundary-rules` 17/17 PASS; `instagram/webhook` 15/15 PASS | **GREEN** |
| 12 | Security gate Instagram ≥80% | `jest.security.config.js` inclui `route.test.ts`; `test:security` 144/10 suites 97.22% statements, webhook 96.93% statements / 86.84% branches | **GREEN** |

## 3. Gates com exit codes

| Gate | Comando | Exit | Evidência |
|---|---|---|---|
| lint | `npm run lint` (`eslint . --max-warnings=0`) | 0 | clean — T10 §4 e Coder1 |
| typecheck | `npm run typecheck` (`tsc --noEmit`) | 0 | clean |
| test (unit+contrato) | `npm test -- --runInBand` | 0 | 319 suites, 2325 tests, 5 skipped — T8/T9 e Coder1 (após correção `maskApiKey` e boundary) |
| test:integration | `npm run test:integration:run -- --runInBand` (loopback `TEST_DATABASE_URL` explícito → `synkroo_test`) | 0 | 45/45 suites, 256/256 tests — T14 E47; guard `TEST_DATABASE_URL is required` antes foi BLOCKED (§5 T10) |
| test:security | `npm run test:security` (`jest --config jest.security.config.js --coverage`) | 0 | 10/10 suites, 144 tests; webhook 96.93% stmts / 86.84% branches / 100% funcs — T2/T6 |
| build | `npm run build` (`next build`, 124 páginas) | **0 em T10 §4** / **1 em Coder1 Windows** | T10 §4: `Compiled successfully in 17.8s`, 124/124 exit 0; Coder1: `Compiled successfully in 30.8s` mas `ENOENT rename .next/export/500.html -> .next/server/pages/500.html` exit 1 (Windows/opennext filesystem) — **requer confirmação em Linux/CI** |
| build:cf | `npm run build:cf` (`opennextjs-cloudflare build && inject-pg-global`) | 0 | `Worker saved in .open-next/worker.js` — T10 §4 e Coder1 exit 0 |
| git diff --check | `git diff --check` | 0 | sem whitespace errors; apenas warnings CRLF legados (8 arquivos) |

## 4. Score — reconciliado com T10 §§13–16 (estado atual)

| Conjunto | Cálculo | Resultado |
|---|---|---|
| T10 §9.1 satisfeitos | 10 GREEN com evidência direta | 10/10 |
| T10 §9.2 parcialmente verificados (AMBER) — alinhado a §§13–14 | Após T6: Instagram boundary 17/17 + 15/15 PASS e security 10/10; LGPD/pagamentos com unit PASS e integração loopback GREEN — AMBER pré-T6 resolvido | 0 AMBER remanescente para boundary/security; AMBER histórico documentado em §9.2 do T10 |
| Gates finais locais T10 §§13–14 + Coder1 | `npm test` 319/319 (2325 tests, 5 skipped) exit 0; `test:integration` 45/45 (256/256) em `synkroo_test` loopback exit 0; `test:security` 10/10 (144 tests) exit 0 | **GREEN** |
| T10 §9.3 bloqueados | 4 RED/BLOCKED externos (integração inicial, security threshold preexistente, `boundary-rules`/`maskApiKey`, smokes) — resolvidos em T2/T6/T8/T14/T23 | 0 remanescentes como falha aberta (exceto E2E) |
| E2E Playwright 14 specs | Não executado nesta tranche Windows (T10 §8.2 e §9.3) — coberto por contrato `t6` | **Não executado — fora do score GREEN** |
| Score tranche (backend/security) | GREEN com evidência ≥ unit + integração loopback + security | **ALLOWED_TO_PROCEED para backend/security** |
| Score global com integrações locais | 319/319 unit + 45/45 integração loopback + 10/10 security | **GREEN** (E2E Playwright pendente) |

## 5. Bloqueios residuais

| Bloqueio | Estado atual | Próximo passo autorizado |
|---|---|---|
| Integração PostgreSQL remota inicial `TEST_DATABASE_URL` ausente / `synkroo-db Exited 137` / `com.docker.service Stopped` | **Desbloqueado localmente** em `synkroo_test` via `docker compose up -d --wait` + `TEST_DATABASE_URL` loopback (T11–T14); remoto permanece sem validação em produção | Revalidar em CI/VM com `TEST_DATABASE_URL` loopback dedicado; não usar `synkroo` dev para fixtures (nota §15 T10: `instance_modules.atendimento` restaurado) |
| `42P01` `push reminder` remoto `pi-finance-api:main` | **Remediado em alvo não produtivo** — V025 `push_reminder_scheduler.sql` aplicada em `pi_financeiro` com backup `pi-financeiro-pre-v025-20260904T180728Z.dump` (201480 bytes, mode 600, sha256 `876f7c07…`), `push_reminder_deliveries`/`push_delivery_attempts` + `_migrations` v25 (`370fb6e7…`), 3 ciclos sem `42P01` pós 18:10, `/health` 200 healthy (T23) | Qualquer promoção a produção exige procedimento de migration de produção aprovado + revalidação independente; divergência `migrate-job` vs `DB_SCHEMA=legacy` documentada |
| Instagram `direct_database_access` (boundary) | **Corrigido** em T6 — sem `getDb` no entrypoint, 17/17 boundary PASS | Manter seam `resolveInstagramInstallation` como contrato |
| `maskApiKey` off-by-one | **Corrigido** em T8 — `'*'.repeat(len-4)+last4` alinhado, financeiro-actions 15/15 PASS | Nenhum pendente |
| Cobertura `test:security` Instagram <80% | **Resolvido** — 144 tests, 96.93% stmts | Não reduzir thresholds nem adicionar exclusões (T9) |
| E2E Playwright 14 specs (409/500/retry/inbound) | Não executado nesta tranche Windows | Executar com `next dev` + DB em staging; coberto por contrato `t6` |

## 6. Fora de escopo — distinção de sessão

Conforme plano §6 e T0 §6 / T10 §8.2, **nesta sessão Coder1 não** foram executados:

*Obs.: T23, em sessão anterior distinta e com autorização explícita, aplicou V025 em alvo remoto explicitamente declarado não produtivo (`pi_financeiro`) com backup, Advisory Lock e checksum, sem deploy de produção — ver T10 §16. A afirmação abaixo refere-se exclusivamente à presente sessão documental.*

- Deploy produção, `preview:cf` com secrets, `wrangler deploy`, `docker compose up` remoto, restart, `pm2`, rollback ou promoção de imagem.
- Criação/rotação/commit/log de `AUTH_SECRET`, `JWT_SECRET`, `MINIMAX_API_KEY`, `OPENAI_API_KEY`, `EVOLUTION_API_URL/KEY`, `WEBHOOK_SECRET`, `CRON_SECRET`, `SEED_SECRET`, `TEST_DATABASE_URL` remoto ou qualquer segredo em Git/logs/backups plaintext.
- `drizzle-kit migrate` ou `admin/run-migration` em DB compartilhado/produção — migrations validadas apenas em unit/integração loopback `synkroo_test`.
- Reconciliação retroativa de pagamentos/liquidações históricas ou notificação formal LGPD — requer procedimento auditado/jurídico separado.
- Redesign visual, i18n completa, migração total de endpoints legados não sensíveis — follow-ups após T8.
- Alteração de provider/infra externa (Supabase/Hyperdrive/Vectorize/Asaas/Evolution/Meta) além de documentação `reports/whatsapp-sidecar*`.

## 7. Veredito final

**ALLOWED_TO_PROCEED para backend/security/data da tranche — com ressalvas documentadas.**

- Todos os critérios §1 do plano têm teste RED→GREEN com evidência em T10 §2/§9 + §§13–16 e Coder1 §§2–4.
- Gates `lint 0`, `typecheck 0`, `test 0` (319/319), `test:integration 0` (45/45 loopback), `test:security 0` (10/10), `build:cf 0`, `git diff --check 0`; `build` (`next build`) divergente — T10 exit 0 vs Coder1 Windows exit 1 ENOENT — **requer confirmação em Linux/CI** antes de claim verde incondicional.
- Residuais críticos (42P01, boundary, security threshold, integração Docker) foram desbloqueados localmente (T2/T6/T8/T14) e, para 42P01, em alvo não produtivo remoto em T23 com backup/health 200; esta sessão Coder1 não executou push/deploy/migration/segredos.
- E2E Playwright 14 specs não executado nesta tranche (T10 §8.2/§9.3) — fora do score GREEN, coberto por contrato `t6`.
- Este veredito não autoriza deploy em produção, rotação de segredos ou migration compartilhada em produção — exige janela controlada com backup e revalidação independente (T23 já demonstrou procedimento em alvo não produtivo).

## 8. Verificação do artefato

```powershell
git diff --check -- reports/final-rubric-2026-09-04.md  # exit 0 (sem whitespace errors)
# 8 seções ##, tabelas markdown balanceadas, sem trailing whitespace
```

*Gerado conforme `code-craftsman` — menor intervenção (só docs), sem abstração especulativa, verificação proporcional ao risco; `autoresearch` 1 iteração validou consistência entre T0, T10 §§1–16 (inclui 319/319, 45/45, 10/10, E2E não executado) e `backend-security-audit` (build divergente reconciliado com caveat Linux/CI, T23 não-produtivo distinguido) sem divergência de HEAD/status/gates.*

