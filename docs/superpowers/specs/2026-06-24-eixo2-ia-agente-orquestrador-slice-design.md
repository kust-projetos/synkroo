# Eixo 2 — Agente IA: Orquestrador (slice ponta-a-ponta) — Design

> **Tipo:** Spec de design (módulo IA, primeira fatia). Deriva do W5 (`docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md`, Tasks 2+3) e do roadmap-mestre §8/§10.
> **Data:** 2026-06-24 · **Revisado:** 2026-06-25 (2 rounds de review crítico do Codex incorporados).
> **Status:** Em revisão. Pré-requisito antes do plano: **spike de viabilidade** (§Spike). Depois do spike: writing-plans.
> **Escopo:** apenas esta fatia (esqueleto + Action Layer + canais). RAG, memória, 4+1 e gestão do agente são fases futuras.

---

## Goal

Entregar a **primeira fatia ponta-a-ponta** do Agente IA: um **orquestrador único** como Cloudflare **Durable Object** (Agents SDK) num **Worker dedicado**, recebendo por **dois canais** (WhatsApp inbound autônomo e chat interno autenticado), entendendo intenção via **LLM pluggable (OpenCode Zen)**, executando operações **exclusivamente pela Action Layer** (Actions expostas como tools) e respondendo pelo canal — com **persona dinâmica** por interlocutor e **permissões herdadas do principal**, satisfazendo o critério de "Onda 1 concluída".

## Architecture

**Worker dedicado (Abordagem C).** Agente = Worker separado do app OpenNext, com deps próprias (Agents SDK + zod isolados). Orquestrador = instância de `Agent` (Agents SDK) = Durable Object único por conversa.

**Capacidades = Actions, via fronteira app↔agente controlada.** O Worker do agente **não importa** a Action Layer. Ele opera contra o app por **service binding**, sob um modelo de confiança estrito (ver §Fronteira de confiança):
- o **app é a autoridade do principal** — o worker carrega apenas um **handle opaco** (sessionId/token assinado emitido pelo app na entrada do canal); nunca envia `principal` cru;
- o app **reconstrói o `ActionContext`** a partir do handle e **revalida** autorização server-side antes de qualquer `runAction`.

**Persistência:** `messages`/`conversations` (Postgres, via Actions do app) é a **única** fonte de verdade e o **único** path de dados nesta fatia (o agente não acessa Postgres direto). DO storage = cache/scratchpad de sessão.

## Tech Stack

Worker dedicado + Agents SDK + Durable Objects; service binding app↔agente; LLM OpenCode Zen (OpenAI-compatible, `https://opencode.ai/zen/v1`); Action Layer no app; Hyperdrive (acesso ao Postgres **só pelo app**); Evolution API (canal). TypeScript 5.6, Jest, integração no runtime Workers.

---

