# Agente IA — Canais / Integração OpenNext (Plano 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o Agente IA ao mundo: as rotas Next (OpenNext) acionam o `ia-agent` (DO) e o `ia-bridge` via service binding, fechando o fluxo da Onda 1 — paciente manda WhatsApp → agente entende → agenda/confirma via Action → responde pelo canal; e chat interno autenticado. Inclui a correção de runtime Workers que o spike revelou.

**Architecture:** Caminho validado pelo spike (`docs/spikes/2026-06-26-opennext-binding.md`, branch `spike/ia-opennext-binding`). O app OpenNext ganha bindings `IA_BRIDGE` (service → `AppService`) e `AGENT` (DO cross-worker → `synkroo-ia-agent`). As rotas acessam via `getCloudflareContext()` e acionam: `env.IA_BRIDGE.issueHandle(...)` (handle) + **binding cru** `env.AGENT.idFromName(id).get(id).runTurn(...)` (NÃO `getAgentByName` — `agents` não existe no bundle do app). Resolução de interlocutor + persistência durável são app-side (têm DB). O agente nunca toca Postgres.

**Tech Stack:** OpenNext (`@opennextjs/cloudflare`), service bindings + Durable Object cross-worker; Action Layer (`runAction`, `buildDelegatedContext`); Evolution webhook (preservado). TypeScript 5.6, Jest. Referência fiel: `spike/ia-opennext-binding` (`src/app/api/ia/spike/route.ts`, `wrangler.toml`).

---

## Escopo

**Inclui:** Task 0 (correção runtime Workers: Playwright lazy + `HANDLE_SECRET`); bindings no wrangler do app; resolução de interlocutor (app-side); helper de acionamento (handle + binding cru do DO); rota `/api/ia/chat` (delegated); webhook WhatsApp inbound → agente (system) + resposta via `atendimento.enviarMensagem`; presets RBAC do `ia`; smoke ponta-a-ponta; remoção da rota descartável do spike.

**Fora:** RAG/Vectorize, memória em camadas, 4+1 especialistas, gestão do agente (fases futuras). Persistência durável usa as Actions de atendimento já existentes.

---

## Pré-condição crítica (achado do spike)

O `bootstrapActions()` importa `@/modules/atendimento`, cuja cadeia (`obter-qrcode` → `channel-service.ts:13`) importa `playwright` no **top-level**. No runtime Workers isso lança `ReferenceError: __dirname is not defined` e derruba qualquer Worker que faça bootstrap (ia-bridge, ia-agent). Os testes Jest (Node) não detectam. **Task 0 resolve isto e é pré-requisito de tudo.**

---

## File Structure

| Path | Responsabilidade |
|---|---|
| `src/modules/atendimento/services/channel-service.ts` | **(Task 0)** Playwright lazy (`import type` + `await import`) |
| `wrangler.toml` | **(Task 1)** bindings `IA_BRIDGE` (service) + `AGENT` (DO cross-worker) |
| `src/core/ia-channel/interlocutor.ts` | **(Task 2)** resolução telefone→paciente/lead/desconhecido; chat→funcionário (lógica pura). Usa os repos EXISTENTES (`src/repositories/patients`, `src/repositories/leads`) |
| `src/core/ia-channel/agent-invoker.ts` | **(Task 3)** acionamento: `invokeAgentWithEnv(env, input)` (puro, testável) + wrapper `invokeAgent` (`getCloudflareContext`) |
| `src/app/api/ia/chat/route.ts` | **(Task 4)** chat interno (gated + autenticado → delegated) |
| `src/modules/atendimento/services/webhook-processor-service.ts` | **(Task 5)** substituir o bloco "AI disabled" por: resolver interlocutor → invocar agente → enviar via `enviarMensagem` (por `conv.id`). Caminhos Meta **e** Evolution |
| `src/core/rbac/presets.ts` | **(Task 6)** `ia` nos presets |
| `src/core/ia-channel/__tests__/*.test.ts` | testes da lógica pura |

---

## Task 0: Correção de runtime Workers (Playwright lazy + secret)

**Files:**
- Modify: `src/modules/atendimento/services/channel-service.ts`
- Test: `src/modules/atendimento/services/__tests__/channel-service-imports.test.ts`

- [ ] **Step 1: Teste de guarda — sem import top-level de `playwright`**

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

it('channel-service does not import playwright at top-level (Workers runtime safe)', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/atendimento/services/channel-service.ts'), 'utf8');
  // import de VALOR puxa playwright em runtime (e __dirname) → proibido no top-level.
  expect(src).not.toMatch(/^import\s+\{[^}]*\bchromium\b[^}]*\}\s+from\s+['"]playwright['"]/m);
  // import TYPE é apagado no compile — permitido.
  // dynamic import (await import('playwright')) dentro de método — permitido.
});
```

- [ ] **Step 2: Rodar (FAIL)** — `npx jest src/modules/atendimento/services/__tests__/channel-service-imports.test.ts -v`

- [ ] **Step 3: Tornar o import lazy** (`channel-service.ts`)

Trocar o import top-level (linha ~13):

```ts
// ANTES:
// import { chromium, Browser, Page, BrowserContext } from 'playwright';

