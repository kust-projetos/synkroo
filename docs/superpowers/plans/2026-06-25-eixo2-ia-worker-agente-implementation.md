# Agente IA — Worker do Agente (Plano 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o "cérebro" do Agente IA: um Worker dedicado (`ia-agent`) que roda um orquestrador como Durable Object (Cloudflare Agents SDK), com LLM pluggable (OpenCode Zen) e um loop LLM↔tools que consome as Actions **exclusivamente** via o `ia-bridge` (Plano 1) por service binding — sem acessar Postgres nem a Action Layer diretamente.

**Architecture:** A **lógica** (provider Zen, personas, loop orquestrador) vive em `src/core/ia-agent/` (pura, deps injetadas, testável em Jest — não depende do Agents SDK nem de zod 4). A **casca** `AgentOrchestrator extends Agent` (DO) vive no pacote isolado `src/workers/ia-agent/` (deps `agents`+zod 4, validada via `wrangler dev`), mantém o estado da sessão (`this.sql`/`this.state`) e injeta as deps reais (provider + binding `APP`→`ia-bridge`). Tools vêm prontas do `ia-bridge` (alias provider-safe + JSON Schema). Segurança: o agente nunca executa ação sem o `ia-bridge` aprovar (handle + matriz).

**Tech Stack:** Cloudflare Agents SDK (`agents@0.16.2`), Durable Objects, `cloudflare:workers` service binding; OpenCode Zen (OpenAI-compatible, `deepseek-v4-flash-free`); TypeScript 5.6, Jest. Referência fiel: branch `spike/ia-agente-referencia` (`spikes/agent-worker/src/index.ts`, `spikes/zen-tool-calling.ts`).

---

## Escopo

**Inclui (Plano 2):** pacote do Worker `ia-agent`; provider Zen (pluggable); personas (system prompt + injeção de data); loop orquestrador (LLM↔tools, guard anti-loop, tratamento de matriz/erros); casca `AgentOrchestrator` (DO) com estado de sessão + binding `APP`; wrangler do agente; testes da lógica (Jest) + casca via `wrangler`.

**Fora (Plano 3 — canais/integração OpenNext):** webhook WhatsApp inbound, rota `/api/ia/chat`, resolução de interlocutor (telefone→paciente/lead, precisa de DB → app-side), persistência de mensagens (`atendimento.receberMensagem`/`enviarMensagem`), service bindings nas rotas Next (OpenNext `getCloudflareContext`). O `ia-agent` recebe `personaType`+`context`+`handle` **prontos** do caller (Plano 3) e devolve a `reply`.

---

## Contrato do agente (entrada/saída do `runTurn`)

```
runTurn(input) → resultado
  input:  { handle, conversationId, source: 'system'|'agent_delegated',
            personaType, context, userMessage,
            confirmedAlias?: string /* alias que o usuário confirmou neste turno */ }
  output: { reply: string, turnsUsed: number,
            escalated?: boolean, pendingConfirmation?: string }
```
O caller (Plano 3) persiste/transporta a `reply` pelo canal. O agente só pensa e age via `ia-bridge`.

---

## File Structure

| Path | Responsabilidade |
|---|---|
| `src/core/ia-agent/types.ts` | `LlmProvider`, `AppBinding`, `ChatMessage`, `RunTurnInput`, `RunTurnResult`, `PersonaType` |
| `src/core/ia-agent/provider-zen.ts` | Adapter OpenCode Zen (OpenAI-compatible): `complete(messages, tools)` + retry/timeout |
| `src/core/ia-agent/personas.ts` | `personaSystemPrompt(type, ctx, now)` — prompt + data atual |
| `src/core/ia-agent/orchestrator-logic.ts` | `runTurn(deps, input)` — loop LLM↔tools, guard, matriz/erros |
| `src/workers/ia-agent/index.ts` | Casca `AgentOrchestrator extends Agent` (DO) + roteamento; injeta deps reais |
| `src/workers/ia-agent/{package.json,wrangler.jsonc,tsconfig.json}` | Pacote isolado (agents + zod 4) |
| `src/core/ia-agent/__tests__/*.test.ts` | Unit/integração da lógica (Jest) |

