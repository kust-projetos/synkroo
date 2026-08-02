# Synkroo: spec canônica de produto e arquitetura

**Versão:** 1.0  
**Data:** 2026-07-28  
**Status:** canônica e vigente por aprovação do owner; primeiro commit pós-contenção deve integrá-la  
**Owner:** Walis  
**Substitui direção de:** roadmap 2026-06-17, PRDs antigos, MVP checklist e decisões verbais
**Baseline auditado:** `f7be12f8a23b7519bfebbdf201b6e06a2bf92e1c`

## 1. Autoridade e controle de mudança

Ordem de autoridade:

1. Esta spec define produto e arquitetura alvo.
2. ADRs ativos refinam decisões técnicas sem contradizer requisitos.
3. Plano mestre define ordem de execução.
4. Código, migrations e testes demonstram estado atual, não alteram objetivo por acidente.
5. Documentos antigos servem somente como pesquisa/histórico.

Mudança de direção exige:

1. Evidência nova reproduzível.
2. ADR com contexto, decisão, alternativas, impacto e rollback.
3. Alteração desta spec e do plano no mesmo PR.
4. Aprovação do owner para escopo, autonomia IA, tenancy, canais ou dados clínicos.

Agente não pode trocar framework, banco, auth, runtime, tenancy, provider principal ou boundary
sem esse processo.

## 2. Produto

Synkroo é plataforma operacional para clínicas odontológicas, entregue como serviço gerenciado.
Primeira versão pronta deve fechar plataforma ampla antes do piloto: operação clínica,
atendimento, IA, comercial, CRM, retenção, financeiro, analytics, administração e LGPD.

**Cliente** = deployment + PostgreSQL dedicados. **Clínica** = unidade operacional dentro do
cliente. **Usuário** = identidade única por cliente; clínica padrão orienta login e acesso efetivo
vem de `userClinicAccess`. **Instância** = recursos técnicos dedicados ao cliente.

### Personas

| Persona | Resultado esperado |
|---|---|
| Owner | controlar operação, acesso, receita, risco e desempenho |
| Administrador | configurar clínica, equipe, canais, catálogo e rotinas |
| Recepcionista | atender, cadastrar, agendar, confirmar e reagendar |
| Dentista | consultar agenda, paciente e tratamento permitido |
| Comercial | gerir lead, pipeline, tarefas, orçamento e follow-up |
| Operador Synkroo | provisionar fora do app e prestar suporte temporário auditado |
| Agente IA | operar somente Actions permitidas e políticas de risco |
| Paciente/responsável | consentir, falar com IA, agendar, pagar, pedir humano e exercer direitos |

### Escopo v1

| Área | Incluído |
|---|---|
| Core | auth, clínicas, usuários, RBAC, módulos, audit seguro |
| Operacional | pacientes, dentistas, procedimentos, agenda, waitlist, tratamentos |
| Atendimento | conversas, mensagens, templates, Evolution e chat widget |
| IA | conversa, tools, memória de sessão, confirmação por risco, knowledge base |
| Follow-up | lembretes, inativos, segmentos, campanhas e orçamento pendente |
| Comercial | leads, pipeline, tarefas, conversão e hot leads |
| CRM | contato unificado read model, timeline, notas, tags e deduplicação |
| Financeiro | orçamentos, parcelas, pagamentos, cobrança e Asaas |
| Gestão | dashboard, analytics, relatórios, configurações e canais |
| Compliance | consentimento, exportação, anonimização, retenção e auditoria |

Tratamento v1 inclui plano, itens, sessões e estados. Financeiro v1 inclui orçamento, parcelas,
cobrança, pagamento e conciliação Asaas. Prontuário completo, odontograma, prescrição,
contabilidade, contas a pagar, DRE, tesouraria e fluxo de caixa ficam fora.

### Fora da v1

- Instagram, Telegram, e-mail, SMS e call center.
- Marketing social, Meta Ads e geração de posts.
- Cadastro público/self-service.
- App mobile nativo.
- Pi Finance dentro do Synkroo.
- Infra compartilhada entre clientes independentes.
- Microservices por domínio.

## 3. Requisitos funcionais

### Core e tenancy

