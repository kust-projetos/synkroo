# W5 — Novo agente de IA (Cloudflare Agents SDK) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o agente de IA atual (~8k LOC) e construir um novo sobre as **primitivas nativas da Cloudflare** (Agents SDK + Durable Objects + Workers AI/AI Gateway + Vectorize), conectado às operações do sistema **exclusivamente pela Action Layer** (W3) e aos canais existentes (WhatsApp/Evolution), com **modelo LLM pluggable** (definido depois). Abordagem **faseada**: montar o esqueleto sobre o que o SDK entrega nativo e **só então mapear e preencher os gaps** de domínio.

**Architecture:** Orquestrador 4+1 (um orquestrador + especialistas sob demanda) rodando como **Durable Objects** (estado/sessão por conversa). O LLM fica atrás de uma abstração (AI Gateway/Workers AI) — sem acoplar a um provider. As capacidades do agente são as **Actions** do sistema via `agentToolsFor(ctx)` (W3.1), com `ctx` = `buildSystemContext(clinicId)` para inbound autônomo (WhatsApp) ou `buildDelegatedContext(userId, clinicId)` para chat interno. RAG via Vectorize. Os canais (Evolution) **permanecem**; muda apenas quem eles acionam.

**Tech Stack:** Cloudflare Agents SDK, Durable Objects, Workers AI / AI Gateway, Vectorize; Action Layer (W3); Evolution API (canal, preservado).

**Spec:** roadmap-mestre §8 W5, §10 (LLM pluggable, Vectorize), `docs/planning/technical-research.md` (arquitetura de agentes 4+1, MCP, RAG).

**Pré-requisitos:** W3 (Action Layer, `buildSystemContext`/`buildDelegatedContext`, `agentToolsFor`) e W4 (Workers, Vectorize, KV) implementados.

> **Natureza deste plano:** a Task 1 (remoção) é concreta e executável já. As Tasks 2+ são **greenfield sobre um SDK externo** — descritas em nível arquitetural com **spikes** e pontos de "consultar docs atuais" (context7: Cloudflare Agents SDK, Vectorize, AI Gateway). Cada uma vira um plano de código detalhado **ao ser iniciada**, após explorar o SDK.

---

## Escopo: remover vs. preservar

**Remover (~8k LOC):**
- `src/services/agent/` (1440), `src/services/agents/` (1886), `src/services/memory/` (1417), `src/services/rag/` (671), `src/services/tools/` (1508), `src/services/scheduler/` (456), `src/services/queue/` (627).
- `src/lib/llm/` (factory multi-provider), `src/lib/minimax.ts` (471).
- Rotas: `src/app/api/agent/*`, `src/app/api/scheduler/chat/`.

**Ajustar (consumidores externos):**
- `src/app/api/cron/smart-triggers/route.ts` — consumia o agente; re-apontar ao novo (ou desativar até o novo existir).
- `src/app/api/agent/messages/route.ts` — substituída pelo novo endpoint/Durable Object.

**Preservar:**
- `src/services/whatsapp/` (Evolution API) e webhooks de canal — independentes do agente (confirmado). Muda só **quem** o inbound aciona.
- Dados de domínio (pacientes, agendamentos, conversas/mensagens no schema).

---

### Task 1: Remover o agente atual (concreto)

**Files:** deletar os diretórios/arquivos do escopo; ajustar consumidores.

- [ ] **Step 1: Mapear consumidores residuais antes de deletar**

Run:
```bash
rg -n "@/services/(agent|agents|memory|rag|tools|scheduler|queue)|@/lib/llm|@/lib/minimax" src \
  --glob '!**/graphify-out/**' --glob '!src/services/(agent|agents|memory|rag|tools|scheduler|queue)/**'
```
Expected: lista finita (esperado: `api/agent/messages`, `api/cron/smart-triggers`, testes). Cada um será ajustado/removido.

- [ ] **Step 2: Desconectar os consumidores externos**

