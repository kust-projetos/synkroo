# Synkroo: plano de remediação da auditoria abrangente

> Plano derivado da auditoria somente leitura de 2026-09-02, realizada por dois
> revisores independentes e validada pelo AGY. A fonte de evidência é
> `C:\Users\walis\.gemini\antigravity-cli\brain\88b6a2b9-af47-4a2f-ba61-7b1016233a1c\auditoria_consolidada_synkroo.md`.
> Este documento descreve a próxima tranche de implementação; ele não declara
> nenhum achado como resolvido e não autoriza deploy, migration aplicada ou commit.

## 1. Objetivo

Remediar os riscos confirmados de disponibilidade, privacidade, integridade
financeira, autorização e UX operacional sem diluir as correções em um refactor
amplo. A execução deve preservar o padrão canônico `runAction`, contratos
existentes e isolamento por `clinicId`.

Resultado esperado:

- webhooks WhatsApp/Instagram e widget externo chegam ao handler correto sem
  expor rotas privadas;
- exportação LGPD de um paciente nunca contém dados ou logs de outro paciente;
- pagamentos manuais e de gateway são idempotentes, tenant-scoped e não quitam
  valores acima ou abaixo do devido;
- crons autenticados não são bloqueados por tráfego anônimo;
- fluxos de agenda e conversas não sinalizam sucesso quando a operação falha;
- handlers legados sensíveis deixam de ser somente `login-required`;
- as garantias passam a ter testes de middleware, integração e E2E, não apenas
  mocks unitários.

## 2. Estado inicial confirmado

- Auditoria confirmou P1 no middleware, LGPD, pagamentos manuais, webhook Asaas,
  rotas legadas RBAC, crons e falso sucesso de agendamento.
- O reviewer confirmou que o webhook Asaas está em
  `src/modules/financeiro/gateways/providers/asaas/webhook.ts`, não no caminho
  inicialmente reportado.
- `jest.config.js` mede branches em 55% e functions em 65%, enquanto `AGENTS.md`
  declara cobertura global de 70%; APIs, repositórios e DB estão excluídos de
  parte da métrica.
- Testes de rota chamam handlers diretamente, portanto não executam
  `src/middleware.ts`; testes de integração relevantes requerem
  `RUN_INTEGRATION_TESTS=1` e `npm run test:integration:run`.
- Nenhuma mudança neste plano deve ser atribuída a arquivos já modificados no
  worktree. No início de cada tarefa, registrar `git status --short` e revisar
  apenas o diff de seus arquivos-alvo.

## 3. Decisões e limites

- Não abrir uma rota por conveniência: cada transporte público deve continuar
  autenticado por assinatura, token efêmero ou validação específica no handler.
- Nunca usar `clinicId`, `patientId`, valor, método ou status recebidos do body
  como fonte de autorização; validar contra registros server-side.
- Correções financeiras são forward-only: não reprocessar cobranças, apagar DLQ
  ou alterar registros históricos sem procedimento de reconciliação aprovado.
- A migração de rotas legadas será incremental; a família legada pode permanecer
  como adapter temporário, mas não pode autorizar ou mutar repositório direto.
- Para mudanças que tocam PostgreSQL, usar somente `TEST_DATABASE_URL` loopback
  via `npm run test:integration:run`.
- Não executar deploy real nesta tranche. Dry-run e smoke staging exigem
  autorização posterior e segredos configurados.

## 4. Ordem de execução

As tarefas T1-T3 são hotfixes e devem ser serializadas nos arquivos comuns
(`middleware.ts` e contratos de canais). T4 e T5 podem ocorrer em paralelo após
T2, desde que não compartilhem migrations. T6-T9 fecham a tranche depois dos
contratos críticos estarem estáveis.

### T0. Congelar evidência e criar baseline

**Objetivo:** garantir atribuição honesta de mudanças e provas de regressão.

**Ações:**

- Registrar HEAD, branch, `git status --short` e comandos de baseline no receipt
  da execução, sem sobrescrever esta auditoria.
- Inventariar os arquivos produtivos e testes de cada tarefa antes de editar.
- Criar uma matriz achado -> tarefa -> teste -> evidência de rollout.

**Aceite:** cada PR futuro identifica claramente arquivos, comportamento RED,
GREEN e risco residual; mudanças preexistentes não são atribuídas à tranche.