---

## Task 1: Lógica — tipos + provider Zen

**Files:**
- Create: `src/core/ia-agent/types.ts`, `src/core/ia-agent/provider-zen.ts`
- Test: `src/core/ia-agent/__tests__/provider-zen.test.ts`

Fiel a `spikes/zen-tool-calling.ts`: OpenAI-compatible, `tool_choice: 'auto'`, `temperature: 0`, retry em AbortError/5xx/429 com timeout de 30s.

- [ ] **Step 1: Definir os tipos** (`src/core/ia-agent/types.ts`)

```ts
export type PersonaType = 'vendas' | 'paciente' | 'recepcao' | 'funcionario';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

// Tool no formato OpenAI function-calling (name = alias provider-safe vindo do ia-bridge).
export interface LlmTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface LlmCompletion { text: string | null; toolCalls: ToolCall[]; }

export interface LlmProvider {
  complete(messages: ChatMessage[], tools: LlmTool[]): Promise<LlmCompletion>;
}

// Espelha a superfície RPC do ia-bridge (Plano 1).
export interface AppBinding {
  listTools(input: { handle: string; conversationId: string }):
    Promise<{ ok: true; catalog: { version: string; tools: RemoteTool[] } } | { ok: false; error: string }>;
  executeAction(input: { handle: string; conversationId: string; alias: string; input: unknown; flags: { confirmed: boolean; identityVerified?: boolean } }):
    Promise<{ ok: true; data: unknown } | { ok: false; error: string; level?: string; message?: string }>;
}

export interface RemoteTool {
  name: string; alias: string; description: string;
  inputSchemaJson: Record<string, unknown>; module: string; permissions: string[];
}

export interface RunTurnInput {
  handle: string; conversationId: string;
  source: 'system' | 'agent_delegated';
  personaType: PersonaType; context: string; userMessage: string;
  confirmedAlias?: string;
}

export interface RunTurnResult {
  reply: string; turnsUsed: number;
  escalated?: boolean; pendingConfirmation?: string;
}
```

- [ ] **Step 2: Escrever o teste do provider** (`__tests__/provider-zen.test.ts`)

```ts
import { createZenProvider } from '../provider-zen';
import type { LlmTool } from '../types';

const tool: LlmTool = { type: 'function', function: { name: 'operacional__consultarDisponibilidade', description: 'x', parameters: { type: 'object', properties: {} } } };

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return jest.fn().mockResolvedValue({ ok, status, text: async () => JSON.stringify(body) });
}

describe('zen provider', () => {
  it('parses tool_calls from an OpenAI-compatible response', async () => {
    const fetchMock = mockFetchOnce({ choices: [{ message: { content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{"date":"2026-06-25"}' } }] } }] });
    const provider = createZenProvider({ apiKey: 'k', model: 'deepseek-v4-flash-free', baseUrl: 'https://opencode.ai/zen/v1', fetchImpl: fetchMock as unknown as typeof fetch });
    const out = await provider.complete([{ role: 'user', content: 'horários?' }], [tool]);
    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0].function.name).toBe('operacional__consultarDisponibilidade');
  });

  it('parses a plain text answer', async () => {
    const fetchMock = mockFetchOnce({ choices: [{ message: { content: 'Olá!', tool_calls: undefined } }] });
    const provider = createZenProvider({ apiKey: 'k', model: 'm', baseUrl: 'https://x/v1', fetchImpl: fetchMock as unknown as typeof fetch });
    const out = await provider.complete([{ role: 'user', content: 'oi' }], []);
    expect(out.text).toBe('Olá!');
    expect(out.toolCalls).toHaveLength(0);
  });

  it('retries once on HTTP 429 then succeeds', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate' })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) });
    const provider = createZenProvider({ apiKey: 'k', model: 'm', baseUrl: 'https://x/v1', fetchImpl: fetchMock as unknown as typeof fetch });
    const out = await provider.complete([{ role: 'user', content: 'oi' }], []);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.text).toBe('ok');
  });
});
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `npx jest src/core/ia-agent/__tests__/provider-zen.test.ts -v`
Expected: FAIL (módulo não existe).

- [ ] **Step 4: Implementar** (`src/core/ia-agent/provider-zen.ts`)

```ts
import type { ChatMessage, LlmCompletion, LlmProvider, LlmTool } from './types';

