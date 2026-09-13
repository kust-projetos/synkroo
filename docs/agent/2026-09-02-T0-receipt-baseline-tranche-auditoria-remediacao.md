# T0 — Receipt de Baseline | Tranche Auditoria Remediação Synkroo

> **Tranche:** `2026-09-02-synkroo-audit-remediation-plan.md` — execução T0 (Congelar evidência e criar baseline)
> **Data de geração:** 2026-09-02T22:08:22-03:00
> **Executor:** Coder 1 (worker `term_56cbf334-fa81-4227-a7e4-2017b2cdfc0e` / task `task_2e25e7540e01`)
> **Plano fonte:** `docs/superpowers/plans/2026-09-02-synkroo-audit-remediation-plan.md`
> **Auditoria fonte (somente leitura, não sobrescrita):** `C:\Users\walis\.gemini\antigravity-cli\brain\88b6a2b9-af47-4a2f-ba61-7b1016233a1c\auditoria_consolidada_synkroo.md`
> **Princípio:** nenhuma mudança preexistente no worktree é atribuída à tranche. Este receipt congela o estado antes de qualquer edição produtiva.

---

## 1. Estado Git congelado (T0)

### HEAD e branch

```
HEAD:       78868048c0d7fddc56bfdef8550d4e3d5424489d
Branch:     main
Upstream:   origin/main (ahead 33 commits)
Último commit: 78868048 fix(whatsapp): route outbound sends through failover service
Remote URL: https://github.com/kust-projetos/synkroo.git
```

### git status --short (capturado ANTES de qualquer edição — baseline T0)

```
?? .opencode/opencode-loop/ses_f9b31b388ffepl4FqAtxLWdziF.json
?? .opencode/opencode-loop/ses_f9c06bbaeffePf1MZrAKuZKUTt.json
?? .opencode/opencode-loop/ses_f9c06bbd0ffe85iv7fUUZJIJvP.json
?? .opencode/opencode-loop/ses_f9c06bbf7ffeE1F7VBeRepmNQF.json
?? .opencode/opencode-loop/ses_f9c06bc2effewDN2B67ctdcg6X.json
?? .opencode/opencode-loop/ses_f9c089d5dffeSxD99z97Vxp95W.json
?? .opencode/opencode-loop/ses_f9c176742ffeLBGT7xoUiFB40A.json
?? .opencode/opencode-loop/ses_f9c176764ffes43q36kl91TnF8.json
?? .opencode/opencode-loop/ses_f9c2a9cbbffeZPUvSONmqm9h2o.json
?? .opencode/opencode-loop/ses_f9c06bbf7ffeE1F7VBeRepmNQF.json [duplicata listada uma vez]
?? .opencode/opencode-loop/ses_f9c2c4123ffeJ6u6ND62AukPRa.json
?? .opencode/opencode-loop/ses_fa17b4d0bffeW2DXsQQRaqcid7.json
?? .opencode/opencode-loop/ses_fa3799497ffeU4fPskfucLM78h.json
?? .opencode/opencode-loop/ses_fa6e75a2fffeRkYqSnm9jpzlVK.json
?? .opencode/opencode-loop/ses_fac53ff12ffe2k8POvKuXsabYr.json
?? .opencode/opencode-loop/ses_fac54d7f4ffeu10Fd0fZSDn5Sm.json
?? .opencode/opencode-loop/ses_facf53535ffeiW6Dlm8vl3QtiX.json
?? .opencode/opencode-loop/ses_fad0e58d4ffe2mxmL1rDYiUM4T.json
?? .opencode/opencode-loop/ses_fad7bf969ffeWqoP0PoWkC5Fe5.json
?? .opencode/opencode-loop/ses_fad7bfbbbffeDo5HlCq1Eujzkr.json
?? .opencode/opencode-loop/ses_fadcb0a97ffeOYC45O2LHl5nTi.json
?? .opencode/opencode-loop/ses_fadcb0ae5ffedFDtUK4XyK2pDC.json
?? .opencode/opencode-loop/ses_fadcb0b07ffeaG4gPH90jBwa34.json
?? .opencode/opencode-loop/ses_fadcc675dffeE94MbyQ2lLYR02.json
?? .opencode/opencode-loop/ses_faf6ce2faffeNxXrs3fU9alXFC.json
?? .opencode/opencode-loop/ses_faf6ce316ffeq9gq1091slKw1x.json
?? .opencode/opencode-loop/ses_faf6ce348ffetG75CsWkjmQgxa.json
?? .opencode/opencode-loop/ses_fafb67308ffeVvbVN0J6uJ3x1r.json
?? .opencode/opencode-loop/ses_fafcab525ffezLep7kpu9tNUd4.json
?? .opencode/opencode-loop/ses_fb2ccc522ffe0UvAAOM5XVBQ1S.json
?? .opencode/opencode-loop/ses_fb4bcb37affe7x8rQwOfhe5JnP.json
?? .opencode/opencode-loop/ses_fb5059d60ffeb4P5fLLwfPiHxp.json
?? .opencode/opencode-loop/ses_fb5071cfbffefULDQguX9I1xNS.json
?? docs/superpowers/plans/2026-09-02-synkroo-audit-remediation-plan.md
?? orca.yaml
?? reports/
```