- **REQ-CORE-01 (ubiquitous):** O sistema shall executar cada cliente em Worker e PostgreSQL dedicados.
- **REQ-CORE-02 (state-driven):** Enquanto cliente possuir várias clínicas, o sistema shall isolar dados por `clinicId` e permitir acesso explícito multi-clínica.
- **REQ-CORE-03 (event-driven):** Quando operação autenticada iniciar, o sistema shall derivar actor e clínica do contexto confiável.
- **REQ-CORE-04 (unwanted):** Se payload tentar escolher outra clínica, então o sistema shall rejeitar sem executar handler.
- **REQ-CORE-05 (event-driven):** Quando usuário for desativado, o sistema shall revogar acesso ativo imediatamente.
- **REQ-CORE-06 (event-driven):** Quando operador provisionar cliente, o processo shall criar instância, owner, RBAC e módulos por identidade operacional autenticada e auditada.
- **REQ-CORE-07 (unwanted):** Se permission ou módulo estiver ausente, então o sistema shall negar acesso.
- **REQ-CORE-08 (state-driven):** Enquanto onboarding gerenciado estiver vigente, `/signup` e `/api/auth/signup` shall retornar 404 em produção.
- **REQ-CORE-09 (event-driven):** Quando usuário trocar clínica, o sistema shall trocar contexto atomicamente, exibir clínica ativa e invalidar dados scoped anteriores.

### Operação clínica

- **REQ-OPS-01 (event-driven):** Quando staff salvar paciente válido, o sistema shall persistir cadastro único na clínica ativa.
- **REQ-OPS-02 (event-driven):** Quando consulta for criada ou movida, o sistema shall impedir conflito de profissional e horário no banco.
- **REQ-OPS-03 (event-driven):** Quando horário ficar livre, o sistema shall permitir convocar waitlist elegível sem duplicidade.
- **REQ-OPS-04 (unwanted):** Se item de tratamento não pertencer ao plano e clínica, então o sistema shall rejeitar atualização.
- **REQ-OPS-05 (event-driven):** Quando consulta mudar de estado, o sistema shall registrar transição e actor.
- **REQ-OPS-06 (event-driven):** Quando sessão de tratamento repetir ou concorrer, o sistema shall aplicar efeito uma vez e manter contador consistente.

### Atendimento e canais

- **REQ-ATD-01 (event-driven):** Quando Evolution entregar mensagem válida, o sistema shall persistir uma única mensagem e atualizar conversa.
- **REQ-ATD-02 (event-driven):** Quando widget entregar mensagem válida, o sistema shall usar mesmo pipeline de conversa.
- **REQ-ATD-03 (event-driven):** Quando webhook válido chegar, o sistema shall derivar clínica somente de instância, credencial ou channel ID registrado; payload público não seleciona clínica.
- **REQ-ATD-04 (state-driven):** Enquanto Evolution estiver indisponível, o sistema shall enfileirar retry ou falhar visivelmente, nunca simular envio.
- **REQ-ATD-05 (ubiquitous):** O sistema shall entregar sidecar Playwright isolado, desabilitado por default e ativado somente por operador autorizado.
- **REQ-ATD-06 (event-driven):** Quando conversa automatizada iniciar, o agente shall identificar-se como IA e oferecer takeover humano.

### Agente IA

- **REQ-IA-01 (event-driven):** Quando mensagem chegar, o agente shall usar somente tools derivadas do registry permitido.
- **REQ-IA-02 (state-driven):** Enquanto ação for leitura ou comunicação pré-aprovada, o agente shall poder executar sem aprovação adicional.
- **REQ-IA-03 (event-driven):** Quando ação alterar agenda reversivelmente, o agente shall usar proof server-side vinculado a actor, conversa, Action, payload, clínica, TTL e uso único.
- **REQ-IA-04 (unwanted):** Se ação envolver dinheiro, exclusão, LGPD, acesso ou merge, então o agente shall exigir aprovador com permission explícita e aprovação vinculada a payload imutável, TTL, decisão e uso único.
- **REQ-IA-05 (unwanted):** Se provider, bridge ou DB falhar, então o agente shall falhar fechado e preservar contexto.
- **REQ-IA-06 (event-driven):** Quando knowledge base for consultada, o sistema shall recuperar dados da clínica via pgvector.
- **REQ-IA-07 (unwanted):** Se mensagem envolver sintoma, diagnóstico, medicação ou urgência, então o agente shall evitar orientação clínica não aprovada e escalar conforme protocolo.

### Comercial, CRM e retenção

- **REQ-COM-01 (event-driven):** Quando lead entrar por canal, o sistema shall deduplicar, pontuar e posicionar no pipeline.
- **REQ-COM-02 (event-driven):** Quando lead converter, o sistema shall criar ou vincular paciente sem duplicar contato.
- **REQ-CRM-01 (ubiquitous):** O CRM shall apresentar read model unificado sem assumir ownership de pacientes ou leads.
- **REQ-CRM-02 (event-driven):** Quando merge for aprovado, o sistema shall executar transação tenant-scoped e manter redirect do loser.
- **REQ-FUP-01 (event-driven):** Quando regra de follow-up vencer, o sistema shall criar execução idempotente.
- **REQ-FUP-02 (unwanted):** Se nenhum recipient for entregue, então campanha shall terminar como falha, não concluída.

