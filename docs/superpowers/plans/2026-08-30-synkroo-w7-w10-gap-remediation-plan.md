# Synkroo: plano focado de remediação dos gaps W7-W10

> Plano derivado da auditoria somente leitura executada em 2026-08-30 contra
> `docs/superpowers/plans/2026-08-28-synkroo-architectural-audit-remediation-plan.md`.
> Este documento trata os gaps confirmados no estado atual e não reclassifica o
> receipt histórico como evidência suficiente.

## 1. Objetivo

Fechar os gaps reais encontrados nas tarefas W7, W8, W9 e W10, preservando a
stack atual e evitando ampliar o escopo por inferência.

O resultado esperado desta tranche é:

- nenhuma operação do outbox financeiro consegue selecionar gateway ou charge
  de outra clínica;
- o guard arquitetural valida arestas reais também no Windows e falha quando o
  grafo declarado não corresponde aos imports;
- a família `/api/financeiro/budgets/*` é realmente canônica e a família
  legada chama as mesmas Actions sem acesso direto a repository;
- manifesto, outbox e cron têm escopo, gating e autenticação comprováveis;
- RPC de emissão e execução mantém superfícies separadas, contrato único e
  testes de incompatibilidade suficientes para o rollout.

## 2. Estado inicial confirmado

- HEAD atual: `212e0200a763a658fbfd8232efa4ff42f3ac7c9f` na branch `main`.
- O worktree está sujo por alterações preexistentes e pela remediação anterior.
  Nenhuma limpeza, reset ou revert faz parte deste plano.
- O receipt `docs/superpowers/audits/2026-08-28-architectural-remediation-receipt.md`
  declara W7-W10 como `VERIFIED`, mas a auditoria direta encontrou pendências.
- Teste focado atual: 21 suites e 168 testes passados.
- `npm run lint`, `npm run typecheck`, `npm run typecheck:ia-bridge`,
  `npm run typecheck:ia-agent` e `npm run roadmap:check` passaram.
- Os três dry-runs Wrangler passaram sem deploy. O app gerou gzip de
  `4092.89 KiB`; o plano Workers Free de 3 MiB continua sendo bloqueador
  externo para deploy real.

## 3. Decisões e limites

- O tenant de um job vem de `job.clinicId`, nunca de `job.payload.clinicId`.
- Não adicionar dependências reversas ao grafo somente para acomodar o
  `lgpd-service`. Leituras cross-module devem usar portas públicas ou
  contribuições injetadas por composition root.
- Não remover a compatibilidade `AppService.issueHandle` nem v1 no mesmo
  deploy que introduz o issuer; a remoção é release posterior, após telemetria.
- DELETE de budget/parcelas não será transformado em purge físico sem disposição
  LGPD aprovada. A Action pode ser archive/cancel/tombstone, desde que ambas as
  famílias HTTP usem a mesma semântica.
- Nenhum deploy, commit, push, PR, migration aplicada ou alteração de arquivo
  não relacionado é autorizado por este plano.
- Testes que tocam PostgreSQL devem usar `TEST_DATABASE_URL` loopback e
  `npm run test:integration:run`.

## 4. Ordem de execução

As tarefas são sequenciais nos pontos de contrato. Os testes de cada tarefa
podem ser escritos em paralelo quando não compartilharem os mesmos arquivos.

### T0. Congelar evidência da tranche

**Objetivo:** diferenciar o estado atual das alterações da execução.

**Ações:**

- Registrar HEAD, branch e `git status --short` no receipt somente quando a
  implementação começar; não alterar o receipt durante esta fase de plano.
- Gerar inventário dos arquivos de produção tocados por W7-W10.
- Preservar a lista de alterações já existente e revisar apenas diffs dos
  arquivos da tarefa em execução.

**Aceite:** o executor consegue apontar, para cada tarefa, RED, GREEN,
mutação, arquivos e risco residual sem atribuir mudanças preexistentes à
tranche.

### T1. Isolar o worker financeiro por clínica (P0)

**Arquivos prováveis:**

- `src/modules/financeiro/services/dispatch-charge-job.ts`
- `src/modules/financeiro/repositories/financeiro-repository.ts`
- `src/modules/financeiro/repositories/financeiro-scope-repository.ts`
- `src/modules/financeiro/services/__tests__/charge-race.test.ts`
- `src/modules/financeiro/services/__tests__/charge-service.integration.test.ts`

