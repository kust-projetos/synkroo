# Agente IA — Worker do Agente (Plano 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o "cérebro" do Agente IA: um Worker dedicado (`ia-agent`) que roda um orquestrador como Durable Object (Cloudflare Agents SDK), com LLM pluggable (OpenCode Zen) e um loop LLM↔tools que consome as Actions **exclusivamente** via o `ia-bridge` (Plano 1) por service binding — sem acessar Postgres nem a Action Layer diretamente.

**Architecture:** A **lógica** (provider Zen, personas, loop) vive em `src/core/ia-agent/` (pura, deps injetadas, testável em Jest — não depende do Agents SDK nem de zod 4). A **casca** `AgentOrchestrator extends Agent` (DO) vive no pacote isolado `src/workers/ia-agent/` (deps `agents`+zod 4, validada via `wrangler`), mantém o estado de sessão (`this.state`) e injeta as deps reais (provider + binding `APP`→`ia-bridge`). Tools vêm prontas do `ia-bridge` (alias + JSON Schema). **O handle é um `sessionToken` reutilizável** (várias execuções por turno); o anti-replay é por `idempotencyKey` de ação.

**Tech Stack:** Cloudflare Agents SDK (`agents@0.16.2`), Durable Objects, `cloudflare:workers`; OpenCode Zen (`deepseek-v4-flash-free`); TypeScript 5.6, Jest. Referência fiel: branch `spike/ia-agente-referencia` (`spikes/agent-worker/src/index.ts`, `spikes/zen-tool-calling.ts`).

---

## Escopo

**Inclui:** **Task 0 — patch do `ia-bridge`** (handle reutilizável + idempotencyKey, correção do contrato do Plano 1); pacote do Worker `ia-agent`; provider Zen; personas (timezone da clínica); loop orquestrador (LLM↔tools, guard, veredictos da matriz, confirmação que vincula args, erro estruturado); casca `AgentOrchestrator` (DO) com histórico real + binding `APP`; wrangler; testes.

**Fora (Plano 3 — canais/integração OpenNext):** webhook inbound, `/api/ia/chat`, resolução de interlocutor (DB → app-side), persistência durável (`atendimento.*`), emissão de handle, service bindings nas rotas Next (`getCloudflareContext`). O `ia-agent` recebe `handle`+`personaType`+`context`+`history`+`timezone` **prontos** e devolve a `reply`.

---

## Contrato do agente (`runTurn`)

```
input:  { handle, conversationId, source, personaType, context, timezone,
          userMessage, history?: ChatMessage[],
          pendingAction?: { alias, args, token },   // ação aguardando confirmação (turno anterior)
          confirmedToken?: string }                 // o usuário confirmou esta ação
output: { reply, turnsUsed, escalated?, pendingAction? }  // pendingAction = nova pendência a guardar
```
A confirmação **reexecuta os args originais** guardados em `pendingAction` (não os que o LLM gerar de novo). O caller (Plano 3) persiste a `reply`, guarda/repassa `pendingAction` e sinaliza `confirmedToken` ao detectar o "sim" do usuário.

---

## File Structure

| Path | Responsabilidade |
|---|---|
| `src/core/agent-bridge/bridge-service.ts` | **(Task 0)** `executeActionLogic` ganha `idempotencyKey`; handle deixa de ser single-use |
| `src/core/agent-bridge/__tests__/bridge-*.test.ts` | **(Task 0)** ajustar replay → dedup por idempotencyKey |
| `src/core/ia-agent/types.ts` | `LlmProvider`, `AppBinding`, `ChatMessage`, `RunTurnInput/Result`, `PersonaType` |
| `src/core/ia-agent/provider-zen.ts` | Adapter OpenCode Zen + retry/timeout |
| `src/core/ia-agent/personas.ts` | `personaSystemPrompt(type, ctx, now, timezone)` |
| `src/core/ia-agent/orchestrator-logic.ts` | `runTurn(deps, input)` — loop, guard, confirmação, erro estruturado |
| `src/workers/ia-agent/index.ts` | Casca `AgentOrchestrator` (DO, `@callable`) + estado de sessão |
| `src/workers/ia-agent/{package.json,wrangler.jsonc,tsconfig.json}` | Pacote isolado (agents + zod 4) |
| `src/core/ia-agent/__tests__/*.test.ts` | Unit/integração da lógica |

---

## Task 0: Patch do `ia-bridge` — handle reutilizável + idempotencyKey (P0)

Corrige o contrato do Plano 1: o handle era single-use por `executeAction`, o que mata o loop multi-tool do agente (2ª execução → `replayed`). Agora o handle é reutilizável e o anti-replay é por `idempotencyKey` (= `tool_call_id`).

**Files:**
- Modify: `src/core/agent-bridge/bridge-service.ts`
- Modify: `src/core/agent-bridge/__tests__/bridge-service.test.ts`, `src/core/agent-bridge/__tests__/bridge-failures.test.ts`