// DEPOIS — só TIPOS no top-level (apagados no compile, sem runtime):
import type { Browser, Page, BrowserContext } from 'playwright';
```

E onde `chromium` é usado (ex.: `launchPersistentContext`), carregar sob demanda dentro do método:

```ts
  // dentro do método que abre o browser (ex.: connect()/launch):
  const { chromium } = await import('playwright');
  this.context = await chromium.launchPersistentContext(this.sessionPath, { /* ...igual... */ });
```

> Resultado: `bootstrapActions()` deixa de puxar `playwright`/`__dirname`; o fallback Playwright só carrega quando de fato usado (caminho que nem roda em Workers, mas o import deixa de quebrar o bundle).

- [ ] **Step 4: Rodar (PASS)** — `npx jest src/modules/atendimento/services/__tests__/channel-service-imports.test.ts -v`

- [ ] **Step 5: Typecheck + suíte do atendimento (sem regressão)**

```bash
npm run typecheck
npx jest src/modules/atendimento -v
```
Expected: verde.

- [ ] **Step 6: Configurar `HANDLE_SECRET` (apenas no `ia-bridge`)**

Só o **`ia-bridge`** lê `HANDLE_SECRET` (`src/workers/ia-bridge/index.ts`): ele **emite** (`issueHandle`) e **valida** (`executeAction`) o handle. O `ia-agent` e o app **não** leem o secret — só repassam o handle opaco. Portanto o secret vive em um único lugar.

```bash
# dev local: .dev.vars do ia-bridge (gitignored)
echo "HANDLE_SECRET=$(openssl rand -hex 32)" >> .dev.vars
# prod:
npx wrangler secret put HANDLE_SECRET --config wrangler.ia-bridge.jsonc
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/atendimento/services/channel-service.ts src/modules/atendimento/services/__tests__/channel-service-imports.test.ts
git commit -m "fix(atendimento): lazy playwright import (Workers runtime __dirname crash)"
```

---

## Task 1: Bindings no `wrangler.toml` do app

**Files:**
- Modify: `wrangler.toml`

Fiel ao spike (`docs/spikes/2026-06-26-opennext-binding.md` §P1, validado por `wrangler deploy --dry-run`).

- [ ] **Step 1: Adicionar os bindings** (`wrangler.toml`)

```toml
[[services]]
binding = "IA_BRIDGE"
service = "synkroo-ia-bridge"
entrypoint = "AppService"