- `api/cron/smart-triggers/route.ts`: substituir a chamada ao agente por um **stub temporário** que retorna 200 sem ação (marcar `// TODO(W5.3): reconectar ao novo agente`), ou desabilitar a rota via manifesto se o módulo IA estiver desativado.
- `api/agent/messages/route.ts`: será deletada (Step 3) — confirmar que nada de UI ativa depende dela (o reconhecimento mostrou só 2 imports de UI no agente, baixo acoplamento).

- [ ] **Step 3: Deletar**

Run:
```bash
rm -rf src/services/agent src/services/agents src/services/memory src/services/rag \
       src/services/tools src/services/scheduler src/services/queue \
       src/lib/llm src/lib/minimax.ts \
       src/app/api/agent src/app/api/scheduler
```

- [ ] **Step 4: Remover testes órfãos e env vars do LLM antigo**

Deletar `__tests__` que testavam o agente removido; remover `MINIMAX_*` de `src/lib/env.ts`/`jest.setup.ts` se não usados por mais nada.

- [ ] **Step 5: Verificar baseline**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` → Expected: `0` (após ajustar consumidores).
Run: `npm test` → Expected: verde (suítes do agente removidas).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(agent): remove agente de IA atual (~8k LOC); preserva canais"
```

---

### Task 2: Esqueleto do agente sobre Agents SDK (spike + base)

**Objetivo:** um agente mínimo funcional rodando como Durable Object, com o LLM atrás de uma abstração pluggable, respondendo a uma mensagem de teste.

- [ ] **Step 1: Explorar o SDK** (context7: Cloudflare Agents SDK) — modelo de Durable Object para agente, ciclo de mensagens, estado, streaming.

- [ ] **Step 2: Abstração de LLM pluggable** — `src/modules/ia/llm/provider.ts`: interface mínima (`complete(messages, tools?) → resposta`) com um adapter para **AI Gateway/Workers AI**. O modelo concreto é **config** (`env`), definido depois (decisão §10 do mestre). Não acoplar.

- [ ] **Step 3: Durable Object do agente** — `src/modules/ia/agent/orchestrator.ts`: um DO por sessão de conversa; recebe mensagem, chama o LLM, devolve resposta. Sem tools ainda (Task 3).

- [ ] **Step 4: Spike de ponta-a-ponta** — enviar uma mensagem de teste e obter resposta do modelo configurado, no runtime Workers.

- [ ] **Step 5: Commit + plano detalhado** desta sub-fase (gerar plano de código próprio ao explorar o SDK).

> Decisões a fixar aqui: mapeamento **conversa → Durable Object** (id por telefone+clínica?), persistência de estado (DO storage vs `conversations` no Postgres), modelo LLM default para testes.

---

### Task 3: Conectar a Action Layer + canais

**Objetivo:** o agente executa operações reais via Actions e atende o WhatsApp inbound.

- [ ] **Step 1: Tools = Actions** — o agente recebe `agentToolsFor(ctx)` (W3.1). Para inbound autônomo, `ctx = buildSystemContext(clinicId)`; para chat interno, `buildDelegatedContext(userId, clinicId)`. **Nenhuma tool paralela** — só Actions.

- [ ] **Step 2: Resolver `clinicId` do canal** — webhook do WhatsApp (Evolution, preservado) → identificar a clínica pelo número/instância → `buildSystemContext(clinicId)`. O paciente é o **contato**, não principal (§3.7).

- [ ] **Step 3: Inbound → agente** — o webhook de canal aciona o Durable Object do agente (substitui o caminho antigo). Resposta volta pelo canal (Evolution send).

- [ ] **Step 4: Reconectar `smart-triggers`** (cron) ao novo agente, se aplicável.

- [ ] **Step 5: Testes de integração** — inbound de teste → agente chama uma Action (ex.: `operacional.scheduleAppointment`) → grava em `action_logs` com `principalType='system'`. Verificar gate de permissão do agente (role `Agente`, §3.7).