- [ ] **Step 1: Atualizar o teste de dedup** (`bridge-failures.test.ts`)

Substituir o teste "replay do mesmo handle → replayed" por dois casos:

```ts
  it('same handle, different idempotencyKeys → both pass (loop multi-tool)', async () => {
    const d = deps();
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: 60 });
    const a = await executeActionLogic(d, { handle, conversationId: 'conv-1', idempotencyKey: 'call-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    const b = await executeActionLogic(d, { handle, conversationId: 'conv-1', idempotencyKey: 'call-2', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it('same idempotencyKey twice → duplicate (anti-replay por ação)', async () => {
    const d = deps();
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: 60 });
    const first = await executeActionLogic(d, { handle, conversationId: 'conv-1', idempotencyKey: 'call-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    const second = await executeActionLogic(d, { handle, conversationId: 'conv-1', idempotencyKey: 'call-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: 'duplicate' });
  });
```

Nos demais testes (`bridge-service.test.ts` e `bridge-failures.test.ts`) que chamam `executeActionLogic`, adicionar `idempotencyKey: 'call-x'` (string única por chamada) ao input.

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx jest src/core/agent-bridge/__tests__/bridge-failures.test.ts -v`
Expected: FAIL (`idempotencyKey` ainda não existe no tipo/lógica).

- [ ] **Step 3: Patch `executeActionLogic`** (`bridge-service.ts`)

```ts
export type ExecuteInput = {
  handle: string; conversationId: string;
  idempotencyKey: string;              // novo: anti-replay por ação (= tool_call_id)
  alias: string; input: unknown;
  flags: { confirmed: boolean; identityVerified?: boolean };
};

export async function executeActionLogic(deps: BridgeDeps, input: ExecuteInput): Promise<ExecuteResult> {
  // 1. handle REUTILIZÁVEL (sem singleUse) — várias execuções por turno
  const v = await verifyHandle(deps.secret, input.handle, { conversationId: input.conversationId, store: deps.store });
  if (!v.ok) return { ok: false, error: v.error };

  // 2. anti-replay por idempotencyKey (não pelo handle)
  if (await deps.store.wasSeen(input.idempotencyKey)) return { ok: false, error: 'duplicate' };

  // 3. alias → action.name
  const action = deps.getActions().find((a) => normalizeToolName(a.name) === input.alias);
  if (!action) return { ok: false, error: 'unknown_tool' };

  // 4. matriz (só source='system')
  if (v.payload.source === 'system') {
    const gate = assertSystemAllowed(action.name, input.flags);
    if (!gate.allowed) return { ok: false, error: gate.reason!, level: gate.level };
  }

  // 5. marca a idempotencyKey ANTES de executar (evita double-execution); TTL cobre o exp do handle
  const ttlSeconds = Math.max(Math.ceil((v.payload.exp - Date.now()) / 1000) + 30, 60);
  await deps.store.markSeen(input.idempotencyKey, ttlSeconds);

  // 6. ctx real + runAction
  const ctx = await rebuildCtx(deps, v.payload);
  const result = await deps.runAction(action, input.input, ctx);
  if (!result.ok) return { ok: false, error: result.error.code, message: result.error.message };
  return { ok: true, data: result.data };
}
```

> `verifyHandle` mantém o parâmetro opcional `singleUse` (não removido), mas o bridge **não** o usa mais. O `ExecuteResult` ganha `'duplicate'` como possível `error`.

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx jest src/core/agent-bridge -v`
Expected: PASS (todos, com os dois novos casos de idempotência).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck && npm run typecheck:ia-bridge
git add src/core/agent-bridge
git commit -m "fix(ia-bridge): reusable handle + per-action idempotencyKey (unblocks agent loop)"
```

---

## Task 1: Lógica — tipos + provider Zen

**Files:**
- Create: `src/core/ia-agent/types.ts`, `src/core/ia-agent/provider-zen.ts`
- Test: `src/core/ia-agent/__tests__/provider-zen.test.ts`

- [ ] **Step 1: Definir os tipos** (`src/core/ia-agent/types.ts`)

```ts
export type PersonaType = 'vendas' | 'paciente' | 'recepcao' | 'funcionario';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string }; }
export interface LlmTool { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> }; }
export interface LlmCompletion { text: string | null; toolCalls: ToolCall[]; }
export interface LlmProvider { complete(messages: ChatMessage[], tools: LlmTool[]): Promise<LlmCompletion>; }

export interface RemoteTool { name: string; alias: string; description: string; inputSchemaJson: Record<string, unknown>; module: string; permissions: string[]; }