### T1. Corrigir transportes públicos e cron DoS (P1)

**Arquivos prováveis:**

- `src/middleware.ts`
- `src/middleware.security.test.ts`
- `src/app/api/cron/reminders/route.ts`
- `src/app/api/cron/smart-triggers/route.ts`
- `src/app/api/cron/crm-duplicates/route.ts`
- `src/services/api-handlers/cron/cleanup.ts`
- testes de rota cron correspondentes

**Implementação:**

- Classificar `/api/whatsapp/webhook`, `/api/instagram/webhook` e as rotas do
  widget pela proteção real que possuem: pública apenas para desafio/assinatura,
  e signed transport quando houver HMAC ou token específico.
- Não liberar curingas de `/api/whatsapp/*` ou `/api/widget/*`; listar rotas
  exatas e manter matcher mínimo.
- Em cada cron, validar `Authorization: Bearer <CRON_SECRET>` com comparação
  timing-safe antes de chamar `checkRateLimit`.
- Fazer o rate limiter usar chave que não possa ser consumida por tráfego
  inválido global; rejeições de credencial não devem gastar a quota do scheduler.

**RED/GREEN:**

- Sem sessão, requisição legítima assinada a webhook/widget chega ao handler;
  rota privada ainda redireciona/nega.
- Vinte requisições anônimas ao cron retornam 401/403, e a requisição seguinte
  com secret válido não retorna 429 por essa causa.
- Assinatura ausente, inválida ou expirada nunca alcança efeito de domínio.

**Aceite:** nenhum transporte externo legítimo recebe 307 para `/login`; nenhum
atacante sem secret esgota a quota do cron autenticado.

### T2. Fechar canal Instagram end-to-end (P1)

**Depende de:** T1.

**Arquivos prováveis:**

- `src/modules/atendimento/actions/receber-mensagem.ts`
- schemas/tipos de canais no módulo Atendimento e DB, encontrados por busca
- `src/app/api/instagram/webhook/**`
- testes do webhook e da Action

**Implementação:**

- Incluir `instagram` em todos os contratos de canal necessários, sem casts ou
  bypass de Zod.
- Resolver a instalação e o tenant no servidor pelos metadados do canal; não
  confiar em clínica informada pelo payload Meta.
- Normalizar evento de verificação e evento inbound para a mesma Action canônica.

**Testes:** contrato Zod negativo/positivo; teste de rota assinado; integração
com duas clínicas para provar que uma instalação Instagram não escreve na outra.

**Aceite:** evento válido cria/atualiza somente a conversa da clínica dona da
instalação; evento de clínica desconhecida falha fechado e não persiste dados.

### T3. Conter export LGPD e disposição de dados (P1)

**Arquivos prováveis:**

- `src/modules/operacional/services/lgpd-service.ts`
- testes unitários e de integração LGPD
- `docs/ops/lgpd-data-disposition-matrix.md`, somente se o contrato efetivo
  precisar ser corrigido e aprovado

**Implementação:**

- Filtrar `actionLogs` pela relação verificável com o paciente exportado. Se o
  schema não tem vínculo confiável, omitir logs em vez de exportar a clínica toda
  e abrir follow-up de modelagem/auditabilidade.
- Substituir o `catch` silencioso de `redactAgentQueues` por falha explícita ou
  omissão segura, definida pelo contrato LGPD; nunca retornar fila não redigida.
- Preservar legal hold, lock transacional e registro de auditoria existentes.

**RED/GREEN:**

- Criar pacientes A e B na mesma clínica e logs distintos; export A não contém
  nenhum identificador, payload ou ação de B.
- Forçar falha de redação de fila; resposta não expõe conteúdo bruto.

**Aceite:** há teste de integração real de minimização; exportação cross-patient
é impossível pelo serviço e o erro de redação é observável.

### T4. Corrigir integridade de pagamentos e webhook Asaas (P1)

**Depende de:** T3 apenas para não sobrecarregar a mesma suite de integração;
pode ser desenvolvida em paralelo após a definição de migrations.

**Arquivos prováveis:**

- `src/modules/financeiro/services/payment-service.ts`
- `src/modules/financeiro/actions/registrar-pagamento.ts`
- `src/modules/financeiro/gateways/providers/asaas/webhook.ts`
- `src/modules/financeiro/repositories/financeiro-repository.ts`
- schemas/migrations de charges, payments e `budget_installments`
- testes financeiros unitários e de integração

