# Coder 1 — Backend/Security/Data Audit (Tranche Synkroo) — 2026-09-04

## Escopo auditado
`src/middleware.ts`; `src/app/api/**`; `src/modules/**`; `src/services/**`; `src/lib/auth/**`; testes backend-focused. Worktree atual inspecionado primeiro via `git diff HEAD --stat` (69 arquivos alterados + ~70 untracked docs/tests temporários). Nenhum push/deploy/alteração de segredo/migration compartilhada executada — verificação read-only conforme instrução. Remote 42P01 follow-up apenas leitura (não reproduzido em dados compartilhados).

## Autoresearch loop (bounded max 3 iterações, --evals)

Iteração 1 — modify→verify: inspecionar diffs T1-T9; validar auth-before-rate-limit (cron, whatsapp, widget, instagram), tenant isolation (budgets 404 opaco, reports tenant-scoped, financial-reports clinicId, LGPD actionLogs filtrado), LGPD fail-closed (redactAgentQueues throw vs silent), pagamento CAS/idempotência (toCents bigint, saldo devedor sob lock, installments atômicos, gateway terminal).

Iteração 2 — verify: `npm run lint` (exit 0), `npm run typecheck` (exit 0), `npm test -- --runInBand --testPathPattern=...` por subsistemas (490/61 suites em subset focado), `npm run test:security` (144/10 suites), `npm test -- --runInBand` full (2325 pass, 5 skip, 319 suites), `npm run build:cf` (exit 0).

Iteração 3 — verify ampliado + evals: re-aferir `src/services/api-handlers` validateApiAuth sem permissão restantes — classificados como não-sensíveis (dashboard/stats/tasks/analytics) e tenant-scoped; sensíveis migrados validados por `t8-matrix.test.ts` (52 casos 401/403/200/404).

## Verificações por garantia

### Tenant isolation
- `src/app/api/budgets/[id]/accept|reject/route.ts:14-15` exige `financeiro:manage_budget` e retorna `Budget not found` 404 quando `budget.clinicId !== clinicId` (opacidade, não 403) — evita enumeração `src/app/api/budgets/[id]/accept/route.ts:17`.
- `src/services/reports/financial-reports.service.ts:128-130` `payments` filtrados por `eq(payments.clinicId, clinicId)` — corrige vazamento cross-clinic anteriormente sem filtro.
- `src/services/api-handlers/reports/patients.ts:34-46` inactiveList via SQL `NOT EXISTS ... appointments.clinicId = clinicId` com `limit/offset` (max 100) — nunca materializa clínica toda em JS.
- `src/services/api-handlers/clinics/settings.ts:31-50` merge server-side preserva `whatsapp_phone_number_id` e chaves desconhecidas; somente `body.settings`/`appointment_durations` tocam `settings` column.
- `src/app/api/**` T8 — budgets, campaigns/segments, custom-fields, knowledge (`ia:chat`/`ia:manage`), reports/financial (`financeiro:view`), treatment-plans (`operacional:*`), patients/preferences todas com `validateApiAuth('<permission>')` explícita.

### Auth-before-rate-limit
- `src/app/api/cron/{reminders,crm-duplicates,cleanup,followups,smart-triggers}`: verificação `CRON_SECRET` com `crypto.timingSafeEqual` antes de `checkRateLimit` — comentário `before rate limit` presente em todos; teste `20 anônimas retornam 401 e seguinte válida não recebe 429` em `src/app/api/cron/followups/route.test.ts:154-174` e `crm-duplicates`.
- `src/app/api/whatsapp/webhook/route.ts:23-30` e `src/app/api/instagram/webhook/route.ts:24-30` verificam `x-hub-signature-256` antes de rate limit; Instagram testa `Invalid signature does not consume quota` — `mockCheckRateLimit.notCalled` em 401.
- `src/app/api/widget/messages/route.ts:69-77` verifica `verifyWidgetToken` antes de `checkRateLimit`; teste correspondente em `route.test.ts:91-99`.
- `src/middleware.ts:14-36` `PUBLIC_EXACT` lista apenas rotas exatas (`/api/whatsapp/webhook`, `/api/whatsapp/evolution`, `/api/instagram/webhook`, `/api/widget/session`, `/api/widget/messages`, `/api/financeiro/webhooks/asaas`) — nenhum wildcard `/api/whatsapp/*`.

