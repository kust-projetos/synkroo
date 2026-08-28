# Synkroo: plano detalhado de remediação da auditoria arquitetural

> **Objetivo:** corrigir os 13 grupos de achados da auditoria arquitetural, começando pelos vazamentos cross-tenant e operações LGPD, sem trocar a stack nem reescrever o produto.
>
> **Executor esperado:** modelo de implementação com contexto limitado. Cada tarefa abaixo fecha decisões de arquitetura, indica arquivos, contrato final, testes e gate. Execute uma tarefa por vez e não amplie o escopo por inferência.

**Data:** 2026-08-28

**Baseline inspecionado:** `83fc1f519b58506887f5529f45b613bbab67cab1`

**Autoridade normativa:** `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md`

**ADRs relevantes:** `ADR-BASE-01`, `ADR-BASE-06`, `ADR-BASE-10`, `ADR-BASE-12`, `ADR-BASE-13`, `ADR-BASE-14`

**Natureza desta entrega:** plano apenas; nenhuma alteração de código de produção faz parte desta etapa.

---

## 1. Resultado final esperado

Ao concluir este plano:

1. Nenhuma Action de negócio aceita `clinicId`/`clinic_id` no payload; tenant vem do `ActionContext`, inclusive para jobs, webhooks e IA.
2. Nenhuma entidade tenant-owned é lida, atualizada ou excluída somente por ID.
3. Relações financeiras e operacionais cross-tenant são rejeitadas também pelo PostgreSQL.
4. Clínica ativa e role efetiva vêm de `user_clinic_access`; `users.role` deixa de autorizar requests.
5. Exportação, anonimização e consentimento LGPD exigem permissões explícitas e auditoria sem PII bruta.
6. Cada entrada de negócio executa um único `runAction`; composição interna usa portas públicas de módulo, nunca `.handler` nem `buildSystemContext` para substituir o caller humano.
7. Inbound persiste conversa, mensagem deduplicada e aggregate de conversa de forma atômica.
8. O registry de Actions tem um único bootstrap determinístico e nenhum side effect de import.
9. Dependências entre módulos são declaradas e imports legados/cross-module internos falham no gate arquitetural.
10. APIs canônicas usam `{ data, meta? }` ou `{ error: { code, message, requestId } }`; rotas legadas passam por strangler observável.
11. Manifesto não mantém cache global stale entre requests/isolates; outbox respeita módulo habilitado, detecta operação sem handler, processa com concorrência limitada e não faz self-fetch pela URL pública.
12. Nenhum arquivo de módulo importa o barrel central de schema; definições vivem no owner e reexports legados não criam ciclo.
13. IA separa emissão de handle de execução de tool, usa contrato RPC versionado com rollout compatível e não possui bypass `isMaster` permanente.

---

## 2. Regras obrigatórias para o executor

### 2.1 Fluxo arquitetural

O fluxo final de toda operação tocada deve ser:

```text
route/server action/worker
  -> build do ActionContext confiável
  -> runAction(Action única)
  -> service/use case ou porta pública do módulo owner
  -> repository com clinicId obrigatório
  -> PostgreSQL e/ou outbox na mesma transaction quando houver side effect
```

Regras vinculantes:

- Transporte não acessa Drizzle, repository ou regra de negócio.
- Toda Action de negócio usa `ctx.clinicId`; remova `clinicId` e `clinic_id` do schema de input, sem exceção por `source`.
- `runAction` rejeita antes do parse qualquer input object com propriedade própria top-level `clinicId` ou `clinic_id`; Zod não pode apenas descartar silenciosamente o selector não confiável.
- Repositories tenant-owned recebem `clinicId: string` em sua API pública e usam o valor no `WHERE` ou em join tenant-scoped.
- ID conhecido de outra clínica retorna `not_found`, não revela existência com `forbidden`.
- Uma Action não chama `outraAction.handler(...)`.
- Uma Action humana não cria `buildSystemContext` para continuar o mesmo workflow.
- Composição entre módulos usa somente seams públicas side-effect-free: `src/modules/<owner>/public.ts` para comportamento e `src/modules/<owner>/schema/index.ts` para relações Drizzle declaradas. O root `index.ts` fica reservado a bootstrap/catálogo.
- Não adicione fallback, mock ou retorno sintético em produção para fazer teste passar.
- Não edite migration já aplicada.

### 2.2 Disciplina de execução

- Não tocar nas alterações preexistentes em `docs/superpowers/plans/INDEX.md`, `e2e/app.spec.ts`, `next.config.ts`, `.claude/skills/orca-planner-coder/`, `.opencode/` e demais arquivos não relacionados.
- Não criar commit, push ou PR sem pedido explícito do usuário.
- Antes de cada tarefa, releia os arquivos listados; o baseline pode ter avançado.
- Use o menor diff que satisfaz o contrato. Não renomeie APIs não relacionadas.
- Um teste de integração que toca banco deve usar `TEST_DATABASE_URL` loopback e banco exato `synkroo_test` por `npm run test:integration:run`.
- Todo guard estrutural novo deve ser provado por mutação temporária: quebrar a regra protegida, confirmar RED com mensagem acionável, restaurar e confirmar GREEN.
- Registre comandos, exit code e resumo no receipt descrito na Onda 0.

### 2.3 Protocolo por tarefa

1. Escrever ou ajustar o teste RED que demonstra o achado.
2. Executar somente o teste e confirmar que falha pelo motivo esperado.
3. Implementar a mudança mínima.
4. Executar o teste focado até GREEN.
5. Executar typecheck e o gate de regressão indicado.
6. Revisar `git diff -- <arquivos da tarefa>` e garantir que não há mudanças colaterais.
7. Atualizar o receipt; não marcar a tarefa concluída somente por inspeção.

---

## 3. Rastreabilidade dos 13 achados

| ID | Severidade | Achado | Ondas |
|---|---|---|---|
| F-01 | Crítico | Financeiro e relações operacionais aceitam IDs cross-tenant; parcelas/pagamentos operam por `budgetId` e FKs são independentes | W1, W2 |
| F-02 | Alto | Histórico de mensagens e lookup de conversa/template possuem interfaces unscoped | W1 |
| F-03 | Alto | RBAC dividido entre `user_clinic_access` e `users.role`; troca de clínica pode preservar role errada | W3 |
| F-04 | Alto | Exportação, anonimização e consentimento LGPD sem permission granular; audit da anonimização guarda PII original | W4 |
| F-05 | Alto | Composição chama `.handler` diretamente ou troca caller humano por `buildSystemContext` | W5 |
| F-06 | Alto | Inbound possui dedup parcial, mas criação de conversa e atualização do aggregate não são uma unidade atômica | W6 |
| F-07 | Médio | Módulos ainda dependem de `src/services`/`src/repositories`; boundaries são permissivas e manifests não declaram dependências | W7 |
| F-08 | Médio | Bootstrap central e `registerActions(...)` por side effect coexistem | W5 |
| F-09 | Médio | Contrato HTTP é parcial e famílias `/api/budgets/*` e `/api/financeiro/budgets/*` coexistem sem strangler completo | W8 |
| F-10 | Médio | Cache de manifesto não invalida; outbox é serial, não filtra módulo por operação e cron usa URL pública | W9 |
| F-11 | Médio | Barrel central de schema reexporta módulos que importam o mesmo barrel, criando ciclos | W7 |
| F-12 | Médio | Bridge IA expõe emissão e execução no mesmo entrypoint e replica tipos RPC sem versão explícita | W10 |
| F-13 | Alto | `users.isMaster` concede `can: () => true`, contrariando ADR-BASE-14 | W3 |

Nota de baseline: `messages.externalProvider`, `messages.externalMessageId`, o índice único correspondente e `appendInboundMessageDeduped` já existem. W6 não deve recriá-los; deve preservar o mecanismo e fechar atomicidade, escopo e corrida de conversa.

---

## 4. Dependências e ordem

```text
W0 baseline e receipt
  -> W1 contenção tenant no código
    -> W2 integridade relacional no PostgreSQL
      -> W3 RBAC ativo + remoção de isMaster
        -> W4 LGPD
          -> W5 Action Layer + registry
            -> W6 inbound atômico
              -> W7 módulos + schemas
                -> W8 HTTP strangler
                  -> W9 manifesto + outbox
                    -> W10 bridge IA
                      -> W11 gates e documentação
```

W1 é bloqueador de segurança e deve ser concluída antes de refatorações estruturais. Dentro de W1, F-01 e F-02 podem ser implementados em paralelo somente se os agentes não editarem os mesmos helpers/test fixtures.

---

## 5. W0: baseline reproduzível e recibo

### Tarefa W0.1: criar receipt e congelar inventário

**Criar:**

- `docs/superpowers/audits/2026-08-28-architectural-remediation-receipt.md`

**Passos:**

- [ ] Registrar `git rev-parse HEAD` e `git status --short` sem alterar o worktree.
- [ ] Criar tabela no receipt com colunas `Task`, `RED command/result`, `GREEN command/result`, `Mutation proof`, `Files`, `Residual risk`.
- [ ] Copiar os IDs F-01..F-13 para uma matriz de status inicialmente `OPEN`.
- [ ] Registrar que a auditoria inicial foi somente leitura e não executou testes.
- [ ] Registrar o dry-run já observado no baseline: app Worker parseou bindings, bundle `gzip: 4020.06 KiB`, com warnings de ambiente/duplicate-case; isso não equivale a deploy nem smoke RPC.
- [ ] Rodar `npm run typecheck` e registrar o baseline; falha preexistente não autoriza correção fora do escopo.
- [ ] Rodar os testes de arquitetura existentes:

```bash
npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/actions/__tests__/bootstrap.test.ts
```

**Aceite:** receipt existe, diferencia falha preexistente de regressão da tranche e não afirma que a suite completa está verde.

### Tarefa W0.2: estender a fixture de duas clínicas

**Modificar:**

- `src/__tests__/security/audit-remediation-fixtures.ts`
- `src/__tests__/security/audit-remediation-fixtures.test.ts`
- `src/__tests__/security/audit-remediation-fixtures.integration.test.ts`

**Contrato final da fixture:**

- Clínica A atacante e clínica B vítima.
- Em cada clínica: user, role/access, patient, dentist, procedure, appointment, conversation, budget, installment, payment gateway, charge e payment.
- IDs determinísticos distintos e cleanup tenant-scoped.
- O seed permanece import-safe; receber `Pool` é obrigatório para persistir e sem `Pool` somente retorna IDs.

**Teste focado:**

```bash
npm run test:integration:run -- --runInBand src/__tests__/security/audit-remediation-fixtures.integration.test.ts
```

**Aceite:** a fixture demonstra que os relacionamentos legítimos existem em A e B e pode ser reutilizada sem duplicar SQL em cada suite.

---

## 6. W1: contenção cross-tenant no código