[[durable_objects.bindings]]
name = "AGENT"
class_name = "AgentOrchestrator"
script_name = "synkroo-ia-agent"
```

- [ ] **Step 2: Validar bindings (dry-run + build)**

```bash
npx wrangler deploy --dry-run --config wrangler.toml
npm run build:cf
```
Expected: o dry-run lista `env.AGENT (AgentOrchestrator, defined in synkroo-ia-agent)` e `env.IA_BRIDGE (synkroo-ia-bridge#AppService)`; `build:cf` completa.

- [ ] **Step 3: Commit**

```bash
git add wrangler.toml
git commit -m "feat(ia): app bindings IA_BRIDGE (service) + AGENT (DO cross-worker)"
```

---

## Task 2: Resolução de interlocutor (app-side, lógica pura)

**Files:**
- Create: `src/core/ia-channel/types.ts`, `src/core/ia-channel/interlocutor.ts`
- Test: `src/core/ia-channel/__tests__/interlocutor.test.ts`

Usa os repos **existentes** (não duplicar): `findPatientByPhone(phone, clinicId)` (`src/repositories/patients/index.ts` — retorna `PatientRow` com `name`) e `findLeadByPhone(phone, clinicId)` (`src/repositories/leads/index.ts` — `LeadRow`). A lógica recebe esses repos como deps (testável).

- [ ] **Step 1: Tipos** (`src/core/ia-channel/types.ts`)

```ts
import type { PersonaType } from '@/core/ia-agent/types';

export interface Interlocutor {
  personaType: PersonaType;
  context: string;            // contexto NÃO-sensível injetável no prompt
  peerId: string;             // telefone (whatsapp) ou userId (chat)
  patientId?: string;
  leadId?: string;
}

// Assinaturas batem com os repos reais: (phone, clinicId). PatientRow/LeadRow têm mais campos;
// só usamos id + name (estruturalmente compatível).
export interface InterlocutorDeps {
  findPatientByPhone(phone: string, clinicId: string): Promise<{ id: string; name: string } | null>;
  findLeadByPhone(phone: string, clinicId: string): Promise<{ id: string; name: string | null } | null>;
}
```

- [ ] **Step 2: Teste da resolução** (`__tests__/interlocutor.test.ts`)

```ts
import { resolveInterlocutor, resolveFuncionario } from '../interlocutor';
import type { InterlocutorDeps } from '../types';

const deps = (over: Partial<InterlocutorDeps> = {}): InterlocutorDeps => ({
  findPatientByPhone: async () => null,
  findLeadByPhone: async () => null,
  ...over,
});

describe('resolveInterlocutor (whatsapp)', () => {
  it('patient → persona paciente + name in context', async () => {
    const r = await resolveInterlocutor(deps({ findPatientByPhone: async () => ({ id: 'p1', name: 'João' }) }), 'c1', '5511999');
    expect(r.personaType).toBe('paciente');
    expect(r.patientId).toBe('p1');
    expect(r.context).toContain('João');
  });
  it('lead (not patient) → persona vendas', async () => {
    const r = await resolveInterlocutor(deps({ findLeadByPhone: async () => ({ id: 'l1', name: 'Maria' }) }), 'c1', '5511999');
    expect(r.personaType).toBe('vendas');
    expect(r.leadId).toBe('l1');
  });
  it('unknown → persona recepcao, no sensitive context', async () => {
    const r = await resolveInterlocutor(deps(), 'c1', '5511999');
    expect(r.personaType).toBe('recepcao');
    expect(r.context).toBe('');
  });
});

describe('resolveFuncionario (chat)', () => {
  it('logged-in user → persona funcionario', () => {
    const r = resolveFuncionario('user-1', 'Dra. Ana');
    expect(r.personaType).toBe('funcionario');
    expect(r.peerId).toBe('user-1');
  });
});
```

- [ ] **Step 3: Rodar (FAIL)** — `npx jest src/core/ia-channel/__tests__/interlocutor.test.ts -v`

- [ ] **Step 4: Implementar** (`src/core/ia-channel/interlocutor.ts`)

```ts
import type { Interlocutor, InterlocutorDeps } from './types';

// Identidade por telefone é DICA FRACA: contexto sensível NÃO entra só por isso (spec §Segurança).
// Aqui só o nome (não-sensível) é injetado; dados clínicos/financeiros exigem verificação no ia-bridge.
export async function resolveInterlocutor(deps: InterlocutorDeps, clinicId: string, phone: string): Promise<Interlocutor> {
  const patient = await deps.findPatientByPhone(phone, clinicId);
  if (patient) return { personaType: 'paciente', context: `Paciente: ${patient.name}`, peerId: phone, patientId: patient.id };

  const lead = await deps.findLeadByPhone(phone, clinicId);
  if (lead) return { personaType: 'vendas', context: lead.name ? `Lead: ${lead.name}` : '', peerId: phone, leadId: lead.id };

  return { personaType: 'recepcao', context: '', peerId: phone };
}

export function resolveFuncionario(userId: string, _userName: string): Interlocutor {
  // No chat interno, o principal é o usuário autenticado; o RBAC dele governa as tools.
  return { personaType: 'funcionario', context: 'Atendimento interno (funcionário).', peerId: userId };
}
```

> Wiring (Tasks 4/5): passar os repos reais como deps —
> `import { findPatientByPhone } from '@/repositories/patients';`
> `import { findLeadByPhone } from '@/repositories/leads';`
> `resolveInterlocutor({ findPatientByPhone, findLeadByPhone }, clinicId, phone)`.
> Nota de dívida (`// TODO(E-05)`): quando o módulo Comercial existir, trocar o repo legado de leads pela Action equivalente.

- [ ] **Step 5: Rodar (PASS) + commit**

```bash
npx jest src/core/ia-channel/__tests__/interlocutor.test.ts -v
git add src/core/ia-channel/types.ts src/core/ia-channel/interlocutor.ts src/core/ia-channel/__tests__/interlocutor.test.ts
git commit -m "feat(ia): interlocutor resolution (patient/lead/unknown/staff) via existing repos"
```

---

## Task 3: Helper de acionamento (handle + binding cru do DO)

**Files:**
- Create: `src/core/ia-channel/agent-invoker.ts`
- Test: `src/core/ia-channel/__tests__/agent-invoker.test.ts`

Fiel ao spike (caminho vencedor P4-B). **Não** importar `agents`. A lógica recebe `env` como parâmetro (`invokeAgentWithEnv` — testável em Jest com env mockado); o wrapper `invokeAgent` resolve o `env` via `getCloudflareContext`.

- [ ] **Step 1: Teste da lógica** (`__tests__/agent-invoker.test.ts`)

```ts
import { invokeAgentWithEnv, type AgentEnv } from '../agent-invoker';

function makeEnv() {
  const calls: Record<string, unknown> = {};
  const env: AgentEnv = {
    IA_BRIDGE: { issueHandle: async (i) => { calls.issue = i; return { handle: 'H' }; } },
    AGENT: {
      idFromName: (name) => { calls.idName = name; return { name }; },
      get: (id) => ({ runTurn: async (i) => { calls.runTurn = i; return { reply: 'oi', turnsUsed: 1 }; } }),
    },
  };
  return { env, calls };
}

describe('invokeAgentWithEnv', () => {
  it('issues handle, addresses DO by conversation, runs turn', async () => {
    const { env, calls } = makeEnv();
    const out = await invokeAgentWithEnv(env, {
      clinicId: 'c1', conversationId: 'conv-1', channel: 'whatsapp', peerId: '5511', principalRef: 'agente',
      source: 'system', personaType: 'paciente', context: 'Paciente: João', timezone: 'America/Sao_Paulo', userMessage: 'oi',
    });
    expect(out.reply).toBe('oi');
    expect((calls.issue as any).conversationId).toBe('conv-1');
    expect(calls.idName).toBe('c1:whatsapp:conv-1');         // DO endereçado por CONVERSA (conversationId)
    expect((calls.runTurn as any).handle).toBe('H');         // handle repassado ao DO
  });
});
```

- [ ] **Step 2: Rodar (FAIL)** — `npx jest src/core/ia-channel/__tests__/agent-invoker.test.ts -v`

- [ ] **Step 3: Implementar** (`src/core/ia-channel/agent-invoker.ts`)

```ts
// Aciona o ia-agent (DO) e o ia-bridge a partir do app OpenNext.
// NÃO importar 'agents' (não existe no bundle do app — spike P4-A NO-GO).
// Caminho validado: env.IA_BRIDGE.issueHandle + env.AGENT.idFromName().get().runTurn() (spike P4-B GO).
import type { RunTurnResult, PersonaType } from '@/core/ia-agent/types';

interface IaBridgeRpc {
  issueHandle(input: { clinicId: string; conversationId: string; principalRef: string; source: 'system' | 'agent_delegated'; ttlSeconds?: number }): Promise<{ handle: string }>;
}
interface AgentStub {
  runTurn(input: { handle: string; conversationId: string; source: 'system' | 'agent_delegated'; personaType: PersonaType; context: string; timezone: string; userMessage: string; confirmedToken?: string; identityVerifiedToken?: string }): Promise<RunTurnResult>;
}
export interface AgentEnv {
  IA_BRIDGE: IaBridgeRpc;
  AGENT: { idFromName(name: string): unknown; get(id: unknown): AgentStub };
}

export interface InvokeAgentInput {
  clinicId: string; conversationId: string; channel: 'whatsapp' | 'chat';
  peerId: string; principalRef: string; source: 'system' | 'agent_delegated';
  personaType: PersonaType; context: string; timezone: string;
  userMessage: string; confirmedToken?: string; identityVerifiedToken?: string;
}

// Lógica pura (testável): recebe os bindings já resolvidos.
export async function invokeAgentWithEnv(env: AgentEnv, input: InvokeAgentInput): Promise<RunTurnResult> {
  // 1. handle (ia-bridge é a autoridade do principal)
  const { handle } = await env.IA_BRIDGE.issueHandle({
    clinicId: input.clinicId, conversationId: input.conversationId,
    principalRef: input.principalRef, source: input.source, ttlSeconds: 120,
  });
  // 2. DO por CONVERSA (shard por conversationId — não por peerId; senão o mesmo usuário
  //    em 2 conversas compartilharia history/pendingAction no DO).
  const id = env.AGENT.idFromName(`${input.clinicId}:${input.channel}:${input.conversationId}`);
  const stub = env.AGENT.get(id);
  // 3. roda o turno
  return stub.runTurn({
    handle, conversationId: input.conversationId, source: input.source,
    personaType: input.personaType, context: input.context, timezone: input.timezone,
    userMessage: input.userMessage, confirmedToken: input.confirmedToken, identityVerifiedToken: input.identityVerifiedToken,
  });
}

// Wrapper runtime: resolve env via getCloudflareContext (sync, fallback async — fiel ao spike).
export async function invokeAgent(input: InvokeAgentInput): Promise<RunTurnResult> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare/cloudflare-context');
  let env: AgentEnv;
  try { env = (getCloudflareContext() as { env: AgentEnv }).env; }
  catch { env = ((await getCloudflareContext({ async: true })) as { env: AgentEnv }).env; }
  return invokeAgentWithEnv(env, input);
}
```

- [ ] **Step 4: Rodar (PASS) + typecheck + commit**

```bash
npx jest src/core/ia-channel/__tests__/agent-invoker.test.ts -v
npm run typecheck
git add src/core/ia-channel/agent-invoker.ts src/core/ia-channel/__tests__/agent-invoker.test.ts
git commit -m "feat(ia): agent invoker (pure invokeAgentWithEnv + getCloudflareContext wrapper)"
```

---

## Task 4: Rota `/api/ia/chat` (chat interno, delegated)

**Files:**
- Create: `src/app/api/ia/chat/route.ts`
- Test: `src/app/api/ia/__tests__/chat-route.test.ts` (mockando `agent-invoker` + auth)

- [ ] **Step 1: Teste da rota** (auth + gate + delega ao invoker)

```ts
const mockInvoke = jest.fn();
jest.mock('@/core/ia-channel/agent-invoker', () => ({ invokeAgent: (...a: unknown[]) => mockInvoke(...a) }));
const mockBuildCtx = jest.fn();
jest.mock('@/core/actions/context', () => ({ buildUserContext: () => mockBuildCtx() }));
jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (h: unknown) => h }));
jest.mock('@/core/modules/manifest', () => ({ moduleManifest: {} }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ia/chat/route';

function req(body: unknown) { return new Request('http://localhost/api/ia/chat', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) as unknown as NextRequest; }
const ctxWith = (can: (k: string) => boolean) => ({ user: { id: 'u1', name: 'Ana' }, clinicId: 'c1', can });

describe('POST /api/ia/chat', () => {
  beforeEach(() => { jest.clearAllMocks(); mockBuildCtx.mockResolvedValue(ctxWith((k) => k === 'ia:chat')); });

  it('delegates to invokeAgent with funcionario persona and returns reply', async () => {
    mockInvoke.mockResolvedValue({ reply: 'Olá Ana!', turnsUsed: 1 });
    const res = await POST(req({ conversationId: 'conv-1', message: 'oi' }));
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe('Olá Ana!');
    expect(mockInvoke).toHaveBeenCalledWith(expect.objectContaining({ source: 'agent_delegated', personaType: 'funcionario', channel: 'chat', principalRef: 'u1' }));
  });
  it('401 when unauthenticated', async () => {
    mockBuildCtx.mockRejectedValueOnce(new Error('unauthenticated'));
    expect((await POST(req({ conversationId: 'conv-1', message: 'oi' }))).status).toBe(401);
  });
  it('403 when missing ia:chat', async () => {
    mockBuildCtx.mockResolvedValueOnce(ctxWith(() => false));
    expect((await POST(req({ conversationId: 'conv-1', message: 'oi' }))).status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar (FAIL)** — `npx jest src/app/api/ia/__tests__/chat-route.test.ts -v`

- [ ] **Step 3: Implementar** (`src/app/api/ia/chat/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // buildUserContext lança 'unauthenticated' sem sessão; dá user + can (RBAC real).
  let ctx: Awaited<ReturnType<typeof buildUserContext>>;
  try { ctx = await buildUserContext(); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  // autorização específica: exige ia:chat (não basta o módulo ativo).
  if (!ctx.can('ia:chat')) return NextResponse.json({ error: 'Sem permissão para o assistente.' }, { status: 403 });
  const userId = ctx.user!.id, name = ctx.user!.name, clinicId = ctx.clinicId;

  const body = await request.json().catch(() => ({}));
  const conversationId: string = body.conversationId;
  const message: string = body.message;
  if (!conversationId || !message) return NextResponse.json({ error: 'conversationId e message são obrigatórios.' }, { status: 422 });

  const who = resolveFuncionario(userId, name);
  const result = await invokeAgent({
    clinicId, conversationId, channel: 'chat',
    peerId: userId, principalRef: userId, source: 'agent_delegated',
    personaType: who.personaType, context: who.context,
    timezone: 'America/Sao_Paulo',          // TODO: timezone real da clínica (clinic settings)
    userMessage: message, confirmedToken: body.confirmedToken, identityVerifiedToken: body.identityVerifiedToken,
  });

  return NextResponse.json(result);
}

export const POST = withModuleRoute('ia', moduleManifest)(handlePOST);
```

> O `buildDelegatedContext` real (perms do usuário) é reconstruído **no ia-bridge** a partir do handle (`principalRef = userId`). A rota só autentica e delega.

- [ ] **Step 4: Rodar (PASS) + typecheck + commit**

```bash
npx jest src/app/api/ia/__tests__/chat-route.test.ts -v
npm run typecheck
git add src/app/api/ia/chat/route.ts src/app/api/ia/__tests__/chat-route.test.ts
git commit -m "feat(ia): /api/ia/chat route (authenticated, delegated)"
```

---

## Task 5: Webhook WhatsApp inbound → agente (system)

**Files:**
- Create: `src/core/ia-channel/webhook-router.ts`, `src/core/ia-channel/__tests__/webhook-router.test.ts`
- Modify: `src/modules/atendimento/services/webhook-processor-service.ts` (substituir o bloco "AI disabled" nos caminhos Evolution **e** Meta)

O fluxo real **não** está no `route.ts` (que só valida e delega), e sim no `webhook-processor-service.ts`. Hoje há um placeholder explícito — `processEvolutionMessage:91-97` registra `"Message stored (AI disabled)"` (`reason: 'legacy_agent_removed'`) **depois** dos handlers de button/confirmação/waitlist. Esse é o ponto de entrada do agente. O caminho Meta (`storeAndProcessMetaMessage`) tem o ponto equivalente. A conversa **já está persistida** (`findOrCreateConversation` → `conv.id`) e a mensagem inbound já foi deduplicada por `externalMessageId`.

- [ ] **Step 1: Helper testável** (`src/core/ia-channel/webhook-router.ts`)

```ts
import type { Interlocutor } from './types';
import type { RunTurnResult } from '@/core/ia-agent/types';

export interface WebhookRouterDeps {
  resolveInterlocutor(clinicId: string, phone: string): Promise<Interlocutor>;
  invokeAgent(input: {
    clinicId: string; conversationId: string; channel: 'whatsapp'; peerId: string;
    principalRef: string; source: 'system'; personaType: Interlocutor['personaType'];
    context: string; timezone: string; userMessage: string;
  }): Promise<RunTurnResult>;
  sendReply(conversationId: string, message: string): Promise<boolean>;   // true = enviado de fato
  timezone: string;
}

// Substitui o antigo "AI disabled": roteia a mensagem inbound ao agente e envia a resposta.
// Usa conv.id (conversa persistida), NÃO chave sintética.
export async function routeInboundToAgent(
  deps: WebhookRouterDeps,
  args: { clinicId: string; conversationId: string; phone: string; content: string },
): Promise<{ from: string; action: string }> {
  const who = await deps.resolveInterlocutor(args.clinicId, args.phone);
  const result = await deps.invokeAgent({
    clinicId: args.clinicId, conversationId: args.conversationId, channel: 'whatsapp',
    peerId: args.phone, principalRef: 'agente', source: 'system',
    personaType: who.personaType, context: who.context, timezone: deps.timezone, userMessage: args.content,
  });
  if (!result.reply) return { from: args.phone, action: 'no_reply' };
  const sent = await deps.sendReply(args.conversationId, result.reply);   // envia também em escalonamento
  if (!sent) return { from: args.phone, action: 'send_failed' };
  return { from: args.phone, action: result.escalated ? 'escalated' : 'agent_replied' };
}
```

- [ ] **Step 2: Teste do helper** (`__tests__/webhook-router.test.ts`)

```ts
import { routeInboundToAgent } from '../webhook-router';

it('resolves interlocutor, invokes agent (system, conv.id), sends reply', async () => {
  const calls: Record<string, unknown> = {};
  const result = await routeInboundToAgent({
    resolveInterlocutor: async () => ({ personaType: 'paciente', context: 'Paciente: João', peerId: '5511' }),
    invokeAgent: async (i) => { calls.invoke = i; return { reply: 'Agendado!', turnsUsed: 2 }; },
    sendReply: async (convId, msg) => { calls.sent = { convId, msg }; return true; },
    timezone: 'America/Sao_Paulo',
  }, { clinicId: 'c1', conversationId: 'conv-uuid', phone: '5511', content: 'quero agendar' });

  expect((calls.invoke as any).source).toBe('system');
  expect((calls.invoke as any).conversationId).toBe('conv-uuid');   // conv.id, não sintético
  expect((calls.invoke as any).personaType).toBe('paciente');
  expect(calls.sent).toEqual({ convId: 'conv-uuid', msg: 'Agendado!' });
  expect(result.action).toBe('agent_replied');
});

it('returns send_failed when sendReply fails (runAction not ok)', async () => {
  const result = await routeInboundToAgent({
    resolveInterlocutor: async () => ({ personaType: 'recepcao', context: '', peerId: '5511' }),
    invokeAgent: async () => ({ reply: 'oi', turnsUsed: 1 }),
    sendReply: async () => false,            // envio falhou
    timezone: 'America/Sao_Paulo',
  }, { clinicId: 'c1', conversationId: 'conv-uuid', phone: '5511', content: 'oi' });
  expect(result.action).toBe('send_failed');
});

it('sends escalation reply before returning escalated', async () => {
  const calls: Record<string, unknown> = {};
  const result = await routeInboundToAgent({
    resolveInterlocutor: async () => ({ personaType: 'recepcao', context: '', peerId: '5511' }),
    invokeAgent: async () => ({ reply: 'Vou encaminhar para um humano.', turnsUsed: 1, escalated: true }),
    sendReply: async (convId, msg) => { calls.sent = { convId, msg }; return true; },
    timezone: 'America/Sao_Paulo',
  }, { clinicId: 'c1', conversationId: 'conv-uuid', phone: '5511', content: 'preciso de ajuda' });
  expect(calls.sent).toEqual({ convId: 'conv-uuid', msg: 'Vou encaminhar para um humano.' });
  expect(result.action).toBe('escalated');
});
```

- [ ] **Step 3: Rodar (FAIL→implementar→PASS)** — `npx jest src/core/ia-channel/__tests__/webhook-router.test.ts -v`

- [ ] **Step 4: Wiring no `webhook-processor-service.ts`** — substituir o bloco "AI disabled" (Evolution `:91-97`) e o equivalente no caminho Meta (`storeAndProcessMetaMessage`):

```ts
import { routeInboundToAgent } from '@/core/ia-channel/webhook-router';
import { resolveInterlocutor } from '@/core/ia-channel/interlocutor';
import { findPatientByPhone } from '@/repositories/patients';
import { findLeadByPhone } from '@/repositories/leads';
import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { enviarMensagem } from '../actions/enviar-mensagem';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';

// substitui as linhas do "AI disabled":
const agentResult = await routeInboundToAgent({
  resolveInterlocutor: (cId, ph) => resolveInterlocutor({ findPatientByPhone, findLeadByPhone }, cId, ph),
  invokeAgent,
  sendReply: async (convId, msg) => {
    const ctx = await buildSystemContext(clinicId);                       // principal = role Agente
    const r = await runAction(enviarMensagem, { conversationId: convId, message: msg, channel: 'whatsapp' }, ctx);
    if (!r.ok) whatsappLogger.error('[ia] enviarMensagem falhou', null, { conversationId: convId, error: r.error.code });
    return r.ok;                                                          // runAction NÃO lança; checar ok
  },
  timezone: 'America/Sao_Paulo',   // TODO: timezone real da clínica (clinic settings)
}, { clinicId, conversationId: conv.id, phone, content });
results.push(agentResult);
await repo.updateConversationTimestamp(conv.id);
return results;
```

> **Atenção aos nomes de variáveis por caminho** (evita copy/paste errado): em `processEvolutionMessage` o escopo tem `clinicId`, `phone`, `content`, `conv`; em `storeAndProcessMetaMessage` (caminho Meta) os nomes locais são `cId`, `from`, `content`, `conv` — adaptar o snippet ao escopo de cada função.
> O role **Agente** precisa de `atendimento:manage_messages` + as permissões das tools (corrigidas na Task 6 Step 1) — via `getAgentPermissions(clinicId)`. Política do webhook preservada (assinatura/dedup/200-no-op). Falha do agente → o próprio `runTurn` já devolve fallback.

- [ ] **Step 5: Rodar + typecheck + commit**

```bash
npx jest src/core/ia-channel src/modules/atendimento -v
npm run typecheck
git add src/core/ia-channel/webhook-router.ts src/core/ia-channel/__tests__/webhook-router.test.ts src/modules/atendimento/services/webhook-processor-service.ts
git commit -m "feat(ia): route whatsapp inbound (Meta+Evolution) to agent in webhook-processor"
```

---

## Task 6: Presets RBAC + smoke ponta-a-ponta + limpeza

**Files:**
- Modify: `src/core/rbac/agent-access.ts`, `src/core/rbac/seed.ts`, `src/core/rbac/presets.ts`
- Test: `src/core/rbac/__tests__/agent-access.test.ts`, `src/core/rbac/__tests__/seed.test.ts`
- Remove: rota descartável do spike (se presente na branch de trabalho)

- [ ] **Step 1 (BLOQUEADOR): alinhar `DEFAULT_AGENT_PERMISSIONS` aos `requires` reais** (`agent-access.ts`)

Hoje `DEFAULT_AGENT_PERMISSIONS` tem permissões que **não existem** (`operacional:create`, `operacional:confirm`) e `atendimento:reply` em vez de `atendimento:manage_messages`. Com isso o agente **não** consegue agendar (action exige `operacional:manage_appointments`) nem enviar a resposta (`enviarMensagem` exige `atendimento:manage_messages`). Corrigir para as permissões reais:

```ts
export const DEFAULT_AGENT_PERMISSIONS = [
  'operacional:view',                 // consultar disponibilidade, listar/obter
  'operacional:manage_appointments',  // agendar/confirmar (matriz exige confirmação no WhatsApp)
  'atendimento:manage_messages',      // enviar a resposta (enviarMensagem)
];
```

> Mantém o espírito §3.7 (não dar `manage_patients`/financeiro/cancelamento por default — a matriz de segurança do ia-bridge ainda barra ações sensíveis/destrutivas mesmo que a permissão exista). Confirme em `src/modules/atendimento/permissions.ts` que `atendimento:manage_messages` é o `requires` de `enviarMensagem`.

- [ ] **Step 2: Teste das permissões do agente** (`__tests__/agent-access.test.ts`)

```ts
import { DEFAULT_AGENT_PERMISSIONS } from '../agent-access';

it('agent defaults cover the actions it must run (real permission keys)', () => {
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('operacional:view');
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('operacional:manage_appointments'); // agendar
  expect(DEFAULT_AGENT_PERMISSIONS).toContain('atendimento:manage_messages');      // enviar resposta
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('operacional:create');           // chave antiga/inexistente
  expect(DEFAULT_AGENT_PERMISSIONS).not.toContain('atendimento:reply');            // chave antiga/inexistente
});
```

- [ ] **Step 3 (BLOQUEADOR): reconciliar role `Agente` já existente** (`seed.ts`)

Trocar o loop que hoje faz `if (existing.length) continue;` por fluxo que **sempre** reconcilia permissões mínimas do role `Agente`, mesmo quando a clínica já foi seedada antes:

```ts
async function syncRolePermissions(db: DbOrTx, roleId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  await db.insert(rolePermissions)
    .values(keys.map((permissionKey) => ({ roleId, permissionKey })))
    .onConflictDoNothing();
}

for (const preset of presets) {
  const existing = await db.select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.clinicId, clinicId), eq(roles.name, preset.name)))
    .limit(1);

  const roleId = existing[0]?.id ?? (await db.insert(roles)
    .values({ clinicId, name: preset.name, description: preset.description, isSystem: true })
    .returning({ id: roles.id }))[0].id;

  // Roles de staff existentes são preservados. O Agente é role de sistema operacional:
  // precisa receber novas permissões mínimas quando o produto evolui.
  if (preset.name === AGENT_ROLE_NAME) {
    await syncRolePermissions(db, roleId, DEFAULT_AGENT_PERMISSIONS);
    continue;
  }

  if (existing.length) continue;
  await syncRolePermissions(db, roleId, preset.keys);
}
```

- [ ] **Step 4: Teste de reconciliação do role `Agente`** (`__tests__/seed.test.ts`)

Adicionar teste com executor fake no próprio `seed.test.ts` (sem depender de Postgres):

```ts
import { roles, rolePermissions, permissions } from '@/modules/core/schema/rbac';
import { seedRbacForClinic } from '../seed';

