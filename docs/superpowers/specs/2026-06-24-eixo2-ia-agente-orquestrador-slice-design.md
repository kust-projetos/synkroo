# Eixo 2 — Agente IA: Orquestrador (slice ponta-a-ponta) — Design

> **Tipo:** Spec de design (módulo IA, primeira fatia). Deriva do W5 (`docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md`, Tasks 2+3) e do roadmap-mestre §8/§10.
> **Data:** 2026-06-24 · **Revisado:** 2026-06-25 (review crítico do Codex incorporado).
> **Status:** Em revisão. Pré-requisito antes do plano: **spike de viabilidade** (ver §Spike). Próximo passo após o spike: writing-plans.
> **Escopo:** apenas esta fatia (esqueleto + Action Layer + canais). RAG, memória, 4+1 e gestão do agente são fases futuras.

---

## Goal

Entregar a **primeira fatia ponta-a-ponta** do Agente IA do Synkroo: um **orquestrador único** rodando como Cloudflare **Durable Object** (Agents SDK) num **Worker dedicado**, que recebe mensagens por **dois canais** (WhatsApp inbound autônomo e chat interno autenticado), entende a intenção via **LLM pluggable (OpenCode Zen)**, executa operações **exclusivamente pela Action Layer** (as ~69 Actions registradas, expostas como tools) e responde pelo canal de origem — com **persona dinâmica** por tipo de interlocutor e **permissões herdadas do principal**.

Satisfaz o critério de "Onda 1 concluída" (`2026-06-21-eixo2-sequenciamento-design.md` §4): paciente manda WhatsApp → agente entende → agenda/confirma via Action → registra → responde, no runtime Cloudflare via Action Layer com RBAC/entitlement aplicados.

## Architecture

**Worker dedicado (Abordagem C).** O agente é um **Worker separado** do app OpenNext, com suas próprias dependências (Agents SDK + zod próprios) — isolando o conflito de peer-deps que inviabiliza embutir o SDK no app (ver §Spike, achado de zod). O orquestrador é uma instância de `Agent` (Agents SDK) = um Durable Object globalmente único por conversa (`getAgentByName`).

**Capacidades = Actions, via service binding.** O Worker do agente **não importa** a Action Layer (evita reintroduzir o conflito de zod). Ele executa Actions chamando o app por **service binding**: o app expõe um endpoint interno autenticado que recebe `{ action, input, principal }`, monta o `ActionContext` real (`buildSystemContext`/`buildDelegatedContext`) e roda `runAction`, devolvendo o resultado. O agente recebe a lista de tools disponíveis (nome/descrição/schema) do mesmo contrato. As duas entradas (WhatsApp `system`, chat `delegated`) convergem no mesmo DO, diferindo só no principal.

**Persistência:** `conversations`/`messages` (Postgres, via Actions do Atendimento) é a **fonte de verdade** das mensagens; o DO storage é cache/scratchpad de sessão. Sem tools paralelas.

## Tech Stack

Worker dedicado Cloudflare + Agents SDK + Durable Objects; service binding app↔agente; LLM via OpenCode Zen (gateway OpenAI-compatible, `https://opencode.ai/zen/v1`); Action Layer no app (`runAction`, `agentToolsFor`, `buildSystemContext`/`buildDelegatedContext`); Hyperdrive (Postgres na borda); Evolution API (canal WhatsApp). TypeScript 5.6, Jest (unit), integração no runtime Workers.

---

## Decisões fixadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Fatia | Slice ponta-a-ponta (esqueleto + Action Layer + canais) — W5 Tasks 2+3 |
| 2 | Runtime/topologia | **Worker dedicado** (Abordagem C); Agents SDK + DO no Worker do agente; deps isoladas do app |
| 2b | Acesso a Actions | Via **service binding** app↔agente (agente não importa a Action Layer) |
| 3 | LLM | **OpenCode Zen** (OpenAI-compatible), pluggable; modelo default validado no spike |
| 4 | Escopo 4+1 | **Só o orquestrador**; especialistas no gap-fill |
| 5 | Entradas | **WhatsApp inbound (system) + chat interno (delegated)** |
| 6 | Permissões | `ctx` filtra tools; chat = perms reais do usuário; WhatsApp = role Agente; cliente = contato |
| 7 | Comportamento | **Persona dinâmica** (lead/paciente/desconhecido/funcionário) → system prompt + filtragem de tools |
| 8 | Fonte de verdade | `messages` (Postgres) = fonte de verdade; DO = cache/scratchpad |
| 9 | Identidade WhatsApp | Telefone é **dica fraca**, nunca barreira de segurança (ver §Segurança) |

---

## Spike de viabilidade (GATE — obrigatório antes do plano)

Os achados CRÍTICOS do review tornam duas incertezas arquiteturais bloqueantes. **O plano de implementação só começa após o spike fechar estes pontos** (cada um GO/NO-GO, com evidência):