### Financeiro e gestão

- **REQ-FIN-01 (event-driven):** Quando cobrança for criada, o sistema shall usar provider configurado e valor calculado no servidor.
- **REQ-FIN-02 (unwanted):** Se provider estiver ausente, então o sistema shall falhar sem gerar URL, PIX ou ID fictício.
- **REQ-FIN-03 (event-driven):** Quando webhook Asaas autenticado chegar, o sistema shall derivar clínica do gateway e persistir evento único + transição da cobrança local em uma transaction.
- **REQ-GES-01 (ubiquitous):** Dashboard shall exibir somente métricas derivadas de dados reais e período explícito.
- **REQ-GES-02 (event-driven):** Quando usuário exportar relatório, o sistema shall aplicar clínica, permission e redaction.

### LGPD e segurança

- **REQ-LGPD-01 (event-driven):** Quando anonimização autorizada for confirmada, o sistema shall executar transação única e auditável.
- **REQ-LGPD-02 (ubiquitous):** O sistema shall minimizar PII em logs, traces, errors e payloads de auditoria.
- **REQ-LGPD-03 (state-driven):** Enquanto retenção legal estiver vigente, o sistema shall bloquear purge incompatível e registrar fundamento.
- **REQ-LGPD-04 (event-driven):** Antes do primeiro contato não transacional, o sistema shall exigir consentimento ativo ou base legal documentada e registrar finalidade, versão, canal, actor e timestamp.
- **REQ-LGPD-05 (event-driven):** Quando paciente solicitar opt-out, campanhas, follow-up e IA shall suprimi-lo antes de novo contato não transacional.
- **REQ-SEC-01 (ubiquitous):** Todo recurso shall validar auth, permission, módulo, clínica e ownership no servidor.
- **REQ-SEC-02 (event-driven):** Quando secret for exposto, o processo shall bloquear release, rotacionar e sanear histórico.
- **REQ-SEC-03 (unwanted):** Se input exceder schema ou limite, então o sistema shall rejeitar antes de regra e persistência.
- **REQ-SEC-04 (ubiquitous):** Scripts administrativos shall ser import-safe, fail-closed, dry-run por default e exigir `--apply` explícito.
- **REQ-SEC-05 (event-driven):** Quando sessão, senha, role ou estado do usuário mudar, o sistema shall revogar tokens incompatíveis.
- **REQ-SEC-06 (unwanted):** Se request cookie-authenticated sensível falhar validação de origem/CSRF, então o sistema shall rejeitar antes da Action.

## 4. Decisões técnicas

| ID | Decisão | Razão | Rejeitado |
|---|---|---|---|
| ADR-BASE-01 | modular monolith por bounded context | menor custo e boundaries testáveis | microservices |
| ADR-BASE-02 | Next.js 15/OpenNext em Worker | base atual e deploy alvo | troca de framework |
| ADR-BASE-03 | PostgreSQL 17 + Drizzle + `pg` + Hyperdrive | stack real e madura | Supabase, `postgres.js` |
| ADR-BASE-04 | pgvector como vector store único v1 | uma fonte, transação e dimensão única | Vectorize simultâneo |
| ADR-BASE-05 | NextAuth v4 + `AUTH_SECRET` único >=32 bytes | elimina JWT/cookie paralelo | `JWT_SECRET`, auth manual |
| ADR-BASE-06 | Action Layer como entrada de negócio | UI e IA compartilham policy | regra em route handler |
| ADR-BASE-07 | Durable Object atual condicionado a smoke | evita migração sem dor real | Agents SDK preventivo |
| ADR-BASE-08 | Evolution provider principal | operação compatível com Workers | browser no Worker |
| ADR-BASE-09 | Playwright sidecar entregue, default off | browser exige Node/processo persistente | bundle OpenNext |
| ADR-BASE-10 | API `camelCase` com `{ data, meta? }` | contrato uniforme e tipado | snake_case/envelopes ad hoc |
| ADR-BASE-11 | onboarding gerenciado | modelo de serviço e menor attack surface | signup público v1 |
| ADR-BASE-12 | audit allowlist | minimização LGPD | payload bruto + denylist |
| ADR-BASE-13 | Cloudflare Queues para jobs externos | retry/DLQ at-least-once | queue direct, DO como fila geral |
| ADR-BASE-14 | sem Master permanente no banco clínico | menor privilégio e LGPD | `isMaster` standing access |

## 5. Arquitetura alvo