### Tarefa W1.1: bloquear parcelas e pagamentos cross-tenant

**Modificar:**

- `src/modules/financeiro/actions/listar-parcelas.ts`
- `src/modules/financeiro/actions/salvar-parcelas.ts`
- `src/modules/financeiro/actions/listar-pagamentos.ts`
- `src/modules/financeiro/actions/registrar-pagamento.ts`
- `src/modules/financeiro/services/installment-service.ts`
- `src/modules/financeiro/services/payment-service.ts`
- `src/modules/financeiro/repositories/financeiro-repository.ts`
- `src/modules/financeiro/repositories/financeiro-scope-repository.ts`
- `src/modules/financeiro/repositories/installment-replacement-repository.ts`
- callers e testes que deixarem de compilar pelas assinaturas abaixo

**Testar/criar:**

- `src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts`
- `src/modules/financeiro/__tests__/installments-scope/integration.test.ts`
- `src/modules/financeiro/__tests__/payments-scope/integration.test.ts` (novo)

**Assinaturas finais obrigatórias:**

```ts
listInstallments(clinicId: string, budgetId: string)
calculateRemainingBalance(clinicId: string, budgetId: string)
replaceInstallments(clinicId: string, budgetId: string, installments: InstallmentInput[])
listPayments(clinicId: string, budgetId: string)
registerManualPayment(input: {
  clinicId: string;
  budgetId: string;
  chargeId?: string;
  amount: number;
  paymentMethod: string;
  paidAt?: string;
  notes?: string;
  actorUserId: string | null;
})
replaceInstallmentsAtomic(clinicId: string, budgetId: string, rows: InstallmentInsert[])
```

**Implementação:**

- [ ] Remover `clinicId` dos quatro schemas Zod de Action e usar exclusivamente `ctx.clinicId`.
- [ ] Antes de listar ou calcular saldo, resolver orçamento por `getBudgetForClinic(budgetId, clinicId)`; orçamento estrangeiro deve gerar `ActionError('not_found', ...)`.
- [ ] Em `replaceInstallmentsAtomic`, iniciar transaction, selecionar o budget por `(id, clinicId) FOR UPDATE`, falhar antes do delete se ausente e somente então substituir parcelas.
- [ ] Não fazer `getBudget(id)` seguido de comparação em memória para autorizar escrita; o predicado tenant deve estar na query que protege a mutação.
- [ ] Substituir `getPaymentCharge(chargeId)` e updates por ID por versões `(chargeId, clinicId)`.
- [ ] Registrar pagamento, validar budget e charge e atualizar charge/criar payment na mesma transaction. Se `chargeId` for informado, exigir que charge, budget e clínica coincidam.
- [ ] Persistir `createdBy` a partir de `ctx.user?.id ?? null`; nunca aceitar actor no payload HTTP.
- [ ] Listagem de payments deve usar `AND payments.clinic_id = clinicId AND payments.budget_id = budgetId`.
- [ ] Enquanto `budget_installments.clinic_id` ainda não existir, usar join com `budgets` no read e lock do budget no write. W2 adicionará defesa no schema.

**RED obrigatório:** Action executada com contexto da clínica A e `budgetId` da clínica B não lista, substitui nem registra nada em B.

**GREEN focado:**

```bash
npm test -- --runInBand src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts
npm run test:integration:run -- --runInBand src/modules/financeiro/__tests__/installments-scope/integration.test.ts src/modules/financeiro/__tests__/payments-scope/integration.test.ts
```

**Aceite:** estado de B é byte-for-byte equivalente antes/depois das tentativas de A; retorno não revela se o ID estrangeiro existe.

### Tarefa W1.2: fechar IDOR de conversas, mensagens e templates

**Modificar:**

- `src/modules/atendimento/repositories/conversations-repository.ts`
- `src/modules/atendimento/actions/historico-mensagens.ts`
- `src/modules/atendimento/actions/obter-conversa.ts`
- `src/modules/atendimento/actions/obter-modelo-mensagem.ts`
- `src/modules/atendimento/actions/enviar-mensagem.ts`
- `src/modules/atendimento/actions/agendar-mensagem.ts`
- `src/modules/atendimento/actions/responder-instagram.ts`
- `src/modules/atendimento/actions/processar-webhook-whatsapp.ts`
- `src/modules/atendimento/actions/processar-webhook-instagram.ts`
- callers de `findById` e `findMessagesByConversation` encontrados por busca

**Criar/estender:**

- `src/modules/atendimento/actions/__tests__/conversation-tenancy.test.ts` (novo)
- `src/modules/atendimento/__tests__/conversations/integration.test.ts`

**Assinaturas finais:**

```ts
findByIdForClinic(id: string, clinicId: string)
findByChannelAndExternalId(clinicId: string, channel: Channel, externalId: string)
findMessagesByConversation(clinicId: string, conversationId: string, opts?: PageOptions)
countMessagesByConversation(clinicId: string, conversationId: string)
getLastMessage(clinicId: string, conversationId: string)
getConversationContext(clinicId: string, conversationId: string, limit?: number)
getPatientInsights(clinicId: string, patientId: string)
updateMessage(clinicId: string, messageId: string, patch: MessagePatch)
updateConversation(clinicId: string, conversationId: string, patch: ConversationPatch)
appendInboundMessage(clinicId: string, input: InboundMessageInput)
appendOutboundMessage(clinicId: string, input: OutboundMessageInput)
updateConversationTimestamp(clinicId: string, conversationId: string, at: Date)
updateAppointmentStatus(clinicId: string, appointmentId: string, status: AppointmentStatus)
```

**Implementação:**

- [ ] Eliminar o export público unscoped `findById(id)`; não mantê-lo como alias.
- [ ] Inventariar todos os exports do repository, não somente os callers inicialmente encontrados. Além de `findById`, o baseline possui lookups, counts, insights, appends e updates públicos sem clínica; cada um recebe `clinicId` ou vira primitive privada chamada após ownership comprovado.
- [ ] Em queries de `messages`, fazer `INNER JOIN conversations` e filtrar `conversations.clinicId` e `conversationId`.
- [ ] `historicoMensagens` deve passar `ctx.clinicId` e lançar `not_found` quando a conversa não pertence à clínica.
- [ ] `obterConversa` deve usar a mesma query scoped tanto para conversation quanto para messages.
- [ ] `obterModeloMensagem` nunca substitui `ctx.clinicId` pelo valor da conversa. Se `conversationId` vier, apenas valide ownership; conversa estrangeira ou ausente retorna `not_found`.
- [ ] Actions de envio/agendamento/resposta e webhooks devem passar a clínica confiável já resolvida para `findByIdForClinic`.
- [ ] Não aceitar `clinicId` no payload de webhook Action; a rota/integration resolve installation e constrói contexto antes do `runAction`.

**GREEN focado:**

```bash
npm test -- --runInBand src/modules/atendimento/actions/__tests__/conversation-tenancy.test.ts
npm run test:integration:run -- --runInBand src/modules/atendimento/__tests__/conversations/integration.test.ts
```

**Aceite:** conversation ID de B não retorna mensagens/templates sob contexto A e nenhum caller de produção usa lookup de conversa unscoped.

### Tarefa W1.3: validar relações de consulta no owner module

**Modificar:**

- `src/modules/operacional/actions/agendar-consulta.ts`
- `src/modules/operacional/actions/atualizar-consulta.ts`
- `src/modules/operacional/services/scheduling-service.ts`
- `src/modules/operacional/repositories/appointments-repository.ts`
- `src/modules/operacional/repositories/catalog-repository.ts`
- `src/modules/operacional/services/catalog-service.ts`
- remover uso tocado de `src/repositories/appointments/index.ts`

**Criar/estender:**

- `src/modules/operacional/actions/__tests__/appointment-relational-tenancy.test.ts` (novo)
- `src/modules/operacional/actions/__tests__/scheduling/integration.test.ts`

**Assinaturas finais:**

```ts
findDentistById(clinicId: string, id: string)
findProcedureById(clinicId: string, id: string)
updateAppointment(clinicId: string, id: string, patch: AppointmentPatch)
updatePatientLastVisit(clinicId: string, patientId: string, at: Date)
```

**Implementação:**

- [ ] `agendarConsulta` valida patient obrigatório e dentist/procedure opcionais na mesma clínica antes do insert.
- [ ] `atualizarConsulta` valida todo ID relacional presente no patch antes do update.
- [ ] A query de update inclui `(appointments.id, appointments.clinicId)`.
- [ ] Atualização de `patient.lastVisitAt` inclui `(patients.id, patients.clinicId)`.
- [ ] Migrar `atualizar-consulta.ts` para o repository owned em `src/modules/operacional` e remover o import legado.
- [ ] Lookups e updates de catálogo recebem `clinicId` na própria query, não carregam por ID para comparar depois.

**GREEN focado:**

```bash
npm test -- --runInBand src/modules/operacional/actions/__tests__/appointment-relational-tenancy.test.ts
npm run test:integration:run -- --runInBand src/modules/operacional/actions/__tests__/scheduling/integration.test.ts
```

### Tarefa W1.4: remover tenant selectors de todo o catálogo de Actions

**Modificar:**

- `src/core/actions/run.ts`
- todas as Actions encontradas por busca sob `src/modules/**/actions/*.ts`
- routes, crons, workers e testes que hoje acrescentam `clinicId` ao input
- `src/modules/*/ui/route-adapter.ts`
- `src/core/actions/__tests__/run.test.ts`
- `src/core/actions/__tests__/tenant-input-guard.test.ts` (novo)

**Baseline confirmado:** há 47 declarações `clinicId`/`clinic_id` em schemas de Actions, incluindo Core, Comercial, Atendimento, Financeiro, CRM e Operacional. W1.1 remove apenas quatro delas e não fecha REQ-CORE-03/04.

**Implementação:**

- [ ] Antes de `action.input.safeParse`, `runAction` rejeita com `invalid_input` qualquer object que possua chave própria top-level `clinicId` ou `clinic_id`, usando `Object.prototype.hasOwnProperty.call` e sem acessar valor/getter da chave; não confiar no strip default de `z.object`.
- [ ] Remover essas chaves de todos os schemas e usar `ctx.clinicId` no handler/service.
- [ ] Actions de cron/system iteram clínicas no boundary, constroem um `ActionContext` por clínica e passam somente o input de negócio.
- [ ] Webhooks resolvem instalação/credencial/channel ID no boundary; a Action recebe contexto já tenant-scoped e payload normalizado sem selector de clínica.
- [ ] Operações de suporte cross-clinic primeiro selecionam explicitamente um grant operacional válido e constroem o contexto; não recebem tenant no input da Action.
- [ ] Criar guard de source que lista arquivo e Action se um schema voltar a declarar as chaves proibidas; discovery vazio falha.