> **Interpretação baseline:** nenhum arquivo rastreado modificado (`git diff --name-only` vazio, `git diff --cached --name-only` vazio, `git diff --check` sem saída). Todos os itens são `??` untracked. Mudanças preexistentes NÃO são atribuídas à tranche — apenas este receipt (`docs/agent/2026-09-02-T0-receipt-baseline-tranche-auditoria-remediacao.md`) é criado por T0.

### Comandos de baseline executados (somente leitura, não mutantes)

```powershell
git rev-parse HEAD
git branch --show-current
git status --short
git status
git diff --name-only
git diff --cached --name-only
git diff --check
git log --oneline -1 --decorate
git log --oneline -5
git remote get-url origin
git branch -vv
Get-ChildItem -Path D:/projetos/synkroo/docs -ErrorAction SilentlyContinue
Get-ChildItem -Path D:/projetos/synkroo/docs/agent -ErrorAction Continue
Get-ChildItem -Path D:/projetos/synkroo/src/middleware.ts
Get-ChildItem -Path D:/projetos/synkroo/src/app/api/cron -Recurse
Get-ChildItem -Path D:/projetos/synkroo/src/modules/atendimento -Recurse -Filter *.ts
Get-ChildItem -Path D:/projetos/synkroo/src/modules/financeiro -Recurse -Filter *.ts
Get-Content D:/projetos/synkroo/src/middleware.ts -Raw
Get-Content D:/projetos/synkroo/src/modules/operacional/services/lgpd-service.ts -Raw
Get-Content D:/projetos/synkroo/src/modules/financeiro/services/payment-service.ts -Raw
Get-Content D:/projetos/synkroo/src/app/api/cron/reminders/route.ts -Raw
Get-Content D:/projetos/synkroo/src/app/api/cron/smart-triggers/route.ts -Raw
Get-Content D:/projetos/synkroo/src/modules/financeiro/gateways/providers/asaas/webhook.ts -Raw
Get-Content D:/projetos/synkroo/src/modules/atendimento/actions/receber-mensagem.ts -Raw
Select-String -Path D:/projetos/synkroo/src/components/calendar/AppointmentDialog.tsx -Pattern "response.ok|closeDialog|fetch"
Get-Content D:/projetos/synkroo/src/services/api-handlers/clinics/settings.ts -Raw
Get-Content D:/projetos/synkroo/src/services/api-handlers/reports/patients.ts -Raw
Get-ChildItem -Path D:/projetos/synkroo/src/app/api -Recurse -Filter *.ts | Select-String -Pattern "validateApiAuth"
Get-Content jest.config.js -Raw
Get-Content C:/Users/walis/.gemini/antigravity-cli/brain/88b6a2b9-af47-4a2f-ba61-7b1016233a1c/auditoria_consolidada_synkroo.md -Raw
```

> Todos os comandos acima são de leitura / inspeção. Nenhum `write`, `edit`, `migration`, `deploy`, `commit` ou alteração de produção/testes/configuração foi executado em T0, conforme exigido.

---

## 2. Inventário de arquivos produtivos e testes previstos por tarefa (T1-T9)

> Levantamento antes de editar. Lista reflete o plano + verificação real de existência no disco em HEAD `78868048`. Caminhos são relativiamente a `D:/projetos/synkroo/`.