```text
Cliente dedicado
├── app Worker: Next.js, auth, API, UI, Actions
├── ia-bridge Worker: RPC autenticado, tool policy, Hyperdrive
├── ia-agent Worker: Durable Object por conversa
├── PostgreSQL 17: dados, audit mínimo, pgvector
├── Cloudflare Queues: jobs, retries, DLQ e idempotência
└── Playwright sidecar Node: entregue, isolado e default off

Externos
├── Evolution API
├── Asaas
└── LLM provider via adapter configurado
```

### Boundary rules

1. `app/api` transporta; não contém regra de negócio.
2. UI e IA chamam Action; Action valida input/policy e delega service.
3. Service mantém invariantes; repository faz Drizzle tenant-scoped.
4. Módulo importa somente interface pública de outro módulo.
5. Integração externa passa por adapter, timeout e contrato Zod.
6. Side effects assíncronos usam idempotency key e estado observável.
7. Entidade com `clinicId` nunca é lida/escrita somente por ID.

## 6. Jornadas canônicas

Cada linha fixa ator, resultado, negativo obrigatório e evidência mínima; detalhamento não pode
reduzir esses quatro elementos.

| ID | Ator → resultado final | Negativo obrigatório | Evidência |
|---|---|---|---|
| J-01 | operador → owner completa consulta teste | provisionamento parcial | smoke + E2E |
| J-02 | owner → acesso/troca/revogação efetivos | role cross-clinic | E2E + integration |
| J-03 | paciente → conversa única Evolution/widget | assinatura/replay inválido | contract + E2E |
| J-04 | recepção → ciclo agenda/waitlist fechado | conflito/duplicidade | E2E + DB race |
| J-05 | paciente/IA → R0-R3/takeover corretos | replay/urgência/provider down | safety eval + E2E |
| J-06 | comercial → lead até cobrança conciliada | duplicate/falha parcial | E2E + race |
| J-07 | comercial → campanha consentida entregue | opt-out/100% falha | E2E + Queue |
| J-08 | owner → direito LGPD concluído | sem permission/legal hold | E2E + purge proof |
| J-09 | owner → métricas por clínica corretas | timezone/fonte stale | metric contract |
| J-10 | operador → serviços recuperados sem perda | Evolution/LLM/DB/sidecar down | fault injection |
| J-11 | operador → import aplicado ou revertido | linhas inválidas/replay | dry-run + E2E |
| J-12 | owner → export/revogação/destruição | retenção vigente | runbook exercise |

## 7. Contratos

### HTTP

```ts
type ApiSuccess<T> = { data: T; meta?: { cursor?: string; total?: number } };
type ApiFailure = { error: { code: string; message: string; requestId: string } };
```

- JSON e TypeScript usam `camelCase`.
- IDs são UUID; datas são ISO 8601 UTC; timezone da clínica formata/executa agenda.
- Listagens possuem paginação e limites.
- Webhooks preservam raw body para assinatura.

### Risco IA

| Nível | Exemplos | Regra |
|---|---|---|
| R0 | consultar disponibilidade, ler dados permitidos | autônomo |
| R1 | responder template, criar nota | autônomo com audit mínimo |
| R2 | criar/reagendar consulta | confirmar intenção/identidade |
| R3 | cobrança, merge, anonimização, acesso, exclusão | humano autorizado |

## 8. Qualidade e aceite

| Gate | Meta v1 |
|---|---|
| Lint/typecheck | zero erro e zero warning |
| Unit/contract | 100% verde |
| Coverage | >=80% em código novo; global sobe sem regressão até 80% |
| Integration | PostgreSQL 17 real; isolamento, constraints e concorrência |
| E2E | jornadas críticas reais, sem catch/tautologia/skip por defeito |
| Mutation | >=70% em auth, RBAC, Actions, financeiro e LGPD |
| Security | zero critical/high explorável; secret scan de árvore e histórico |
| Runtime | app + bridge + agent + pacote sidecar; cenário enabled testado |

## 9. Critério de plataforma pronta

Candidato v1 pode iniciar piloto somente quando:

1. P0 de segurança encerrados e credenciais rotacionadas.
2. Contratos UI/API das áreas em escopo passam por contract tests.
3. J-01 a J-12 passam em staging com evidência nominal definida na tabela.
4. App, bridge, agent e sidecar passam smoke integrado.
5. Deploy staging executa migration, rollout, smoke e rollback ensaiado.
6. Toda capacidade baseline v1 está funcional; beta não conta como entregue e disabled significa contrato, não implementação parcial.

V1 pode entrar em go-live somente após piloto executar J-01 a J-12, sem defect Sev-0/Sev-1,
e owner aprovar scorecard de segurança, operação, acessibilidade, performance e produto.