**RED obrigatório:** para uma Action representativa de cada módulo, enviar `{ ...inputValido, clinicId: CLINIC_B }` sob contexto A e provar que o handler não foi chamado. Repetir com `clinic_id`.

**Mutação obrigatória:** reintroduzir temporariamente `clinicId: z.string()` em uma Action e confirmar que o guard falha apontando arquivo e nome; restaurar e confirmar GREEN.

**GREEN focado:**

```bash
npm test -- --runInBand src/core/actions/__tests__/run.test.ts src/core/actions/__tests__/tenant-input-guard.test.ts
```

**Gate da onda:**

```bash
npm run typecheck
npm test -- --runInBand src/core/actions/__tests__/tenant-input-guard.test.ts src/modules/financeiro/actions/__tests__/financeiro-actions-tenancy.test.ts src/modules/atendimento/actions/__tests__/conversation-tenancy.test.ts src/modules/operacional/actions/__tests__/appointment-relational-tenancy.test.ts
```

---

## 7. W2: integridade relacional no PostgreSQL

### Tarefa W2.1: modelar chaves tenant compostas

**Modificar schemas:**

- `src/modules/operacional/schema/patients.ts`
- `src/modules/operacional/schema/clinical.ts`
- `src/modules/operacional/schema/appointments.ts`
- `src/lib/db/schema/business.ts`

**Gerar nova migration:**

```bash
npm run db:generate -- --name tenant-relational-integrity
```

Nunca editar migration anterior. Inspecionar o nome realmente gerado e registrar no receipt.

**DDL final:**

- Unique keys `(clinic_id, id)` em `patients`, `dentists`, `procedures`, `appointments`, `budgets`, `payment_gateways`, `payment_charges`, `leads` e `campaigns` quando forem alvo de FK composta.
- `budget_installments.clinic_id uuid` e `budget_items.clinic_id uuid` adicionados primeiro como nullable.
- `payments.clinic_id` final `NOT NULL`.
- FK composta de appointments para patient/dentist/procedure.
- FK composta de budgets para patient/appointment/lead/campaign quando o relacionamento não for nulo.
- FK composta de budget items/installments para budget.
- FK composta de payments para budget/patient/charge.
- FK composta de payment charges para budget/gateway.
- FK composta de gateway routing rules para gateway e para campaign/patient/lead opcionais.

**Ordem obrigatória dentro da nova migration:**

1. Adicionar colunas nullable e unique indexes de suporte.
2. Backfill `budget_items.clinic_id` e `budget_installments.clinic_id` a partir de `budgets`.
3. Backfill `payments.clinic_id` por budget, charge ou patient somente quando a origem for inequívoca.
4. Executar blocos de auditoria `DO $$ ... RAISE EXCEPTION ... $$` para qualquer linha órfã ou relação com clinics divergentes.
5. Adicionar FKs como `NOT VALID` quando PostgreSQL/DDL exigir validação separada.
6. `VALIDATE CONSTRAINT` uma a uma.
7. Aplicar `SET NOT NULL` somente após backfill e auditoria zerados.
8. Manter os FKs simples antigos durante esta migration; remoção ocorre apenas após aplicação e testes verdes.

**Não fazer:** corrigir silenciosamente uma relação divergente escolhendo uma das clínicas. A migration deve abortar e listar constraint/tabela; dados reais exigem decisão operacional separada.

### Tarefa W2.2: alinhar repositories às novas colunas

**Modificar:**

- `src/modules/financeiro/repositories/financeiro-repository.ts`
- `src/modules/financeiro/repositories/installment-replacement-repository.ts`
- `src/modules/financeiro/repositories/financeiro-scope-repository.ts`
- `src/modules/financeiro/services/installment-service.ts`

**Implementação:**

- [ ] Inserts de items/installments sempre gravam `clinicId` derivado do budget tenant-scoped.
- [ ] Reads/updates/deletes de installments incluem `clinicId` diretamente, sem depender somente do join.
- [ ] `payments.clinicId` deixa de ser `string | null` nos tipos de insert.
- [ ] Depois do gate completo, gerar migration separada para remover FKs simples redundantes; não remover na mesma janela do backfill.

### Tarefa W2.3: provar constraints e concorrência

**Criar:**

- `src/__tests__/security/tenant-relational-integrity.integration.test.ts`

**Cenários:**

- Insert de appointment A com patient/dentist/procedure B falha com FK.
- Insert de budget A com patient/lead/campaign B falha.
- Insert de charge/payment/routing rule A ligado a entidade B falha.
- Substituição concorrente de installments do mesmo budget serializa pelo lock e termina em um conjunto completo, nunca mistura lotes.
- A migration aplica do zero e sobre seed existente.

**Comando:**

```bash
npm run test:integration:run -- --runInBand src/__tests__/security/tenant-relational-integrity.integration.test.ts src/modules/financeiro/__tests__/installments-scope/integration.test.ts
```

**Rollback:** antes de deploy, rollback é descartar a nova migration ainda não aplicada. Depois de aplicada, não apagar migration; criar forward migration que remove somente constraints novas, preservando colunas/backfill.

---

## 8. W3: RBAC por clínica ativa e remoção de `isMaster`

### Tarefa W3.1: tornar `user_clinic_access` a autoridade de role

**Modificar:**

- `src/repositories/auth/index.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/auth.ts`
- `src/services/api-handlers/auth/switch-clinic.ts`
- `src/modules/core/schema/rbac.ts`
- `src/modules/core/repositories/access-repository.ts`
- `src/modules/core/repositories/users-repository.ts`
- `src/modules/core/services/access-service.ts`
- tipos NextAuth que definem `session.user.role`

**Contrato final:**

```ts
findUserProfileById(userId: string, activeClinicId: string): Promise<AuthUserRow | null>
```

O método deve:

- carregar identidade de `users`;
- receber explicitamente `activeClinicId`; somente o login inicial pode escolher `users.clinicId` antes de chamar este método;
- exigir row em `user_clinic_access` para a clínica escolhida;
- joinar `roles` e retornar `roleId` e `roleName` efetivos;
- carregar a clínica escolhida, não necessariamente a clínica padrão do user.

**Implementação:**

- [ ] `getUserProfile` chama `findUserProfileById(session.user.id, session.user.clinicId)`.
- [ ] JWT callback de login e `trigger === 'update'` resolve role pela mesma row de access usada para resolver clinic.
- [ ] Troca de clínica retorna role efetiva e a atualização da sessão deve alterar `clinicId` e `role` juntos.
- [ ] Se acesso foi revogado entre requests, sessão falha fechada.
- [ ] `users.role` permanece temporariamente somente como dado legado de bootstrap; nenhuma autorização request-time o consulta.
- [ ] `listClinicUsers` parte de `user_clinic_access`, junta `users`/`roles` e inclui identidades cuja clínica padrão é outra.
- [ ] `getUserRoleScope` deixa de comparar `users.clinicId` com a clínica da role; valida `(userId, targetClinicId)` pela membership e `(roleId, targetClinicId)` pela query tenant-scoped.
- [ ] Adicionar unique `(roles.id, roles.clinic_id)` e FK composta `(user_clinic_access.role_id, clinic_id) -> roles(id, clinic_id)`.
- [ ] Adicionar FK composta de `(user_permission_overrides.user_id, clinic_id)` para `user_clinic_access(user_id, clinic_id)`, impedindo override sem membership.
- [ ] Adicionar a `user_clinic_access` campos nullable `expiresAt`, `revokedAt`, `grantReason` e `grantedBy`; membership clínica normal usa `expiresAt = null`.
- [ ] Incrementar `sessionVersion`/revogar sessão quando role, membership, expiração, revogação ou estado global da identidade mudar.
- [ ] Remover a semântica clínica ambígua de `core.deactivateUser`: administrador de uma clínica remove/revoga apenas aquela membership; desativação global fica no fluxo operacional autenticado e revoga todas as sessões.
- [ ] Revogar membership e limpar overrides daquela clínica na mesma transaction; um re-grant não pode ressuscitar overrides antigos. Counts de Owner/access ativos ignoram rows revogadas ou expiradas.

**Criar/estender:**

- `src/lib/auth/__tests__/active-clinic-role.test.ts` (novo)
- `src/repositories/auth/__tests__/integration.test.ts`
- testes de `switch-clinic`

**Cenário essencial:** mesmo usuário é `Administrador` em A e `Recepcionista` em B; após switch A -> B, `clinicId`, `role` e `can()` correspondem a B e caches/query data de A são invalidados pelo client flow existente.

**Cenário relacional obrigatório:** associar access da clínica A a role da clínica B ou criar override para usuário sem access deve falhar no PostgreSQL.

### Tarefa W3.2: substituir checks de role legado por permission

**Modificar:**

- `src/lib/auth/session.ts`
- `src/app/api/campaigns/route.ts`
- `src/app/api/campaigns/[id]/start/route.ts`
- `src/app/api/campaigns/[id]/recipients/route.ts`
- `src/services/api-handlers/campaigns/[id].ts`
- `src/services/api-handlers/reports/export.ts`
- `src/core/rbac/seed.ts`
- `scripts/backfill-rbac-permissions.mjs`
- testes do script/reconcile RBAC
- testes correspondentes

**Permissões exatas:**

- listar campanhas: `followup:view`;
- criar/iniciar/editar recipients: `followup:manage_campaigns`;
- exportar relatório: nova `analytics:export` em `src/core/rbac/preset-policy.json` sob `modulePermissions.analytics`.

**Implementação:**

- [ ] Adicionar helper `requirePermission(permissionKey)` que deriva a clínica da sessão via `buildUserContext`/`resolveAccess`, não aceita clínica do caller e não consulta `profile.role`.
- [ ] Remover usos de produção de `hasRequiredRole` e `requireRole`.
- [ ] Não mapear nomes `owner/admin/dentist/receptionist` para permissions em código.
- [ ] Atualizar seed/catalog e testes de preset para `analytics:export`; Administrador e Owner recebem, demais presets não.
- [ ] Incrementar a versão de `preset-policy.json` e tornar `backfill-rbac-permissions.mjs` o reconcile explícito de instalações existentes: dry-run relata permissions ausentes por clínica/role; `--apply` insere catálogo e grants faltantes das roles de sistema.
- [ ] Não apagar grants de role customizada nem grants removidos da policy silenciosamente. Remoção exige lista explícita de revogação e receipt separado.
- [ ] Provar rerun idempotente: primeiro apply reconcilia; segundo apply reporta zero insert. `master:*` permanece fora deste reconcile clínico.

### Tarefa W3.3: remover bypass `isMaster`

**Modificar:**