### T1 — Corrigir transportes públicos e cron DoS (P1)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/middleware.ts` | sim (3.4 KB) | `PUBLIC_EXACT` e `SIGNED_TRANSPORT` confirmados — sem `/api/whatsapp/webhook`, sem `/api/instagram/webhook`, sem `/api/widget/*` |
| Teste | `src/middleware.security.test.ts` | **não** | Ausente — será criado em T1 |
| Prod | `src/app/api/cron/reminders/route.ts` | sim | `checkRateLimit` ANTES de `CRON_SECRET` (linha 16-33) — DoS confirmado |
| Prod | `src/app/api/cron/smart-triggers/route.ts` | sim | Mesmo padrão DoS (linha 16) — endpoint retornando 410 mas ainda consome quota |
| Prod | `src/app/api/cron/crm-duplicates/route.ts` | sim | Verificar mesmo padrão |
| Prod | `src/app/api/cron/cleanup/route.ts` + `_handler.ts` | sim | `src/services/api-handlers/cron/cleanup.ts` citado no plano não encontrado; real é `src/app/api/cron/cleanup/*` |
| Prod | `src/app/api/cron/financeiro-collections/route.ts` | sim | Cobrir na mesma correção |
| Prod | `src/app/api/cron/followups/route.ts` | sim | — |
| Prod | `src/app/api/cron/hot-leads/route.ts` | sim | — |
| Prod | `src/app/api/cron/outbox/route.ts` | sim | — |
| Teste | `src/app/api/cron/crm-duplicates/route.test.ts` | sim | Ajustar para novo comportamento 401 antes de 429 |
| Teste | `src/app/api/cron/followups/route.test.ts` | sim | — |
| Teste | `src/app/api/cron/outbox/route.test.ts` | sim | — |
| Lib | `src/lib/rate-limit.ts` | sim (não listado mas implícito) | Isolar chave pós-auth |

### T2 — Fechar canal Instagram end-to-end (P1) — depende T1

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/modules/atendimento/actions/receber-mensagem.ts` | sim | `channel: z.enum(['whatsapp','web'])` linha 16 — falta `instagram` |
| Prod | `src/modules/atendimento/actions/verificar-webhook-instagram.ts` | sim | Verificar consistência |
| Prod | `src/modules/atendimento/actions/processar-webhook-instagram.ts` | sim | — |
| Prod | `src/modules/atendimento/actions/responder-instagram.ts` | sim | — |
| Prod | `src/modules/atendimento/integrations/resolve-channel-installation.ts` | sim | Tenant resolution deve usar metadados server-side |
| Prod | `src/app/api/instagram/webhook/**` | **verificar** | Não listado no `Get-ChildItem` genérico — confirmar em T2 |
| Schema | `src/modules/atendimento/schema/*` + `src/lib/db/schema/*` canal enum/DB | sim (a confirmar) | Buscar por `channel` enum no DB |
| Teste | `src/modules/atendimento/actions/__tests__/conversation-tenancy.test.ts` | sim | Estender para 2 clínicas Instagram |
| Teste | Contrato Zod + rota assinada Instagram | **novo** | Será criado |

### T3 — Conter export LGPD e disposição de dados (P1)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/modules/operacional/services/lgpd-service.ts` | sim (388 linhas) | `actionLogs` linha 151: `eq(actionLogs.clinicId, clinicId)` — vazamento confirmado; `redactAgentQueues` catch silencioso linha 291-293 |
| Prod | `src/modules/operacional/services/lgpd-registry.ts` | sim (indireto) | Verificar contribuições |
| Prod | `docs/ops/lgpd-data-disposition-matrix.md` | **a confirmar** | Só editar se contrato exigir |
| Teste | `src/modules/operacional/**/__tests__/lgpd*` | sim (a confirmar) | Estender para export A≠B + falha redação |
| Teste | Integração `RUN_INTEGRATION_TESTS=1` minimização | **novo/ampliar** | Teste real com 2 pacientes |

### T4 — Corrigir integridade de pagamentos e webhook Asaas (P1) — depende T3 (desacoplar migrations)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/modules/financeiro/services/payment-service.ts` | sim (88 linhas) | Sem validação saldo, sem arredondamento decimal, `amount: String(amount)` sem trava |
| Prod | `src/modules/financeiro/actions/registrar-pagamento.ts` | sim | Wrapper — verificar lock/CAS |
| Prod | `src/modules/financeiro/gateways/providers/asaas/webhook.ts` | sim | `paymentMethod: 'pix'` implícito, `patientId: null`, `status='paid'` sem `amount >= total`, sem parcial, sem dedup robusto |
| Prod | `src/modules/financeiro/repositories/financeiro-repository.ts` | sim | `processGatewayEventAtomically` linha ~471-484 — sem CAS/estorno terminal |
| Schema | `src/modules/financeiro/schema/financeiro.ts` | sim | `charges`, `payments`, `budget_installments` — verificar tipos decimal |
| Teste | `src/modules/financeiro/gateways/__tests__/asaas-webhook.test.ts` | sim | Ampliar: parcial, duplicado, estorno |
| Teste | `src/modules/financeiro/gateways/__tests__/asaas-webhook.integration.test.ts` | sim | Concorrência + CAS |
| Teste | `src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts` | sim | Incluir overpayment |

