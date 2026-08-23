# Synkroo O1-G03 — Tenant-Scoped Actions & Concurrency (F2.03–F2.08) TDD Implementation Plan

> **Goal:** Executar a tranche completa de tenancy e concorrência para promover os itens **F2.03 a F2.08** do roadmap de `PARTIAL` / `EVIDENCE_PENDING` para `VERIFIED`, eliminando brechas de escopo em Core Actions, módulos de negócio (`comercial`, `financeiro`, `atendimento`), webhooks inbound e repositórios de planos de tratamento.

---

## 1. Auditoria do Estado Atual (F2.03–F2.08)

### 1.1 Mapeamento e Diagnóstico por Item

| ID | Requisito Roadmap | Status Atual | Diagnóstico da Auditoria | Ação Necessária |
|---|---|---|---|---|
| **F2.03** | RED: tentar `input.clinicId != ctx.clinicId` em cada Core Action | `PARTIAL` | `src/modules/core/actions/` possui `assertClinicScope` para `assignUserAccess`, `createRole`, `removeUserAccess`, `deactivateUser`. Porém, ações nos módulos `comercial` e `financeiro` ainda aceitam `clinicId` no input schema sem validação contra `ctx.clinicId`. | Expandir matriz RED para cobrir todas as ações mutantes em todos os módulos e fechar a fronteira. |
| **F2.04** | Remover clinic scope controlável de payload ou comparar fail-closed | `PARTIAL` | Em `core`, `assertClinicScope` compara fail-closed. Em `comercial` (ex: `atualizar-etapa-pipeline`, `criar-task-comercial`) e `financeiro` (ex: `criar-orcamento`, `gerar-cobranca`), payloads aceitam `clinicId` aberto que é repassado diretamente aos serviços. | Padronizar: remover `clinicId` de inputs onde deve ser exclusivamente derivado de `ctx.clinicId`, ou aplicar `assertClinicScope` estrito antes de invocar serviços. |
| **F2.05** | Validar role/user/entidade na mesma clínica | `PARTIAL` | `access-service.ts` valida `scope.userClinicId === input.clinicId && scope.roleClinicId === input.clinicId`. Contudo, entidades de negócio (planos de tratamento, procedimentos, dentistas, leads, orçamentos) em outros módulos não validam consistentemente se entidades relacionadas pertencem ao mesmo tenant. | Adicionar predicados de ownership de clínica nos repositórios e serviços de domínio para cross-entity validation. |
| **F2.06** | RED: webhook inbound tenta escolher `clinicId`; derivar somente de channel credential registrado | `PARTIAL` | `/api/messages/inbound` deriva `clinicId` exclusivamente via `resolveChannelInstallation` (tabela `channel_installations` com hash SHA-256 + `timingSafeEqual`). Porém, `processarWebhookWhatsApp` e `processarWebhookInstagram` ainda possuem `clinicId` aberto em seu schema Zod. | Bloquear tentativa de sobreposição de `clinicId` nos schemas/handlers de webhook; assegurar que apenas a credencial registrada determine o tenant. |
| **F2.07** | RED: treatment item de outro plano/clínica e POST repetido | `PARTIAL` | `completeSessionProgress(itemId, treatmentPlanId)` valida item contra plano e é idempotente para item já `completed`. Contudo, `findById`, `update`, `deleteTreatmentPlan`, `getProgress` e `updateItem` em `src/repositories/treatment-plans/index.ts` **não exigem `clinicId`**, permitindo acesso/mutação cross-tenant se o ID for conhecido. | Refatorar todas as queries do repositório de tratamento para exigir `clinicId` no predicado `WHERE` e adicionar fixture cross-clinic de 2 clínicas / 2 planos. |
| **F2.08** | Implementar update tenant-scoped, atômico e idempotente; testar concorrência | `PARTIAL` | Existe teste de concorrência PostgreSQL para `completeSessionProgress` (1 suite). Faltam testes de corrida multi-tenant para `assignUserAccess`, dedup de webhooks inbound sob rajada paralela, e orçamentos/cobranças. | Criar suite de corrida PostgreSQL cobrindo transações com `FOR UPDATE`, idempotência em rajadas simultâneas (`Promise.all`) e ausência de mutação cruzada. |

---

