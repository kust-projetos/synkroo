# Eixo 2 — Agente IA: Orquestrador (slice ponta-a-ponta) — Design

> **Tipo:** Spec de design (módulo IA, primeira fatia). Deriva do W5 (`docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md`, Tasks 2+3) e do roadmap-mestre §8/§10.
> **Data:** 2026-06-24 · **Revisado:** 2026-06-25 (3 rounds de review crítico do Codex incorporados).
> **Status:** **Spike concluído (2026-06-25)** — Abordagem C confirmada (gates 1–5 e 6a = GO). Único pendente: **6b (tool-calling real do OpenCode Zen)**, bloqueado por falta de credencial — depende de API key (ação do usuário), não de viabilidade técnica. Próximo: writing-plans (validação do Zen entra como tarefa inicial do plano, assim que houver key).
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

**Resultado (2026-06-25 — `spikes/viability-report.md`):** 1 GO (zod 4 isolado no agente, zod 3 no app, lockfile intacto) · 2 GO (DO+SQLite via `wrangler dev`) · 3 GO (binding RTT ~3ms, app público 404 binding-only) · 4 GO-com-ressalva (handle assinado valida + rejeita forjado; **recomendado sessionId persistido** para prod) · 5 GO (Postgres só via app) · 6a GO (Zod→JSON Schema draft-07) · **6b NO-GO** (sem credencial Zen/OpenAI/OpenRouter/MiniMax para testar tool-calling real). **Achado de infra:** o Worker do agente precisa de `nodejs_compat`. **Conclusão:** Abordagem C viável pelos gates 1–5+6a; resta validar tool-calling do Zen com credencial.

---

## Fronteira de confiança app↔agente (achados #1, #2, #3)

A topologia C cria uma fronteira de rede. Modelo de confiança:

