# Eixo 2 — Agente IA: Orquestrador (slice ponta-a-ponta) — Design

> **Tipo:** Spec de design (módulo IA, primeira fatia). Deriva do W5 (`docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md`, Tasks 2+3) e do roadmap-mestre §8/§10.
> **Data:** 2026-06-24
> **Status:** Aprovado em brainstorming (2026-06-24). Próximo passo: plano de implementação (writing-plans).
> **Escopo:** apenas esta fatia (esqueleto + Action Layer + canais). RAG, memória, 4+1 e gestão do agente são fases futuras, fora deste documento.

---

## Goal

Entregar a **primeira fatia ponta-a-ponta** do Agente IA do Synkroo: um **orquestrador único** rodando como Cloudflare **Durable Object** (Agents SDK), que recebe mensagens por **dois canais** (WhatsApp inbound autônomo e chat interno autenticado), entende a intenção via **LLM pluggable (OpenCode Zen)**, executa operações reais **exclusivamente pela Action Layer** (as ~69 Actions já registradas viram tools via `agentToolsFor(ctx)`) e responde pelo canal de origem — com **persona dinâmica** conforme o tipo de interlocutor e **permissões herdadas do principal**.

Esta fatia satisfaz o critério de "Onda 1 concluída" do sequenciamento (`2026-06-21-eixo2-sequenciamento-design.md` §4): paciente manda WhatsApp → agente entende → agenda/confirma via Action → registra → responde, no runtime Cloudflare via Action Layer com RBAC/entitlement aplicados.

## Architecture

Orquestrador único (`AgentOrchestrator extends Agent`, Cloudflare Agents SDK) — cada instância é um Durable Object globalmente único por conversa (`getAgentByName`). As duas entradas (WhatsApp `system`, chat interno `delegated`) **convergem no mesmo DO**, diferindo só no `ActionContext`. O loop LLM↔tools e a persistência são escritos uma vez. O LLM fica atrás de uma abstração pluggable (adapter OpenCode Zen, OpenAI-compatible). Estado de sessão no DO storage; registro durável de mensagens no Postgres (`conversations`/`messages`) via Actions do Atendimento. Sem tools paralelas — capacidades = Actions.

## Tech Stack

Cloudflare Agents SDK + Durable Objects (runtime Workers via OpenNext); LLM via OpenCode Zen (gateway OpenAI-compatible, `https://opencode.ai/zen/v1`); Action Layer (`runAction`, `agentToolsFor`, `buildSystemContext`/`buildDelegatedContext`); Hyperdrive (Postgres na borda); Evolution API (canal WhatsApp, preservado). TypeScript 5.6, Jest (unit), integração via runtime Workers.

---

## Decisões fixadas (brainstorming 2026-06-24)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Fatia a especificar | Slice ponta-a-ponta (esqueleto + Action Layer + canais) — W5 Tasks 2+3 |
| 2 | Runtime/estado | **Durable Object nativo** (Agents SDK) desde o início; estado no DO storage; dev/test via `wrangler dev`/`preview:cf` |
| 3 | LLM default | **OpenCode Zen** (OpenAI-compatible); abstração pluggable; `model`/`baseURL`/`apiKey` por env; modelo com tool-calling |
| 4 | Escopo 4+1 | **Só o orquestrador** (1 agente); os 4 especialistas ficam para o gap-fill |
| 5 | Entradas | **WhatsApp inbound (system) + chat interno (delegated)** juntos |
| 6 | Permissões | `ctx` filtra as tools; chat interno = perms reais do usuário; WhatsApp = role Agente; cliente/paciente = contato, não principal |
| 7 | Comportamento | **Persona dinâmica** no orquestrador único: resolução de interlocutor (lead/paciente/desconhecido/funcionário) seleciona system prompt + contexto injetado |

---

## Escopo

**Inclui:**
- Módulo `src/modules/ia/` (template canônico Eixo 2: manifest, permissions, index).
- `AgentOrchestrator` (DO) com loop LLM↔tools e guard anti-loop.
- Abstração LLM pluggable + adapter OpenCode Zen.
- Acionamento por WhatsApp inbound (via webhook Evolution já existente) e chat interno (`/api/ia/chat`).
- Resolução de interlocutor + persona dinâmica (versão mínima).
- Persistência de mensagens via Actions do Atendimento; estado de sessão no DO.
- Provisionamento do DO no `wrangler.toml`; env do Zen.
- Testes unit (provider, loop, resolução) + integração (chat e inbound contra Actions reais).

**Não inclui (fases futuras):** ver §Não-objetivos.

---

## Componentes — `src/modules/ia/`