export interface ZenConfig {
  apiKey: string; model: string; baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch; // injetável para testes
}

export function createZenProvider(cfg: ZenConfig): LlmProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  const endpoint = cfg.baseUrl.endsWith('/') ? `${cfg.baseUrl}chat/completions` : `${cfg.baseUrl}/chat/completions`;

  async function call(messages: ChatMessage[], tools: LlmTool[]): Promise<LlmCompletion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 30000);
    try {
      const res = await doFetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, messages, tools, tool_choice: tools.length ? 'auto' : undefined, temperature: 0 }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text);
      const message = json.choices?.[0]?.message ?? {};
      return { text: message.content ?? null, toolCalls: message.tool_calls ?? [] };
    } finally {
      clearTimeout(timeout);
    }
  }

  function isRetryable(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return err.name === 'AbortError' || /HTTP (408|409|429|5\d\d)/.test(err.message);
  }

  return {
    async complete(messages, tools) {
      try { return await call(messages, tools); }
      catch (err) { if (!isRetryable(err)) throw err; return await call(messages, tools); }
    },
  };
}
```

- [ ] **Step 5: Rodar (deve passar)**

Run: `npx jest src/core/ia-agent/__tests__/provider-zen.test.ts -v`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/core/ia-agent/types.ts src/core/ia-agent/provider-zen.ts src/core/ia-agent/__tests__/provider-zen.test.ts
git commit -m "feat(ia-agent): zen provider (openai-compatible) + types"
```

---

## Task 2: Personas (system prompt + injeção de data)

**Files:**
- Create: `src/core/ia-agent/personas.ts`
- Test: `src/core/ia-agent/__tests__/personas.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
import { personaSystemPrompt } from '../personas';

describe('personaSystemPrompt', () => {
  const now = new Date('2026-06-25T12:00:00.000Z');
  it('injects current date and persona objective', () => {
    const p = personaSystemPrompt('paciente', 'Paciente: João (últjudo retorno em abril)', now);
    expect(p).toContain('2026-06-25');         // data atual injetada (resolução temporal)
    expect(p.toLowerCase()).toContain('paciente');
    expect(p).toContain('João');               // contexto injetado
  });
  it('vendas persona focuses on qualifying/scheduling', () => {
    const p = personaSystemPrompt('vendas', '', now);
    expect(p.toLowerCase()).toMatch(/vendas|avaliação|agendar/);
  });
  it('funcionario persona is internal/management', () => {
    const p = personaSystemPrompt('funcionario', '', now);
    expect(p.toLowerCase()).toMatch(/interno|gestão|equipe/);
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx jest src/core/ia-agent/__tests__/personas.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Implementar** (`src/core/ia-agent/personas.ts`)

```ts
import type { PersonaType } from './types';

const BASE = [
  'Você é o assistente virtual de uma clínica odontológica. Responda sempre em pt-BR, de forma objetiva e cordial.',
  'Use as tools disponíveis quando precisar de dados ou executar ações; não invente horários, preços ou dados de pacientes.',
  'Quando uma ação exigir confirmação, pergunte antes de executar.',
].join(' ');

const BY_PERSONA: Record<PersonaType, string> = {
  vendas: 'Perfil do interlocutor: LEAD (possível novo paciente). Objetivo: qualificar o interesse e agendar uma avaliação. Seja consultivo, sem pressionar.',
  paciente: 'Perfil do interlocutor: PACIENTE já cadastrado. Objetivo: relacionamento — agenda, confirmação, retorno e dúvidas. Trate dados sensíveis com cuidado.',
  recepcao: 'Perfil do interlocutor: DESCONHECIDO (sem cadastro). Objetivo: recepcionar, tirar dúvidas gerais e, se houver interesse, encaminhar para avaliação. Não exponha dados de terceiros.',
  funcionario: 'Perfil do interlocutor: FUNCIONÁRIO da clínica (uso interno). Objetivo: apoiar tarefas de gestão e operação da equipe conforme as permissões do usuário.',
};