**Implementação:**

- Criar ou reutilizar `getPaymentGatewayForClinic(gatewayId, clinicId)`.
- Fazer `updatePaymentChargeForClinic` ser a única mutação usada pelo worker.
- Em `dispatchChargeJob`, derivar `clinicId` exclusivamente de `job.clinicId`.
- Validar que gateway, charge, budget e clínica coincidem antes de chamar o
  provider; falhar fechado sem chamada externa quando houver divergência.
- Manter `payload.clinicId` somente como dado legado não confiável, sem usá-lo
  para autorização, provider input ou query.
- Auditar os producers de `financeiro.charge.create/cancel` para garantir que o
  `job.clinicId` acompanha a transaction que cria o job.

**RED/GREEN:**

- Unitário: job da clínica A com `gatewayId` e payload adulterado da clínica B
  não chama provider nem atualiza charge.
- Integração: duas clínicas com gateways e charges distintos; execução de A
  não altera nenhuma linha de B e retorna erro técnico não revelador.
- Rodar:

```bash
npm test -- --runInBand src/modules/financeiro/services/__tests__/charge-race.test.ts src/modules/financeiro/services/__tests__/charge-service.integration.test.ts
npm run test:integration:run -- --runInBand src/modules/financeiro/services/__tests__/charge-service.integration.test.ts
```

**Aceite:** nenhuma query de gateway/charge do dispatcher financeiro usa apenas
ID; uma tentativa cross-tenant deixa o estado da clínica vítima inalterado.

### T2. Tornar o guard de módulos realmente fail-closed (P0)

**Arquivos:**

- `src/__tests__/architecture/test-file-discovery.ts`
- `src/__tests__/architecture/boundary-rules.test.ts`
- `eslint.rules.json`
- `src/core/modules/definitions.ts`
- `src/modules/operacional/services/lgpd-service.ts`

**Implementação:**