function makeSeedDb() {
  const state = {
    roles: [] as Array<{ id: string; clinicId: string; name: string; description: string; isSystem: boolean }>,
    rolePermissions: [] as Array<{ roleId: string; permissionKey: string }>,
    permissions: [] as Array<unknown>,
  };
  const db = {
    insert(table: unknown) {
      return {
        values(value: unknown) {
          const rows = Array.isArray(value) ? value : [value];
          if (table === permissions) {
            state.permissions.push(...rows);
            return { onConflictDoNothing: async () => undefined };
          }
          if (table === rolePermissions) {
            for (const row of rows as Array<{ roleId: string; permissionKey: string }>) {
              const exists = state.rolePermissions.some((x) => x.roleId === row.roleId && x.permissionKey === row.permissionKey);
              if (!exists) state.rolePermissions.push(row);
            }
            return { onConflictDoNothing: async () => undefined };
          }
          if (table === roles) {
            return {
              returning: async () => {
                const row = rows[0] as { clinicId: string; name: string; description: string; isSystem: boolean };
                const inserted = { ...row, id: `role-${state.roles.length + 1}` };
                state.roles.push(inserted);
                return [{ id: inserted.id }];
              },
            };
          }
          throw new Error('unexpected insert table');
        },
      };
    },
    select() {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit: async () => table === roles ? state.roles.filter((r) => r.clinicId === 'clinic-1') : [],
              };
            },
          };
        },
      };
    },
  };
  return { db, state };
}