export function personaSystemPrompt(type: PersonaType, context: string, now: Date): string {
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 16);
  const ctxLine = context ? `\nContexto: ${context}` : '';
  return `${BASE}\n${BY_PERSONA[type]}\nData/hora atual (UTC): ${date} ${time}. Resolva datas relativas (ex.: "quinta de manhã") para datas concretas antes de chamar tools.${ctxLine}`;
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx jest src/core/ia-agent/__tests__/personas.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ia-agent/personas.ts src/core/ia-agent/__tests__/personas.test.ts
git commit -m "feat(ia-agent): personas (system prompt + date injection)"
```

---

## Task 3: Orquestrador — loop LLM↔tools (lógica pura)

**Files:**
- Create: `src/core/ia-agent/orchestrator-logic.ts`
- Test: `src/core/ia-agent/__tests__/orchestrator-logic.test.ts`

`runTurn` monta o prompt (persona), pega o catálogo de tools do `ia-bridge`, e roda o loop: LLM → toolCalls → `app.executeAction` → realimenta, com guard de iterações e tratamento dos veredictos da matriz.

- [ ] **Step 1: Escrever os testes do loop**

```ts
import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider, RemoteTool } from '../types';

const remoteTool: RemoteTool = { name: 'operacional.consultarDisponibilidade', alias: 'operacional__consultarDisponibilidade', description: 'x', inputSchemaJson: { type: 'object', properties: {} }, module: 'operacional', permissions: ['operacional:view'] };

function app(overrides: Partial<AppBinding> = {}): AppBinding {
  return {
    listTools: async () => ({ ok: true, catalog: { version: 'v1', tools: [remoteTool] } }),
    executeAction: async () => ({ ok: true, data: { slots: ['09:00'] } }),
    ...overrides,
  };
}
function provider(seq: Array<{ text: string | null; toolCalls?: any[] }>): LlmProvider {
  let i = 0;
  return { complete: async () => { const s = seq[Math.min(i++, seq.length - 1)]; return { text: s.text, toolCalls: s.toolCalls ?? [] }; } };
}
const baseInput = { handle: 'h', conversationId: 'c1', source: 'system' as const, personaType: 'paciente' as const, context: '', userMessage: 'horários quinta?' };