### LGPD fail-closed
- `src/modules/operacional/services/lgpd-service.ts:151-158` `loadPatientGraph` filtra `actionLogs` por `containsAnyId(row.inputRedacted, relatedIdsSet)` — nunca exporta clínica toda; se schema sem FK confiável, omite em vez de vazar.
- `redactAgentQueues:288-303` catch distingue `does not exist/relation/undefined_table/no such table` (omissão segura para testes) vs demais → `throw new ActionError('internal', ...)` — nunca retorna fila não redigida.

### Payment CAS/idempotência
- `src/modules/financeiro/services/payment-service.ts:17-35` `toCents`/`centsToDecimal` BigInt decimal-safe; `amountCents <=0` rejeitado; saldo devedor calculado sob `db.transaction` com `SELECT ... payments WHERE budgetId+clinicId`; `remainingCents` check evita ultrapassar `finalValue`; charge CAS `terminal.has(status)` e `eq(paymentCharges.status, charge.status)` predicate; installments atualizados no mesmo tx.
- `src/modules/financeiro/repositories/financeiro-repository.ts:440-520` `processGatewayEventAtomically` deduplica por `onConflictDoNothing` em `gatewayEvents.externalEventId`; `isTerminal` bloqueia `paid` tardio; `isPartial` vs `isFullOrOver` usa `receivedCents`; `partially_paid` não marca `paid` até liquidar; `refund` terminal via `cancelled`; `paymentMethod` e `patientId` preservados do budget server-side, não do body.

### Instagram boundary
- `src/app/api/instagram/webhook/route.ts:1-158` `verifySignature` HMAC sha256 `timingSafeEqual`, GET handshake `hub.verify_token`, POST resolve `resolveInstagramInstallation(accountId)` server-side; `channel: 'instagram'` incluído em `receber-mensagem.ts:16` Zod; `entry.changes[].value.messaging` coberto; timestamp stale >24h ignorado; 401/403 fail-closed sem persist.
- `src/modules/atendimento/repositories/conversations-repository.ts:653-674` tenta `channelInstallations` (provider instagram, enabled true) antes de fallback `getClinicByInstagramAccountId`; nunca confia em `clinicId` do body.
- Teste duas clínicas `src/app/api/instagram/webhook/__tests__/route.test.ts:133-165` prova instalação A não escreve em B.

### Cron e 42P01 (read-only)
- Todos os crons autenticados por `CRON_SECRET`; module gate `assertModuleForJob` após auth. Nenhuma migration aplicada neste worker; `TEST_DATABASE_URL` não tocado. 42P01 (missing relation) follow-up apenas leitura — não reproduzido em ambiente compartilhado.

## Comandos executados (exatos, exit codes)

```
npm run lint                                   # exit 0 — eslint --max-warnings=0
npm run typecheck                              # exit 0 — tsc --noEmit
npm test -- --runInBand --testPathPattern=src/__tests__/middleware           # exit 0 — 47 pass / 4 suites
npm test -- --runInBand --testPathPattern=instagram/webhook                   # exit 0 — 16 pass / 2 suites
npm test -- --runInBand --testPathPattern=src/app/api/cron                    # exit 0 — 43 pass / 6 suites
npm test -- --runInBand --testPathPattern=src/__tests__/api/reports           # exit 0 — 10 pass / 2 suites
npm test -- --runInBand --testPathPattern=whatsapp/webhook|widget/messages    # exit 0 — 12 pass / 2 suites
npm run test:security                          # exit 0 — 144 pass / 10 suites (security config)
npm test -- --runInBand --testPathPattern=src/services/api-handlers          # exit 0 — 8 pass / 2 suites
npm test -- --runInBand --testPathPattern=src/modules/financeiro|src/modules/operacional/__tests__/lgpd # exit 0 — 149 pass /22 suites
npm test -- --runInBand --testPathPattern=t8-matrix|middleware|instagram|widget|whatsapp/webhook|cron|reports|financeiro|lgpd|budgets|tasks|clinics/settings # exit 0 — 490 pass /61 suites
npm test -- --runInBand                        # exit 0 — 2325 pass, 5 skip, 319 suites (48.7s)
npm run build:cf                               # exit 0 — opennextjs-cloudflare build + inject-pg-global
npm run build                                  # exit 1 — ENOENT rename .next/export/500.html -> .next/server/pages/500.html (Windows opennext artifact, não relacionado a alterações backend; build:cf sucedeu)
```