**Implementação:**

- Calcular saldo devedor sob transação/lock no registro manual. Rejeitar valor
  não positivo e valor acima do saldo; definir arredondamento em decimal, sem
  `number` para montantes persistidos.
- No webhook, comparar valor recebido com a charge server-side, preservar método
  real e paciente associado e aplicar transição condicional de status (CAS).
- Modelar pagamento parcial explicitamente; não marcar `paid` até liquidar o
  valor contratado. Atualizar parcelas no mesmo limite transacional.
- Deduplicar evento por ID externo/idempotency key e tornar estorno/cancelamento
  terminal, sem evento atrasado reverter a decisão.

**RED/GREEN e mutação:**

- Dois pagamentos manuais concorrentes não ultrapassam `budget.totalAmount`.
- Evento duplicado não cria segundo payment nem muda o total.
- PIX parcial não marca charge como `paid`; estorno não volta a `paid` por retry.
- Mutar query removendo `clinicId` ou CAS deve quebrar teste tenant/concurrency.

**Aceite:** nenhum caminho manual ou gateway quita acima do devido, pagamentos
parciais continuam cobrados corretamente e eventos fora de ordem são seguros.

### T5. Preservar settings de clínica e limitar relatórios (P2)

**Arquivos prováveis:**

- `src/services/api-handlers/clinics/settings.ts`
- schema/validação de settings de clínica
- `src/services/api-handlers/reports/patients.ts`
- testes de settings e relatórios

**Implementação:**

- Trocar substituição integral do JSON por schema de campos editáveis e merge
  server-side que preserve credenciais/metadados de canais.
- Mover filtragem de relatório de pacientes para SQL, com paginação/limite e
  agregações adequadas; não carregar toda a clínica na memória do Worker.

**Aceite:** editar horários não remove `whatsapp_phone_number_id`; relatório de
uma clínica grande tem limite, paginação e plano de query que não materializa
pacientes ilimitadamente em JS.

### T6. Corrigir falsos sucessos e conversas operacionais (P1/P2)

**Arquivos prováveis:**

- `src/components/calendar/AppointmentDialog.tsx`
- `src/app/dashboard/conversas/page.tsx`
- `src/lib/hooks/use-queries.ts`
- testes de calendário, conversas e `e2e/conversations.spec.ts`

**Implementação:**

- Tratar `response.ok` e envelope de erro no diálogo de agendamento. Manter modal
  aberta, mostrar toast acessível e invalidar queries somente após sucesso.
- Incluir rollback determinístico da mensagem otimista, estado de retry e toast
  de falha. Adotar polling com intervalo moderado ou canal realtime já suportado;
  evitar polling duplicado por tab.
- Conectar Agendar/Reagendar a uma navegação ou diálogo real, sem botões inertes.

**Testes:** Playwright/integração para 409 de agenda, 500, envio falho, retry e
inbound sem refresh manual.

**Aceite:** falha não fecha modal nem cria mensagem fantasma; usuário obtém
feedback e uma mensagem inbound aparece dentro da janela definida pelo contrato.

### T7. Fechar CTAs, configuração e permissões de UI (P2)

**Arquivos prováveis:**

- `src/app/dashboard/configuracoes/page.tsx`
- `src/app/dashboard/crm/page.tsx`
- `src/app/dashboard/leads/page.tsx`
- `src/app/dashboard/financeiro/financeiro-client.tsx`
- `src/lib/ui/sidebar.tsx`
- manifests de módulos e testes de navegação

**Implementação:**

- Implementar persistência do horário por endpoint canônico; exibir erro de load
  em vez de renderizar defaults como estado confirmado.
- Implementar `?filter=hot`, onboarding de WhatsApp/Instagram e permissão real
  para ações de orçamento; retirar CTA até que exista fluxo funcional.
- Derivar sidebar de permissões e módulos ativos da clínica, preservando defesa
  server-side como autoridade final.

**Aceite:** não há CTA visível sem efeito; reload preserva settings; links e
menus respeitam permissões e módulos, enquanto URL direta continua protegida.

### T8. Migrar rotas legadas sensíveis para autorização canônica (P1)