- `src/core/rbac/resolve.ts`
- `src/core/rbac/repository.ts`
- `src/lib/db/schema/core.ts`
- `src/modules/core/schema/rbac.ts`
- `src/modules/core/actions/assign-user-access.ts`
- `src/modules/core/actions/create-role.ts`
- `scripts/migrate-userrole-to-rbac.ts`
- `scripts/grant-operator-access.mjs` (novo, import-safe, dry-run default)
- `scripts/revoke-operator-access.mjs` (novo, import-safe, dry-run default)
- testes/mocks que implementam `RbacRepo`
- migration nova gerada após W2
- `docs/adr/ADR-BASE-14-sem-master.md`

**Pré-condição obrigatória:** executar consulta read-only `SELECT id, email FROM users WHERE is_master = true`. Se houver linha, parar esta tarefa, registrar no receipt e exigir decisão nominal sobre revogação ou grant operacional temporário. Não converter automaticamente para standing access.

**Implementação:**

- [ ] Remover `isMaster()` da interface e implementação de `RbacRepo`.
- [ ] Remover o ramo `can: () => true` de `resolveAccess`.
- [ ] `getAccess` usa os campos da W3.1 e falha fechado para access revogado ou expirado, inclusive no limite exato do timestamp.
- [ ] Permissões `master:*` passam por `role_permissions` tenant-scoped, continuam negadas ao Owner e não podem ser atribuídas por `createRole`, `assignUserAccess`, overrides ou reconcile clínico.
- [ ] Scripts operacionais criam/reutilizam role reservada `Synkroo Operator`, concedem somente a permission solicitada, exigem `--expires-at`, `--reason`, actor operacional e `--apply`, e escrevem audit allowlisted. Nenhum preset contém essa role.
- [ ] `master.setModuleContract` permanece protegida por `master:manage_modules`; somente access operacional não expirado explicitamente provisionado pode executá-la.
- [ ] Desativação global de identidade usa script/controle operacional autenticado, exige motivo e revoga todas as memberships/tokens; a Action clínica não pode produzir esse efeito.
- [ ] Gerar migration que remove `users.is_master` somente após pré-condição zero e testes verdes.
- [ ] Atualizar ADR-BASE-14 para `Implementado` apenas depois da migration aplicada no banco de teste e da ausência de `isMaster` em produção code paths.

**Testes negativos:** Owner não obtém `master:*`; administrador não cria role/override master; grant expirado ou revogado falha; limite de expiração falha fechado; script sem `--apply`, expiração ou motivo não grava; remover `is_master` não deixa operador standing.

**Testes:**

```bash
npm test -- --runInBand src/core/rbac/__tests__/resolve.test.ts src/core/actions/__tests__/context.test.ts src/lib/auth/__tests__/active-clinic-role.test.ts
npm run test:integration:run -- --runInBand src/core/rbac/__tests__/resolve/integration.test.ts src/repositories/auth/__tests__/integration.test.ts
```

---

## 9. W4: autorização e minimização LGPD

### Tarefa W4.0: aprovar matriz de disposição antes de mutar dados

**Criar:**

- `docs/ops/lgpd-data-disposition-matrix.md`
- `src/modules/operacional/__tests__/lgpd/data-inventory.test.ts` (novo)

**Inventário mínimo confirmado no baseline:**

- identidade clínica: `patients`, `patient_observations`, `patient_preferences`, `patient_risk_scores`, `patient_feedback`;
- operação: `appointments`, `appointment_status_log`, `appointment_reminders`, `waitlist`, treatment plans/items;
- atendimento: `conversations`, `messages`, states, sessions e memories;
- financeiro: budgets/items/installments, payments, charges, gateway events, routing rules e collection attempts;
- retenção/CRM: leads e atividades/tasks, campaign recipients, follow-ups, consents e custom field values;
- IA/infra: pending actions, decision/smart-trigger/agent logs, outbox/idempotency payloads, audit/action logs e JSONB que possa conter PII.

**Contrato da matriz:** uma linha por tabela/campo ou payload, owner module, caminho de ownership até patient/lead, inclusão no export, ação de anonimização (`clear`, `pseudonymize`, `unlink`, `retain`, `delete pending`), base/prazo de retenção, tratamento de `legalHold` e teste correspondente.

**Gate de decisão:** não inferir prazo legal nem apagar registro clínico/financeiro por conveniência técnica. Campos sem disposição aprovada bloqueiam W4.2/W4.3 e exigem decisão do owner/responsável jurídico. O teste de inventário falha quando surge nova FK `patientId`/`contactId`, coluna textual sensível ou JSONB relevante sem entrada na matriz.

### Tarefa W4.1: criar permissões e Actions LGPD

**Modificar:**

- `src/core/rbac/preset-policy.json`
- catálogo/seed RBAC e testes associados
- roots de catálogo `src/modules/operacional/index.ts` e `src/modules/crm/index.ts` para incluir as novas Actions públicas

**Criar:**

- `src/modules/operacional/actions/exportar-dados-paciente.ts`
- `src/modules/operacional/actions/anonimizar-paciente.ts`
- `src/modules/operacional/services/lgpd-service.ts`
- `src/modules/crm/actions/listar-consentimentos.ts`
- `src/modules/crm/actions/conceder-consentimento.ts`
- `src/modules/crm/actions/revogar-consentimento.ts`
- `src/modules/crm/public.ts` com porta tenant-safe para consentimentos

**Permissões exatas:**

- `lgpd:export`
- `lgpd:anonymize`
- `lgpd:view_consents`
- `lgpd:manage_consents`

Declará-las em `modulePermissions.lgpd`. Conceder as quatro ao preset `Administrador` por `extraKeys`; Owner recebe por regra de todas as permissões non-master. Não conceder a Recepcionista, Dentista, Comercial nem Agente.

Depois de atualizar catálogo/policy, executar o reconcile versionado da W3.2 em dry-run e apply no banco de teste. Seed de clínica nova não atualiza roles existentes e não é evidência suficiente.

**Risco IA:** marcar `operacional.anonimizarPaciente` fora de toda allowlist IA e cobrir com teste R3/unknown tool.

### Tarefa W4.2: migrar rotas LGPD para Action única

**Modificar:**

- `src/services/api-handlers/lgpd/export.ts`
- `src/services/api-handlers/lgpd/anonymize.ts`
- `src/app/api/lgpd/export/route.ts`
- `src/app/api/lgpd/anonymize/route.ts`
- `src/app/api/consents/route.ts`

**Implementação:**

- [ ] Transporte parseia request e chama `runAction` com `buildUserContext`; nenhuma query Drizzle permanece nos handlers.
- [ ] Export Action exige `lgpd:export` e filtra consents por `clinicId`, hoje ausente no handler legado.
- [ ] Export Action percorre toda a matriz aprovada, incluindo conteúdo relacionado e payloads exportáveis; ausência de extractor para linha marcada `export = yes` falha o teste.
- [ ] Anonymize Action exige `lgpd:anonymize`, valida legal hold e executa todas as disposições aprovadas + audit na mesma transaction.
- [ ] Registros clínicos/financeiros marcados `retain` preservam fatos obrigatórios, mas removem/desvinculam PII conforme a matriz; não usar cascade delete genérico do patient.
- [ ] Outbox/jobs pending que contêm contato são cancelados/redigidos na mesma transaction para impedir novo envio; logs/audit históricos seguem política de minimização, nunca busca textual cega em JSON.
- [ ] Consent GET exige `lgpd:view_consents`; POST/PATCH exigem `lgpd:manage_consents`.
- [ ] `actor` de consentimento vem de `ctx.user.id`; remover `actor` de inputs públicos/services.
- [ ] Validar ownership de patient/lead antes de grant/revoke.

### Tarefa W4.3: remover PII do audit de anonimização

**Contrato do audit:**

```ts
oldValues: {
  fieldsPresent: string[];
  legalHold: boolean;
  fingerprint: string; // HMAC/one-way fingerprint, nunca valor original
}
newValues: {
  anonymized: true;
  fieldsCleared: string[];
}
```

**Implementação:**

- [ ] Não persistir name, phone, email, CPF, birth date, notes ou conteúdo clínico antigos.
- [ ] Usar allowlist de audit já adotada pelo Action Layer.
- [ ] Retornar o ID real do `auditLogs.insert(...).returning({ id })`; remover `requestId` apresentado como `auditId`.
- [ ] Erros/logs incluem IDs técnicos e códigos, não PII.

**Testes:**

- sem permissão: 403/`forbidden`, zero reads sensíveis e zero mutations;
- clinic A não exporta/anonimiza contato B;
- legal hold: falha sem qualquer alteração;
- audit persistido não contém os valores sentinela de PII;
- consent actor forjado no body é ignorado/rejeitado.

```bash
npm test -- --runInBand src/services/api-handlers/lgpd src/app/api/consents
npm run test:security
```

---

## 10. W5: Action Layer única e registry determinístico

### Tarefa W5.1: extrair portas públicas dos módulos owner

**Modificar/criar no Operacional:**

- extrair a lógica de `registrar-observacao-paciente.ts` para service/use case público;
- extrair a lógica de `atualizar-tags-paciente.ts` para service/use case público;
- exportar uma interface pequena e side-effect-free por `src/modules/operacional/public.ts`.

**Modificar/criar no Comercial:**

- extrair a lógica de `registrar-nota-lead.ts` para service/use case público;
- extrair a lógica de `atualizar-tags-lead.ts` para service/use case público;
- expor `ensurePatientForLead`/conversão como porta que recebe `clinicId` e `actorUserId`, sem criar contexto;
- exportar uma interface pequena e side-effect-free por `src/modules/comercial/public.ts`.

**Contrato:** cada Action owner e cada workflow cross-module chama a mesma função de use case. A função recebe valores confiáveis explícitos, aplica invariantes e nunca chama `runAction`.

### Tarefa W5.2: remover `.handler` direto no CRM

**Modificar:**

- `src/modules/crm/services/contact-notes-service.ts`
- `src/modules/crm/services/contact-tags-service.ts`
- testes `contact-actions.test.ts` e `owner-bridge-actions.test.ts`

**Implementação:**

- [ ] Importar somente `@/modules/operacional/public` e `@/modules/comercial/public`; não importar Actions nem roots de catálogo.
- [ ] Remover casts parciais para `ActionContext`.
- [ ] `crm.adicionarNotaContato` e `crm.atualizarTagsContato` continuam sendo as únicas Actions auditadas para a request.
- [ ] Preservar ownership e actor ao chamar a porta.

### Tarefa W5.3: preservar caller nos workflows comercial/financeiro

**Modificar:**

- `src/modules/comercial/services/lead-conversion-service.ts`
- `src/modules/financeiro/actions/aceitar-orcamento.ts`
- `src/modules/financeiro/services/budget-service.ts`
- testes de conversão/aceite

**Implementação:**