## 2. Arquitetura da Solução

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Entrypoints (Routes / API)               │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                                 ┌─────────────▼─────────────┐
                                 │       ActionContext       │ (Trusted: ctx.clinicId, ctx.user)
                                 └─────────────┬─────────────┘
                                               │
                        ┌──────────────────────▼──────────────────────┐
                        │      Action Boundary Validation             │
                        │  - assertClinicScope(input.clinicId, ctx)   │
                        │  - ou payload sem clinicId (usa ctx)        │
                        └──────────────────────┬──────────────────────┘
                                               │
                        ┌──────────────────────▼──────────────────────┐
                        │      Domain Services / Repositories         │
                        │  - Predicado WHERE clinic_id = ctx.clinicId │
                        │  - Transações atômicas com FOR UPDATE       │
                        │  - Idempotência com lock/unique constraint  │
                        └─────────────────────────────────────────────┘
```

### 2.1 Regras de Tenancy Obrigatórias
1. **Never Trust Payload Scope:** Nenhuma Action ou rota autenticada deve aceitar `clinicId` arbitrário no payload para determinar onde a mutação ocorre.
2. **Fail-Closed Verification:** Se um `clinicId` for fornecido no payload, deve passar por `assertClinicScope(input.clinicId, ctx)` lançando `ActionError('forbidden')` imediatamente.
3. **Repository Multi-Tenancy Predicates:** Todas as operações de leitura, atualização e exclusão em repositórios devem incluir `and(eq(table.id, id), eq(table.clinicId, clinicId))` nos predicados `where`.
4. **Relational Tenancy Isolation:** Ao referenciar entidades secundárias (ex: `roleId`, `procedureId`, `treatmentPlanId`, `patientId`), o repositório ou serviço deve validar se a entidade pertence ao mesmo `clinicId`.
5. **Inbound Webhook Channel Derivation:** Webhooks nunca aceitam `clinicId` no payload; o `clinicId` é resolvido exclusivamente via `resolveChannelInstallation` com base em `installationId` e segredo registrado (`timingSafeEqual`).

---

## 3. Plano de Execução TDD (Tranche O1-G03)

### Fase 1: Core & Cross-Module Action Tenancy Boundary (F2.03, F2.04, F2.05)

#### Task 1.1: Matriz de Testes RED para Tenancy de Actions
- **Arquivos de Teste:**
  - `src/modules/core/actions/__tests__/tenant-scope.test.ts`
  - `src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts` (novo)
  - `src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts` (novo)
- **Cenários a Cobrir:**
  1. Payload com `clinicId: 'clinic-b'` executado sob `ctx.clinicId: 'clinic-a'` deve retornar `forbidden` e não executar serviços.
  2. Ações sem `clinicId` no payload devem injetar `ctx.clinicId` com segurança.
  3. Tentativa de atribuir `roleId` pertencente à clínica B para usuário da clínica A deve retornar `forbidden`.
  4. Tentativa de criar orçamento com `patientId` de outra clínica deve retornar `forbidden` / `not_found`.
- **Comando RED:**
  ```bash
  npm test -- src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts
  ```

#### Task 1.2: Implementação GREEN das Ações de Comercial e Financeiro
- **Arquivos a Modificar:**
  - `src/modules/comercial/actions/*.ts` (`atualizar-etapa-pipeline.ts`, `criar-task-comercial`, `mover-lead-etapa.ts`, `obter-lead.ts`, etc.)
  - `src/modules/financeiro/actions/*.ts` (`criar-orcamento.ts`, `gerar-cobranca.ts`, `aceitar-orcamento.ts`, etc.)
- **Ações:**
  - Aplicar `assertClinicScope(input.clinicId, ctx)` onde `clinicId` é recebido, ou remover `clinicId` do schema de entrada em favor de `ctx.clinicId`.
  - Garantir que os serviços recebam apenas o `ctx.clinicId` autenticado.

---

### Fase 2: Inbound Webhook Channel Credential Isolation (F2.06)

#### Task 2.1: Matriz de Testes RED para Webhooks Inbound
- **Arquivos de Teste:**
  - `src/modules/atendimento/actions/__tests__/webhook-tenancy.test.ts` (novo)
  - `src/modules/atendimento/__tests__/gates/integration.test.ts`
- **Cenários a Cobrir:**
  1. Payload de webhook contendo `clinicId` forjado tentando gravar em outra clínica deve ser rejeitado ou ignorado, utilizando apenas o tenant da credencial (`installationId`).
  2. Webhook sem credencial válida ou com segredo inválido retorna `403` sem qualquer persistência.
  3. Injeção de mensagem via `processarWebhookWhatsApp` e `processarWebhookInstagram` não permite `clinicId` divergente do contexto do sistema.

#### Task 2.2: Implementação GREEN para Webhooks
- **Arquivos a Modificar:**
  - `src/modules/atendimento/actions/processar-webhook-whatsapp.ts`
  - `src/modules/atendimento/actions/processar-webhook-instagram.ts`
  - `src/modules/atendimento/actions/receber-widget-mensagem.ts`
- **Ações:**
  - Remover `clinicId` do payload aceito pelo schema de webhook ou aplicar `assertClinicScope(input.clinicId, ctx)`.
  - Derivar o tenant exclusivamente de `resolveChannelInstallation` ou `getClinicByInstance`.

---

### Fase 3: Treatment Plans & Items Tenancy & Cross-Plan Isolation (F2.07)

#### Task 3.1: Matriz de Testes RED para Treatment Plans
- **Arquivos de Teste:**
  - `src/repositories/treatment-plans/__tests__/treatment-tenancy.integration.test.ts` (novo)
- **Cenários a Cobrir (Fixtures com 2 clínicas A e B, cada uma com planos e itens):**
  1. `findById(planId, clinicId)` com `clinicId` incorreto deve retornar `null`.
  2. `update(planId, clinicId, data)` com `clinicId` da clínica B não deve alterar plano da clínica A.
  3. `deleteTreatmentPlan(planId, clinicId)` com `clinicId` incompatível não deve deletar itens nem plano.
  4. `updateItem(itemId, planId, clinicId, data)` onde `itemId` pertence ao plano A mas é passado com `planId` B ou `clinicId` B deve falhar / retornar `null`.
  5. `completeSessionProgress(itemId, planId, clinicId)` com `clinicId` divergente deve falhar e não incrementar sessões.
  6. POST repetido de conclusão de sessão deve ser idempotente e não duplicar contagem.

#### Task 3.2: Implementação GREEN no Repositório de Tratamento
- **Arquivos a Modificar:**
  - `src/repositories/treatment-plans/index.ts`
  - `src/services/treatment-plans/treatment-plan.service.ts`
  - `src/app/api/treatment-plans/[id]/route.ts`
  - `src/app/api/treatment-plans/[id]/sessions/route.ts`
- **Ações:**
  - Adicionar parâmetro obrigatório `clinicId: string` nas funções `findById`, `update`, `deleteTreatmentPlan`, `getProgress`, `updateItem` e `completeSessionProgress`.
  - Incluir `and(eq(treatmentPlans.id, treatmentPlanId), eq(treatmentPlans.clinicId, clinicId))` em todas as queries.
  - Atualizar chamadas na service layer e nas rotas da API para repassar o `clinicId` autenticado.

---

### Fase 4: Concurrency, Idempotency & Race Matrix (F2.08)

#### Task 4.1: Matriz de Testes de Concorrência PostgreSQL (DB Real)
- **Arquivos de Teste:**
  - `src/modules/core/actions/__tests__/concurrency.integration.test.ts` (novo)
  - `src/repositories/treatment-plans/__tests__/session-progress.integration.test.ts` (expansão)
  - `src/modules/atendimento/__tests__/concurrency-dedup.integration.test.ts` (novo)
- **Cenários a Cobrir sob `Promise.all` Simultâneo:**
  1. **Core Access Race:** Duas requisições concorrentes de alteração de role para o mesmo usuário na mesma clínica resultam em estado determinístico e incremento correto de `users.sessionVersion`.
  2. **Anti-Lockout Race:** Tentativa de desativar o último Owner em 2 threads simultâneas deve permitir no máximo 1 (ou zero se for o único) e manter pelo menos 1 Owner ativo garantido.
  3. **Treatment Session Completion Race:** 5 chamadas concorrentes para `completeSessionProgress` no mesmo item resultam em exatamente 1 conclusão, `completedSessions` incrementado em 1, e status de plano consistente.
  4. **Inbound Webhook Dedup Race:** 5 webhooks com mesmo `externalMessageId` disparados simultaneamente resultam em exatamente 1 registro gravado na tabela `messages`.

#### Task 4.2: Implementação e Hardening de Transações
- **Arquivos a Modificar:**
  - `src/repositories/treatment-plans/index.ts` (`completeSessionProgress` com locking `for('update')`)
  - `src/modules/core/repositories/access-repository.ts`
  - `src/modules/atendimento/repositories/conversations-repository.ts` (`appendInboundMessageDeduped`)

---

### Fase 5: Verificação Canônica, Mutação e Promoção no Ledger

#### Task 5.1: Execução de Verificação Completa
```bash
# 1. Typecheck e Lint
npm run typecheck
npm run lint

# 2. Testes Unitários e Integração
npm test -- --runInBand
npm run test:integration:run

# 3. Build Check
npm run build
```

#### Task 5.2: Hardening de Mutação (Stryker)
- Executar Stryker com foco nos repositórios e actions modificados:
```bash
npx stryker run --reporters json,clear-text
```
- Meta: Kill rate >= 70% nos arquivos tocados por F2.03–F2.08.

#### Task 5.3: Promoção do Ledger e Evidência Auditada
- Atualizar `docs/superpowers/audits/roadmap-143-ledger.json`:
  - `F2.03`: `VERIFIED`
  - `F2.04`: `VERIFIED`
  - `F2.05`: `VERIFIED`
  - `F2.06`: `VERIFIED`
  - `F2.07`: `VERIFIED`
  - `F2.08`: `VERIFIED`
- Criar `docs/superpowers/audits/2026-08-23-o1-g03-tenant-actions-receipt.md` contendo hashes de commit, comandos executados, logs de saída dos testes e contagem de mutantes eliminados.
- Executar validação de gate:
```bash
npm run roadmap:check
```

---

## 4. Análise de Risco e Rollback

| Risco | Impacto | Mitigação | Rollback |
|---|---|---|---|
| Quebra de contratos de API em rotas de frontend | Frontend deixa de conseguir disparar certas actions se schemas Zod mudarem | Manter retrocompatibilidade aceitando `clinicId` opcional no schema Zod mas validando com `assertClinicScope` se fornecido; se omitido, usar `ctx.clinicId`. | Reverter commit de schema Zod; rotas usam NextAuth session clinicId. |
| Deadlock em `completeSessionProgress` sob concorrência intensa | Timeout em transação de progresso de sessão | Ordenar locks estritamente: primeiro `treatmentPlanItems`, depois `treatmentPlans` dentro da mesma transação com timeout curto. | Reverter para locking otimista ou retry explícito na camada de serviço. |
| Incompatibilidade de migração de banco | N/A | Esta tranche não requer alteração de DDL/schema no banco; utiliza schemas e constraints existentes. | N/A |

---

## 5. Arquivos Afetados

### Código de Produção
- `src/core/actions/tenant-scope.ts`
- `src/modules/core/actions/*.ts`
- `src/modules/comercial/actions/*.ts`
- `src/modules/financeiro/actions/*.ts`
- `src/modules/atendimento/actions/*.ts`
- `src/repositories/treatment-plans/index.ts`
- `src/services/treatment-plans/treatment-plan.service.ts`

### Testes
- `src/modules/core/actions/__tests__/tenant-scope.test.ts`
- `src/modules/core/actions/__tests__/integration.test.ts`
- `src/modules/core/actions/__tests__/concurrency.integration.test.ts`
- `src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts`
- `src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts`
- `src/modules/atendimento/actions/__tests__/webhook-tenancy.test.ts`
- `src/repositories/treatment-plans/__tests__/treatment-tenancy.integration.test.ts`
- `src/repositories/treatment-plans/__tests__/session-progress.integration.test.ts`

### Documentação e Ledger
- `docs/superpowers/plans/2026-08-23-o1-g03-tenant-actions-tdd.md` (este documento)
- `docs/superpowers/audits/o1-g03-tenant-actions.md`
- `docs/superpowers/audits/2026-08-23-o1-g03-tenant-actions-receipt.md`
- `docs/superpowers/audits/roadmap-143-ledger.json`