1. **Service binding app↔agente:** o Worker do agente chama o app e recebe resposta? Latência aceitável?
2. **Agente → Action Layer:** o endpoint interno do app roda `runAction` com `buildSystemContext`/`buildDelegatedContext` e devolve resultado + lista de tools, com auth do binding (não público)?
3. **Agente → estado/DO:** `Agent`/`getAgentByName` + DO storage funcionam no Worker dedicado; e o agente alcança o Postgres (via app ou Hyperdrive próprio)?
4. **Isolamento de deps:** Agents SDK instala **limpo** (sem `--legacy-peer-deps`) no pacote/Worker do agente, com zod próprio, sem contaminar o lockfile do app?
5. **Modelo Zen:** escolher **1 modelo default** e validar tool-calling real (schema, timeout, retry, comportamento sob múltiplas tools).

Se 1–4 não fecharem, reavaliar topologia (último recurso: DO cru). O spike é descartável; seu resultado vira insumo do plano.

---

## Componentes

**Worker do agente (novo pacote/Worker):**
| Arquivo | Papel |
|---|---|
| `agent/orchestrator.ts` | `Agent` (Agents SDK / DO). Lifecycle de mensagem; resolve persona; pede tools+executa via service binding; loop LLM↔tools com guard; correlaciona logs |
| `llm/provider.ts` | Abstração pluggable; adapter OpenCode Zen (OpenAI-compatible); tradução tools ↔ function-calling |
| `personas.ts` | Mapa `tipo → { system prompt, conjunto de módulos/tools permitido }` (puro) |

**No app (OpenNext):**
| Arquivo | Papel |
|---|---|
| endpoint interno de Actions (service binding) | Recebe `{ action, input, principal }`, monta ctx real, roda `runAction`, devolve resultado + tools disponíveis. Auth por binding, nunca público |
| `channel/inbound` (atendimento ou ia) | Webhook Evolution → resolve `clinicId` → aciona o Worker do agente (system); dedup por `externalMessageId` |
| rota `/api/ia/chat` | Gated `withModuleRoute('ia')` + autenticada → aciona o agente (delegated) |
| `leads-read` adapter | Leitura única telefone→lead (schema `leads`), encapsulada, com contrato mínimo e plano de migração para Action quando E-05 virar módulo |
| `manifest.ts` · `permissions.ts` · `index.ts` | Módulo `ia` (entitlement, permissões, barrel) |