describe('runTurn', () => {
  it('calls a tool then returns the final answer', async () => {
    const p = provider([
      { text: null, toolCalls: [{ id: 't1', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' } }] },
      { text: 'Temos 09:00 livre.' },
    ]);
    const r = await runTurn({ provider: p, app: app(), now: new Date('2026-06-25') }, baseInput);
    expect(r.reply).toBe('Temos 09:00 livre.');
    expect(r.turnsUsed).toBe(2);
  });

  it('returns plain answer without tools', async () => {
    const r = await runTurn({ provider: provider([{ text: 'Olá, como ajudo?' }]), app: app(), now: new Date() }, baseInput);
    expect(r.reply).toBe('Olá, como ajudo?');
  });

  it('asks for confirmation when ia-bridge returns needs_confirmation', async () => {
    const p = provider([{ text: null, toolCalls: [{ id: 't1', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' } }] }]);
    const r = await runTurn({ provider: p, app: app({ executeAction: async () => ({ ok: false, error: 'needs_confirmation' }) }), now: new Date() }, baseInput);
    expect(r.pendingConfirmation).toBe('operacional__consultarDisponibilidade');
    expect(r.reply.toLowerCase()).toContain('confirm');
  });

  it('escalates to human when ia-bridge returns escalate_human', async () => {
    const p = provider([{ text: null, toolCalls: [{ id: 't1', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' } }] }]);
    const r = await runTurn({ provider: p, app: app({ executeAction: async () => ({ ok: false, error: 'escalate_human' }) }), now: new Date() }, baseInput);
    expect(r.escalated).toBe(true);
  });

  it('stops at the guard limit and returns a fallback', async () => {
    // sempre pede tool → nunca conclui
    const p = provider([{ text: null, toolCalls: [{ id: 't', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' } }] }]);
    const r = await runTurn({ provider: p, app: app(), now: new Date(), maxIterations: 3 }, baseInput);
    expect(r.turnsUsed).toBe(3);
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it('falls back when listTools fails (bridge down)', async () => {
    const r = await runTurn({ provider: provider([{ text: 'x' }]), app: app({ listTools: async () => ({ ok: false, error: 'binding_down' }) }), now: new Date() }, baseInput);
    expect(r.reply.length).toBeGreaterThan(0);
    expect(r.turnsUsed).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx jest src/core/ia-agent/__tests__/orchestrator-logic.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Implementar** (`src/core/ia-agent/orchestrator-logic.ts`)

```ts
import type { AppBinding, ChatMessage, LlmProvider, LlmTool, RunTurnInput, RunTurnResult } from './types';
import { personaSystemPrompt } from './personas';

export interface RunTurnDeps {
  provider: LlmProvider;
  app: AppBinding;
  now: Date;
  maxIterations?: number;
}

const FALLBACK = 'Só um momento — vou verificar e já te retorno.';

export async function runTurn(deps: RunTurnDeps, input: RunTurnInput): Promise<RunTurnResult> {
  const maxIterations = deps.maxIterations ?? 5;

  // 1. catálogo de tools (do ia-bridge). Falha → fallback (não chama o LLM às cegas).
  const toolsResp = await deps.app.listTools({ handle: input.handle, conversationId: input.conversationId });
  if (!toolsResp.ok) return { reply: FALLBACK, turnsUsed: 0 };

  const llmTools: LlmTool[] = toolsResp.catalog.tools.map((t) => ({
    type: 'function', function: { name: t.alias, description: t.description, parameters: t.inputSchemaJson },
  }));
  const aliasToReal = new Map(toolsResp.catalog.tools.map((t) => [t.alias, t.name]));

  const messages: ChatMessage[] = [
    { role: 'system', content: personaSystemPrompt(input.personaType, input.context, deps.now) },
    { role: 'user', content: input.userMessage },
  ];

  let turnsUsed = 0;
  for (let i = 0; i < maxIterations; i++) {
    turnsUsed = i + 1;
    const completion = await deps.provider.complete(messages, llmTools);

    if (!completion.toolCalls.length) {
      return { reply: completion.text ?? FALLBACK, turnsUsed };
    }

    // processa as tool calls deste passo
    messages.push({ role: 'assistant', content: completion.text ?? '', tool_calls: completion.toolCalls });
    for (const call of completion.toolCalls) {
      const alias = call.function.name;
      const confirmed = input.confirmedAlias === alias;
      let args: unknown = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }

      const exec = await deps.app.executeAction({
        handle: input.handle, conversationId: input.conversationId,
        alias, input: args, flags: { confirmed },
      });

      if (!exec.ok) {
        if (exec.error === 'needs_confirmation' || exec.error === 'needs_identity') {
          const what = exec.error === 'needs_identity' ? 'preciso confirmar sua identidade' : 'você confirma esta ação';
          return { reply: `Para prosseguir, ${what}. Posso seguir?`, turnsUsed, pendingConfirmation: alias };
        }
        if (exec.error === 'escalate_human') {
          return { reply: 'Vou encaminhar você para um atendente da clínica para concluir isso. Um instante.', turnsUsed, escalated: true };
        }
        // outros erros (forbidden, expired, etc.): realimenta como resultado de erro; o LLM se adapta.
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: exec.error }) });
        continue;
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(exec.data) });
    }
  }

  // guard estourado
  return { reply: FALLBACK, turnsUsed };
}
```

> Nota: `aliasToReal` fica disponível para o caller (Plano 3) registrar nos logs qual `action.name` real foi usado; o `ia-bridge` já reverte o alias internamente na execução.

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx jest src/core/ia-agent/__tests__/orchestrator-logic.test.ts -v`
Expected: PASS (6/6).

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add src/core/ia-agent/orchestrator-logic.ts src/core/ia-agent/__tests__/orchestrator-logic.test.ts
git commit -m "feat(ia-agent): orchestrator loop (llm<->tools, guard, matrix verdicts)"
```

---

## Task 4: Pacote isolado do Worker `ia-agent`

**Files:**
- Create: `src/workers/ia-agent/package.json`, `src/workers/ia-agent/wrangler.jsonc`, `src/workers/ia-agent/tsconfig.json`
- Modify: `tsconfig.json` raiz (já exclui `src/workers/**` desde o Plano 1 — confirmar)

- [ ] **Step 1: `package.json` do pacote** (deps isoladas — zod 4, fiel ao spike)

```json
{
  "name": "ia-agent-worker",
  "private": true,
  "dependencies": { "agents": "0.16.2", "zod": "4.4.3" },
  "devDependencies": { "wrangler": "4.104.0", "@cloudflare/workers-types": "^4.20260625.1" }
}
```

- [ ] **Step 2: Instalar deps isoladas**

Run: `cd src/workers/ia-agent && npm install && cd -`
Expected: `agents@0.16.2` instala **limpo** (sem `--legacy-peer-deps`), zod 4 isolado neste pacote (não toca o lockfile raiz).

- [ ] **Step 3: `wrangler.jsonc`** (DO + service binding → ia-bridge; fiel a `spikes/agent-worker/wrangler.jsonc`)

```jsonc
{
  "name": "synkroo-ia-agent",
  "main": "index.ts",
  "compatibility_date": "2026-06-25",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": {
    "bindings": [{ "name": "AGENT", "class_name": "AgentOrchestrator" }]
  },
  "services": [{ "binding": "APP", "service": "synkroo-ia-bridge", "entrypoint": "AppService" }],
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["AgentOrchestrator"] }],
  "vars": { "IA_LLM_BASE_URL": "https://opencode.ai/zen/v1", "IA_LLM_MODEL": "deepseek-v4-flash-free" },
  "observability": { "enabled": true }
}
```

> `OPENCODE_ZEN_API_KEY` é **secret**: `npx wrangler secret put OPENCODE_ZEN_API_KEY --config src/workers/ia-agent/wrangler.jsonc`. Dev: `.dev.vars`.

- [ ] **Step 4: `tsconfig.json`** (isolado, igual ao do ia-bridge)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["esnext", "dom"], "strict": true, "noEmit": true,
    "skipLibCheck": true, "esModuleInterop": true, "module": "esnext",
    "moduleResolution": "bundler", "resolveJsonModule": true, "isolatedModules": true,
    "types": ["@cloudflare/workers-types"],
    "paths": { "@/*": ["../../*"] }, "baseUrl": "."
  },
  "include": ["index.ts", "worker-configuration.d.ts"]
}
```

- [ ] **Step 5: Gerar tipos + script**

Run: `npx wrangler types --config src/workers/ia-agent/wrangler.jsonc --path src/workers/ia-agent/worker-configuration.d.ts`
Adicionar a `package.json` raiz:
```json
"dev:ia-agent": "wrangler dev --config src/workers/ia-agent/wrangler.jsonc",
"deploy:ia-agent": "wrangler deploy --config src/workers/ia-agent/wrangler.jsonc",
"typecheck:ia-agent": "tsc --noEmit --project src/workers/ia-agent/tsconfig.json"
```

- [ ] **Step 6: Commit**

```bash
git add src/workers/ia-agent/package.json src/workers/ia-agent/wrangler.jsonc src/workers/ia-agent/tsconfig.json package.json
git commit -m "feat(ia-agent): isolated worker package (agents + zod4) + config"
```

---

## Task 5: Casca `AgentOrchestrator` (Durable Object)

**Files:**
- Create: `src/workers/ia-agent/index.ts`
- Test: validado via `wrangler dev` (importa `agents`/`cloudflare:workers` — não roda em Jest)

Fiel a `spikes/agent-worker/src/index.ts`: `extends Agent`, `this.state`/`setState`, `this.sql`, `getAgentByName`, service binding `env.APP`. A casca injeta o provider real + o binding `APP` na lógica pura (`runTurn`).

- [ ] **Step 1: Implementar a casca** (`src/workers/ia-agent/index.ts`)

```ts
import { Agent, routeAgentRequest } from 'agents';
import { createZenProvider } from '@/core/ia-agent/provider-zen';
import { runTurn as runAgentTurn } from '@/core/ia-agent/orchestrator-logic';
import type { AppBinding, RunTurnInput, RunTurnResult, ChatMessage } from '@/core/ia-agent/types';

export interface Env {
  AGENT: DurableObjectNamespace<AgentOrchestrator>;
  APP: AppBinding;                 // service binding → ia-bridge (AppService)
  OPENCODE_ZEN_API_KEY: string;
  IA_LLM_BASE_URL: string;
  IA_LLM_MODEL: string;
}

type SessionState = { turnCount: number; history: ChatMessage[] };

export class AgentOrchestrator extends Agent<Env, SessionState> {
  initialState: SessionState = { turnCount: 0, history: [] };

  // RPC chamado pelo caller (Plano 3). Mantém estado de sessão e roda um turno.
  async runTurn(input: RunTurnInput): Promise<RunTurnResult> {
    const provider = createZenProvider({
      apiKey: this.env.OPENCODE_ZEN_API_KEY,
      model: this.env.IA_LLM_MODEL,
      baseUrl: this.env.IA_LLM_BASE_URL,
    });

    const result = await runAgentTurn({ provider, app: this.env.APP, now: new Date() }, input);

    // persistência de SESSÃO (scratchpad) no DO — o transcript durável é do app-side (Plano 3)
    this.setState({ turnCount: this.state.turnCount + 1, history: [...this.state.history, { role: 'user', content: input.userMessage }, { role: 'assistant', content: result.reply }].slice(-20) });
    this.sql`CREATE TABLE IF NOT EXISTS turns (id INTEGER PRIMARY KEY, role TEXT, content TEXT, ts INTEGER)`;
    this.sql`INSERT INTO turns (role, content, ts) VALUES ('user', ${input.userMessage}, ${Date.now()})`;
    this.sql`INSERT INTO turns (role, content, ts) VALUES ('assistant', ${result.reply}, ${Date.now()})`;

    return result;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    // health/dev only; o acionamento real é por RPC (getAgentByName) a partir do caller (Plano 3)
    return (await routeAgentRequest(request, env)) ?? new Response('ia-agent up', { status: 200 });
  },
};
```

> Como o caller (Plano 3, OpenNext) obtém a instância: `const agent = await getAgentByName(env.AGENT, \`${clinicId}:${channel}:${peerId}\`); await agent.runTurn({...})`. Esse fio fica no Plano 3.

- [ ] **Step 2: Typecheck do worker**

Run: `npm run typecheck:ia-agent`
Expected: 0 erros (resolve `agents` e `cloudflare:workers` via o tsconfig isolado).

- [ ] **Step 3: Subir local (smoke) — requer o ia-bridge no ar**

Run (terminais separados): `npm run dev:ia-bridge` e `npm run dev:ia-agent`.
Run: `curl -s http://localhost:8788/` → Expected: `ia-agent up` (HTTP 200).

> O fluxo RPC ponta-a-ponta (caller → `runTurn` → `ia-bridge`) é exercitado no Plano 3. Aqui validamos que o Worker sobe, tipa e expõe o DO.

- [ ] **Step 4: Commit**

```bash
git add src/workers/ia-agent/index.ts src/workers/ia-agent/worker-configuration.d.ts
git commit -m "feat(ia-agent): AgentOrchestrator durable object (session state + runTurn)"
```

---

## Task 6: Suíte de robustez da lógica (matriz de falhas)

**Files:**
- Test: `src/core/ia-agent/__tests__/orchestrator-failures.test.ts`

- [ ] **Step 1: Escrever os testes de robustez**

```ts
import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider, RemoteTool } from '../types';

const tool: RemoteTool = { name: 'operacional.consultarDisponibilidade', alias: 'operacional__consultarDisponibilidade', description: 'x', inputSchemaJson: { type: 'object', properties: {} }, module: 'operacional', permissions: ['operacional:view'] };
const okApp: AppBinding = { listTools: async () => ({ ok: true, catalog: { version: 'v1', tools: [tool] } }), executeAction: async () => ({ ok: true, data: {} }) };
const callTool = { text: null as string | null, toolCalls: [{ id: 't', type: 'function' as const, function: { name: 'operacional__consultarDisponibilidade', arguments: '{}' } }] };
function provider(seq: any[]): LlmProvider { let i = 0; return { complete: async () => seq[Math.min(i++, seq.length - 1)] }; }
const input = { handle: 'h', conversationId: 'c1', source: 'system' as const, personaType: 'recepcao' as const, context: '', userMessage: 'oi' };

describe('runTurn — robustez', () => {
  it('feeds back forbidden as tool error and lets the LLM recover', async () => {
    const p = provider([callTool, { text: 'Não tenho permissão para isso, posso ajudar de outra forma?', toolCalls: [] }]);
    const app: AppBinding = { ...okApp, executeAction: async () => ({ ok: false, error: 'forbidden' }) };
    const r = await runTurn({ provider: p, app, now: new Date() }, input);
    expect(r.reply).toContain('permissão');
  });

  it('handles malformed tool arguments without throwing', async () => {
    const p = provider([{ text: null, toolCalls: [{ id: 't', type: 'function', function: { name: 'operacional__consultarDisponibilidade', arguments: '{bad json' } }] }, { text: 'pronto', toolCalls: [] }]);
    const r = await runTurn({ provider: p, app: okApp, now: new Date() }, input);
    expect(r.reply).toBe('pronto');
  });

  it('returns a non-empty fallback when the LLM yields empty text and no tools', async () => {
    const r = await runTurn({ provider: provider([{ text: null, toolCalls: [] }]), app: okApp, now: new Date() }, input);
    expect(r.reply.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npx jest src/core/ia-agent/__tests__/orchestrator-failures.test.ts -v`
Expected: PASS (3/3).

- [ ] **Step 3: Gate completo**

```bash
npm run typecheck
npm run typecheck:ia-agent
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

- **Provider Zen** pluggable, OpenAI-compatible, retry/timeout, fetch injetável — Task 1.
- **Personas** com injeção de data (resolução temporal do achado 6b) — Task 2.
- **Loop** LLM↔tools com guard anti-loop e veredictos da matriz (confirm/identity/escalate) — Task 3.
- **Pacote isolado** (agents + zod 4) instala limpo, sem tocar o lockfile raiz — Task 4.
- **Casca `Agent`/DO** fiel ao spike, estado de sessão, injeta deps reais — Task 5.
- **Robustez** (forbidden, args malformados, vazio) — Task 6.

> **Notas para o executor:**
> - **Referência fiel:** `spike/ia-agente-referencia` — `spikes/agent-worker/src/index.ts` (Agent/DO/getAgentByName), `spikes/zen-tool-calling.ts` (provider/retry/formato de tools e tool result).
> - **Sem Postgres no agente:** toda capacidade é via `env.APP` (ia-bridge). Não importar `@/core/actions`/DB na casca do agente.
> - **`flags.confirmed`** vem de `input.confirmedAlias` (o caller/Plano 3 decide a confirmação no diálogo); o esqueleto trata `needs_confirmation` pedindo confirmação e encerrando o turno.
> - **Plano 3 (canais)** liga isto ao mundo: resolução de interlocutor (DB, app-side), emissão de handle (ia-bridge), `getAgentByName(...).runTurn(...)`, persistência/envio via `atendimento.*`, e os service bindings no OpenNext (`getCloudflareContext`) — que devem ser de-riscados por um mini-spike antes.