- [ ] Remover `buildSystemContext` de `ensurePatientForLead`, `agendarAvaliacao` e `aceitarOrcamento`.
- [ ] A Action top-level passa `ctx.clinicId` e `ctx.user?.id` para o workflow.
- [ ] Comercial usa portas públicas do Operacional para criar/atualizar patient e agendar.
- [ ] Financeiro usa porta pública do Comercial para converter lead.
- [ ] O budget deve ser carregado por `(id, ctx.clinicId)` antes da conversão.
- [ ] Declarar dependências `comercial -> operacional` e `financeiro -> comercial, operacional` na W7.

**Teste guard:** spy em `runAction`, `buildSystemContext` e child `.handler`; ao executar a Action top-level, `runAction` externo ocorre uma vez e os três mecanismos internos não são chamados.

### Tarefa W5.4: eliminar registros por side effect

**Modificar:**

- `src/modules/operacional/actions/index.ts`
- `src/modules/atendimento/actions/index.ts`
- `src/modules/comercial/actions/index.ts`
- `src/modules/financeiro/actions/index.ts`
- `src/modules/followup/actions/index.ts`
- `src/modules/followup/index.ts`
- `src/modules/operacional/index.ts`
- `src/modules/comercial/index.ts`
- `src/core/rbac/catalog.ts`
- `src/core/actions/bootstrap.ts`
- `src/core/actions/__tests__/bootstrap.test.ts`

**Implementação:**

- [ ] Remover import e chamadas top-level de `registerActions` dos cinco barrels.
- [ ] Remover `import './actions'` de `followup/index.ts`; barrels e roots apenas constroem/exportam arrays/catálogo.
- [ ] Substituir a flag booleana `done` por uma Promise memoizada de bootstrap; duas chamadas concorrentes aguardam a mesma execução.
- [ ] `bootstrapActions` é o único registro de produção e trata todos os arrays de forma uniforme. `iaActions = []` é a única contribuição vazia aprovada porque IA não possui diretório `actions/` próprio.
- [ ] Preparar e validar catálogo completo e permissões antes de publicar estado global. Se o bootstrap falhar, limpar Action registry, catálogo de permissões e Promise memoizada; retry explícito não pode observar estado parcial nem ficar preso em Promise rejeitada.
- [ ] Tornar `registerAccessPermissions` idempotente por chave e resetável em testes; rerun/HMR não acumula entradas invisíveis.
- [ ] Testar import de todos os barrels/roots Core, Operacional, Atendimento, Followup, IA, Comercial, CRM e Financeiro com registries vazios: continuam vazios até o bootstrap explícito.
- [ ] Manter mapa versionado de nomes públicos esperados por módulo e comparar exatamente com o registry final. Todo módulo com diretório `actions/` contribui pelo menos uma Action; após W4, CRM expõe exatamente as 12 Actions humanas atuais, incluindo `executarMergePatient`/`executarMergeLead`, mais `listarConsentimentos`, `concederConsentimento` e `revogarConsentimento` (15 no total). Excluir `reprocessarSugestoesDuplicidade` e não duplicar no array CRM as Actions owner `operacional.mesclarPacientes`/`comercial.mesclarLeads`.
- [ ] Testar arrays contra `undefined`, nomes duplicados e diferença entre união dos arrays públicos e `getActions()`.
- [ ] Testar duas chamadas concorrentes e um rerun após reset; nenhuma duplicate exception e contagens/permissões permanecem exatas.
- [ ] Forçar falha entre prepare e commit, provar registries vazias e confirmar que a chamada seguinte refaz o bootstrap com sucesso.

**Mutação obrigatória do guard:** reintroduzir temporariamente `registerActions([umaAction])` em um barrel; o teste deve falhar informando side effect. Restaurar e confirmar GREEN.

### Tarefa W5.5: substituir owner-merge registration implícito por composition root

**Modificar/criar:**

- remover imports de side effect em `src/modules/operacional/index.ts` e `src/modules/comercial/index.ts`;
- remover `registerOwnerMerge(...)` top-level de `src/modules/operacional/actions/mesclar-pacientes.ts` e `src/modules/comercial/actions/mesclar-leads.ts`;
- remover os dispatchers side-effect-only `src/modules/crm/services/patient-merge-dispatcher.ts` e `lead-merge-dispatcher.ts`; as portas `merge`/`isMerged` passam a ser exports side-effect-free de `src/modules/operacional/public.ts` e `src/modules/comercial/public.ts`;
- manter somente `src/modules/crm/services/owner-merge-registry.ts` como registry leaf e remover o segundo `Map` privado de `duplicate-execution-service.ts`; o adapter registrado contém `merge` e `isMerged`, evitando imports diretos de Operacional/Comercial no CRM;
- registrar explicitamente os adapters `patient` e `lead` no composition root `src/core/actions/bootstrap.ts`, junto do bootstrap único, e limpar essa registry em `resetBootstrapForTests`;
- estender o prepare/commit e o rollback de falha da W5.4 para validar e limpar também os owner adapters, sem estado parcial;
- adaptar `duplicate-execution-service.ts` para obter ambas as operações da registry leaf e falhar fechado quando o adapter estiver ausente.
- reescrever `src/modules/crm/__tests__/owner-merge-registry-guard.test.ts` para provar registry vazia após imports isolados, duas chaves após bootstrap e erro acionável em ausência/duplicidade.

**Contrato:** importar qualquer módulo isoladamente não altera `ownerMergeRegistry`. O composition root registra exatamente `patient` e `lead`, uma vez, depois de carregar as portas; chave duplicada lança erro em vez de `Map.set` sobrescrever silenciosamente. Ausência/duplicidade falha no bootstrap/teste, nunca somente na primeira execução de merge.

**Mutação obrigatória:** remover temporariamente um adapter da composição e confirmar RED com `OWNER_MERGE_ADAPTER_MISSING:<owner>`; restaurar e confirmar GREEN.

```bash
npm test -- --runInBand src/core/actions/__tests__/bootstrap.test.ts src/modules/crm/__tests__/contact-actions.test.ts src/modules/crm/__tests__/owner-merge-registry-guard.test.ts
npm run typecheck
```

---

## 11. W6: inbound atômico e idempotente

### Tarefa W6.1: adicionar unicidade de conversa

**Modificar:**

- `src/modules/atendimento/schema/conversations.ts`
- migration nova

**DDL:** unique index `conversations_clinic_channel_external_unique` em `(clinic_id, channel, external_id)`.

Antes do índice, a migration deve detectar duplicatas. Se houver, abortar e gerar relatório; não mesclar mensagens automaticamente na migration.

### Tarefa W6.2: criar primitive transacional única

**Modificar:**

- `src/modules/atendimento/repositories/conversations-repository.ts`
- `src/modules/atendimento/services/webhook-processor-service.ts`

**API final:**

```ts
persistInboundMessage(input: {
  clinicId: string;
  channel: 'whatsapp' | 'web';
  externalConversationId: string;
  externalProvider: string;
  externalMessageId: string;
  content: string;
  messageType: string;
  metadata: Record<string, unknown>;
}): Promise<
  | { deduped: true; conversationId: string }
  | { deduped: false; conversationId: string; messageId: string }
>
```

**Transaction obrigatória:**

1. Upsert conversation por `(clinicId, channel, externalConversationId)` e obter ID.
2. Insert da message com `onConflictDoNothing` pela chave externa já existente.
3. Se deduped, não alterar aggregate.
4. Se nova, executar update atômico `message_count = message_count + 1`, `last_message_at = now`, `updated_at = now` na conversa da mesma clínica.
5. Na mesma transaction, enfileirar os eventos pós-persistência necessários; commit e somente consumers executam confirmação, lead capture, agente e resposta externa. Criar producer, handler idempotente e teste no mesmo task; não deixar operação pending sem consumer até W9.

**Remover/substituir nos fluxos inbound:** sequência `findOrCreateConversation` + `appendInboundMessageDeduped` + `updateConversationTimestamp`.

Para provider inbound, `externalMessageId` é obrigatório. Evento sem ID deve falhar visivelmente/ser descartado com log técnico; não gerar UUID novo a cada retry. Widget deve receber idempotency key estável da request ou gerar uma única vez no boundary e devolvê-la ao caller.

### Tarefa W6.3: corrida real

**Criar:**

- `src/modules/atendimento/__tests__/concurrency-dedup.integration.test.ts`

**Cenários `Promise.all`:**

- 10 eventos iguais -> uma conversation, uma message, `messageCount = 1`.
- 10 IDs externos diferentes para o mesmo peer -> uma conversation, dez messages, `messageCount = 10`.
- mesmo external ID em providers diferentes segue a semântica do índice atual e do contrato documentado.
- falha forçada no update do aggregate faz rollback do insert da message.

```bash
npm run test:integration:run -- --runInBand src/modules/atendimento/__tests__/concurrency-dedup.integration.test.ts
```

### Tarefa W6.4: convergir boundaries Evolution/widget em uma Action de ingress

**Modificar:**

- `src/app/api/messages/inbound/route.ts`
- `src/app/api/whatsapp/evolution/route.ts`
- `src/app/api/whatsapp/webhook/route.ts`
- `src/app/api/widget/session/route.ts` (novo)
- `src/app/api/widget/messages/route.ts`
- `src/app/api/instagram/webhook/route.ts`
- `src/lib/db/schema/infra.ts` e migration nova para origins autorizadas da instalação widget
- `src/lib/auth/widget-token.ts` (novo)
- `src/modules/atendimento/services/webhook-processor-service.ts`
- `src/modules/atendimento/actions/processar-webhook-whatsapp.ts`
- `src/modules/atendimento/actions/receber-mensagem.ts`
- `src/modules/atendimento/actions/receber-widget-mensagem.ts`
- `src/app/api/messages/inbound/__tests__/route.security.test.ts`
- `src/app/api/whatsapp/evolution/route.test.ts`
- `src/app/api/whatsapp/webhook/__tests__/route.test.ts`
- `src/app/api/widget/messages/route.test.ts` (novo)
- `src/app/api/instagram/webhook/__tests__/route.test.ts`

**Implementação:**