it('reconciles existing agent role with new minimum permissions on seed rerun', async () => {
  const { db, state } = makeSeedDb();
  await seedRbacForClinic('clinic-1', db);
  const agent = state.roles.find((r) => r.name === 'Agente')!;

  state.rolePermissions = state.rolePermissions.filter((p) =>
    p.roleId !== agent.id || !['operacional:manage_appointments', 'atendimento:manage_messages'].includes(p.permissionKey),
  );

  await seedRbacForClinic('clinic-1', db);

  const keys = state.rolePermissions.filter((p) => p.roleId === agent.id).map((p) => p.permissionKey);
  expect(keys).toContain('operacional:manage_appointments');
  expect(keys).toContain('atendimento:manage_messages');
});
```

> O fake acima só cobre operações usadas por `seedRbacForClinic`; se o código real do seed ganhar novas queries, atualizar o fake junto. Não remover permissões antigas neste passo. Objetivo é **adicionar as mínimas novas** sem quebrar clínicas existentes.

- [ ] **Step 5: Adicionar `ia` aos presets** (`presets.ts`)

`ia:chat` para quem opera o assistente interno. Sugestão conservadora: Administrador (módulo `ia`); Recepcionista e Dentista recebem `ia:chat` via `extraKeys`. Confirmar com o produto.

```ts
{ name: 'Administrador', ... modules: [..., 'ia'] },
{ name: 'Recepcionista', ..., extraKeys: ['comercial:view', 'ia:chat'] },
{ name: 'Dentista', ..., extraKeys: ['followup:view', 'ia:chat'] },
```

- [ ] **Step 6: Confirmar que a rota do spike não está na branch de trabalho**

Run: `ls src/app/api/ia/spike 2>/dev/null && echo "REMOVER" || echo "ok (só na branch spike)"`
Se existir, remover (`git rm -r src/app/api/ia/spike`).

- [ ] **Step 7: Smoke ponta-a-ponta (trio local, fiel ao spike §P5)**

**Pré-condição:** os módulos **`ia` e `atendimento` habilitados** na clínica de teste (`instance_modules`), senão as rotas/gates respondem 404/`module_disabled`. Garantir também `HANDLE_SECRET` (ia-bridge) e `OPENCODE_ZEN_API_KEY` (ia-agent) em `.dev.vars`, usuário com `ia:chat`, e role `Agente` reconciliado com `atendimento:manage_messages`.

```bash
npx wrangler dev --config wrangler.ia-bridge.jsonc --port 8792        # terminal 1
npx wrangler dev --config src/workers/ia-agent/wrangler.jsonc --port 8793   # terminal 2
npm run build:cf && npx wrangler dev .open-next/worker.js --config wrangler.toml --port 8791  # terminal 3
```
Validar (autenticado, com `ia:chat`): `POST http://127.0.0.1:8791/api/ia/chat` com `{ "conversationId": "smoke", "message": "quais horários livres na quinta?" }` → resposta com `reply` (cadeia bootstrapa sem o crash de Playwright; com `HANDLE_SECRET` o `issueHandle` funciona).