- Normalizar separadores com uma conversão que trate `\` simples em todos os
  caminhos retornados pelo discovery.
- Corrigir o matcher de módulo para aceitar tanto `src/modules/...` quanto
  `/src/modules/...`; adicionar fixture explícita de caminho Windows.
- Fazer o guard escanear somente produção e validar cada import cross-module
  contra `moduleDependencies`, permitindo somente `public.ts` e `schema/**`.
- Remover a exceção de `collection-service.ts` ou substituí-la por uma regra
  nominal, documentada e temporária se ela ainda for indispensável.
- Não ampliar `operacional.dependsOn` para esconder o problema de
  `lgpd-service`. Separar a travessia de dados LGPD em portas/contribuições
  tenant-safe dos owners, montadas no composition root, sem imports diretos de
  schemas Financeiro, Followup, Comercial, CRM, IA e Atendimento no serviço
  Operacional.
- Adicionar teste de grafo real que detecte a aresta não declarada e imprima o
  caminho completo quando houver ciclo.

**RED/GREEN e mutação:**

- Reintroduzir temporariamente import de repository interno em outro módulo.
- Reintroduzir temporariamente import do barrel `@/lib/db/schema`.
- Executar cada guard em RED, restaurar, executar em GREEN.
- Provar que a mesma validação funciona com caminho Windows.

```bash
npm run lint
npm run typecheck
npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/modules/__tests__/definitions.test.ts src/core/modules/__tests__/manifest.test.ts
```

**Aceite:** o guard falha de verdade para uma aresta não declarada e a busca
em produção continua sem imports legados ou barrel central.

### T3. Fechar W7.1, W7.2 e W7.4

**Arquivos:**

- `src/core/modules/definitions.ts`
- `src/modules/*/manifest.ts`
- `src/modules/operacional/repositories/patients-repository.ts`
- `src/modules/comercial/repositories/leads-repository.ts`
- `src/modules/crm/services/dispatch-contact-changed-job.ts`
- `src/lib/outbox/operations.ts`
- `src/lib/outbox/worker.ts`
- `src/lib/db/schema/index.ts`
- `src/lib/db/schema/business.ts`
- `src/lib/db/schema/crm.ts`
- `src/lib/db/schema/infra.ts`
- `src/modules/operacional/actions/__tests__/processar-confirmacao-resposta.security.test.ts`

**Implementação:**

- Preservar o grafo aprovado e confirmar todos os oito manifests contra ele.
- Criar contract test producer→handler para `crm.contact.changed`, cobrindo
  patient e lead, payload inválido e `job.clinicId`.
- Limpar mocks/testes que ainda apontam para `@/services` quando a porta pública
  equivalente já existir.
- Manter o barrel central somente como reexport de compatibilidade; nenhum
  arquivo de produção em `src/modules` pode importá-lo.
- Adicionar guard que rejeite schema seam importando root de módulo, Action ou
  código com side effect.

**Aceite:** `CRM_CONTACT_CHANGED` tem producer, tipo compartilhado, handler e
contract test; o scan de produção retorna zero imports legados, zero barrel e
zero arestas fora do grafo.

### T4. Consolidar o adapter HTTP canônico (P1)

**Arquivos:**

- `src/lib/api/action-route.ts`
- `src/lib/api/response.ts`
- `src/modules/*/ui/route-adapter.ts`
- `src/lib/api/__tests__/action-route.test.ts`
- `src/__tests__/api/contract/response-format.test.ts`

**Implementação:**

- Criar uma única função compartilhada para construir contexto, executar
  `runAction`, mapear `ActionErrorCode` e escrever `{ data, meta? }` ou
  `{ error: { code, message, requestId } }`.
- Migrar adapters Financeiro, Comercial, Atendimento, CRM, Operacional e
  Followup para essa função; wrappers de módulo devem apenas configurar owner,
  contexto e serializer.
- Garantir `x-request-id` igual ao request ID do body de erro em sucesso e falha.
- Ocultar mensagem bruta de erro inesperado e manter snake_case somente no
  adapter legado.
- Remover duplicação de `runFinanceiroAction`/`runComercialAction`/
  `runAtendimentoAction` quando não houver comportamento específico real.

**Aceite:** todas as rotas canônicas cobertas pelo inventário usam o mesmo
adapter e os testes provam status, envelope, request ID e erro inesperado.

### T5. Completar o strangler de budgets (P1)

**Arquivos:**

- `src/app/api/financeiro/budgets/**`
- `src/app/api/budgets/**`
- `src/services/api-handlers/budgets/[id].ts`
- `src/services/api-handlers/budgets/[id]/send.ts`
- `src/modules/financeiro/actions/listar-orcamentos.ts`
- novas Actions Financeiro para update/delete budget e registro de payment
- `src/hooks/usePayments.ts`
- `src/lib/hooks/use-queries.ts`

**Implementação:**

- Implementar as Actions faltantes: atualização, archive/cancel ou tombstone,
  `registrarPagamento`, e operações individuais de installment.
- Expor na família canônica os métodos previstos na matriz: PUT/DELETE de
  budget, POST de payments, PATCH/DELETE de installment e remoção do `/status`
  fantasma.
- Fazer `listarOrcamentos` aplicar `patientId`, `page` e `limit`, retornando
  `meta.total` quando o contrato solicitar.
- Converter todos os handlers legados em adapters de Action; nenhum `_handler`
  legado pode importar repository/service para autorizar ou mutar diretamente.
- Remover sequências `getBudget(id)` + comparação em memória. ID estrangeiro
  retorna `not_found` pela Action tenant-scoped.
- Migrar `usePayments` e `useUpdateBudgetStatus` para endpoints canônicos.
- Aplicar `Deprecation`, `Link`, `X-Synkroo-Legacy-Route` e telemetria sem PII
  em todas as rotas legadas, não apenas `/api/budgets/`.

**Testes:**

- Criar `src/__tests__/api/contract/budget-route-parity.test.ts`.
- Criar `src/hooks/__tests__/usePayments.test.tsx`.
- Estender `src/lib/hooks/__tests__/use-queries.test.tsx`.
- Para cada método, cobrir auth, permission, validação, clínica estrangeira,
  sucesso, erro e diferença exclusiva de serializer.

```bash
npm test -- --runInBand src/lib/api/__tests__/action-route.test.ts src/modules/financeiro/__tests__/routes.test.ts src/__tests__/api/contract/response-format.test.ts src/__tests__/api/contract/budget-route-parity.test.ts src/hooks/__tests__/usePayments.test.tsx src/lib/hooks/__tests__/use-queries.test.tsx
```

**Aceite:** cada método da matriz W8.2 existe em ambas as decisões de domínio;
somente envelope/serializer difere e nenhum adapter legado acessa repository.

### T6. Remover o singleton residual do manifesto (P1)

**Arquivos:**

- `src/core/modules/manifest.ts`
- `src/core/actions/context.ts`
- `src/core/modules/gates.ts`
- `src/modules/core/services/modules-service.ts`
- todos os callers de `moduleManifest` encontrados por busca
- `src/core/modules/__tests__/manifest.test.ts`
- testes de rotas que mockam `moduleManifest`

**Implementação:**

- Remover o export público `moduleManifest`; manter somente factory/injeção por
  request, contexto ou batch.
- Migrar rotas, páginas, crons e testes para receber uma instância local.
- Garantir um snapshot por contexto: chamadas internas da mesma request/batch
  compartilham a instância, requests independentes não compartilham cache.
- Não adicionar TTL ou cache global distribuído.
- Adicionar teste que altera o contrato entre duas instâncias e comprova
  observação imediata do estado novo.

**Aceite:** não existe import de `moduleManifest` em produção e o guard falha
se o singleton voltar.

### T7. Endurecer registry e concorrência do outbox (P1)

**Arquivos:**

- `src/lib/outbox/operations.ts`
- `src/lib/outbox/worker.ts`
- `src/lib/outbox/dispatch-outbox.ts`
- `src/lib/outbox/outbox-repository.ts`
- producers Financeiro, Followup, CRM e Atendimento
- `src/lib/outbox/__tests__/*`
- `src/app/api/cron/outbox/route.ts`
- `src/app/api/cron/outbox/route.test.ts`

**Implementação:**

- Manter registry tipado e exatamente uma definição por operação.
- Comparar operações desconhecidas contra o conjunto de operações conhecidas,
  não contra somente as operações atualmente habilitadas.
- Não silenciar falha da consulta de diagnóstico; emitir erro/métrica acionável
  e impedir falsa indicação de fila saudável.
- Preservar `SKIP LOCKED`, lease, retry, DLQ e pool máximo 5.
- Testar módulo/dependência desabilitados sem consumir attempts ou enviar para
  DLQ; handler ausente, operação persistida desconhecida e `limit < concurrency`.
- Criar teste de dois workers concorrentes com o mesmo backlog e provar ausência
  de double delivery.
- Fazer o `GET /api/cron/outbox` exigir o mesmo `CRON_SECRET` ou removê-lo; não
  expor lista de operações publicamente.

**Aceite:** operação desconhecida é observável, job desabilitado permanece
`pending`, dois workers não entregam duas vezes e todos os métodos cron exigem
autorização.

```bash
npm test -- --runInBand src/lib/outbox/__tests__ src/app/api/cron/outbox/route.test.ts src/__tests__/cloudflare/opennext-queue-config.test.ts
npm run test:integration:run -- --runInBand src/lib/outbox/__tests__/outbox.integration.test.ts src/lib/outbox/__tests__/dispatch-outbox.integration.test.ts
```

### T8. Fechar capability e contrato RPC IA (P1)

**Arquivos:**

- `src/core/agent-bridge/rpc-contract.ts`
- `src/core/agent-bridge/bridge-service.ts`
- `src/core/ia-agent/types.ts`
- `src/core/ia-agent/orchestrator-logic.ts`
- `src/workers/ia-bridge/index.ts`
- `src/workers/ia-agent/index.ts`
- `src/core/agent-bridge/__tests__/*`
- `src/workers/ia-bridge/__tests__/index.test.ts`
- `src/workers/ia-agent/__tests__/index.test.ts`
- `docs/runbooks/ia-rpc-rollout.md`

**Implementação:**

- Remover DTOs duplicados exportados por `bridge-service.ts`; usar os tipos do
  `rpc-contract.ts`, com tipos internos derivados por `Omit` quando necessário.
- Manter `HandleIssuerBinding` somente com `issueHandle` e `AppBinding` sem
  `issueHandle`.
- Preservar `AppService.issueHandle` somente durante a janela de compatibilidade
  v1 definida no runbook.
- Cobrir handshake `ping` por turno, versão desconhecida antes de `IA_SEEN`,
  issuer indisponível, handle expirado/forjado e replay de idempotency key.
- Adicionar teste de surface negativo para impedir que bindings trocados
  reintroduzam capability indevida.
- Regenerar os três arquivos `worker-configuration.d.ts` somente durante a
  implementação, usando `wrangler types`; registrar o diff gerado.

**Gate de bundle:** o dry-run do app deve ser registrado. Com gzip acima de
3 MiB, parar antes de deploy e obter decisão sobre redução do bundle ou plano
Workers pago. Nenhum deploy real pode ser inferido do dry-run.

```bash
npm test -- --runInBand src/core/agent-bridge src/workers/ia-bridge src/workers/ia-agent
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
npx wrangler deploy --dry-run --env staging --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc
npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc
```

**Aceite:** não há DTO RPC manual duplicado, mismatch não toca idempotência nem
Action, e o rollout documenta claramente o bloqueio de bundle e a ordem de
rollback.

### T9. Verificação final da tranche

**Gates:**

```bash
npm run lint
npm run typecheck
npm test -- --runInBand src/__tests__/architecture/boundary-rules.test.ts src/core/modules/__tests__/definitions.test.ts src/core/modules/__tests__/manifest.test.ts src/lib/api/__tests__/action-route.test.ts src/__tests__/api/contract/response-format.test.ts src/__tests__/api/contract/budget-route-parity.test.ts src/lib/outbox/__tests__ src/core/agent-bridge src/workers/ia-bridge src/workers/ia-agent
npm run test:integration:run -- --runInBand src/lib/outbox/__tests__/outbox.integration.test.ts src/lib/outbox/__tests__/dispatch-outbox.integration.test.ts
npm run test:security
npm run verify
npm run build
npm run build:cf
git diff --check
```

**Provas por mutação obrigatórias:**

- import cross-module não declarado;
- import de barrel central;
- caminho Windows no discovery;
- `getPaymentGateway` ou update de charge sem clínica;
- adapter legado chamando repository;
- `GET` cron sem secret;
- DTO/capability RPC incompatível;
- operação outbox desconhecida ou handler ausente.

**Aceite final:** cada mutação produz RED com mensagem acionável, a restauração
produz GREEN, os gates passam e o receipt registra comandos, exit codes,
arquivos e riscos sem apagar o histórico do worktree.

## 5. Riscos e rollback

- **Tenant financeiro:** rollback somente revertendo a mudança de código antes
  do deploy; não reprocessar jobs sem confirmar clínica e idempotência.
- **Boundary/schema:** preservar os barrels de compatibilidade; rollback deve
  manter o guard anterior ativo, nunca remover toda a proteção para fazer lint
  passar.
- **HTTP:** manter adapters legados durante a janela de observação; não fazer
  redirect 301/302 em mutações.
- **Outbox:** não resetar attempts nem apagar DLQ; qualquer correção de jobs
  existentes deve ser forward-only e auditada.
- **RPC:** rollback antes da remoção v1 é `agent -> app -> bridge`; após a
  remoção, redeployar bridge compatível antes de voltar app/agent antigos.
- **Cloudflare:** bundle acima do limite do plano e qualquer binding ausente
  bloqueiam deploy; dry-run não substitui smoke staging.

## 6. Fora desta tranche

Os seguintes pontos foram confirmados na auditoria, mas devem permanecer em
follow-up separado para não diluir W7-W10:

- `exportPatientData` inclui `actionLogs` da clínica inteira em
  `src/modules/operacional/services/lgpd-service.ts:266,304,365`;
- `src/services/api-handlers/cron/cleanup.ts:38-64` ainda não cobre toda a
  política de retenção;
- `assertConsentVersion` não possui uso produtivo comprovado;
- o caminho alternativo de inbound em
  `src/modules/atendimento/services/webhook-processor-service.ts` ainda deve
  ser tratado na tranche F-06.

Esses itens não podem ser marcados como resolvidos por este plano nem usados
como justificativa para ampliar dependências do grafo W7.