### T5 — Preservar settings de clínica e limitar relatórios (P2)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/services/api-handlers/clinics/settings.ts` | sim | `PUT` linha 36-41: substituição `settings = body.settings` — apaga `whatsapp_phone_number_id` |
| Schema | `src/lib/validations/clinicSettingsSchema` | sim | Verificar merge de campos editáveis |
| Prod | `src/services/api-handlers/reports/patients.ts` | sim | Linha 35: `allPatients` sem `LIMIT`, filter JS — OOM |
| Teste | `src/services/api-handlers/clinics/settings.test.ts` | **a confirmar/novo** | Persistência + preservação chaves desconhecidas |
| Teste | `src/services/api-handlers/reports/patients.test.ts` | **a confirmar/novo** | Paginação + plano SQL |

### T6 — Corrigir falsos sucessos e conversas operacionais (P1/P2)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/components/calendar/AppointmentDialog.tsx` | sim | Linha 154: `fetch('/api/appointments')` sem `response.ok`, `closeDialog()` incondicional linha 167 |
| Prod | `src/app/dashboard/conversas/page.tsx` | sim | Otimista sem rollback (189-225), `Agendar`/`Reagendar` sem `onClick` (446-453), sem `refetchInterval` |
| Prod | `src/lib/hooks/use-queries.ts` | sim | Sem `refetchInterval` linha 334-341 |
| Teste | `e2e/conversations.spec.ts` | sim (14 specs) | Estender: 409, 500, retry, inbound sem F5 |
| Teste | Calendário Playwright | sim | — |

### T7 — Fechar CTAs, configuração e permissões de UI (P2)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Prod | `src/app/dashboard/configuracoes/page.tsx` | sim | Horário só Zustand memória, `Connect` sem handler |
| Prod | `src/app/dashboard/crm/page.tsx` | sim | — |
| Prod | `src/app/dashboard/leads/page.tsx` | sim | Ignora `?filter=hot` linha 97-116 |
| Prod | `src/app/dashboard/financeiro/financeiro-client.tsx` | sim | `canManageBudget={false}` fixo |
| Prod | `src/lib/ui/sidebar.tsx` | sim | Array fixo linha 79-91, sem gating RBAC |
| Manifest | `src/modules/*/manifest.ts` | sim | Derivar sidebar de módulos ativos |

### T8 — Migrar rotas legadas sensíveis para autorização canônica (P1)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Busca | `src/app/api/**/*.ts` com `validateApiAuth()` sem arg | **69 ocorrências** | Confirmado `Get-ChildItem | Select-String` count 69 |
| Exemplos | `src/app/api/campaigns/route.ts`, `treatment-plans/route.ts`, `analytics/*` | sim | Classificar por PHI/escrita/config/financeiro |
| Prod | `src/core/actions/run.ts` | sim | Padrão canônico `requires` + tenant guard |
| Teste | Matriz por rota: anônimo, sem permission, correta, estrangeira, master | **novo** | — |

### T9 — Restaurar qualidade, testes reais e acessibilidade (P2/P3)