## Decisões fixadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Fatia | Slice ponta-a-ponta (W5 Tasks 2+3) |
| 2 | Topologia | **Worker dedicado** (Abordagem C); SDK+DO no agente; deps isoladas |
| 2b | Acesso a Actions | **Service binding**; agente não importa a Action Layer |
| 2c | Autoridade do principal | **App** reconstrói o ctx por handle opaco; worker nunca envia principal cru (achado #1) |
| 2d | Path de dados | **Todo** acesso ao transcript/Postgres é via app nesta fatia (achado #4) |
| 3 | LLM | OpenCode Zen pluggable; modelo default validado no spike |
| 4 | Escopo 4+1 | Só o orquestrador; especialistas no gap-fill |
| 5 | Entradas | WhatsApp (system) + chat interno (delegated) |
| 6 | Permissões | `ctx` filtra tools; **enforcement server-side** RBAC(ctx) ∩ allowlist(canal/persona) (achado #2) |
| 7 | Comportamento | Persona dinâmica → prompt + subset de tools (sugestão; enforcement é no app) |
| 8 | Fonte de verdade | `messages` (Postgres); DO = cache |
| 9 | Identidade conversa | WhatsApp `${clinicId}:whatsapp:${phone}`; chat `${clinicId}:chat:${conversationId}` |

---

## Spike de viabilidade (GATE — antes do plano)

Cada ponto GO/NO-GO com evidência:
1. **Service binding app↔agente** funciona; latência aceitável.
2. **Autorização da fronteira:** app reconstrói principal a partir do handle opaco, **rejeita** principal forjado, e o endpoint é **inacessível publicamente** (só via binding).
3. **Agente → estado/DO:** `Agent`/`getAgentByName` + DO storage no Worker dedicado. (Postgres **só via app** — não testar Hyperdrive no agente.)
4. **Isolamento de deps:** Agents SDK instala **limpo** (sem `--legacy-peer-deps`) no pacote do agente, zod próprio, sem tocar o lockfile do app.
5. **Modelo Zen:** escolher 1 default e validar tool-calling (schema, timeout, retry, múltiplas tools).
6. **Contrato de tools:** validar que os metadados da Action Layer (name/description/inputSchema) são serializáveis para o contrato remoto (§Contrato de tools).

Se 1–4 não fecharem, reavaliar topologia (último recurso: DO cru). Spike descartável; vira insumo do plano.

---

## Fronteira de confiança app↔agente (achados #1, #2, #3)

A topologia C cria uma fronteira de rede. Modelo de confiança:

- **Handle opaco, não principal.** Na entrada (webhook WhatsApp validado, ou chat autenticado), o **app** cria uma sessão e emite um **handle opaco** (sessionId persistido no app, ou token assinado curto) que codifica `{ clinicId, source, principalRef, conversationId }`. O worker recebe e reapresenta esse handle — **nunca** monta nem envia `principal` livre.
- **App reconstrói e revalida.** No endpoint interno de Actions, o app: valida o handle → reconstrói `ActionContext` (`buildSystemContext`/`buildDelegatedContext`) → aplica **enforcement server-side**: `RBAC(ctx)` ∩ `allowlist(canal/persona)` ∩ (matriz de segurança por action) → só então `runAction`. O subset de persona/canal feito no worker é **sugestão de UX**, não barreira; a barreira é server-side.
- **Endpoint não-público.** Acessível somente via service binding (não roteável externamente); rejeita chamadas sem binding.

### Contrato de tools (versionado — achado #3)
Tools deixam de ser objetos locais e viram **contrato remoto versionado**. Catálogo entregue ao worker:
```
{ version, tools: [ { name, description, inputSchemaJson, module, permissions } ] }
```
- **Descoberta** (catálogo filtrado por ctx) e **execução** são endpoints separados.
- Validação de input **obrigatória server-side** (o app revalida o schema, não confia no worker).
- `version` permite detectar drift entre a Action Layer e o worker (incompatibilidade falha explícita, não silenciosa).

---

## Matriz de segurança por action (achado #5)

"Subset seguro" do WhatsApp vira **classificação formal por action**, aplicada server-side. Quatro níveis:

| Nível | Significado | Exemplos (proposta — validar) |
|---|---|---|
| **Livre** | Agente autônomo executa sem verificação | `consultarDisponibilidade`, `listarProcedimentos`, dúvidas gerais |
| **Confirmação** | Exige confirmação explícita do contato no diálogo | `agendarConsulta`, `confirmarConsulta`, `entrarWaitlist` |
| **Verificação forte** | Exige verificação de identidade adicional | leitura de dado clínico/financeiro do paciente, `atualizarPaciente` |
| **Proibido/escala** | Agente não executa no WhatsApp; escala humano | `cancelarConsulta`/`remarcarConsulta` de terceiros, dados sensíveis em massa, orçamentos |

> Classificação é **proposta inicial para validação** (LGPD/saúde). Telefone é dica fraca: contexto sensível não entra no prompt só com base no número. No chat interno (principal autenticado), a matriz não restringe além do RBAC do usuário. Ajustável por clínica na futura Gestão do Agente.

---

## Componentes

**Worker do agente:** `agent/orchestrator.ts` (Agent/DO: loop LLM↔tools com guard, correlação, persona); `llm/provider.ts` (OpenCode Zen pluggable); `personas.ts` (prompt + subset sugerido de tools).

**No app:** endpoint interno de Actions (binding-only: valida handle → reconstrói ctx → enforcement → `runAction`; catálogo de tools versionado); `channel/inbound` (webhook→handle→aciona agente; dedup `externalMessageId`); rota `/api/ia/chat` (gated+autenticada→handle→agente); `leads-read` adapter; módulo `ia` (manifest/permissions/index).

---

## Fluxos

### WhatsApp inbound (system)
```
Evolution webhook (assinatura/secret, dedup externalMessageId)
  → app: resolve clinicId, cria sessão + handle opaco, correlationId
  → aciona Worker do agente (handle)
  → orchestrator: interlocutor.resolve(phone) → persona/context (não-sensível)
       persiste inbound (app: atendimento.receberMensagem)
       pede catálogo de tools (subset persona) → loop LLM ⇄ execução remota
         (app revalida RBAC ∩ allowlist ∩ matriz → runAction) [guard anti-loop]
       persiste + envia resposta (chave idempotente outbound)
```

### Chat interno (delegated)
```
POST /api/ia/chat (withModuleRoute('ia'), sessão) → conversationId + handle
  → agente → mesmo loop; persona funcionário; enforcement = RBAC do usuário
```

---

## Resolução de interlocutor & persona

| Tipo | Identificação | Persona | Subset sugerido |
|---|---|---|---|
| Lead | nº em `leads` (adapter) | Vendas/SDR | agenda/qualificação |
| Paciente | nº em `patients` | Relacionamento | agenda/confirmação |
| Desconhecido | sem match | Recepção | mínimo |
| Funcionário | chat (logado) | Gestão/operação | conforme RBAC |

Persona = prompt + contexto + **sugestão** de tools. Enforcement real é server-side (§Fronteira). Cada persona é candidata a especialista 4+1 no gap-fill.

---

## Estado, persistência, entrega, concorrência

- **`messages` = fonte de verdade**; DO = cache/scratchpad. Acesso ao Postgres **só via app** (achado #4).
- **Ordem:** persistir inbound → processar → persistir outbound → enviar. **Chave idempotente outbound** + estado de entrega (`pending`/`sent`/`failed`).
- **Dono do retry (achado #7):** o **app** é o dono do envio outbound e do retry (não o DO) — fila/estado de entrega no app; replay do mesmo `externalMessageId` (inbound) ou da mesma chave outbound é no-op; sem reorder (entrega em ordem por conversa).
- **Concorrência (achado #8):** **serialização por conversa** — o DO processa um turno por vez (fila no próprio DO); mensagens concorrentes na mesma conversa enfileiram; turno usa o estado mais recente.
- **Ciclo de vida da sessão DO (achado #6):** TTL de inatividade (ex.: encerra/sumariza sessão após N h sem mensagem); reset explícito ao detectar novo assunto/atendimento; nova sessão lógica não herda scratchpad velho (contexto antigo não contamina). `messages` permanece como histórico durável independente do TTL do DO.
- **Reidratação:** janela curta no DO + reidratação parcial de `messages` + sumarização.

## Observabilidade (achado #10)

`correlationId`/trace id de ponta a ponta: inbound → handle → turno do DO → execução de Action (`action_logs`) → outbound. Requisito do design.

## LLM + loop (achados #8, #11)

`provider.complete(messages, tools) → { text, toolCalls }`. Modelo default validado no spike. **Anti-loop:** limite de iterações (~5), budget de tempo por turno, escape (resposta parcial + escala), retry limitado de tool → degrade.

---

## Testing

- **Unit (Node, mock LLM):** provider; loop+guard; `interlocutor.resolve`; personas; leads-read; **reconstrução de ctx por handle + rejeição de handle inválido/forjado**; enforcement server-side (allowlist/matriz).
- **Integração (Workers):** chat (delegated)→Action→resposta; WhatsApp (system)→Action→`action_logs` `principalType='system'`; tool proibida → `forbidden`; endpoint interno inacessível sem binding.
- **Matriz de falhas:** replay `externalMessageId`; send ok/persist fail; persist ok/send fail; restart/eviction do DO; timeout/429 de tool; concorrência na mesma conversa; tool proibida/ausente; persona sem tools; handle expirado; drift de versão do contrato de tools.

---

## Dependências

- **Existe:** `agentToolsFor`/`buildSystemContext`/`buildDelegatedContext`; ~69 Actions; telefone→paciente (`operacional.obterPaciente`+repo); `receberMensagem`/`enviarMensagem`; webhook gated; dedup `externalMessageId`; Hyperdrive/Vectorize.
- **A criar/confirmar (spike/plano):** Worker dedicado + service binding + endpoint interno (handle/auth/contrato de tools versionado); install limpo do SDK (zod isolado); `leads-read` adapter; `conversationId` + sessão/handle no chat; conta/key OpenCode Zen + modelo validado.

## Não-objetivos (fases futuras)

4+1 especialistas · RAG/Vectorize · memória em camadas · multimodal/MCP · Gestão do Agente (config de comportamento, permissões finas, UI de auditoria) · voz · reconectar `cron/smart-triggers`.

## Exceções conhecidas / dívida

- **`leads-read` (achado #9):** **exceção temporária** à narrativa "capacidades = Actions" — leitura direta do schema `leads` por não haver módulo Comercial (E-05, Onda 2+). Encapsulada num adapter único. **Critério de remoção:** quando E-05 expuser uma Action de leitura de lead, migrar e remover o adapter. Marcar com `// TODO(E-05)`.

## Decisões abertas (residuais — pós-spike)

| Decisão | Nota |
|---|---|
| Handle: sessionId persistido vs token assinado | Decidir no spike (segurança/latência) |
| Latência exata do service binding | Medir no spike |
| Streaming no chat | Opcional nesta fatia |

## Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md` | Plano arquitetural (Tasks 2+3) |
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Onda 1; critério |
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§8/§10/§3.7) |
| Reviews do Codex (2026-06-25, 2 rounds) | Origem dos achados 1–12 (round 1) e 1–9 (round 2 — fronteira app↔agente) |
| `src/core/actions/agent.ts` · `context.ts` | `agentToolsFor`, contextos |
| commit `4abe8960` (revertido) | Esqueleto-referência; revelou o conflito de zod |
| OpenCode Zen | `https://opencode.ai/docs/zen/` |