- [ ] Cada request válida resolve instalação/credencial antes do `runAction`, constrói um único contexto system e executa uma única Action de ingress que chama `persistInboundMessage`.
- [ ] Remover chamadas diretas do transport para services, `buildSystemContext` e child Actions dentro de `webhook-processor-service`.
- [ ] Evolution usa provider event/message ID como idempotency key e preserva raw body quando assinatura exigir.
- [ ] Restaurar widget conforme REQ-ATD-02. `channel_installations` do provider `widget` recebe allowlist exata de origins HTTPS, sem wildcard em produção; `installationId` é identificador público opaco, nunca `clinicId`.
- [ ] `POST /api/widget/session` recebe somente `installationId`, valida instalação enabled + `Origin` na allowlist, aplica rate limit por instalação/IP e emite token com `installationId`, origin, nonce e expiração máxima de cinco minutos. Assinar por HMAC com chave derivada de `AUTH_SECRET` e context string exclusiva; nenhum shared secret vai ao browser.
- [ ] `POST /api/widget/messages` valida assinatura, expiração e igualdade exata do `Origin`, resolve a clínica novamente pela instalação server-side e exige idempotency key estável do client. Token inválido/expirado ou instalação desabilitada falha antes de `runAction`.
- [ ] Tratar `Origin` como restrição de browser, não autenticação forte: o token permite somente ingress de mensagem, nunca leitura/administração; rate limit, limite de payload e observabilidade cobrem clients não-browser capazes de forjar header.
- [ ] Preflight/response CORS ecoa apenas origin aprovado e usa `Vary: Origin`; `GET /api/widget/messages` responde `405` canônico, sem inventar histórico nesta tranche.
- [ ] `/api/widget/messages` não pode permanecer `410` enquanto a spec vigente inclui chat widget. Mudança de escopo exige ADR + atualização da spec aprovada.
- [ ] Instagram continua fora da v1 pela seção 2 da spec; rota pública deve permanecer 404/disabled e não ser incorporada ao pipeline sem change control.
- [ ] Side effects pós-commit usam outbox e não reexecutam quando `persistInboundMessage` retorna `deduped: true`.

**Testes de contrato:** token inválido/expirado, bootstrap em origin não autorizada, payload tentando `clinicId`, retry do mesmo evento, replay em outra origin, instalação desabilitada após emissão, rate limit, CORS, side effect antes de commit e rota Instagram em produção.

```bash
npm test -- --runInBand src/app/api/messages/inbound src/app/api/whatsapp/evolution src/app/api/whatsapp/webhook src/app/api/widget/messages src/app/api/instagram/webhook
```

---

## 12. W7: boundaries de módulo e schema sem ciclos

### Tarefa W7.1: declarar catálogo e dependências de módulos

**Criar:**

- `src/core/modules/definitions.ts`
- `src/core/modules/__tests__/definitions.test.ts`

**Modificar todos `src/modules/*/manifest.ts`:** adicionar `dependsOn` explícito.

**Grafo aprovado:**

```text
core -> []
operacional -> []
comercial -> [operacional]
atendimento -> [operacional, comercial]
crm -> [operacional, comercial]
financeiro -> [operacional, comercial]
followup -> [operacional, atendimento, financeiro]
ia -> [atendimento, operacional]
```

`core` é always-on e implicitamente disponível, portanto não aparece nos arrays. `definitions.ts` importa somente `manifest.ts` side-effect-free, valida IDs únicos, dependências existentes e ausência de ciclo. `makeManifest` considera módulo efetivamente habilitado somente quando todas as dependências também estiverem habilitadas.

**Correções obrigatórias antes de aceitar o grafo:**

- Operacional/Comercial deixam de importar CRM para recálculo; mutations owner gravam evento `crm.contact.changed` na mesma transaction e o CRM o consome de forma idempotente.
- Comercial deixa de importar Actions de Atendimento/Core para hot-lead; emissão de notificação vira evento/outbox ou porta injetada no composition root, nunca dependência reversa.
- Atendimento pode chamar a porta pública Comercial para lead capture após persistência inbound; Comercial não chama Atendimento, preservando DAG.
- `src/modules/financeiro/services/collection-service.ts` deixa de importar `enviarMensagemDireta` de Atendimento; Financeiro enfileira uma operação de cobrança/mensagem na mesma transaction e Atendimento a consome. Não adicionar `financeiro -> atendimento`: envio externo é side effect pós-commit, não chamada síncrona de domínio.
- Owner merge usa o composition root explícito de W5.5, não imports Operacional↔CRM ou Comercial↔CRM.
- Merge de patient/lead não pode manter no repository owner imports de tabelas Financeiro/Followup/CRM para cleanup; o orchestrator transacional injeta as contribuições dos módulos dependentes ou usa constraints/ports explícitas.
- CRM pode ler schemas/portas públicas de Operacional e Comercial; nenhuma chamada reversa é permitida.

Os eventos introduzidos nesta onda entram imediatamente no worker/dispatch atual com handler idempotente e contract test producer↔handler; W9 centraliza tipagem, module gating e concorrência, mas não pode ser requisito para restaurar comportamento removido em W7.

**Teste:** além de validar o catálogo declarado, construir grafo de imports reais de produção e falhar se uma aresta cross-module não estiver em `dependsOn` ou se houver ciclo. O teste imprime caminho completo do ciclo.

### Tarefa W7.2: remover dependências legadas de produção

**Escopo inicial confirmado, não exaustivo:**

- `src/modules/operacional/services/reminders-service.ts`
- `src/modules/operacional/actions/atualizar-consulta.ts`
- `src/modules/operacional/actions/obter-consulta.ts`
- `src/modules/operacional/actions/reativar-consulta.ts`
- `src/modules/operacional/actions/listar-tratamentos-incompletos.ts`
- `src/modules/operacional/actions/processar-confirmacao-resposta.ts`
- `src/modules/atendimento/services/webhook-processor-service.ts`
- wrappers de `src/modules/followup/services/*`
- `src/modules/followup/actions/registrar-followup.ts`

**Procedimento:**

- [ ] Gerar no receipt inventário completo de imports `@/services`, `@/repositories`, roots/actions/internals de outro módulo e aresta módulo→módulo antes da primeira edição; não encerrar pelo checklist curto acima.
- [ ] Para cada import `@/services/*` ou `@/repositories/*`, mover implementação para o módulo owner ou expor uma porta pública existente.
- [ ] Para cada import de Action/repository/service interno de outro módulo, usar `public.ts`, schema seam permitida, outbox ou injeção no composition root conforme o grafo aprovado.
- [ ] Atualizar callers antes de remover wrapper legado.
- [ ] Não copiar lógica e deixar duas fontes ativas.
- [ ] Testes podem mockar a nova porta pública; remover mocks de caminhos legados tocados.

**Critério:** busca em arquivos de produção de `src/modules` por imports `@/services/` e `@/repositories/` retorna zero. Comentários históricos e testes não contam, mas devem ser limpos quando enganarem o guard.

### Tarefa W7.3: tornar boundary fail-closed

**Modificar:**

- `eslint.rules.json`
- `src/__tests__/architecture/boundary-rules.test.ts`
- discovery helper usado pelo teste

**Regras:**

- `boundaries/dependencies.default` passa para `disallow` depois que os imports existentes forem migrados.
- Módulo pode importar `src/core`, leaf compartilhado de `src/lib`, arquivos próprios e somente `public.ts` ou `schema/index.ts` de outro módulo listado em `dependsOn`.
- Somente os composition roots nomeados `src/core/actions/bootstrap.ts` e `src/core/modules/definitions.ts` podem importar, respectivamente, arrays públicos/root de catálogo e `manifest.ts` dos módulos; código de negócio não. Importar root de módulo não pode ser atalho para carregar catálogo de Actions.
- Módulo não pode importar `src/services`, `src/repositories` nem internals de outro módulo.
- Import de `@/lib/db/schema` barrel é proibido em todo arquivo de produção sob `src/modules`, não apenas em arquivos `schema`.
- `app/api` pode importar adapters públicos/core/lib, mas não repository/schema.
- Exceções devem nomear arquivo e motivo temporário; não usar wildcard para um módulo inteiro.

**Guard complementar:** varrer arquivos de produção e reportar lista completa de imports proibidos e arestas não declaradas; falhar se discovery retornar vazio. A configuração ESLint e o guard Jest devem implementar a mesma allowlist para não divergir.

**Mutação obrigatória:** adicionar temporariamente um import `@/modules/operacional/repositories/patients-repository` em outro módulo e confirmar que lint/guard falha com o arquivo; restaurar.

### Tarefa W7.4: quebrar ciclos de schema

**Modificar:**

- `src/modules/atendimento/schema/conversations.ts`
- `src/modules/followup/schema/index.ts`
- todos os arquivos de produção em `src/modules` que importam `@/lib/db/schema`
- `src/lib/db/schema/agent.ts`, `business.ts`, `crm.ts`, `infra.ts`, `appointments.ts` e `conversations.ts`
- `src/lib/db/schema/index.ts` somente para reexports de compatibilidade, sem ser importado pelos módulos

**Implementação:**

- [ ] Trocar `import { patients } from '@/lib/db/schema'` por `@/modules/operacional/schema`; schema seams são barrels públicos side-effect-free e não expõem Actions.
- [ ] Trocar reexport de `patientFeedback` do barrel central pelo schema seam do owner.
- [ ] Imports de core/enums usam arquivos leaf (`@/lib/db/schema/core`, `.../enums`), nunca `@/lib/db/schema`.
- [ ] Mover definições de `agent.ts` para `src/modules/ia/schema`, mantendo reexport legado; IA declara dependência dos schemas usados.
- [ ] Separar `business.ts`: `appointmentStatusLog` e treatment plans/items vão para Operacional; orçamento, parcelas, pagamentos, gateways, charges, routing/events e collection attempts vão para `src/modules/financeiro/schema`; manter somente reexports legados no leaf antigo.
- [ ] Separar `crm.ts`: leads/tasks já permanecem no Comercial; campaigns/recipients/follow-ups/configs/segments vão para Followup e `clinicTags` para CRM. O arquivo legado apenas reexporta.
- [ ] Separar `infra.ts`: `knowledgeBase` vai para IA; `whatsappInstances`, `channelInstallations` (incluindo origins da W6) e `messageTemplates` vão para Atendimento; `consents` e custom fields/values vão para CRM; `idempotencyKeys`, `outboxJobs` e `auditLogs` ficam em leaf de infraestrutura Core. Manter reexports legados e remover o import morto de `patients`; leaf compartilhado não importa módulo.
- [ ] Relações de uma camada mais baixa para módulo dependente, como `budgets.campaignId`/routing rule → campaign, não podem criar Financeiro→Followup enquanto Followup→Financeiro. Manter a coluna UUID no owner baixo e declarar/validar a FK por migration/arquivo neutro de relações carregado apenas no composition root, sem import runtime reverso.
- [ ] `appointments.ts` e `conversations.ts` permanecem reexports de compatibilidade, mas nenhum módulo pode importá-los pelo barrel central.
- [ ] Criar guard que falha se qualquer arquivo de produção sob `src/modules` importar o barrel central ou se um schema seam importar Actions/root com side effects.

**Mutação obrigatória:** reintroduzir um import do barrel em fixture temporária e confirmar RED.

```bash
npm run lint
npm run typecheck
npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/modules/__tests__/definitions.test.ts
```

---

## 13. W8: contrato HTTP e strangler das rotas de orçamento

### Tarefa W8.1: consolidar adapter HTTP canônico

**Modificar:**

- `src/lib/api/action-route.ts`
- `src/lib/api/response.ts`
- adapters `src/modules/*/ui/route-adapter.ts`
- testes `src/lib/api/__tests__/action-route.test.ts` e contract tests

**Contrato:**

