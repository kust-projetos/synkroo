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
| `src/core/ia-channel/interlocutor.ts` | **(Task 2)** resolução telefone→paciente/lead/desconhecido; chat→funcionário (lógica pura) |
| `src/core/ia-channel/leads-read.ts` | **(Task 2)** adapter de leitura de `leads` (dívida temporária, `// TODO(E-05)`) |
| `src/core/ia-channel/agent-invoker.ts` | **(Task 3)** acionamento: `getCloudflareContext` → `issueHandle` + binding cru do DO |
| `src/app/api/ia/chat/route.ts` | **(Task 4)** chat interno (gated + autenticado → delegated) |
| `src/app/api/whatsapp/webhook/route.ts` | **(Task 5)** inbound → agente (system) + envio pela resposta |
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

- [ ] **Step 6: Configurar `HANDLE_SECRET` (dev + prod)**

```bash
# dev local: .dev.vars de cada worker que usa o secret (gitignored)
echo "HANDLE_SECRET=$(openssl rand -hex 32)" >> .dev.vars          # ia-bridge (raiz)
# prod:
npx wrangler secret put HANDLE_SECRET --config wrangler.ia-bridge.jsonc
```
> O mesmo `HANDLE_SECRET` deve estar no `ia-bridge` (emite e valida o handle). Documentar em `docs/` que é compartilhado.

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
- Create: `src/core/ia-channel/types.ts`, `src/core/ia-channel/leads-read.ts`, `src/core/ia-channel/interlocutor.ts`
- Test: `src/core/ia-channel/__tests__/interlocutor.test.ts`

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

export interface InterlocutorDeps {
  findPatientByPhone(clinicId: string, phone: string): Promise<{ id: string; nome: string } | null>;
  findLeadByPhone(clinicId: string, phone: string): Promise<{ id: string; nome: string | null } | null>;
}
```

- [ ] **Step 2: Adapter de leitura de leads** (`src/core/ia-channel/leads-read.ts`)

```ts
// DÍVIDA TEMPORÁRIA (// TODO(E-05)): leitura direta de `leads` por não haver módulo Comercial.
// Migrar para uma Action de leitura quando E-05 existir; remover este adapter.
import { getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

export async function findLeadByPhone(clinicId: string, phone: string): Promise<{ id: string; nome: string | null } | null> {
  const [row] = await getDb().select({ id: leads.id, nome: leads.name }).from(leads)
    .where(and(eq(leads.clinicId, clinicId), eq(leads.phone, phone))).limit(1);
  return row ?? null;
}
```

> Confirme os nomes reais das colunas em `@/lib/db/schema` (tabela `leads`: `id`, `name`/`nome`, `phone`, `clinicId`). Ajuste se divergirem.

- [ ] **Step 3: Teste da resolução** (`__tests__/interlocutor.test.ts`)

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
    const r = await resolveInterlocutor(deps({ findPatientByPhone: async () => ({ id: 'p1', nome: 'João' }) }), 'c1', '5511999');
    expect(r.personaType).toBe('paciente');
    expect(r.patientId).toBe('p1');
    expect(r.context).toContain('João');
  });
  it('lead (not patient) → persona vendas', async () => {
    const r = await resolveInterlocutor(deps({ findLeadByPhone: async () => ({ id: 'l1', nome: 'Maria' }) }), 'c1', '5511999');
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

- [ ] **Step 4: Rodar (FAIL)** — `npx jest src/core/ia-channel/__tests__/interlocutor.test.ts -v`

- [ ] **Step 5: Implementar** (`src/core/ia-channel/interlocutor.ts`)

```ts
import type { Interlocutor, InterlocutorDeps } from './types';

// Identidade por telefone é DICA FRACA: contexto sensível NÃO entra só por isso (spec §Segurança).
// Aqui só nome (não-sensível) é injetado; dados clínicos/financeiros exigem verificação no ia-bridge.
export async function resolveInterlocutor(deps: InterlocutorDeps, clinicId: string, phone: string): Promise<Interlocutor> {
  const patient = await deps.findPatientByPhone(clinicId, phone);
  if (patient) return { personaType: 'paciente', context: `Paciente: ${patient.nome}`, peerId: phone, patientId: patient.id };

  const lead = await deps.findLeadByPhone(clinicId, phone);
  if (lead) return { personaType: 'vendas', context: lead.nome ? `Lead: ${lead.nome}` : '', peerId: phone, leadId: lead.id };

  return { personaType: 'recepcao', context: '', peerId: phone };
}

export function resolveFuncionario(userId: string, _userName: string): Interlocutor {
  // No chat interno, o principal é o usuário autenticado; o RBAC dele governa as tools.
  return { personaType: 'funcionario', context: 'Atendimento interno (funcionário).', peerId: userId };
}
```

- [ ] **Step 6: Rodar (PASS) + commit**

```bash
npx jest src/core/ia-channel/__tests__/interlocutor.test.ts -v
git add src/core/ia-channel/types.ts src/core/ia-channel/leads-read.ts src/core/ia-channel/interlocutor.ts src/core/ia-channel/__tests__/interlocutor.test.ts
git commit -m "feat(ia): interlocutor resolution (patient/lead/unknown/staff) + leads-read adapter"
```

---

## Task 3: Helper de acionamento (handle + binding cru do DO)

**Files:**
- Create: `src/core/ia-channel/agent-invoker.ts`
- Test: validado via `wrangler dev` (usa bindings runtime — não roda em Jest)

Fiel ao spike (caminho vencedor P4-B). **Não** importar `agents` aqui.

- [ ] **Step 1: Implementar** (`src/core/ia-channel/agent-invoker.ts`)

```ts
// Aciona o ia-agent (DO) e o ia-bridge a partir do app OpenNext.
// NÃO importar 'agents' (não existe no bundle do app — spike P4-A NO-GO).
// Caminho validado: env.IA_BRIDGE.issueHandle + env.AGENT.idFromName().get().runTurn() (spike P4-B GO).

import type { RunTurnResult, PersonaType } from '@/core/ia-agent/types';

// Tipos RPC mínimos (o app não tem os tipos dos workers).
interface IaBridgeRpc {
  issueHandle(input: { clinicId: string; conversationId: string; principalRef: string; source: 'system' | 'agent_delegated'; ttlSeconds?: number }): Promise<{ handle: string }>;
}
interface AgentStub {
  runTurn(input: { handle: string; conversationId: string; source: 'system' | 'agent_delegated'; personaType: PersonaType; context: string; timezone: string; userMessage: string; confirmedToken?: string; identityVerifiedToken?: string }): Promise<RunTurnResult>;
}
interface AgentNamespace { idFromName(name: string): unknown; get(id: unknown): AgentStub; }

async function getEnv(): Promise<Record<string, unknown>> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare/cloudflare-context');
  try { return (getCloudflareContext() as { env: Record<string, unknown> }).env; }
  catch { return (await getCloudflareContext({ async: true }) as { env: Record<string, unknown> }).env; }
}