// Espelha a superfície RPC do ia-bridge (Plano 1 + Task 0).
export interface AppBinding {
  listTools(input: { handle: string; conversationId: string }):
    Promise<{ ok: true; catalog: { version: string; tools: RemoteTool[] } } | { ok: false; error: string }>;
  executeAction(input: { handle: string; conversationId: string; idempotencyKey: string; alias: string; input: unknown; flags: { confirmed: boolean; identityVerified?: boolean } }):
    Promise<{ ok: true; data: unknown } | { ok: false; error: string; level?: string; message?: string }>;
}

export interface PendingAction { alias: string; args: unknown; token: string; }

export interface RunTurnInput {
  handle: string; conversationId: string;
  source: 'system' | 'agent_delegated';
  personaType: PersonaType; context: string; timezone: string;
  userMessage: string;
  history?: ChatMessage[];
  pendingAction?: PendingAction;
  confirmedToken?: string;
}
export interface RunTurnResult { reply: string; turnsUsed: number; escalated?: boolean; pendingAction?: PendingAction; }
```

- [ ] **Step 2: Escrever o teste do provider** (`__tests__/provider-zen.test.ts`)

```ts
import { createZenProvider } from '../provider-zen';
import type { LlmTool } from '../types';

const tool: LlmTool = { type: 'function', function: { name: 'operacional__consultarDisponibilidade', description: 'x', parameters: { type: 'object', properties: {} } } };
const mk = (body: unknown, ok = true, status = 200) => jest.fn().mockResolvedValue({ ok, status, text: async () => JSON.stringify(body) });