- success: `{ data, meta? }`;
- failure: `{ error: { code, message, requestId } }`;
- header `x-request-id` sempre igual ao body de erro;
- mapping único de `ActionErrorCode` para status;
- erro inesperado nunca devolve `error.message` bruto ao cliente;
- serializers explícitos convertem snake_case legado somente no adapter legado.

Substituir duplicação de `runFinanceiroAction`, `runComercialAction`, `runActionRoute` etc. por um adapter compartilhado configurável, mantendo apenas wrappers finos por módulo se melhorarem imports. O adapter não acrescenta `clinicId` ao input; constrói contexto confiável e deixa `runAction` aplicar policy. Corrigir `createActionRoute`, que hoje devolve `error.message` bruto no catch inesperado.

### Tarefa W8.2: escolher família canônica e adaptar legado

**Família canônica aprovada:** `/api/financeiro/budgets/*`.

**Modificar:**

- rotas sob `src/app/api/financeiro/budgets/**` para Action + resposta canônica;
- rotas sob `src/app/api/budgets/**` para adapters legados, sem services/repositories diretos;
- `src/hooks/usePayments.ts` para família canônica;
- `src/lib/hooks/use-queries.ts` e seus testes;
- Actions Financeiro ausentes para update/delete budget, registro de payment e update/delete de installment.

**Matriz obrigatória antes de migrar callers:**

| Recurso | Legado atual | Canônico atual | Estado final desta tranche |
|---|---|---|---|
| `/budgets` | `GET`, `POST` | `GET`, `POST` | mesmas Actions; envelopes distintos somente no adapter legado |
| `/budgets/[id]` | `GET`, `PUT`, `DELETE` | somente `GET` | criar Actions `atualizarOrcamento`/`excluirOrcamento` e expor `PUT`/`DELETE` canônicos tenant-scoped |
| `/budgets/[id]/payments` | `GET`, `POST` | somente `GET` | expor `POST` canônico via `registrarPagamento`; legado traduz snake_case |
| `/budgets/[id]/installments` | `GET`, `POST`, `PATCH`, `DELETE` | `GET`, `PUT` | `PUT` canônico substitui lote; criar `PATCH`/`DELETE` em `/installments/[installmentId]`; legado POST/query-param chama as mesmas Actions |
| accept/reject/send | `POST` | `POST` | mesmas Actions e decisões de domínio |
| status | nenhum route canônico real | hook chama `/status` inexistente | remover endpoint fantasma do hook e usar `PUT /budgets/[id]`/Action de update |
| `/budgets/followup` | `GET`, `POST`, módulo Followup | sem equivalente Financeiro | excluir do strangler Financeiro; manter temporariamente como endpoint Followup e planejar rename próprio sem fingir sucessor Financeiro |

Não migrar um caller para a família canônica antes de existir paridade do método e serializer que ele usa. A semântica de DELETE segue a matriz LGPD/retention aprovada: se purge físico for vedado, ambas as famílias chamam a mesma Action de archive/cancel/tombstone. DELETE de budget/parcelas fica fora da allowlist IA e exige `financeiro:manage_budget`.

**Strangler legado:**

- chama a mesma Action da rota canônica;
- traduz request snake_case -> input camelCase;
- traduz output canônico -> shape legado somente quando caller existente exigir;
- adiciona `Deprecation: true`, `Link: </api/financeiro/...>; rel="successor-version"` e `X-Synkroo-Legacy-Route: 1`; `Sunset` só é emitido depois de a release aprovar uma data RFC 7231 exata, nunca com placeholder;
- emite métrica/log técnico por route template, sem PII e sem IDs de paciente;
- não redireciona mutações com 301/302.
- nunca chama `getBudget(id)`, `listPayments(id)` ou update/delete repository unscoped para montar compatibilidade.

### Tarefa W8.3: provar paridade e definir remoção

**Criar/estender:**

- `src/modules/financeiro/__tests__/routes.test.ts`
- `src/__tests__/api/contract/budget-route-parity.test.ts` (novo)
- `src/hooks/__tests__/usePayments.test.tsx` (novo)
- `src/lib/hooks/__tests__/use-queries.test.tsx`
- `e2e/api/budgets-api.spec.ts`

**Cenários:** para cada linha/método da matriz, auth, permission, tenant foreign, validation, success e error mapping produzem a mesma decisão de domínio nas duas famílias; apenas envelope/serializer legado difere. Contract test falha se uma rota/método ou caller inventariado não estiver na matriz.

Remoção de `/api/budgets/*` não ocorre nesta tranche. Critério para plano futuro: zero hit por duas janelas de release, clients internos migrados e comunicação aos consumidores externos.

```bash
npm test -- --runInBand src/lib/api/__tests__/action-route.test.ts src/modules/financeiro/__tests__/routes.test.ts src/__tests__/api/contract/response-format.test.ts src/__tests__/api/contract/budget-route-parity.test.ts src/hooks/__tests__/usePayments.test.tsx src/lib/hooks/__tests__/use-queries.test.tsx
```

---

## 14. W9: manifesto e outbox operacional

### Tarefa W9.1: remover cache global stale do manifesto

**Modificar:**

- `src/core/modules/manifest.ts`
- `src/core/modules/gates.ts`
- `src/core/actions/context.ts`
- `src/modules/core/services/modules-service.ts`
- `src/core/modules/__tests__/manifest.test.ts`
- callers de produção que importam o singleton `moduleManifest`

**Problema confirmado:** `moduleManifest` é singleton de módulo e cacheia indefinidamente. `invalidate()` após `setModuleContract` alcançaria somente o isolate atual; outros isolates continuariam autorizando estado antigo.

**Contrato final:** remover cache cross-request e o export singleton `moduleManifest`. Expor uma factory que cria manifesto memoizado somente para o escopo recebido. Rotas que chegam a `runAction` deixam o adapter compartilhado construir um único contexto/snapshot e não executam gate de manifesto independente; `withModuleRoute` cria uma instância dentro de cada invocação somente para handlers legados que ainda não executam Action. Builders de `ActionContext` criam/recebem uma instância por contexto; cron/outbox criam uma por batch. Migrar todos os imports de produção do singleton para factory ou injeção explícita. Não adicionar TTL/process cache nesta tranche. Uma otimização futura exige versão distribuída e teste multi-isolate.

**Testes:** duas requests independentes separadas por update observam estados diferentes imediatamente; chamadas dentro do mesmo contexto usam um snapshot; update que falha não muda o banco; teste com duas instâncias da factory prova que não dependem de invalidação local. Guard falha se arquivo de produção voltar a importar/exportar o singleton `moduleManifest`.

### Tarefa W9.2: mapear operação -> módulo e limitar concorrência

**Modificar:**

- `src/lib/outbox/worker.ts`
- `src/lib/outbox/dispatch-outbox.ts`
- `src/lib/outbox/outbox-repository.ts`
- producers Financeiro/Followup/CRM/Atendimento tocados por W6/W7
- testes em `src/lib/outbox/__tests__`

**Registry final:**

```ts
type OutboxHandlerDefinition = {
  operation: OutboxOperation;
  moduleId: ModuleId;
  handle(job: OutboxJob): Promise<void>;
  onDeadLetter?(job: OutboxJob, error: unknown): Promise<void>;
};
```

**Implementação:**

- [ ] Carregar módulos habilitados uma vez por batch.
- [ ] Definir constantes/tipo `OutboxOperation` compartilhados por producer e handler; `enqueueOutbox` de produção não aceita string arbitrária.
- [ ] Registrar explicitamente as três operações existentes (`financeiro.charge.create`, `financeiro.charge.cancel`, `followup.campaign.recipient`) e as novas operações introduzidas por W6/W7.
- [ ] Startup/contract test compara operações produzíveis com handlers exatamente uma vez. Consultar rows pending com operation desconhecida antes do batch e emitir erro/métrica acionável; não deixá-las invisíveis pelo filtro de claim.
- [ ] Passar a `claimOutboxJob` somente operations cujo módulo e dependências estão habilitados.
- [ ] Job de módulo disabled permanece `pending`; não consumir attempts nem mandar para DLQ.
- [ ] Processar no máximo `limit` com worker pool de concorrência fixa default 5; cada worker faz claim com `SKIP LOCKED`, sem criar `Promise.all` proporcional ao backlog.
- [ ] Preservar lease, `FOR UPDATE SKIP LOCKED`, retry e DLQ existentes.
- [ ] Testar dois workers concorrentes sem double delivery.

**Cenários adicionais:** todas as operações disabled, dependência disabled, operação desconhecida já persistida, handler ausente no deploy, primeiro worker esvazia fila, retry concorrente após lease e `limit < concurrency`.

### Tarefa W9.3: substituir self-fetch público por service binding

**Modificar:**

- `worker-entry.mjs`
- `wrangler.toml`
- `src/__tests__/cloudflare/opennext-queue-config.test.ts`

**Implementação aprovada:** usar o binding existente `env.WORKER_SELF_REFERENCE.fetch()` com URL absoluta sintética, por exemplo `https://synkroo.internal/api/cron/outbox?limit=25`; service binding roteia ao Worker e não depende desse hostname no DNS. Manter `Authorization: Bearer CRON_SECRET`. Remover `OUTBOX_WORKER_URL` de `[vars]`, staging e validação runtime após testes.

Não chamar a URL `*.workers.dev` no scheduled handler. Não tornar a rota cron pública sem secret apenas porque o caller principal usa binding.

**Testes/gates:**