- [ ] **Step 6: Commit + plano detalhado da sub-fase.**

---

### Task 4: RAG sobre Vectorize

- [ ] **Step 1: Ingestão** — pipeline que indexa a base de conhecimento da clínica em **Vectorize** (embeddings via Workers AI; dimensão definida aqui → confirma o índice provisionado no W4). Escopo por clínica (metadata `clinicId`).
- [ ] **Step 2: Retrieval** — o orquestrador consulta o Vectorize (filtro por `clinicId`) e injeta contexto no prompt.
- [ ] **Step 3: Avaliar AutoRAG** (Cloudflare) como alternativa gerenciada ao pipeline manual.
- [ ] **Step 4: Testes de relevância** + commit + plano detalhado.

> Decisão: modelo de embedding (define a dimensão do índice Vectorize, W4 Task 4) e `pgvector`→Vectorize (mestre §10).

---

### Task 5: Gap-fill (pós-esqueleto)

Após o esqueleto no ar, **mapear o que falta** para o sistema funcionar bem e preencher — esta é a fase que a decisão do produto previu ("trabalhar no que falta depois do SDK implementado"):

- [ ] Memória do paciente (camadas) — o que o DO storage/SDK já cobre vs. o que precisa de tabela própria.
- [ ] Orquestração multi-agente 4+1 (especialistas: agendamento, vendas, generalista) — sob demanda por complexidade.
- [ ] Tools de domínio específicas que não existam como Actions ainda (declarar como Actions — nunca tools paralelas).
- [ ] Multimodal/MCP (operar sistemas externos, ler documentos) — §2.5/§5 da spec do W3.
- [ ] Gestão do Agente de IA (config de comportamento, permissões do role `Agente`, auditoria) — módulo do Eixo 2.

Cada item vira um plano próprio, priorizado após observar o esqueleto em uso.

---

## Decisões abertas (fixar ao iniciar cada fase)

| Decisão | Fase | Nota |
|---|---|---|
| Modelo LLM concreto | Task 2 | Pluggable; usuário define para testes/prod (mestre §10). |
| Conversa → Durable Object (id, estado) | Task 2 | DO storage vs `conversations` no Postgres. |
| Modelo de embedding / dimensão Vectorize | Task 4 | Define o índice do W4 Task 4. |
| AutoRAG vs pipeline manual | Task 4 | Avaliar gerenciado. |
| Profundidade da memória no esqueleto | Task 5 | Começar mínimo; expandir no gap-fill. |

---

## Self-Review

**Spec coverage (§8 W5):**
- Remoção dos ~8k LOC + preservação de canais → Task 1 ✓
- Orquestrador 4+1 sobre Agents SDK/Durable Objects + LLM pluggable → Tasks 2/5 ✓
- Conexão via Action Layer (sem tools paralelas) + `buildSystemContext` do canal → Task 3 ✓
- RAG via Vectorize → Task 4 ✓
- Gap-fill posterior (memória, multi-agente, MCP/multimodal) → Task 5 ✓

**Placeholder scan:** Task 1 é concreta (comandos reais). Tasks 2–5 marcam explicitamente "explorar SDK / plano detalhado da sub-fase" — é a natureza greenfield sobre SDK externo, não TBD evitável. Cada uma lista objetivo, decisões e verificação.

**Dependências:** Task 1 pode rodar assim que o W3 estiver pronto (não precisa do W4). Tasks 2–4 precisam do W4 (Workers/Vectorize). A Action Layer (W3) é pré-requisito da Task 3. O role `Agente` e suas permissões (W3.3/W3.4) governam o que o agente autônomo pode fazer.

**Risco:** maior incerteza é a fidelidade do mapeamento "4+1 + memória" às primitivas do Agents SDK — mitigado pela abordagem faseada (esqueleto primeiro, gap-fill informado pelo uso real), exatamente como o produto pediu.