## Arquivos tocados nesta tranche (backend/security escopo relevante)

`src/middleware.ts` (PUBLIC_EXACT exatos), `src/lib/auth/session.ts` (validateApiAuth com permissão), `src/app/api/whatsapp/webhook/route.ts`, `src/app/api/instagram/webhook/route.ts` (+ `__tests__/route.test.ts`, `contract.test.ts`), `src/app/api/widget/messages/route.ts` (+ `route.test.ts`), `src/app/api/cron/{reminders,smart-triggers,crm-duplicates,followups}/route.ts` (+ testes), `src/services/api-handlers/cron/{cleanup,followups}.ts`, `src/modules/operacional/services/lgpd-service.ts`, `src/modules/financeiro/services/payment-service.ts`, `src/modules/financeiro/repositories/financeiro-repository.ts`, `src/modules/atendimento/repositories/conversations-repository.ts`, `src/modules/atendimento/actions/receber-mensagem.ts`, `src/modules/atendimento/actions/obter-qrcode.ts`, `src/services/api-handlers/clinics/settings.ts`, `src/services/api-handlers/reports/patients.ts`, `src/services/reports/financial-reports.service.ts`, `src/app/api/budgets/[id]/{accept,reject}/route.ts`, `src/app/api/campaigns/segments/route.ts`, `src/services/api-handlers/campaigns/segments/preview.ts`, `src/app/api/custom-fields/{definitions,values}/route.ts`, `src/app/api/knowledge/{ingest,search}/route.ts`, `src/services/api-handlers/knowledge*.ts`, `src/app/api/patients/[id]/preferences/route.ts`, `src/app/api/reports/financial/route.ts`, `src/app/api/treatment-plans/{route,[id]/route}.ts`, `src/__tests__/api/t8-matrix.test.ts`, `src/__tests__/middleware.security.test.ts`, `jest.config.js`/`jest.integration.config.js`/`jest.security.config.js`, `AGENTS.md`.

Arquivos fora do escopo backend (UI/frontend) aparecem no diff mas não alterados por este worker: `src/app/dashboard/**`, `src/components/calendar/**`, `src/lib/ui/**`, etc. — preservados.

## Riscos residuais

1. **Build Windows `next build` ENOENT 500.html** — falha de filesystem do Next opennext no Windows (30.8s compilado ok), não afeta runtime Cloudflare (`build:cf` exit 0). Mitigação: validar em WSL/CI Linux.
2. **Handlers `validateApiAuth()` sem permissão restantes (~8 em `src/services/api-handlers/{tasks,dashboard/stats,alerts,crm/stats,analytics/**,activities}`)** — tenant-scoped e login-required, classificados baixa sensibilidade; se política exigir RBAC fino em tasks/analytics, follow-up mapear para `comercial:view`/`analytics:export`.
3. **Duplicação `toCents` helpers** (payment-service vs financeiro-repository) — lógica equivalente mas privada; extrair util compartilhado `src/lib/money.ts` reduziria drift.
4. **LGPD `redactAgentQueues` heurística `containsAnyId(payload, ids)`** — busca substring pode omitir payload binário; follow-up modelar FK `patient_id` em DLQ.
5. **Scheduling pollution** — dezenas de `ses_*.json` sob `.opencode/opencode-loop/` gerados por loops anteriores; não afetam build/test mas poluem worktree.

## Decisões

- Não desfazer mudanças válidas existentes; apenas auditar/correção dentro do escopo backend/security.
- Não executar `npm run test:integration:run` (requer `TEST_DATABASE_URL` loopback e DB container) sem autorização; testes de integração relevantes cobertos por mocks unitários + gates.
- Report gerado em `reports/backend-security-audit-2026-09-04-coder1.md`; nenhuma task/worker despachado.