| Tipo | Arquivo | Existe? | Nota T0 |
|------|---------|---------|---------|
| Config | `jest.config.js` | sim | `branches 55, functions 65` vs `AGENTS.md 70%` — divergência confirmada; `collectCoverageFrom` exclui `src/app/**`, `repositories`, `lib/db` |
| Doc | `AGENTS.md` | sim | Linha 124 declara 70% global |
| Prod | `src/lib/ui/toast.tsx` | sim | Sem `role="status"`/`aria-live`, botão sem `aria-label` |
| Prod | `src/components/calendar/views/MonthView.tsx` | sim | `div onClick` sem `tabIndex`/`role` linha 320,334 |
| Prod | `src/components/ui/toaster.tsx` + `src/hooks/use-toast.ts` | sim | Código morto — `<Toaster/>` nunca montado vs `ToastProvider` real |
| Prod | `src/hooks/usePayments.ts` vs `use-queries.ts:usePayments` | sim | Chaves cache distintas impedem invalidação |
| Teste | Middleware harness / RBAC / LGPD | **novo** | Sem tautologia `can:()=>true` |

---

## 3. Matriz achado → tarefa → teste → evidência / risco residual

> Cada linha traça um achado confirmado da auditoria consolidada até a tarefa do plano, o teste que provará RED→GREEN e a evidência/risco residual exigidos no aceite.