```bash
npm test -- --runInBand src/lib/outbox/__tests__ src/app/api/cron/outbox/route.test.ts src/__tests__/cloudflare/opennext-queue-config.test.ts
npm run test:integration:run -- --runInBand src/lib/outbox/__tests__/outbox.integration.test.ts src/lib/outbox/__tests__/dispatch-outbox.integration.test.ts
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

---

## 15. W10: separação de capability e contrato IA versionado

### Tarefa W10.1: separar entrypoints RPC

**Modificar:**

- `src/workers/ia-bridge/index.ts`
- `src/core/ia-channel/agent-invoker.ts`
- `wrangler.toml`
- `src/workers/ia-agent/wrangler.jsonc`
- worker configuration types gerados/maintained

**Desenho final no mesmo worker ia-bridge:**

- `HandleIssuerService`: expõe somente `issueHandle`, bound apenas no app Worker como `IA_HANDLE_ISSUER`.
- `AppService`: expõe `listTools`, `executeAction`, `ping` e `dbHealth`, bound no ia-agent como `APP`; não expõe `issueHandle`.
- ia-agent recebe handle no `runTurn` e não possui binding para `HandleIssuerService`.

**Estado de compatibilidade obrigatório:** o primeiro deploy do bridge adiciona `HandleIssuerService`, mas mantém temporariamente `issueHandle` no `AppService` legado. Remover o método no mesmo deploy que adiciona o novo entrypoint quebraria o app Worker antigo entre deploys.

**Configuração:**

- `wrangler.toml`: trocar binding usado pelo app para `IA_HANDLE_ISSUER`, entrypoint `HandleIssuerService`.
- `src/workers/ia-agent/wrangler.jsonc`: manter `APP` apontando para entrypoint executor `AppService`.
- Atualizar `AgentEnv` e `invokeAgentWithEnv` para emitir via `IA_HANDLE_ISSUER` e depois chamar o DO.
- Regenerar `worker-configuration.d.ts` do app, bridge e agent para validar nomes/entrypoints. Como binding cross-worker pode continuar gerado como `Service`, tipar a surface no código exclusivamente pelos bindings compartilhados de `rpc-contract.ts`, sem interfaces duplicadas/casts ad hoc.

**Testes negativos finais:** `env.APP.issueHandle` não existe no agent; `env.IA_HANDLE_ISSUER.listTools/executeAction` não existe no app. Contract tests validam tanto a surface TypeScript compartilhada quanto tentativa RPC runtime após a remoção da compatibilidade v1.

### Tarefa W10.2: fonte única e versão do contrato

**Criar:**

- `src/core/agent-bridge/rpc-contract.ts`

**Mover/centralizar:** `ListToolsInput/Result`, `ExecuteInput/Result`, handle issuer input/result e `BRIDGE_RPC_VERSION`.

**Contrato:**

- toda request issue/list/execute inclui `contractVersion` no contrato final;
- toda resposta inclui `contractVersion`;
- mismatch retorna `{ ok: false, error: 'contract_version_mismatch', contractVersion }` antes de consumir idempotency key ou executar Action;
- `src/core/ia-agent/types.ts` importa os tipos compartilhados para `AppBinding`, não replica interfaces manualmente;
- `ping` inclui versão para smoke/deploy ordering;
- antes de `listTools`/`executeAction`, o agent novo faz handshake `ping` e exige versão suportada; bridge antigo sem campo falha localmente como mismatch e nenhuma chamada de tool é enviada. Cache do handshake dura no máximo o `runTurn`, não o isolate.

Durante a release compatível, request sem `contractVersion` é reconhecida somente como versão legada explícita `v1`; não significa “latest”. `SUPPORTED_BRIDGE_RPC_VERSIONS` lista `v1` e a versão nova. Depois da telemetria provar zero caller v1, release separada remove ausência/v1 e torna a versão obrigatória. DTOs RPC contêm apenas dados structured-clone serializáveis; nunca `ActionContext`, funções, Errors ou instances Drizzle/Zod.

### Tarefa W10.3: contract tests e deploy order

**Modificar/criar:**

- `src/workers/ia-bridge/__tests__/index.test.ts`
- `src/workers/ia-agent/__tests__/index.test.ts`
- `src/core/agent-bridge/__tests__/rpc-contract.test.ts` (novo)
- `docs/runbooks/ia-rpc-rollout.md` (novo)

**Cenários:** versão igual, agent antigo sem campo/bridge compatível, agent novo/bridge antigo com falha controlada, executor sem handle válido, issuer indisponível, handle expirado e replay de idempotency key. Mismatch não marca `IA_SEEN`, não lista tool e não executa Action.

**Deploy seguro em releases separadas:**

1. Deploy bridge compatível: exporta os dois entrypoints, preserva `AppService.issueHandle` v1 e aceita somente v1 + versão nova.
2. Regenerar tipos/dry-run; deploy app trocando `IA_BRIDGE/AppService` por `IA_HANDLE_ISSUER/HandleIssuerService`; smoke app → issuer → DO.
3. Deploy agent novo com `contractVersion`; smoke app → issuer → agent → executor.
4. Observar telemetria até zero request v1/sem versão por uma janela de release.
5. Em release posterior, remover `issueHandle` de `AppService`, remover v1 e executar o teste negativo final.

Rollback antes da etapa 5 ocorre agent → app → bridge. Depois da etapa 5, primeiro redeployar o bridge compatível antes de voltar app/agent antigos. Nunca testar o bridge binding-only por URL pública; smoke parte do app/agent que possuem o service binding.

**Typegen obrigatório:**

```bash
npx wrangler types --config wrangler.toml worker-configuration.d.ts
npx wrangler types --config wrangler.ia-bridge.jsonc src/workers/ia-bridge/worker-configuration.d.ts
npx wrangler types --config src/workers/ia-agent/wrangler.jsonc src/workers/ia-agent/worker-configuration.d.ts
```

```bash
npm test -- --runInBand src/core/agent-bridge src/workers/ia-bridge src/workers/ia-agent
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
npx wrangler deploy --dry-run --env staging --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc
npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc
```

O dry-run do app no baseline gerou `gzip: 4020.06 KiB`. Antes de deploy real, registrar limite da conta: plano Workers Free (3 MiB) bloqueia esse bundle; resolver por redução abaixo do limite ou plano pago aprovado. Não trocar Workers por Pages sem ADR/spec, pois o runtime alvo é normativo.

---

## 16. W11: gates finais, documentação e reclassificação

### Tarefa W11.1: provar guards por mutação

Para cada guard criado em W1/W4/W5/W7/W8/W9/W10:

1. Reintroduzir temporariamente a violação protegida.
2. Rodar somente o guard.
3. Registrar no receipt o erro e arquivo apontado.
4. Restaurar o código correto.
5. Rodar novamente e registrar GREEN.

No mínimo provar:

- side effect `registerActions` em barrel;
- contribuição vazia/Action pública omitida do registry;
- schema de Action contendo `clinicId`/`clinic_id`;
- import cross-module de internal;
- aresta real ausente em `dependsOn` e ciclo de imports;
- import de `@/services` dentro de módulo;
- import do barrel `@/lib/db/schema` em qualquer arquivo de módulo;
- rota Action retornando envelope ad hoc;
- operação outbox produzível sem handler/módulo owner;
- versão RPC incompatível consumindo idempotency key.

### Tarefa W11.2: executar verificação escalonada

**Gate estático e focado:**

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

**Banco e segurança:**

```bash
npm run test:integration:run
npm run test:security
npm run test:security:repositories
npm run test:security:services
```

**Build/runtime:**

```bash
npm run build
npm run build:cf
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
npx wrangler deploy --dry-run --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc
npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc
```

**Roadmap/docs:**

```bash
npm run roadmap:check
```

E2E completo entra somente depois dos gates acima verdes e deve incluir J-02, J-03, J-06 e J-08 da spec canônica.

### Tarefa W11.3: alinhar ADRs ao estado comprovado

**Modificar somente após evidência:**

- `docs/adr/ADR-BASE-01-modular-monolith.md`: remover “Gap nenhum” enquanto imports legados/boundaries ainda existirem; marcar implementado após W7.
- `docs/adr/ADR-BASE-06-action-layer.md`: registrar remoção de `.handler`/system substitution e bootstrap único.
- `docs/adr/ADR-BASE-10-api-contracts.md`: documentar família canônica e janela do strangler.
- `docs/adr/ADR-BASE-13-cloudflare-queues.md`: refletir Cron + PostgreSQL outbox real e service binding interno, sem afirmar Queue nativa.
- `docs/adr/ADR-BASE-14-sem-master.md`: marcar implementado somente após drop de `is_master`.
- receipt W0: anexar resultados finais e riscos residuais.

Não alterar a spec canônica para acomodar código incompleto. Se uma decisão deste plano contradizer evidência nova, abrir ADR antes de mudar direção.

---

## 17. Critérios de aceite por achado

| ID | Evidência mínima para fechar |
|---|---|
| F-01 | suites cross-clinic de finance/appointments verdes + FKs compostas rejeitando inserts inválidos |
| F-02 | toda API pública de conversation/message recebe clinic + teste A tentando ID B |
| F-03 | teste multi-clinic com roles diferentes + FKs access/role/override + zero check request-time de `users.role` |
| F-04 | matriz de disposição completa, permission negatives, legal hold, actor server-side e audit/outbox sem PII sentinela |
| F-05 | zero `.handler(` em produção fora de `run.ts`; zero system context em workflows humanos tocados |
| F-06 | corrida 10x prova uma conversa/mensagem, rollback do aggregate e Evolution/widget convergem na Action única |
| F-07 | zero imports legados/internals + boundary default deny + grafo declarado igual ao grafo real e acíclico |
| F-08 | imports não mudam registries; bootstrap Promise único, arrays públicos exatos e contribuição vazia só explicitamente aprovada |
| F-09 | matriz método-a-método, contract tests canonical/legacy, clients internos na canonical e telemetria de legado |
| F-10 | manifesto fresco por request, unknown operation observável, disabled jobs não claimed, concorrência sem double delivery e service binding dry-run |
| F-11 | zero import do schema barrel em módulos, schemas nos owners e guard provado por mutação |
| F-12 | entrypoints separados, tipos únicos/versionados, rollout v1→novo comprovado e mismatch fail-closed |
| F-13 | zero `isMaster`, Owner sem `master:*` e grant operacional tenant-scoped, expirável, revogável e auditado |

---

## 18. Definition of Done

- [ ] F-01..F-13 estão `VERIFIED` no receipt com comando e resultado, não por intenção.
- [ ] Nenhum P0/P1 foi rebaixado ou postergado sem decisão explícita do owner.
- [ ] `clinicId` de toda Action de negócio é derivado de `ActionContext`; payload com selector é rejeitado antes do handler.
- [ ] Repositories tocados exigem clinic no contrato e no predicado.
- [ ] Migrations aplicam em banco vazio e em seed existente; inconsistência aborta sem correção silenciosa.
- [ ] Lint, typecheck, unit, integração, segurança e builds app/Cloudflare estão verdes.
- [ ] Guards estruturais foram provados por mutação e restaurados.
- [ ] Nenhum segredo ou PII entrou em diff, logs, receipt ou fixtures.
- [ ] ADRs descrevem o estado real e a spec canônica continua autoridade.
- [ ] Alterações preexistentes não relacionadas foram preservadas.

---

## 19. Paradas obrigatórias

O executor deve parar e pedir decisão somente nestes casos:

1. `users.is_master = true` para qualquer usuário real antes do drop.
2. Migration encontra relação cross-tenant/órfã em dados reais.
3. Matriz LGPD encontra campo sem decisão de retenção/disposição ou exige interpretação jurídica não aprovada.
4. Telemetria mostra consumidor externo ativo da família `/api/budgets/*` quando alguém tentar removê-la.
5. Conta Cloudflare alvo permanece no Workers Free enquanto o bundle comprimido excede 3 MiB, ou a separação de entrypoints exige ampliar credenciais/custo não autorizado.
6. A implementação exigir mudar framework, auth provider, banco, tenancy ou runtime, o que demanda ADR + aprovação do owner pela spec.

Fora desses casos, avance tarefa por tarefa, corrija regressões dentro do escopo e produza a evidência definida.