| Arquivo | Papel | Depende de |
|---|---|---|
| `agent/orchestrator.ts` | `class AgentOrchestrator extends Agent`. Lifecycle: `onRequest` (chat HTTP) e método de inbound (canal). Carrega sessão (DO), resolve persona, monta `agentToolsFor(ctx)`, roda o loop LLM↔tools, persiste mensagens via Actions. | Agents SDK, `provider`, `interlocutor`, `agentToolsFor`, Actions atendimento |
| `llm/provider.ts` | Abstração pluggable: `complete(messages, tools) → { text, toolCalls }`. Adapter OpenAI-compatible → OpenCode Zen. Traduz `AgentTool[]` ↔ formato function-calling. | `@/lib/env`, fetch |
| `agent/interlocutor.ts` | Resolução de interlocutor: telefone → paciente (`operacional.obterPaciente`/repo) · telefone → lead (query `leads`, schema crm) · senão desconhecido; chat interno → funcionário (role do usuário). Devolve `{ type, persona, context }`. | repo patients, schema crm leads |
| `agent/personas.ts` | Mapa estático `tipo → system prompt` (vendas/relacionamento/recepção/gestão). Puro, sem efeito. | — |
| `channel/inbound.ts` | Resolve `clinicId` pela instância/número (Evolution) → `buildSystemContext` → despacha pro DO. Reusa dedup por `externalMessageId`. | `buildSystemContext`, atendimento |
| `ui/route-adapter.ts` + rota `/api/ia/chat` | Rota autenticada gated por `withModuleRoute('ia')` → `buildDelegatedContext(userId, clinicId)` → DO. | gates, `buildDelegatedContext` |
| `manifest.ts` · `permissions.ts` · `index.ts` | Plumbing canônico do módulo (entitlement `ia`, permissões, barrel). | core |

**Identidade do DO:** nome = `${clinicId}:${channel}:${peerId}` (peerId = telefone no WhatsApp, ou `conversationId`/`userId` no chat). Globalmente único → a mesma conversa cai sempre na mesma instância.

---

## Fluxos

### WhatsApp inbound (autônomo, principal = Agente)
```
Evolution webhook (rota já gated p/ atendimento, assinatura/secret validados)
  → channel/inbound: resolve clinicId (instância/número) + dedup externalMessageId
  → buildSystemContext(clinicId)                 [perms do role Agente]
  → getAgentByName(IA_AGENT, clinicId:whatsapp:phone)
  → orchestrator.handleInbound:
       interlocutor.resolve(phone) → { type, persona, context }
       persiste msg inbound (Action atendimento.receberMensagem)
       tools = agentToolsFor(ctx)
       loop: LLM(persona prompt + context + tools) ⇄ toolCalls → runAction(...)  [guard anti-loop]
       persiste + envia resposta (Action atendimento.enviarMensagem)
```

### Chat interno (autenticado, principal = usuário)
```
POST /api/ia/chat  (withModuleRoute('ia'), sessão autenticada)
  → buildDelegatedContext(userId, clinicId)      [tools = perms reais do usuário]
  → getAgentByName(IA_AGENT, clinicId:chat:userId)
  → orchestrator.handleChat: persona "funcionário/gestão"
       mesmo loop LLM↔tools → resposta (stream opcional)
```

Ambos chamam o mesmo loop interno; só mudam `ctx` (system vs delegated) e a persona inicial.

---

## Resolução de interlocutor & persona

Etapa no início do fluxo que classifica o interlocutor e seleciona persona + contexto:

| Tipo | Identificação | Persona / objetivo |
|---|---|---|
| Lead | WhatsApp; número bate na tabela `leads` (crm) | Vendas/SDR — qualificar, agendar avaliação |
| Paciente | WhatsApp; número bate em `patients` | Relacionamento/clínico — agenda, retorno, follow-up |
| Desconhecido | WhatsApp; sem match | Recepção/qualificação — identificar, potencial lead |
| Funcionário | Chat interno (usuário logado) | Gestão/operação — tarefas internas |

A persona injeta apenas o **system prompt** e o **contexto** (dados do paciente/lead). Não há sub-agentes, roteador, nem modelos distintos — cada persona é candidata a virar um especialista 4+1 no gap-fill, sem reescrever o orquestrador.

---

## Permissões & segurança

- **O `ctx` é a fronteira de capacidade.** `agentToolsFor(ctx)` filtra as Actions por `hasModule(action.module) && can(action.requires)`; o LLM só enxerga o que o principal pode usar. Se mesmo assim chamar algo proibido, `runAction` rebate com `forbidden`. Dupla barreira.
- **Chat interno → principal = usuário logado.** `buildDelegatedContext` resolve perms reais (Administrador vê tudo do contratado; Recepcionista só operacional+atendimento; Dentista +`followup:view`; Comercial comercial+followup). O agente faz exatamente o que aquele usuário poderia na mão. Zero escalonamento.
- **WhatsApp → principal = role Agente (`buildSystemContext`).** O cliente/paciente **não é principal e não tem RBAC** — é o contato da conversa. O agente age com as permissões que a clínica concede ao role Agente (`getAgentPermissions(clinicId)`). Um paciente nunca ganha privilégio mandando mensagem.
- No slice, **um único role Agente por clínica** (configuração fina = fase Gestão do Agente).
- Webhook WhatsApp já validado (assinatura/secret) pelo Atendimento; idempotência reusa dedup por `externalMessageId`. Rota de chat gated + autenticada. Guard anti-loop + timeout no tool-calling. Toda Action auditada em `action_logs` (`principalType` `system`/`agent_delegated`).