- **Handle opaco, não principal.** Na entrada (webhook WhatsApp validado, ou chat autenticado), o **app** cria uma sessão e emite um **handle opaco** (sessionId persistido no app, ou token assinado curto) que codifica `{ clinicId, source, principalRef, conversationId }`. O worker recebe e reapresenta esse handle — **nunca** monta nem envia `principal` livre.
- **Lifecycle do handle (achado round 3 #1):** vínculo **estrito** handle ↔ `conversationId` ↔ `principalRef` ↔ `source` (o app rejeita uso cruzado — handle de uma conversa não vale para outra, nem troca de principal/source). **Expiração curta** + renovação pelo app. **Anti-replay** (single-use por requisição de execução, ou nonce) e **revogação** (encerrar sessão invalida o handle).
- **Mecanismo (decidido no spike):** **sessionId persistido no app** para produção (permite revogação e estado de replay server-side). Token assinado curto só é aceitável **com** anti-replay + revogação explícitos. O spike provou ambos validando `buildDelegatedContext`/`buildSystemContext` + `runAction` e rejeitando handle forjado (`invalid_signature`).
- **App reconstrói e revalida.** No endpoint interno de Actions, o app: valida o handle → reconstrói `ActionContext` (`buildSystemContext`/`buildDelegatedContext`) → aplica **enforcement server-side**: `RBAC(ctx)` ∩ `allowlist(canal/persona)` ∩ (matriz de segurança por action) → só então `runAction`. O subset de persona/canal feito no worker é **sugestão de UX**, não barreira; a barreira é server-side.
- **Endpoint não-público.** Acessível somente via service binding (não roteável externamente); rejeita chamadas sem binding.

### Contrato de tools (versionado — achado #3)
Tools deixam de ser objetos locais e viram **contrato remoto versionado**. Catálogo entregue ao worker:
```
{ version, tools: [ { name, description, inputSchemaJson, module, permissions } ] }
```
- **Descoberta** (catálogo filtrado por ctx) e **execução** são endpoints separados.
- Validação de input **obrigatória server-side** (o app revalida o schema, não confia no worker).
- `inputSchemaJson`: **JSON Schema draft-07**, derivado do Zod da Action (conversor validado no spike).
- `version`: **catálogo global** versionado (não por-tool); muda quando o conjunto/shape de tools muda.
- **Drift durante a conversa (achado round 3 #4):** a sessão **fixa (pin)** a `version` do catálogo no início; se a execução chega com `version` divergente, o app **falha explícito** (`stale_catalog`) e o worker **redescobre** o catálogo e refaz o turno — nunca executa contra schema obsoleto em silêncio.

---

## Matriz de segurança por action (achado #5)

"Subset seguro" do WhatsApp vira **classificação formal por action**, aplicada server-side. O nível **não** é fixo por action — é **derivado de eixos** (achado round 3 #2), porque a mesma action muda de risco conforme o alvo/dado:

**Eixos:** (a) **self vs third-party** (o contato age sobre si ou sobre outra pessoa); (b) **leitura vs mutação**; (c) **dado sensível** (clínico/financeiro) **vs operacional**; (d) impacto destrutivo/irreversível.

**Quatro níveis e regra de derivação (autônomo no WhatsApp; proposta para validar):**

| Nível | Significado | Quando se aplica (regra) |
|---|---|---|
| **Livre** | Executa sem verificação | leitura **operacional** pública (disponibilidade, procedimentos), dúvidas gerais |
| **Confirmação** | Confirmação explícita no diálogo | mutação **self** + operacional (agendar/confirmar **a própria** consulta, entrar em waitlist) |
| **Verificação forte** | Verificação de identidade adicional | qualquer acesso a **dado sensível** (clínico/financeiro), ou mutação de **cadastro** self |
| **Proibido/escala** | Não executa; escala humano | qualquer **third-party**, mutação **destrutiva** (cancelar/remarcar), dado sensível **em massa**, orçamentos |

Regra de subida: a presença de **third-party**, **dado sensível** ou **destrutivo** sempre **eleva** o nível (nunca rebaixa). Ex.: `confirmarConsulta` self = Confirmação; a "mesma" intenção sobre terceiro = Proibido/escala.

> Classificação **validada pelo usuário em 2026-06-25** (LGPD/saúde). Telefone é dica fraca: contexto sensível não entra no prompt só com base no número. No chat interno (principal autenticado), a matriz **não** restringe além do RBAC do usuário. Ajustável por clínica na futura Gestão do Agente.

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
- **Política terminal de entrega (achado round 3 #3):** N tentativas com backoff (ex.: 3) → estado terminal **`failed`** (dead); mensagens `failed` ficam **visíveis no inbox de Atendimento** para recuperação humana (reenvio manual / escala). Ordem lógica preservada por conversa: uma mensagem em `failed` **não bloqueia** novas mensagens posteriores, mas o `correlationId` e o timestamp mantêm a sequência auditável (o `failed` fica marcado na thread, sem reordenar as seguintes).
- **Concorrência (achado #8):** **serialização por conversa** — o DO processa um turno por vez (fila no próprio DO); mensagens concorrentes na mesma conversa enfileiram; turno usa o estado mais recente.
- **Ciclo de vida da sessão DO (achados #6 + round 3 #6):** o gatilho de reset é **objetivo e do app/orquestrador, não do LLM**: (a) **TTL de inatividade** (ex.: nova mensagem após N h de silêncio inicia sessão lógica nova); (b) **conversa arquivada/encerrada** via Action do Atendimento (`arquivarConversa`); (c) **reset manual** por operador. O modelo **não** decide sozinho "mudou de assunto" (evita ambiguidade). Sessão nova não herda scratchpad velho. `messages` permanece como histórico durável, independente do TTL do DO.
- **Reidratação:** janela curta no DO + reidratação parcial de `messages` + sumarização.

## Observabilidade (achado #10)

`correlationId`/trace id de ponta a ponta: inbound → handle → turno do DO → execução de Action (`action_logs`) → outbound. Requisito do design.

## LLM + loop (achados #8, #11)

`provider.complete(messages, tools) → { text, toolCalls }`. Modelo default validado no spike. **Anti-loop:** limite de iterações (~5), budget de tempo por turno, escape (resposta parcial + escala), retry limitado de tool → degrade.

**Falha do service binding (achado round 3 #3):** distinguir dois casos: (a) **falha ao descobrir o catálogo** de tools → o turno **aborta** antes de chamar o LLM, responde fallback ("um momento, já te respondo") e reenfileira/escala; (b) **falha ao executar uma tool** (binding down / timeout) → não inventar resultado: o turno encerra com resposta de fallback + `correlationId` logado, e a operação não-confirmada **não** é reportada como concluída ao contato. Ambos visíveis via observabilidade; sem efeito colateral silencioso.

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
| ~~Handle: sessionId vs token~~ | **Resolvido:** sessionId persistido (spike) |
| ~~Latência do service binding~~ | **Medido:** ~3ms local (spike) |
| Modelo default do OpenCode Zen | Validar tool-calling com credencial (tarefa inicial do plano) |
| Streaming no chat | Opcional nesta fatia |

## Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/plans/2026-06-17-w5-novo-agente-cloudflare.md` | Plano arquitetural (Tasks 2+3) |
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Onda 1; critério |
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§8/§10/§3.7) |
| Reviews do Codex (2026-06-25, 3 rounds) | Achados 1–12 (r1), 1–9 (r2 — fronteira), confirmação + 4 fechamentos finos (r3) |
| `src/core/actions/agent.ts` · `context.ts` | `agentToolsFor`, contextos |
| commit `4abe8960` (revertido) | Esqueleto-referência; revelou o conflito de zod |
| OpenCode Zen | `https://opencode.ai/docs/zen/` |