export interface InvokeAgentInput {
  clinicId: string; conversationId: string; channel: 'whatsapp' | 'chat';
  peerId: string; principalRef: string; source: 'system' | 'agent_delegated';
  personaType: PersonaType; context: string; timezone: string;
  userMessage: string; confirmedToken?: string; identityVerifiedToken?: string;
}

export async function invokeAgent(input: InvokeAgentInput): Promise<RunTurnResult> {
  const env = await getEnv();
  const bridge = env.IA_BRIDGE as IaBridgeRpc;
  const agentNs = env.AGENT as AgentNamespace;

  // 1. handle (ia-bridge é a autoridade do principal)
  const { handle } = await bridge.issueHandle({
    clinicId: input.clinicId, conversationId: input.conversationId,
    principalRef: input.principalRef, source: input.source, ttlSeconds: 120,
  });

  // 2. DO por conversa (binding cru — sem getAgentByName)
  const id = agentNs.idFromName(`${input.clinicId}:${input.channel}:${input.peerId}`);
  const stub = agentNs.get(id);

  // 3. roda o turno
  return stub.runTurn({
    handle, conversationId: input.conversationId, source: input.source,
    personaType: input.personaType, context: input.context, timezone: input.timezone,
    userMessage: input.userMessage, confirmedToken: input.confirmedToken, identityVerifiedToken: input.identityVerifiedToken,
  });
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck` → 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/core/ia-channel/agent-invoker.ts
git commit -m "feat(ia): agent invoker (issueHandle + raw DO binding runTurn)"
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
jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ success: true, profile: { id: 'u1', name: 'Ana', clinic_id: 'c1', role: 'admin' } }),
}));
jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (h: unknown) => h }));
jest.mock('@/core/modules/manifest', () => ({ moduleManifest: {} }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ia/chat/route';

function req(body: unknown) { return new Request('http://localhost/api/ia/chat', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) as unknown as NextRequest; }

describe('POST /api/ia/chat', () => {
  beforeEach(() => jest.clearAllMocks());
  it('delegates to invokeAgent with funcionario persona and returns reply', async () => {
    mockInvoke.mockResolvedValue({ reply: 'Olá Ana!', turnsUsed: 1 });
    const res = await POST(req({ conversationId: 'conv-1', message: 'oi' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('Olá Ana!');
    expect(mockInvoke).toHaveBeenCalledWith(expect.objectContaining({ source: 'agent_delegated', personaType: 'funcionario', channel: 'chat', principalRef: 'u1' }));
  });
  it('401 when unauthenticated', async () => {
    const { validateApiAuth } = require('@/lib/auth/session');
    validateApiAuth.mockResolvedValueOnce({ success: false, error: { message: 'Unauthorized', status: 401 } });
    const res = await POST(req({ conversationId: 'conv-1', message: 'oi' }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar (FAIL)** — `npx jest src/app/api/ia/__tests__/chat-route.test.ts -v`

- [ ] **Step 3: Implementar** (`src/app/api/ia/chat/route.ts`)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { validateApiAuth } from '@/lib/auth/session';
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveFuncionario } from '@/core/ia-channel/interlocutor';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateApiAuth();
  if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status });
  const { id: userId, name, clinic_id: clinicId } = auth.profile!;

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
- Modify: `src/app/api/whatsapp/webhook/route.ts`
- Test: `src/app/api/whatsapp/webhook/__tests__/agent-routing.test.ts`

O webhook já valida assinatura + gate (Plano atendimento). Acrescentar: para cada mensagem inbound, resolver `clinicId`+interlocutor, acionar o agente (system) e enviar a resposta de volta — mantendo a política 200-no-op/idempotência existente.

- [ ] **Step 1: Teste do roteamento ao agente** (mock invoker + Actions)

```ts
const mockInvoke = jest.fn();
jest.mock('@/core/ia-channel/agent-invoker', () => ({ invokeAgent: (...a: unknown[]) => mockInvoke(...a) }));
const mockResolve = jest.fn();
jest.mock('@/core/ia-channel/interlocutor', () => ({ resolveInterlocutor: (...a: unknown[]) => mockResolve(...a) }));
// ... mocks de clinicId-by-instance, enviarMensagem, dedup conforme o webhook real ...

it('inbound message → resolves interlocutor → invokes agent → sends reply', async () => {
  mockResolve.mockResolvedValue({ personaType: 'paciente', context: 'Paciente: João', peerId: '5511999' });
  mockInvoke.mockResolvedValue({ reply: 'Posso agendar para quinta 9h?', turnsUsed: 2 });
  // POST do webhook com payload Meta válido (1 mensagem) + assinatura válida (mock)
  // assert: mockInvoke chamado com source:'system', personaType:'paciente'
  // assert: enviarMensagem chamado com a reply
  // assert: resposta HTTP 200
});
```

> Implementador: reusar os helpers de assinatura/dedup já existentes no webhook; o teste foca no novo trecho (resolver → invocar → enviar).

- [ ] **Step 2: Rodar (FAIL)**

- [ ] **Step 3: Implementar o roteamento** (no `handlePOST` do webhook, no loop de mensagens)

```ts
import { invokeAgent } from '@/core/ia-channel/agent-invoker';
import { resolveInterlocutor } from '@/core/ia-channel/interlocutor';
import { findPatientByPhone } from '@/modules/operacional/...'; // repo real de paciente por telefone
import { findLeadByPhone } from '@/core/ia-channel/leads-read';

// dentro do loop, para cada mensagem inbound já deduplicada/persistida:
const clinicId = await resolveClinicByInstance(entry);          // helper existente/novo
const who = await resolveInterlocutor({ findPatientByPhone, findLeadByPhone }, clinicId, from);
const conversationId = `${clinicId}:whatsapp:${from}`;
const result = await invokeAgent({
  clinicId, conversationId, channel: 'whatsapp', peerId: from,
  principalRef: 'agente', source: 'system',
  personaType: who.personaType, context: who.context,
  timezone: 'America/Sao_Paulo', userMessage: text,
});
// envia a resposta pelo canal via Action de atendimento (persistência durável + envio)
await runAtendimentoSystemAction(enviarMensagem, { to: from, message: result.reply, channel: 'whatsapp' }, clinicId);
```

> Mantém a política do webhook: assinatura inválida → 403; payload malformado → 200 + log; duplicado (`externalMessageId`) → 200 no-op. Falha do agente → resposta de fallback já vem do próprio `runTurn`.

- [ ] **Step 4: Rodar (PASS) + typecheck + commit**

```bash
npx jest src/app/api/whatsapp/webhook -v
npm run typecheck
git add src/app/api/whatsapp/webhook/route.ts src/app/api/whatsapp/webhook/__tests__/agent-routing.test.ts
git commit -m "feat(ia): whatsapp inbound routes to agent (system) + sends reply"
```

---

## Task 6: Presets RBAC + smoke ponta-a-ponta + limpeza

**Files:**
- Modify: `src/core/rbac/presets.ts`
- Remove: rota descartável do spike (se presente na branch de trabalho)

- [ ] **Step 1: Adicionar `ia` aos presets** (`presets.ts`)

`ia:chat` para quem opera o assistente interno. Sugestão conservadora: Administrador (módulo `ia`); Recepcionista e Dentista recebem `ia:chat` via `extraKeys`. Confirmar com o produto.

```ts
{ name: 'Administrador', ... modules: [..., 'ia'] },
{ name: 'Recepcionista', ..., extraKeys: ['comercial:view', 'ia:chat'] },
{ name: 'Dentista', ..., extraKeys: ['followup:view', 'ia:chat'] },
```

- [ ] **Step 2: Confirmar que a rota do spike não está na branch de trabalho**

Run: `ls src/app/api/ia/spike 2>/dev/null && echo "REMOVER" || echo "ok (só na branch spike)"`
Se existir, remover (`git rm -r src/app/api/ia/spike`).

- [ ] **Step 3: Smoke ponta-a-ponta (trio local, fiel ao spike §P5)**

```bash
# garantir HANDLE_SECRET no .dev.vars do ia-bridge e OPENCODE_ZEN_API_KEY no do ia-agent
npx wrangler dev --config wrangler.ia-bridge.jsonc --port 8792        # terminal 1
npx wrangler dev --config src/workers/ia-agent/wrangler.jsonc --port 8793   # terminal 2
npm run build:cf && npx wrangler dev .open-next/worker.js --config wrangler.toml --port 8791  # terminal 3
```
Validar (autenticado): `POST http://127.0.0.1:8791/api/ia/chat` com `{ "conversationId": "smoke", "message": "quais horários livres na quinta?" }` → resposta com `reply` (agora a cadeia bootstrapa sem o crash de Playwright; com `HANDLE_SECRET` o `issueHandle` funciona).

- [ ] **Step 4: Gate completo**

```bash
npm run typecheck && npm run typecheck:ia-bridge && npm run typecheck:ia-agent
npm run lint
npm test
```
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/core/rbac/presets.ts
git commit -m "feat(ia): rbac presets (ia:chat) + e2e smoke"
```

---

## Self-Review Checklist

- **Task 0 (pré-condição):** Playwright lazy → `bootstrapActions` Workers-safe; `HANDLE_SECRET` configurado. Sem isto, nada roda em Workers (achado do spike).
- **Bindings** `IA_BRIDGE` + `AGENT` (DO cross-worker) — fiel ao spike (Task 1).
- **Interlocutor** (paciente/lead/desconhecido/funcionário) + `leads-read` (dívida E-05) — lógica pura testada (Task 2).
- **Acionamento** via `getCloudflareContext` + `issueHandle` + **binding cru** do DO (não `getAgentByName`) — Task 3.
- **Canais:** `/api/ia/chat` (delegated, autenticado) e webhook inbound (system) + envio via `atendimento.enviarMensagem` — Tasks 4/5.
- **RBAC** + smoke trio local + limpeza do spike — Task 6.

> **Notas para o executor:**
> - **Task 0 primeiro, sempre:** o crash de Playwright derruba o bootstrap em Workers; é o que impediu o `runTurn` real no spike.
> - **Referência fiel:** branch `spike/ia-opennext-binding` — `src/app/api/ia/spike/route.ts` (getCloudflareContext + binding cru), `wrangler.toml` (bindings), `docs/spikes/2026-06-26-opennext-binding.md` (vereditos + comandos de dev).
> - **Nunca importar `agents` no app** (NO-GO P4-A): acionar o DO só por `env.AGENT.idFromName().get()`.
> - **Timezone real da clínica** (chat e webhook usam `America/Sao_Paulo` provisório) → puxar de clinic settings num passo futuro.
> - **Detecção do "sim"/identidade** (→ `confirmedToken`/`identityVerifiedToken`) é simplificada nesta fatia; o refino conversacional é evolução.