- [ ] **Step 8: Gate completo**

```bash
npm run typecheck && npm run typecheck:ia-bridge && npm run typecheck:ia-agent
npm run lint
npm test
```
Expected: tudo verde.

- [ ] **Step 9: Commit**

```bash
git add src/core/rbac/agent-access.ts src/core/rbac/seed.ts src/core/rbac/__tests__/agent-access.test.ts src/core/rbac/__tests__/seed.test.ts src/core/rbac/presets.ts
git commit -m "feat(ia): align and reconcile agent permissions + rbac presets"
```

---

## Self-Review Checklist

- **Task 0 (pré-condição):** Playwright lazy → `bootstrapActions` Workers-safe; `HANDLE_SECRET` configurado. Sem isto, nada roda em Workers (achado do spike).
- **Bindings** `IA_BRIDGE` + `AGENT` (DO cross-worker) — fiel ao spike (Task 1).
- **Interlocutor** (paciente/lead/desconhecido/funcionário) via repos existentes (`findPatientByPhone`/`findLeadByPhone`) — lógica pura testada (Task 2); dívida E-05 = trocar o repo legado de leads por Action quando o Comercial existir.
- **Acionamento** via `getCloudflareContext` + `issueHandle` + **binding cru** do DO (não `getAgentByName`) — Task 3.
- **Canais:** `/api/ia/chat` (delegated, autenticado) e webhook inbound (system) + envio via `atendimento.enviarMensagem`; reply de escalonamento também é enviado — Tasks 4/5.
- **RBAC:** role `Agente` alinhado e reconciliado para clínicas existentes + smoke trio local + limpeza do spike — Task 6.

> **Notas para o executor:**
> - **Task 0 primeiro, sempre:** o crash de Playwright derruba o bootstrap em Workers; é o que impediu o `runTurn` real no spike.
> - **Referência fiel:** branch `spike/ia-opennext-binding` — `src/app/api/ia/spike/route.ts` (getCloudflareContext + binding cru), `wrangler.toml` (bindings), `docs/spikes/2026-06-26-opennext-binding.md` (vereditos + comandos de dev).
> - **Nunca importar `agents` no app** (NO-GO P4-A): acionar o DO só por `env.AGENT.idFromName().get()`.
> - **Timezone real da clínica** (chat e webhook usam `America/Sao_Paulo` provisório) → puxar de clinic settings num passo futuro.
> - **Detecção do "sim"/identidade** (→ `confirmedToken`/`identityVerifiedToken`) é simplificada nesta fatia; o refino conversacional é evolução.