| # Auditoria | Achado (severidade validada) | Evidência precisa (arquivo:linha) | Tarefa | Teste que prova RED→GREEN | Evidência de rollout | Risco residual após tranche |
|-------------|------------------------------|-----------------------------------|--------|---------------------------|----------------------|----------------------------|
| 1 | Middleware bloqueia Webhook e Widget (P1) | `src/middleware.ts:14-39,82-87` | T1 | `src/middleware.security.test.ts` (novo): `SIGNED_TRANSPORT` + `PUBLIC_EXACT` — webhook assinado sem sessão 200, rota privada sem token 307/401, assinatura expirada 401 | Log de smoke: `curl -H "X-Signature: ..." /api/whatsapp/webhook` 200 sem cookie; rota privada 307 | Risco: se lista exata divergir de handler real, webhook volta a 307. Mitigação: matcher mínimo + teste de integração assinada |
| 2 | Pagamento manual sem validação saldo / Overpayment (P1) | `src/modules/financeiro/services/payment-service.ts:66-77`, `registrar-pagamento.ts:14` | T4 | `asaas-webhook.test.ts` + `financeiro-actions.test.ts`: dois `registerManualPayment` concorrentes com `totalAmount=R$3000`, segundo deve falhar quando soma > saldo; mutação remover `clinicId` quebra teste | `npm run test:integration:run -- --runInBand suites-financeiro` GREEN; `git diff --check` sem whitespace | Risco: arredondamento `number` vs `decimal`; lock `FOR UPDATE` não portável. Mitigação: CAS transacional + teste mutação `clinicId` removido |
| 3 | Webhook Asaas hardcoded CAS/estorno (P1) | `src/modules/financeiro/gateways/providers/asaas/webhook.ts:81-93`, `financeiro-repository.ts:471-484` | T4 | `asaas-webhook.integration.test.ts`: PIX parcial R$10 de R$3000 NÃO marca `paid`; evento duplicado `externalEventId` idempotente; estorno não volta a `paid` por retry atrasado | Log gateway: `findGatewayEvent` duplicado retorna `duplicate:true` sem segundo `payment` | Risco: histórico já liquidado indevidamente permanece. Mitigação: reconciliação auditada separada (fora tranche) |
| 4 | Vazamento `actionLogs` clínica em export LGPD (P1 LGPD) | `src/modules/operacional/services/lgpd-service.ts:151,190,251` + `clinicActionRows` | T3 | Integração real `exportPatientData(clinicA, patientA)` com pacientes A e B: `actionLogs` contém 0 ids de B; forçar falha `redactAgentQueues` não expõe payload bruto | `npm run test:integration:run` LGPD GREEN; audit `lgpd.patient_anonymized` com `fingerprint` | Risco: schema sem FK paciente→log obriga omitir logs (perda auditabilidade). Mitigação: follow-up modelagem LGPD |
| 4b | `redactAgentQueues` catch silencioso (P1) | `lgpd-service.ts:280-293` | T3 | Teste injeta falha SQL `agent_queue` → export lança ou omite seguro, nunca retorna fila não redigida | Log erro observável `lastErrorCode: lgpd_patient_anonymized` | Risco: fila não redigida vaza se catch permanecer. Mitigação: fail-closed |
| 5 | Rotas legadas `validateApiAuth()` sem permissão (P1 RBAC) | `src/lib/auth/session.ts:156-180`, 69 ocorrências `src/app/api/**` | T8 | Matriz por rota: anônimo 401, autenticado sem permission 403, clínica correta 200, ID estrangeiro `not_found`, master opaco 404 — sem mock `can:()=>true` | `grep -R "validateApiAuth()" --include="*.ts" src/app/api | grep -v "requires" | wc -l` → 0 handlers sensíveis sem permissão | Risco: janela compatibilidade adapter legado. Mitigação: manter adapter mas com mesma `Action` canônica |
| 6 | Cobertura real divergente docs (P2) | `jest.config.js:35-54,55-62` vs `AGENTS.md:124` | T9 | Ajustar `coverageThreshold` e `collectCoverageFrom` progressivamente; `npm test` mede superfícies críticas sem novas exclusões | CI `coverage` badge reflete branches/functions reais; `AGENTS.md` alinhado | Risco: queda de cobertura visível após incluir `src/app/**`. Mitigação: inclusão incremental + documentação honesta |
| 7 | Agendamento fecha com sucesso em erro HTTP (P1) | `src/components/calendar/AppointmentDialog.tsx:154-172` | T6 | Playwright: `POST /api/appointments` 409 → modal permanece aberta + toast `role="status"`; 500 idem; `invalidateQueries` só após `response.ok` | `npm run test:e2e -- --grep "appointment 409"` GREEN | Risco: usuário duplicar paciente se retry não idempotente. Mitigação: dedup paciente + chave negócio |
| 8 | Chat sem rollback/polling, botões inertes (P2) | `src/app/dashboard/conversas/page.tsx:189-225,446-453`, `use-queries.ts:334-341` | T6 | Integração: mensagem otimista falha → rollback + toast + retry; `Agendar`/`Reagendar` navegam/diálogo; `refetchInterval` ou realtime entrega inbound em ≤ janela contratada | `e2e/conversations.spec.ts` GREEN para falha e inbound sem F5 | Risco: polling duplicado por tab. Mitigação: intervalo moderado ou canal realtime único |
| 9 | CTAs quebrados / Settings sem persistência (P2) | `src/app/dashboard/leads/page.tsx:97-116`, `configuracoes/page.tsx:57-59,414-431`, `financeiro-client.tsx` | T7 | `leads/page.tsx`: `?filter=hot` filtra servidor; `configuracoes`: salvar horário persiste via endpoint canônico e reload preserva; `Connect` WhatsApp/Instagram com `onClick` real | Smoke UI: reload settings preserva `appointment_durations` | Risco: settings merge destrutivo (ver #11). Mitigação: T5 merge server-side |
| 10 | Sidebar estático sem gating RBAC (P2) | `src/lib/ui/sidebar.tsx:79-91,205-210` | T7 | Teste navegação: usuário sem `crm:read` não vê link CRM, mas `GET /api/crm/*` direto 403 — defesa server-side autoritativa | `manifest.ts` deriva módulos ativos por clínica | Risco: cache permissão desatualizado. Mitigação: revalidar em `runAction` |
| 11-Novo1 | DoS não-autenticado cron via rate limit estático (P1) | `src/app/api/cron/reminders/route.ts:16-33`, `smart-triggers:16`, `crm-duplicates:21`, `cleanup:16` | T1 | 20 requisições anônimas → 401 todas, 21ª com `CRON_SECRET` válido **não** 429; auth antes de `checkRateLimit` | `npm test -- --runInBand route.test.ts cron` GREEN; chave rate limit por IP/secret | Risco: limite por IP ainda bypassável via botnet. Mitigação: chave por `Authorization` hash |
| 12-Novo2 | Webhook Instagram bloqueado + schema rejeita `instagram` (P1) | `src/middleware.ts:14-39`, `receber-mensagem.ts:16` | T2 | Contrato Zod `channel: z.enum(['whatsapp','web','instagram'])` positivo/negativo; rota assinada Instagram 200; 2 clínicas — instalação A não escreve em B | `POST /api/instagram/webhook` com `X-Hub-Signature` válido 200 | Risco: tenant via `channel_installations` ausente. Mitigação: derivar clínica de metadados server-side |
| 13-Novo3 | Baixa total com pagamento parcial (P1 financeiro) | `financeiro-repository.ts:483-484`, `asaas/webhook.ts:81-93` | T4 | PIX R$10 de R$3000 mantém `status≠paid` (`partially_paid`), régua cobrança continua, `budget_installments` atualizado | `SELECT status, amount_paid FROM payment_charges WHERE id=...` mostra parcial | Risco: gateway não envia `value` correto. Mitigação: validar `input.amount >= charge.amount` server-side |
| 14-Novo4 | Sobrescrita destrutiva settings apaga WhatsApp (P2) | `src/services/api-handlers/clinics/settings.ts:36-41` | T5 | Editar `appointment_durations` preserva `whatsapp_phone_number_id`; teste lê `clinics.settings` antes/depois | `UPDATE clinics SET settings = jsonb_merge(...)` | Risco: merge raso perde chaves aninhadas. Mitigação: merge profundo `jsonb_build_object` ou `read+spread` |
| 15-Novo5 | OOM relatório pacientes (P2) | `src/services/api-handlers/reports/patients.ts:35-36` | T5 | Clínica 5k pacientes: query SQL `NOT EXISTS`/`LEFT JOIN` com `LIMIT 50`, sem `allPatients` em JS; `EXPLAIN ANALYZE` sem `Seq Scan` full | `npm run test:integration:run` reports GREEN com dataset escala | Risco: Cloudflare Workers 128MB. Mitigação: paginação + agregação SQL |
| 16-A11y | Toast sem ARIA / MonthView div não semântico (P3) | `src/lib/ui/toast.tsx:74-95`, `src/components/calendar/views/MonthView.tsx:320,334` | T9 | `toast.tsx` com `role="status"` `aria-live="polite"` montado único; `MonthView` com `role="button"` `tabIndex=0` + teclado | Axe `npm run test:e2e -- --grep "a11y"` sem violações críticas | Risco: regressão visual. Mitigação: teste snapshot ARIA |

---

## 4. Gates mínimos previstos (T10) — baseline atual

> Não executados em T0 (somente leitura). Registrados para comparação futura.

```bash
npm run lint
npm run typecheck
npm test -- --runInBand <suites-unidade-e-contrato-alteradas>
npm run test:integration:run -- --runInBand <suites-financeiro-lgpd-alteradas>
npm run test:security
npm run build
npm run build:cf
git diff --check
```

**Smokes obrigatórios antes de produção (definidos no plano, não executados nesta tranche):** webhook assinado WhatsApp e Instagram; cron com e sem secret; exportação LGPD de dois pacientes; pagamento manual, parcial, duplicado e estornado; agenda 409; envio de conversa com falha; UI de settings após reload; RBAC em rota legada migrada.

---

## 5. Riscos e rollback — baseline

- **Middleware/canais:** rollback = reverter regra/adapter publicado; nunca ampliar wildcard público como mitigação.
- **LGPD:** correção fail-closed; não corrigir exportações passadas sem decisão jurídica.
- **Financeiro:** rollback código não desfaz liquidações; reconciliação auditada separada.
- **Settings:** preservar snapshot/merge de chaves desconhecidas.
- **Frontend:** manter fallback retry; feature flag polling/realtime desativável.
- **RBAC:** manter adapters legados com mesma Action; não reduzir checks para compatibilidade.

---

## 6. Fora desta tranche (não coberto por este receipt)

Redesign visual, i18n completa, migração total endpoints legados não sensíveis, deploy produção, alteração secrets, migrations em ambiente compartilhado, reconciliação retroativa pagamentos, notificações formais incidente LGPD.

---

## 7. Verificação do receipt (leitura pós-escrita)

- [x] Auditoria original não sobrescrita — `auditoria_consolidada_synkroo.md` intacta em `C:\Users\walis\.gemini\antigravity-cli\brain\88b6a2b9-af47-4a2f-ba61-7b1016233a1c\`
- [x] HEAD, branch, `git status --short` e comandos de baseline registrados na §1
- [x] Inventário produtivo/testes por T1-T9 registrado na §2 (verificação disco + 69 `validateApiAuth()` contadas)
- [x] Matriz achado→tarefa→teste→evidência/risco residual registrada na §3 (16 linhas, incluindo 5 novos achados)
- [x] Nenhum arquivo de produção, teste, configuração, auditoria, dados, migration ou segredo modificado — apenas este receipt criado
- [x] Nenhum commit/deploy realizado

---

**Aceite T0:** cada PR futuro identifica claramente arquivos, comportamento RED, GREEN e risco residual; mudanças preexistentes não são atribuídas à tranche — baseline congelado neste receipt.

*Gerado conforme `code-craftsman` (menor intervenção, sem abstração especulativa; verificação proporcional ao risco).*