**Depende de:** T4-T7 podem fornecer Actions reutilizáveis.

**Arquivos prováveis:**

- handlers encontrados por busca de `validateApiAuth()` sem requisito
- `src/core/actions/run.ts`, adapters de rota e testes de autorização
- rotas de clinics/settings, knowledge, reports, campaigns, budgets e
  custom-fields identificadas no inventário

**Implementação:**

- Inventariar todos os handlers sem permissão explícita e classificá-los por
  leitura PHI, escrita, configuração e ação financeira.
- Migrar cada um para Action com `requires`, tenant guard e resposta canônica, ou
  exigir permissão explícita no adapter transicional.
- Retornar `not_found` tenant-scoped para IDs estrangeiros e evitar diferenças
  403/404 que revelem existência quando o contrato exigir opacidade.

**Testes:** matriz por rota: anônimo, autenticado sem permission, usuário da
clínica correta, ID estrangeiro e master onde aplicável.

**Aceite:** busca estática não encontra handler sensível apenas com
`validateApiAuth()`; testes exercitam permissão e isolamento sem mock `can:()=>true`.

### T9. Restaurar qualidade, testes reais e acessibilidade (P2/P3)

**Arquivos prováveis:**

- `jest.config.js`, `AGENTS.md`
- testes de middleware, integração e RBAC/LGPD
- `src/lib/ui/toast.tsx`
- `src/components/calendar/views/MonthView.tsx`
- `src/app/dashboard/**/{error,not-found,loading}.tsx`
- hooks duplicados de toast e pagamentos

**Implementação:**

- Alinhar promessa de cobertura à medição efetiva e incluir superfícies críticas
  progressivamente, sem mascarar queda de cobertura por exclusões novas.
- Criar testes que executem middleware ou um harness equivalente de edge; remover
  tautologias onde mocks já concedem autorização.
- Montar/remover infraestrutura de toast de forma única; corrigir ARIA, teclado e
  rótulos de ícones. Adicionar boundaries/loading onde a ausência gera estados
  vazios enganadores.

**Aceite:** CI mede/documenta o mesmo contrato; regressões de middleware/RBAC
falham; controles interativos são navegáveis por teclado e erros são anunciados.

### T10. Verificação final da tranche

**Gates mínimos:**

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

**Smokes obrigatórios antes de produção:** webhook assinado WhatsApp e Instagram;
cron com e sem secret; exportação LGPD de dois pacientes; pagamento manual,
parcial, duplicado e estornado; agenda 409; envio de conversa com falha; UI de
settings após reload; RBAC em rota legada migrada.

**Aceite final:** todos os REDs descritos passam a GREEN; resultados dos gates,
comandos, exit codes, arquivos tocados e riscos residuais são registrados em um
receipt novo, sem reescrever a auditoria original.

## 5. Riscos e rollback

- **Middleware/canais:** rollback é reverter apenas a regra/adaptador publicado;
  nunca ampliar wildcard público como mitigação rápida.
- **LGPD:** não tentar corrigir exportações passadas sem decisão jurídica e
  procedimento de incidente; correção de código deve ser fail-closed.
- **Financeiro:** rollback de código não desfaz liquidações já persistidas. Criar
  reconciliação auditada e aprovada separadamente antes de qualquer ajuste de
  dados históricos.
- **Settings:** preservar snapshot/merge de chaves desconhecidas; rollback não
  deve substituir JSON inteiro.
- **Frontend:** manter fallback de retry e estados de erro; feature flag de
  polling/realtime deve permitir desativação sem perder mensagens.
- **RBAC:** manter adapters legados durante a janela de compatibilidade, mas com
  a mesma Action; não reduzir checks para restaurar clientes antigos.

## 6. Fora desta tranche

- Redesign visual amplo, revisão de branding ou alteração estética sem relação
  com falha operacional.
- Internacionalização completa: o produto pode permanecer pt-BR enquanto strings
  de acessibilidade críticas são corrigidas.
- Migração total de todos os endpoints legados que não lidam com dados sensíveis;
  criar follow-up após o inventário de T8.
- Deploy de produção, alteração de secrets, execução de migrations em ambiente
  compartilhado, reconciliação retroativa de pagamentos e notificações formais de
  incidente LGPD: requerem autoridade explícita separada.