**Identidade do DO / da conversa (fecha #6):**
- WhatsApp: `${clinicId}:whatsapp:${phone}` (1 thread por contato/clínica).
- Chat interno: **`${clinicId}:chat:${conversationId}`** — N threads por usuário (cada conversa é uma instância). `userId` **não** é a chave (evita misturar threads). Criar `conversationId` ao iniciar um chat.

---

## Fluxos

### WhatsApp inbound (autônomo, principal = Agente)
```
Evolution webhook (assinatura/secret validados, dedup externalMessageId)
  → resolve clinicId → aciona Worker do agente (correlationId gerado)
  → orchestrator: interlocutor.resolve(phone) → { type, persona, context }
       persiste msg inbound (service binding → atendimento.receberMensagem)
       tools = subset(persona) das Actions permitidas pelo ctx system (role Agente)
       loop LLM ⇄ toolCalls → (service binding → runAction) [guard anti-loop]
       persiste + envia resposta (atendimento.enviarMensagem) com chave idempotente
```

### Chat interno (autenticado, principal = usuário)
```
POST /api/ia/chat (withModuleRoute('ia'), sessão)  → conversationId
  → aciona Worker do agente (delegated: perms reais do usuário)
  → mesmo loop; persona "funcionário/gestão"; tools = subset pelas perms do usuário
```

---

## Resolução de interlocutor & persona

| Tipo | Identificação | Persona / objetivo | Tools liberadas (camada persona) |
|---|---|---|---|
| Lead | WhatsApp; número em `leads` (via adapter) | Vendas/SDR | agenda/qualificação |
| Paciente | WhatsApp; número em `patients` | Relacionamento/clínico | agenda/confirmação/follow-up |
| Desconhecido | WhatsApp sem match | Recepção/qualificação | mínimo (info + agendar avaliação) |
| Funcionário | Chat interno (usuário logado) | Gestão/operação | conforme RBAC do usuário |

Persona define **system prompt + contexto + qual subconjunto de tools** é oferecido (ver §Filtragem). Cada persona é candidata a virar especialista 4+1 no gap-fill.

---

## Permissões & segurança (reescrito — achado #4)

- **`ctx` é a fronteira de capacidade.** Tools filtradas por `hasModule && can`; `runAction` rebate `forbidden` se o LLM insistir. Dupla barreira.
- **Chat interno → principal = usuário.** `buildDelegatedContext` resolve perms reais (admin/recepção/dentista/comercial). Zero escalonamento.
- **WhatsApp → principal = role Agente.** Cliente/paciente não é principal nem tem RBAC.
- **Identidade por telefone é dica fraca, nunca barreira de segurança.** Em contexto clínico (LGPD/dados de saúde):
  - Persona/contexto sensível (histórico clínico, financeiro) **não** é injetado no prompt só com base no número.
  - Agente autônomo no WhatsApp limitado a um **subset seguro** por default: consultar disponibilidade, agendar, **confirmar a própria** consulta, responder dúvidas gerais.
  - **Ações sensíveis** (cancelar/remarcar, expor dados clínicos/financeiros, alterar cadastro) exigem **confirmação explícita** e/ou verificação adicional de identidade; na dúvida, **escala para humano** (`atendimento.escalarConversa`).
  - *(Postura default — confirmar na revisão; ajustável por clínica na futura Gestão do Agente.)*
- Webhook validado (assinatura/secret); idempotência inbound por `externalMessageId`. Rota chat gated+autenticada. Toda Action auditada em `action_logs`.

## Filtragem de tools em camadas (achado #5)

Não enviar as ~69 tools em toda chamada (custo/precisão). Camadas: **ctx** (módulo+permissão) → **canal/persona** (subset relevante) → **intenção/módulo** (refino opcional por classificação leve). Requisito, não otimização futura.

## LLM pluggable + loop (achados #8, #11)

- `provider.complete(messages, tools) → { text, toolCalls }`; OpenAI-compatible → Zen. Env: `OPENCODE_ZEN_API_KEY`, `IA_LLM_MODEL`, `IA_LLM_BASE_URL`.
- **Modelo default escolhido e validado no spike** (tool-calling, schema, timeout, retry).
- **Política anti-loop (fechar):** limite de iterações (ex.: 5), budget de tempo por turno, regra de escape (resposta parcial + escala), e tratamento de erro de tool (retry limitado → degrade). 

## Estado & persistência (reescrito — achados #3, #12)

- **`messages` (Postgres) = fonte de verdade.** Transcript oficial; DO = cache/scratchpad/sumário.
- **Ordem:** persistir inbound → processar → persistir outbound → enviar. Envio com **chave idempotente outbound** + estado de entrega (evita duplicar em retry/replay).
- **Reidratação após eviction:** janela curta de contexto no DO + reidratação parcial de `messages` + sumarização. Política inicial simples.
- Replay do mesmo `externalMessageId` é no-op (dedup).

## Observabilidade (achado #10)

`correlationId`/trace id propagado de ponta a ponta: inbound → turno do DO → chamadas de Action (`action_logs`) → outbound. Sem isso, debug operacional é inviável. Requisito do design.

---

## Testing (achado #9 — matriz de falhas)

- **Unit (Node, mock LLM):** provider; loop+guard; `interlocutor.resolve`; personas (prompt + subset de tools); leads-read adapter.
- **Integração (runtime Workers):** chat (delegated) → Action real → resposta; WhatsApp (system) → Action → `action_logs` `principalType='system'`; tool proibida → `forbidden`.
- **Matriz de falhas (obrigatória):** replay do mesmo `externalMessageId`; send ok/persist fail; persist ok/send fail; restart/eviction do DO; timeout/429 de tool; mensagens concorrentes na mesma conversa; tool proibida/ausente; persona sem tools.

---

## Dependências

- **Existe:** `agentToolsFor`/`buildSystemContext`/`buildDelegatedContext`; ~69 Actions; lookup telefone→paciente (`operacional.obterPaciente`+repo); Actions de canal (`receberMensagem`/`enviarMensagem`); webhook Evolution gated; dedup `externalMessageId`; Hyperdrive/Vectorize provisionados.
- **A criar/confirmar (spike/plano):** Worker dedicado + service binding + endpoint interno de Actions; instalação limpa do Agents SDK (zod isolado); `leads-read` adapter; `conversationId` no chat; conta/API key OpenCode Zen + modelo validado.

## Não-objetivos (fases futuras)

4+1 especialistas · RAG/Vectorize · memória de paciente em camadas · multimodal/MCP · Gestão do Agente (config de comportamento e permissões finas, UI de auditoria) · voz · reconectar `cron/smart-triggers`.

## Decisões abertas (residuais — pós-spike)

| Decisão | Nota |
|---|---|
| Latência/forma exata do service binding | Medir no spike |
| Quanto de contexto reidratar do Postgres | Começar mínimo, ajustar |
| Streaming no chat | Opcional nesta fatia |

## Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md` | Plano arquitetural (Tasks 2+3) |
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Onda 1; critério de conclusão |
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§8 W5, §10, §3.7 role Agente) |
| Review crítico do Codex (2026-06-25) | Origem dos achados 1–12 incorporados |
| `src/core/actions/agent.ts` · `context.ts` | `agentToolsFor`, contextos |
| commit `4abe8960` (revertido) | Esqueleto-referência; revelou o conflito de zod |
| OpenCode Zen | `https://opencode.ai/docs/zen/` |