describe('zen provider', () => {
  it('parses tool_calls', async () => {
    const f = mk({ choices: [{ message: { content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{"date":"2026-06-25"}' } }] } }] });
    const p = createZenProvider({ apiKey: 'k', model: 'm', baseUrl: 'https://x/v1', fetchImpl: f as unknown as typeof fetch });
    const out = await p.complete([{ role: 'user', content: 'horários?' }], [tool]);
    expect(out.toolCalls[0].function.name).toBe('operacional__consultarDisponibilidade');
  });
  it('parses plain text', async () => {
    const f = mk({ choices: [{ message: { content: 'Olá!' } }] });
    const p = createZenProvider({ apiKey: 'k', model: 'm', baseUrl: 'https://x/v1', fetchImpl: f as unknown as typeof fetch });
    const out = await p.complete([{ role: 'user', content: 'oi' }], []);
    expect(out.text).toBe('Olá!'); expect(out.toolCalls).toHaveLength(0);
  });
  it('retries once on 429', async () => {
    const f = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate' })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) });
    const p = createZenProvider({ apiKey: 'k', model: 'm', baseUrl: 'https://x/v1', fetchImpl: f as unknown as typeof fetch });
    expect((await p.complete([{ role: 'user', content: 'oi' }], [])).text).toBe('ok');
    expect(f).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Rodar (FAIL)** — `npx jest src/core/ia-agent/__tests__/provider-zen.test.ts -v`

- [ ] **Step 4: Implementar** (`src/core/ia-agent/provider-zen.ts`)

```ts
import type { ChatMessage, LlmCompletion, LlmProvider, LlmTool } from './types';

export interface ZenConfig { apiKey: string; model: string; baseUrl: string; timeoutMs?: number; fetchImpl?: typeof fetch; }

export function createZenProvider(cfg: ZenConfig): LlmProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  const endpoint = cfg.baseUrl.endsWith('/') ? `${cfg.baseUrl}chat/completions` : `${cfg.baseUrl}/chat/completions`;

  async function call(messages: ChatMessage[], tools: LlmTool[]): Promise<LlmCompletion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30000);
    try {
      const res = await doFetch(endpoint, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, messages, tools, tool_choice: tools.length ? 'auto' : undefined, temperature: 0 }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text);
      const m = json.choices?.[0]?.message ?? {};
      return { text: m.content ?? null, toolCalls: m.tool_calls ?? [] };
    } finally { clearTimeout(timeout); }
  }
  const retryable = (e: unknown) => e instanceof Error && (e.name === 'AbortError' || /HTTP (408|409|429|5\d\d)/.test(e.message));

  return { async complete(messages, tools) {
    try { return await call(messages, tools); }
    catch (e) { if (!retryable(e)) throw e; return await call(messages, tools); }
  } };
}
```

- [ ] **Step 5: Rodar (PASS)** — `npx jest src/core/ia-agent/__tests__/provider-zen.test.ts -v`

- [ ] **Step 6: Commit**

```bash
git add src/core/ia-agent/types.ts src/core/ia-agent/provider-zen.ts src/core/ia-agent/__tests__/provider-zen.test.ts
git commit -m "feat(ia-agent): zen provider (openai-compatible) + types"
```

---

## Task 2: Personas (system prompt + timezone da clínica)

**Files:**
- Create: `src/core/ia-agent/personas.ts`
- Test: `src/core/ia-agent/__tests__/personas.test.ts`

- [ ] **Step 1: Escrever o teste** (cobre timezone e virada de dia — achado P1 #5)

```ts
import { personaSystemPrompt } from '../personas';

describe('personaSystemPrompt', () => {
  // 2026-06-25T01:30Z é ainda 24/06 em São Paulo (UTC-3)
  const lateNightUtc = new Date('2026-06-25T01:30:00.000Z');
  it('uses the clinic timezone, not UTC, for the current date', () => {
    const p = personaSystemPrompt('paciente', '', lateNightUtc, 'America/Sao_Paulo');
    expect(p).toContain('2026-06-24');   // dia local correto (não 2026-06-25 do UTC)
  });
  it('injects context and persona objective', () => {
    const p = personaSystemPrompt('paciente', 'Paciente: João', new Date('2026-06-25T12:00:00Z'), 'America/Sao_Paulo');
    expect(p).toContain('João'); expect(p.toLowerCase()).toContain('paciente');
  });
  it('vendas focuses on qualifying/scheduling', () => {
    expect(personaSystemPrompt('vendas', '', new Date(), 'America/Sao_Paulo').toLowerCase()).toMatch(/vendas|avaliação|agendar/);
  });
});
```

- [ ] **Step 2: Rodar (FAIL)** — `npx jest src/core/ia-agent/__tests__/personas.test.ts -v`

- [ ] **Step 3: Implementar** (`src/core/ia-agent/personas.ts`)

```ts
import type { PersonaType } from './types';

const BASE = 'Você é o assistente virtual de uma clínica odontológica. Responda sempre em pt-BR, objetivo e cordial. Use as tools quando precisar de dados ou executar ações; não invente horários, preços ou dados de pacientes. Quando uma ação exigir confirmação, pergunte antes de executar.';

const BY_PERSONA: Record<PersonaType, string> = {
  vendas: 'Perfil: LEAD (possível novo paciente). Objetivo: qualificar interesse e agendar uma avaliação (vendas), sem pressionar.',
  paciente: 'Perfil: PACIENTE cadastrado. Objetivo: relacionamento — agenda, confirmação, retorno e dúvidas. Cuidado com dados sensíveis.',
  recepcao: 'Perfil: DESCONHECIDO (sem cadastro). Objetivo: recepcionar, tirar dúvidas gerais e encaminhar para avaliação. Não exponha dados de terceiros.',
  funcionario: 'Perfil: FUNCIONÁRIO da clínica (uso interno). Objetivo: apoiar gestão e operação da equipe conforme as permissões do usuário.',
};

// Data/hora local da clínica (timezone) — NÃO UTC — para resolução de datas relativas.
function localDateTime(now: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function personaSystemPrompt(type: PersonaType, context: string, now: Date, timeZone: string): string {
  const { date, time } = localDateTime(now, timeZone);
  const ctxLine = context ? `\nContexto: ${context}` : '';
  return `${BASE}\n${BY_PERSONA[type]}\nData/hora atual da clínica (${timeZone}): ${date} ${time}. Resolva datas relativas (ex.: "quinta de manhã") para datas concretas nesse fuso antes de chamar tools.${ctxLine}`;
}
```

- [ ] **Step 4: Rodar (PASS)** — `npx jest src/core/ia-agent/__tests__/personas.test.ts -v`

- [ ] **Step 5: Commit**

```bash
git add src/core/ia-agent/personas.ts src/core/ia-agent/__tests__/personas.test.ts
git commit -m "feat(ia-agent): personas with clinic-timezone date injection"
```

---

## Task 3: Orquestrador — loop LLM↔tools (histórico, confirmação que vincula args, erro estruturado)

**Files:**
- Create: `src/core/ia-agent/orchestrator-logic.ts`
- Test: `src/core/ia-agent/__tests__/orchestrator-logic.test.ts`

- [ ] **Step 1: Escrever os testes**

```ts
import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider, RemoteTool } from '../types';

const tool: RemoteTool = { name: 'operacional.consultarDisponibilidade', alias: 'operacional__consultarDisponibilidade', description: 'x', inputSchemaJson: { type: 'object', properties: {} }, module: 'operacional', permissions: ['operacional:view'] };
function app(o: Partial<AppBinding> = {}): AppBinding {
  return { listTools: async () => ({ ok: true, catalog: { version: 'v1', tools: [tool] } }), executeAction: async () => ({ ok: true, data: { slots: ['09:00'] } }), ...o };
}
function provider(seq: Array<{ text: string | null; toolCalls?: any[] }>): LlmProvider {
  let i = 0; return { complete: async () => { const s = seq[Math.min(i++, seq.length - 1)]; return { text: s.text, toolCalls: s.toolCalls ?? [] }; } };
}
const callTool = (args = '{}') => ({ text: null as string | null, toolCalls: [{ id: 'call-1', type: 'function' as const, function: { name: 'operacional__consultarDisponibilidade', arguments: args } }] });
const base = { handle: 'h', conversationId: 'c1', source: 'system' as const, personaType: 'paciente' as const, context: '', timezone: 'America/Sao_Paulo', userMessage: 'horários?' };

describe('runTurn', () => {
  it('tool then final answer; passes tool_call_id as idempotencyKey', async () => {
    let seenKey = '';
    const p = provider([callTool(), { text: 'Temos 09:00 livre.' }]);
    const a = app({ executeAction: async (i) => { seenKey = i.idempotencyKey; return { ok: true, data: {} }; } });
    const r = await runTurn({ provider: p, app: a, now: new Date() }, base);
    expect(r.reply).toBe('Temos 09:00 livre.');
    expect(seenKey).toBe('call-1');
  });

  it('includes prior history in the prompt', async () => {
    let msgs: any[] = [];
    const p: LlmProvider = { complete: async (m) => { msgs = m; return { text: 'ok', toolCalls: [] }; } };
    await runTurn({ provider: p, app: app(), now: new Date() }, { ...base, history: [{ role: 'user', content: 'pergunta antiga' }, { role: 'assistant', content: 'resposta antiga' }] });
    expect(msgs.some((m) => m.content === 'resposta antiga')).toBe(true);
  });

  it('on needs_confirmation returns a pendingAction bound to alias+args', async () => {
    const p = provider([callTool('{"date":"2026-06-25"}')]);
    const r = await runTurn({ provider: p, app: app({ executeAction: async () => ({ ok: false, error: 'needs_confirmation' }) }), now: new Date() }, base);
    expect(r.pendingAction?.alias).toBe('operacional__consultarDisponibilidade');
    expect(r.pendingAction?.args).toEqual({ date: '2026-06-25' });
    expect(r.pendingAction?.token).toBeTruthy();
  });

  it('confirmed turn re-executes the ORIGINAL args, not the model output', async () => {
    let executedArgs: unknown = null;
    const pending = { alias: 'operacional__consultarDisponibilidade', args: { date: '2026-06-25' }, token: 'tok-1' };
    const a = app({ executeAction: async (i) => { executedArgs = i.input; return { ok: true, data: {} }; } });
    // provider não deve nem ser chamado para gerar nova tool call de execução
    const r = await runTurn({ provider: provider([{ text: 'Confirmado e feito.' }]), app: a, now: new Date() }, { ...base, pendingAction: pending, confirmedToken: 'tok-1' });
    expect(executedArgs).toEqual({ date: '2026-06-25' });
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it('escalates to human on escalate_human', async () => {
    const r = await runTurn({ provider: provider([callTool()]), app: app({ executeAction: async () => ({ ok: false, error: 'escalate_human' }) }), now: new Date() }, base);
    expect(r.escalated).toBe(true);
  });

  it('feeds structured error (error+level+message) back to the model', async () => {
    let toolMsg = '';
    const p: LlmProvider = { complete: async (m) => {
      const last = m[m.length - 1];
      if (last?.role === 'tool') { toolMsg = last.content; return { text: 'ok', toolCalls: [] }; }
      return callTool();
    } };
    await runTurn({ provider: p, app: app({ executeAction: async () => ({ ok: false, error: 'forbidden', level: 'proibido', message: 'Sem permissão.' }) }), now: new Date() }, base);
    expect(toolMsg).toContain('forbidden');
    expect(toolMsg).toContain('Sem permissão.');
  });

  it('falls back when listTools fails', async () => {
    const r = await runTurn({ provider: provider([{ text: 'x' }]), app: app({ listTools: async () => ({ ok: false, error: 'down' }) }), now: new Date() }, base);
    expect(r.turnsUsed).toBe(0); expect(r.reply.length).toBeGreaterThan(0);
  });

  it('stops at guard limit', async () => {
    const r = await runTurn({ provider: provider([callTool()]), app: app(), now: new Date(), maxIterations: 3 }, base);
    expect(r.turnsUsed).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar (FAIL)** — `npx jest src/core/ia-agent/__tests__/orchestrator-logic.test.ts -v`

- [ ] **Step 3: Implementar** (`src/core/ia-agent/orchestrator-logic.ts`)

```ts
import type { AppBinding, ChatMessage, LlmProvider, LlmTool, RunTurnInput, RunTurnResult } from './types';
import { personaSystemPrompt } from './personas';

export interface RunTurnDeps { provider: LlmProvider; app: AppBinding; now: Date; maxIterations?: number; newToken?: () => string; }

const FALLBACK = 'Só um momento — vou verificar e já te retorno.';

export async function runTurn(deps: RunTurnDeps, input: RunTurnInput): Promise<RunTurnResult> {
  const maxIterations = deps.maxIterations ?? 5;
  const newToken = deps.newToken ?? (() => crypto.randomUUID());

  // Caminho de confirmação: reexecuta os args ORIGINAIS (não os do modelo). Vincula alias+args.
  if (input.pendingAction && input.confirmedToken && input.confirmedToken === input.pendingAction.token) {
    const pa = input.pendingAction;
    const exec = await deps.app.executeAction({
      handle: input.handle, conversationId: input.conversationId,
      idempotencyKey: pa.token, alias: pa.alias, input: pa.args, flags: { confirmed: true },
    });
    if (!exec.ok) return { reply: errorReply(exec.error), turnsUsed: 1, escalated: exec.error === 'escalate_human' };
    return { reply: 'Pronto, confirmado e executado.', turnsUsed: 1 };
  }

  // 1. catálogo (falha → fallback, não chama o LLM às cegas)
  const toolsResp = await deps.app.listTools({ handle: input.handle, conversationId: input.conversationId });
  if (!toolsResp.ok) return { reply: FALLBACK, turnsUsed: 0 };
  const llmTools: LlmTool[] = toolsResp.catalog.tools.map((t) => ({ type: 'function', function: { name: t.alias, description: t.description, parameters: t.inputSchemaJson } }));

  // 2. monta o prompt COM histórico (memória real entre turnos)
  const messages: ChatMessage[] = [
    { role: 'system', content: personaSystemPrompt(input.personaType, input.context, deps.now, input.timezone) },
    ...(input.history ?? []),
    { role: 'user', content: input.userMessage },
  ];

  let turnsUsed = 0;
  for (let i = 0; i < maxIterations; i++) {
    turnsUsed = i + 1;
    const completion = await deps.provider.complete(messages, llmTools);
    if (!completion.toolCalls.length) return { reply: completion.text ?? FALLBACK, turnsUsed };

    messages.push({ role: 'assistant', content: completion.text ?? '', tool_calls: completion.toolCalls });
    for (const call of completion.toolCalls) {
      const alias = call.function.name;
      let args: unknown = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }

      const exec = await deps.app.executeAction({
        handle: input.handle, conversationId: input.conversationId,
        idempotencyKey: call.id,                 // anti-replay por ação
        alias, input: args, flags: { confirmed: false },
      });

      if (!exec.ok) {
        if (exec.error === 'needs_confirmation' || exec.error === 'needs_identity') {
          const ask = exec.error === 'needs_identity' ? 'preciso confirmar sua identidade' : 'você confirma esta ação';
          return { reply: `Para prosseguir, ${ask}. Posso seguir?`, turnsUsed, pendingAction: { alias, args, token: newToken() } };
        }
        if (exec.error === 'escalate_human') return { reply: errorReply('escalate_human'), turnsUsed, escalated: true };
        // erro estruturado completo realimentado ao modelo
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: exec.error, level: exec.level, message: exec.message }) });
        continue;
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(exec.data) });
    }
  }
  return { reply: FALLBACK, turnsUsed };
}

function errorReply(error: string): string {
  if (error === 'escalate_human') return 'Vou encaminhar você para um atendente da clínica para concluir isso. Um instante.';
  return 'Não consegui concluir agora. Posso ajudar de outra forma?';
}
```

- [ ] **Step 4: Rodar (PASS)** — `npx jest src/core/ia-agent/__tests__/orchestrator-logic.test.ts -v` → 8/8.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/core/ia-agent/orchestrator-logic.ts src/core/ia-agent/__tests__/orchestrator-logic.test.ts
git commit -m "feat(ia-agent): orchestrator loop (history, bound confirmation, structured errors)"
```

---

## Task 4: Pacote isolado do Worker `ia-agent`

**Files:** Create `src/workers/ia-agent/{package.json,wrangler.jsonc,tsconfig.json}`; Modify `package.json` raiz (scripts).

- [ ] **Step 1: `package.json`** (deps isoladas, fiel ao spike)

```json
{ "name": "ia-agent-worker", "private": true,
  "dependencies": { "agents": "0.16.2", "zod": "4.4.3" },
  "devDependencies": { "wrangler": "4.104.0", "@cloudflare/workers-types": "^4.20260625.1" } }
```

- [ ] **Step 2: Instalar isolado** — `cd src/workers/ia-agent && npm install && cd -`
Expected: `agents@0.16.2` instala **limpo** (sem `--legacy-peer-deps`); não toca o lockfile raiz.

- [ ] **Step 3: `wrangler.jsonc`** (porta fixa para smoke determinístico — achado P2 #8)

```jsonc
{
  "name": "synkroo-ia-agent", "main": "index.ts",
  "compatibility_date": "2026-06-25", "compatibility_flags": ["nodejs_compat"],
  "durable_objects": { "bindings": [{ "name": "AGENT", "class_name": "AgentOrchestrator" }] },
  "services": [{ "binding": "APP", "service": "synkroo-ia-bridge", "entrypoint": "AppService" }],
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["AgentOrchestrator"] }],
  "vars": { "IA_LLM_BASE_URL": "https://opencode.ai/zen/v1", "IA_LLM_MODEL": "deepseek-v4-flash-free" },
  "dev": { "port": 8788 },
  "observability": { "enabled": true }
}
```

> `OPENCODE_ZEN_API_KEY` é **secret** (`wrangler secret put`); dev via `.dev.vars`.

- [ ] **Step 4: `tsconfig.json`** (isolado, igual ao do ia-bridge)

```jsonc
{ "compilerOptions": { "target": "ES2022", "lib": ["esnext", "dom"], "strict": true, "noEmit": true, "skipLibCheck": true, "esModuleInterop": true, "module": "esnext", "moduleResolution": "bundler", "resolveJsonModule": true, "isolatedModules": true, "types": ["@cloudflare/workers-types"], "paths": { "@/*": ["../../*"] }, "baseUrl": "." },
  "include": ["index.ts", "worker-configuration.d.ts"] }
```

- [ ] **Step 5: Tipos + scripts** — `npx wrangler types --config src/workers/ia-agent/wrangler.jsonc --path src/workers/ia-agent/worker-configuration.d.ts`. Em `package.json` raiz:

```json
"dev:ia-agent": "wrangler dev --config src/workers/ia-agent/wrangler.jsonc --port 8788",
"deploy:ia-agent": "wrangler deploy --config src/workers/ia-agent/wrangler.jsonc",
"typecheck:ia-agent": "tsc --noEmit --project src/workers/ia-agent/tsconfig.json"
```

- [ ] **Step 6: Commit**

```bash
git add src/workers/ia-agent/package.json src/workers/ia-agent/wrangler.jsonc src/workers/ia-agent/tsconfig.json package.json
git commit -m "feat(ia-agent): isolated worker package (agents + zod4) + config"
```

---

## Task 5: Casca `AgentOrchestrator` (Durable Object, `@callable`, histórico real)

**Files:** Create `src/workers/ia-agent/index.ts`. Validado via `wrangler` (importa `agents`/`cloudflare:workers` — não roda em Jest).

Fiel a `spikes/agent-worker/src/index.ts`: `extends Agent`, `@callable()` no método RPC, `this.state`/`setState`, `getAgentByName` (usado pelo caller no Plano 3). **Um** scratchpad: `this.state.history` (sem `this.sql` — achado P2 #6).

- [ ] **Step 1: Implementar a casca** (`src/workers/ia-agent/index.ts`)

```ts
import { Agent, callable, routeAgentRequest } from 'agents';
import { createZenProvider } from '@/core/ia-agent/provider-zen';
import { runTurn as runAgentTurn } from '@/core/ia-agent/orchestrator-logic';
import type { AppBinding, RunTurnInput, RunTurnResult, ChatMessage, PendingAction } from '@/core/ia-agent/types';

export interface Env {
  AGENT: DurableObjectNamespace<AgentOrchestrator>;
  APP: AppBinding;                 // service binding → ia-bridge (AppService)
  OPENCODE_ZEN_API_KEY: string;
  IA_LLM_BASE_URL: string;
  IA_LLM_MODEL: string;
}

type SessionState = { history: ChatMessage[]; pendingAction: PendingAction | null };

export class AgentOrchestrator extends Agent<Env, SessionState> {
  initialState: SessionState = { history: [], pendingAction: null };

  // Exposto via RPC ao caller (Plano 3): const a = await getAgentByName(env.AGENT, id); await a.runTurn({...})
  @callable()
  async runTurn(input: Omit<RunTurnInput, 'history' | 'pendingAction'>): Promise<RunTurnResult> {
    const provider = createZenProvider({ apiKey: this.env.OPENCODE_ZEN_API_KEY, model: this.env.IA_LLM_MODEL, baseUrl: this.env.IA_LLM_BASE_URL });

    const result = await runAgentTurn({ provider, app: this.env.APP, now: new Date() }, {
      ...input,
      history: this.state.history,                 // memória real entre turnos
      pendingAction: this.state.pendingAction ?? undefined,
    });

    // único scratchpad: this.state (janela curta). Transcript durável = app-side (Plano 3).
    const nextHistory = [...this.state.history, { role: 'user' as const, content: input.userMessage }, { role: 'assistant' as const, content: result.reply }].slice(-20);
    this.setState({ history: nextHistory, pendingAction: result.pendingAction ?? null });
    return result;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response('ia-agent up', { status: 200 });
  },
};
```

> O caller passa `confirmedToken` no `input` quando detecta o "sim" do usuário; a casca repassa `this.state.pendingAction` para a lógica vincular alias+args.

- [ ] **Step 2: Typecheck do worker** — `npm run typecheck:ia-agent` → 0 erros.

- [ ] **Step 3: Smoke determinístico (requer o ia-bridge no ar)**

Run (terminais): `npm run dev:ia-bridge` (porta padrão) e `npm run dev:ia-agent` (porta **8788** fixa).
Run: `curl -s http://localhost:8788/` → Expected: `ia-agent up` (HTTP 200).

> O RPC ponta-a-ponta (caller → `runTurn` → `ia-bridge`) é exercitado no Plano 3.

- [ ] **Step 4: Commit**

```bash
git add src/workers/ia-agent/index.ts src/workers/ia-agent/worker-configuration.d.ts
git commit -m "feat(ia-agent): AgentOrchestrator DO (@callable runTurn, real session history)"
```

---

## Task 6: Robustez da lógica

**Files:** Test `src/core/ia-agent/__tests__/orchestrator-failures.test.ts`

- [ ] **Step 1: Escrever os testes de robustez**

```ts
import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider, RemoteTool } from '../types';

const tool: RemoteTool = { name: 'operacional.consultarDisponibilidade', alias: 'operacional__consultarDisponibilidade', description: 'x', inputSchemaJson: { type: 'object', properties: {} }, module: 'operacional', permissions: ['operacional:view'] };
const okApp: AppBinding = { listTools: async () => ({ ok: true, catalog: { version: 'v1', tools: [tool] } }), executeAction: async () => ({ ok: true, data: {} }) };
const callTool = (args = '{}') => ({ text: null as string | null, toolCalls: [{ id: 'c1', type: 'function' as const, function: { name: 'operacional__consultarDisponibilidade', arguments: args } }] });
const provider = (seq: any[]) => { let i = 0; return { complete: async () => seq[Math.min(i++, seq.length - 1)] } as LlmProvider; };
const base = { handle: 'h', conversationId: 'c1', source: 'system' as const, personaType: 'recepcao' as const, context: '', timezone: 'America/Sao_Paulo', userMessage: 'oi' };

describe('runTurn — robustez', () => {
  it('recovers from forbidden (fed back as tool error)', async () => {
    const p = provider([callTool(), { text: 'Não tenho permissão para isso.', toolCalls: [] }]);
    const r = await runTurn({ provider: p, app: { ...okApp, executeAction: async () => ({ ok: false, error: 'forbidden', level: 'proibido', message: 'Sem permissão.' }) }, now: new Date() }, base);
    expect(r.reply).toContain('permissão');
  });
  it('handles malformed tool args', async () => {
    const p = provider([{ text: null, toolCalls: [{ id: 'c1', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{bad' } }] }, { text: 'ok', toolCalls: [] }]);
    expect((await runTurn({ provider: p, app: okApp, now: new Date() }, base)).reply).toBe('ok');
  });
  it('non-empty fallback on empty completion', async () => {
    expect((await runTurn({ provider: provider([{ text: null, toolCalls: [] }]), app: okApp, now: new Date() }, base)).reply.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar** — `npx jest src/core/ia-agent/__tests__/orchestrator-failures.test.ts -v` → 3/3.

- [ ] **Step 3: Gate completo**

```bash
npm run typecheck && npm run typecheck:ia-bridge && npm run typecheck:ia-agent
npm run lint
npm test
```
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add src/core/ia-agent/__tests__/orchestrator-failures.test.ts
git commit -m "test(ia-agent): orchestrator robustness (forbidden, malformed args, empty)"
```

---

## Self-Review Checklist

- **Task 0 (P0):** handle reutilizável + idempotencyKey por ação — desbloqueia o loop multi-tool; dedup testado.
- **Provider Zen** (Task 1), **personas com timezone** da clínica (Task 2, P1 #5).
- **Loop** (Task 3): histórico real no prompt (P1 #3), confirmação que **vincula alias+args** (P1 #4), erro estruturado realimentado (P2 #7), guard, escalate.
- **Pacote isolado** instala limpo (Task 4); **`@callable`** + 1 scratchpad (Task 5, P0 #2 / P2 #6); porta fixa (P2 #8).
- **Robustez + testes** de idempotência/histórico/timezone/confirmação (Tasks 0/2/3/6, P2 #9).

> **Notas para o executor:**
> - **Referência fiel:** `spike/ia-agente-referencia` — `agent-worker/src/index.ts` (`@callable`, Agent/DO, `getAgentByName`), `zen-tool-calling.ts` (provider/retry/formato de tools e tool result).
> - **Task 0 primeiro:** sem o patch do `ia-bridge`, o loop quebra em `replayed`.
> - **Sem Postgres no agente:** toda capacidade é via `env.APP` (ia-bridge).
> - **Plano 3 (canais):** resolução de interlocutor (DB, app-side), emissão de handle, `getAgentByName(...).runTurn(...)`, detecção do "sim" → `confirmedToken`, persistência/envio via `atendimento.*`, e service bindings no OpenNext (`getCloudflareContext`) — de-riscar com mini-spike antes.