---

## LLM pluggable (OpenCode Zen)

- `provider.ts` expõe `complete(messages, tools) → { text, toolCalls }`. Adapter OpenAI-compatible (`POST {baseURL}/chat/completions`), tools no formato function-calling traduzido de `AgentTool[]`.
- Env: `OPENCODE_ZEN_API_KEY`, `IA_LLM_MODEL` (ex.: `opencode/<model-id>`), `IA_LLM_BASE_URL` (default `https://opencode.ai/zen/v1`). Sem hardcode; validado em `@/lib/env`.
- **Loop:** monta mensagens (system persona + histórico + user) → `complete` → se `toolCalls`, executa cada via `tool.run` (→ `runAction`), realimenta resultados, repete até resposta final ou limite de iterações (guard).
- Modelo concreto é config — escolher um com tool-calling confiável como default; trocável sem mudar código.

---

## Estado & persistência

- **DO storage** (`this.sql`/`this.state`): cérebro da sessão — histórico recente de contexto do LLM, persona resolvida, cursor. Por conversa, operacional/efêmero.
- **Postgres `conversations`/`messages`** (via Actions do Atendimento): registro durável de toda mensagem inbound/outbound — visível no inbox, auditável. O DO não é fonte de verdade das mensagens.
- **`action_logs`**: auditoria automática de cada Action disparada pelo agente.

---

## Infra & provisionamento

- `wrangler.toml`: declarar o **Durable Object binding** `IA_AGENT` (classe `AgentOrchestrator`) + migration `new_sqlite_classes`. Adicionar env do Zen.
- DO roda no runtime Workers: dev/test via `wrangler dev` / `preview:cf` (não em `next dev`). Hyperdrive (Postgres na borda) já existe; Vectorize existe mas **não** é usado nesta fatia.
- O DO é declarado no Worker OpenNext do próprio app (Abordagem A). Worker dedicado fica como evolução futura.

---

## Testing

- **Unit (Node, mock LLM):** `provider` (mock HTTP do Zen, tradução de tools); loop de tool-calling (LLM mock decide toolCalls → verifica `runAction` chamado + realimentação + guard); `interlocutor.resolve` (paciente/lead/desconhecido/funcionário); `personas` (prompt correto por tipo).
- **Integração (runtime Workers):** chat interno (delegated) → agente chama Action real → resposta; WhatsApp inbound (system) → Action → `action_logs` com `principalType='system'`; usuário sem permissão → tool ausente / `forbidden`.

---

## Dependências

- **Existe:** `agentToolsFor`/`buildSystemContext`/`buildDelegatedContext` (W3.1); ~69 Actions registradas; lookup telefone→paciente (`operacional.obterPaciente` + `patients-repository`); Actions de canal do Atendimento (`receberMensagem`, `enviarMensagem`); webhook Evolution gated; dedup por `externalMessageId`; Hyperdrive/Vectorize provisionados.
- **A confirmar/criar na implementação:** lookup telefone→**lead** — não há módulo Comercial (E-05 é Onda 2+); usar query direta à tabela `leads` (schema crm) nesta fatia, migrando para Action quando o Comercial virar módulo. DO binding + Agents SDK ainda não no `wrangler.toml`/deps. Conta/API key do OpenCode Zen.

---

## Não-objetivos (fases futuras, fora deste slice)

4+1 especialistas (roteador + vendas/agendamento/generalista) · RAG sobre Vectorize · memória de paciente em camadas · multimodal/MCP · **Gestão do Agente** (config de comportamento, permissões finas do role Agente, UI de auditoria de decisões/ações pendentes) · voz/Call Center · reconectar `cron/smart-triggers` ao novo agente.

---

## Decisões abertas (fixar na implementação, ao explorar o SDK)

| Decisão | Nota |
|---|---|
| Modelo concreto do OpenCode Zen (default) | Precisa tool-calling confiável; trocável por env |
| Forma de `getAgentByName`/roteamento no Worker OpenNext | Confirmar integração DO ↔ rotas Next via Agents SDK |
| Streaming no chat interno | Opcional nesta fatia |
| Histórico de contexto: quanto manter no DO vs reidratar de `messages` | Começar mínimo |
| Estratégia de teste de integração de DO | `wrangler dev` vs pool de workers no Jest/Vitest |

---

## Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md` | Plano arquitetural do agente (Tasks 2+3 = esta fatia) |
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Onda 1; critério de conclusão |
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§8 W5, §10 LLM/Vectorize, §3.7 role Agente) |
| `src/core/actions/agent.ts` · `context.ts` | `agentToolsFor`, `buildSystemContext`/`buildDelegatedContext` |
| `src/modules/atendimento/` | Actions de canal e persistência reusadas; template de módulo |
| OpenCode Zen | `https://opencode.ai/docs/zen/` (gateway OpenAI-compatible) |
