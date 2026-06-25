# Agente IA — Fronteira App-Side (Plano 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a fronteira app-side do Agente IA: um Worker dedicado `ia-bridge` (`AppService`, WorkerEntrypoint) que emite/valida handles opacos, expõe o catálogo de tools (Actions) e executa Actions com enforcement de segurança server-side — consumível por service binding, sem o Worker do agente ainda existir.

**Architecture:** `ia-bridge` é um Worker separado (fiel ao spike `c9b5178`) que importa a Action Layer real (`src/core/actions`, zod 3) e o schema; expõe métodos RPC via `WorkerEntrypoint`. O handle é `base64url(payload)+"."+HMAC-SHA256`, com vínculo estrito + expiração + anti-replay (nonce em KV). Toda execução passa por `runAction` (RBAC + manifesto) **e**, para `source='system'`, pela matriz de segurança por eixos. `fetch()` público responde 404 (binding-only).

**Tech Stack:** Cloudflare Workers (WorkerEntrypoint, `cloudflare:workers`), Hyperdrive (Postgres), KV (anti-replay), `zod-to-json-schema`, Action Layer existente (`runAction`, `buildSystemContext`, `buildDelegatedContext`, `getActions`). TypeScript 5.6, Jest.

> **Decisão arquitetural (de-risk):** o `AppService` vive num Worker dedicado (`ia-bridge`), NÃO embutido no bundle OpenNext. O spike provou esse padrão; evita a incerteza de exportar um WorkerEntrypoint nomeado pelo worker gerado do OpenNext. As rotas Next (chat/webhook) que consomem isto ficam no Plano 2.

---

## Escopo

**Inclui (Plano 1):** módulo `ia` (manifest/permissions/registro); conversor de tools (Zod→JSON Schema + alias provider-safe); catálogo filtrado por ctx; matriz de segurança por eixos; handle opaco (emitir/validar/anti-replay); `AppService` WorkerEntrypoint (`ping`/`issueHandle`/`listTools`/`executeAction`); wrangler do `ia-bridge`; testes unit + integração da fronteira.

**Fora (Plano 2):** Worker do agente (Agents SDK/DO), provider Zen, orquestrador/loop, personas, resolução de interlocutor, rota `/api/ia/chat`, webhook inbound, service bindings do OpenNext.

---

## File Structure

| Path | Responsabilidade |
|---|---|
| `src/modules/ia/manifest.ts` | Manifesto do módulo `ia` (entitlement + menu do chat) |
| `src/modules/ia/permissions.ts` | Permissões `ia:*` |
| `src/modules/ia/index.ts` | Superfície pública (sem actions próprias nesta fatia) |
| `src/core/agent-bridge/tool-catalog.ts` | `normalizeToolName`, `toRemoteTool`, `buildToolCatalog(ctx)` |
| `src/core/agent-bridge/security-matrix.ts` | `classifyActionLevel(...)` por eixos + `assertSystemAllowed(...)` |
| `src/core/agent-bridge/handle.ts` | `issueHandle`, `verifyHandle` (HMAC, exp, conversationId, anti-replay) |
| `src/core/agent-bridge/types.ts` | `HandlePayload`, `RemoteTool`, `ToolCatalog`, `SecurityLevel` |
| `src/core/agent-bridge/bridge-service.ts` | Lógica da fronteira (PURA, deps injetadas): `listToolsLogic`, `executeActionLogic` — testável em Jest |
| `src/workers/ia-bridge/index.ts` | Casca `AppService` (WorkerEntrypoint): injeta env/deps reais e delega à lógica; `fetch` 404. Validada via `wrangler dev`, não Jest (importa `cloudflare:workers`) |
| `wrangler.ia-bridge.jsonc` | Config do Worker `ia-bridge` |
| `src/core/agent-bridge/__tests__/*.test.ts` | Unit tests |
| `src/workers/ia-bridge/__tests__/integration.test.ts` | Integração da fronteira |

---

## Task 1: Módulo `ia` — scaffold e registro

**Files:**
- Create: `src/modules/ia/manifest.ts`, `src/modules/ia/permissions.ts`, `src/modules/ia/index.ts`
- Modify: `src/core/actions/bootstrap.ts`, `src/lib/ui/menu-actions.ts`
- Test: `src/core/actions/__tests__/bootstrap.test.ts`

- [ ] **Step 1: Escrever o manifesto** (`src/modules/ia/manifest.ts`)

```ts
/**
 * Agente IA — module manifest.
 */
export const iaManifest = {
  id: 'ia' as const,
  name: 'Agente IA',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'ia',
      permission: 'ia:chat',
      label: 'Assistente IA',
      path: '/dashboard/ia',
      icon: 'SparklesIcon',
    },
  ],
  jobs: [],
};
```

- [ ] **Step 2: Escrever as permissões** (`src/modules/ia/permissions.ts`)

```ts
import type { PermissionEntry } from '@/core/rbac/catalog';

export const iaAccessPermissions: PermissionEntry[] = [
  { key: 'ia:chat', module: 'ia', label: 'Conversar com o Agente IA' },
  { key: 'ia:manage', module: 'ia', label: 'Gerenciar o Agente IA' },
];
```

- [ ] **Step 3: Escrever a superfície pública** (`src/modules/ia/index.ts`)

```ts
/**
 * Agente IA — module public surface.
 * Sem actions próprias nesta fatia: as capacidades do agente são as Actions
 * dos outros módulos, expostas via tool-catalog. Exporta manifest + permissions.
 */
export const iaActions = [] as const;

export { iaManifest } from './manifest';
export { iaAccessPermissions } from './permissions';
```

- [ ] **Step 4: Registrar no bootstrap** (`src/core/actions/bootstrap.ts`)

Seguir EXATAMENTE o padrão do `followup` já presente neste arquivo. Adicionar o import e o registro:

```ts
// no bloco de imports de módulos, junto aos demais { xActions, xAccessPermissions }:
import { iaActions, iaAccessPermissions } from '@/modules/ia';

// onde os outros módulos chamam registerActions(...) condicional ao getAction:
registerActions(iaActions.filter((a) => !getAction(a.name)));
// onde registra as permissões dos módulos:
registerAccessPermissions(iaAccessPermissions);
```

> `iaActions` é `[]` nesta fatia — o registro é no-op para actions, mas mantém o módulo no pipeline e registra as permissões `ia:*`.

- [ ] **Step 5: Registrar o manifesto no menu** (`src/lib/ui/menu-actions.ts`)

Adicionar `iaManifest` à lista passada para `buildMenu`, junto aos demais manifests:

```ts
import { iaManifest } from '@/modules/ia/manifest'
// ...
return await buildMenu(
  [coreManifest, operacionalManifest, atendimentoManifest, followupManifest, iaManifest],
  makeManifest(drizzleManifestRepo),
  ctx.can,
)
```

- [ ] **Step 6: Estender o guard de bootstrap** (`src/core/actions/__tests__/bootstrap.test.ts`)

Adicionar ao teste de permissões existente as asserções das permissões `ia:*`:

```ts
expect(keys).toContain('ia:chat');
expect(keys).toContain('ia:manage');
```

- [ ] **Step 7: Rodar o teste**

Run: `npx jest src/core/actions/__tests__/bootstrap.test.ts -v`
Expected: PASS (inclui `ia:chat`, `ia:manage`).

- [ ] **Step 8: Typecheck + commit**

```bash
npm run typecheck
git add src/modules/ia src/core/actions/bootstrap.ts src/lib/ui/menu-actions.ts src/core/actions/__tests__/bootstrap.test.ts
git commit -m "feat(ia): module scaffold (manifest, permissions, bootstrap)"
```

---

## Task 2: Conversor de tools (Zod→JSON Schema + alias provider-safe)

**Files:**
- Create: `src/core/agent-bridge/types.ts`, `src/core/agent-bridge/tool-catalog.ts`
- Test: `src/core/agent-bridge/__tests__/tool-catalog.test.ts`
- Modify: `package.json` (dep `zod-to-json-schema`)

- [ ] **Step 1: Instalar o conversor**

Run: `npm install zod-to-json-schema@^3.23.0`
Expected: adiciona `zod-to-json-schema` (compatível com zod 3) às dependencies.

- [ ] **Step 2: Definir os tipos** (`src/core/agent-bridge/types.ts`)

```ts
export type SecurityLevel = 'livre' | 'confirmacao' | 'verificacao_forte' | 'proibido';

export interface RemoteTool {
  name: string;       // action.name real (ex.: 'operacional.consultarDisponibilidade')
  alias: string;      // provider-safe (ex.: 'operacional__consultarDisponibilidade')
  description: string;
  inputSchemaJson: Record<string, unknown>; // JSON Schema draft-07
  module: string;
  permissions: string[];
}

export interface ToolCatalog {
  version: string;        // hash/contador do conjunto de tools
  tools: RemoteTool[];
}

export interface HandlePayload {
  clinicId: string;
  conversationId: string;
  principalRef: string;   // userId (delegated) ou identificador do agente (system)
  source: 'system' | 'agent_delegated';
  jti: string;            // nonce para anti-replay
  exp: number;            // epoch ms
}
```

- [ ] **Step 3: Escrever o teste do alias** (`src/core/agent-bridge/__tests__/tool-catalog.test.ts`)

```ts
import { normalizeToolName, toRemoteTool } from '../tool-catalog';
import { z } from 'zod';

describe('normalizeToolName', () => {
  it('replaces dots with double underscore (Zen rejects dots)', () => {
    expect(normalizeToolName('operacional.consultarDisponibilidade'))
      .toBe('operacional__consultarDisponibilidade');
  });
  it('keeps already-safe names unchanged', () => {
    expect(normalizeToolName('listar_pendentes')).toBe('listar_pendentes');
  });
});

describe('toRemoteTool', () => {
  const action = {
    name: 'operacional.agendarConsulta',
    module: 'operacional',
    requires: 'operacional:create',
    label: 'Agendar consulta',
    description: 'Agenda uma consulta',
    input: z.object({ pacienteId: z.string().uuid(), data: z.string() }),
  };
  it('produces a provider-safe remote tool with JSON Schema', () => {
    const t = toRemoteTool(action);
    expect(t.name).toBe('operacional.agendarConsulta');
    expect(t.alias).toBe('operacional__agendarConsulta');
    expect(t.permissions).toEqual(['operacional:create']);
    expect(t.inputSchemaJson).toHaveProperty('type', 'object');
    expect((t.inputSchemaJson as any).properties).toHaveProperty('pacienteId');
  });
});
```

- [ ] **Step 4: Rodar o teste (deve falhar)**

Run: `npx jest src/core/agent-bridge/__tests__/tool-catalog.test.ts -v`
Expected: FAIL (módulo `../tool-catalog` não existe).

- [ ] **Step 5: Implementar o conversor** (`src/core/agent-bridge/tool-catalog.ts`)

```ts
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';
import { getActions } from '@/core/actions/registry';
import type { RemoteTool, ToolCatalog } from './types';

// Zen (e function-calling em geral) rejeita '.' no nome da tool → HTTP 400.
export function normalizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '__');
}

// Extrai o objeto de schema "puro" (sem $ref/definitions de topo) para o LLM.
function flattenSchema(name: string, schema: any): Record<string, unknown> {
  if (schema?.definitions?.[name]) return schema.definitions[name];
  if (typeof schema?.$ref === 'string') {
    const refName = schema.$ref.split('/').pop();
    if (refName && schema?.definitions?.[refName]) return schema.definitions[refName];
  }
  const clone = { ...schema };
  delete clone.$schema;
  delete clone.definitions;
  delete clone.$ref;
  return clone;
}

export function toRemoteTool(
  action: Pick<ActionDefinition<any, any>, 'name' | 'module' | 'requires' | 'label' | 'description' | 'input'>,
): RemoteTool {
  const raw = zodToJsonSchema(action.input as never, action.name);
  return {
    name: action.name,
    alias: normalizeToolName(action.name),
    description: action.description ?? action.label,
    inputSchemaJson: flattenSchema(action.name, raw),
    module: action.module,
    permissions: [action.requires],
  };
}

// Catálogo filtrado pelo ctx (manifesto + permissão), versionado pelo conjunto de aliases.
export function buildToolCatalog(ctx: ActionContext): ToolCatalog {
  const allowed = getActions().filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires));
  const tools = allowed.map(toRemoteTool);
  const version = hashAliases(tools.map((t) => t.alias));
  return { version, tools };
}

function hashAliases(aliases: string[]): string {
  // hash estável e determinístico do conjunto ordenado (detecta drift)
  const joined = [...aliases].sort().join('|');
  let h = 0;
  for (let i = 0; i < joined.length; i++) { h = (h * 31 + joined.charCodeAt(i)) | 0; }
  return `v${(h >>> 0).toString(16)}`;
}
```

- [ ] **Step 6: Rodar o teste (deve passar)**

Run: `npx jest src/core/agent-bridge/__tests__/tool-catalog.test.ts -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/core/agent-bridge/types.ts src/core/agent-bridge/tool-catalog.ts src/core/agent-bridge/__tests__/tool-catalog.test.ts
git commit -m "feat(ia): tool catalog converter (zod->json schema + provider-safe alias)"
```

---

## Task 3: `buildToolCatalog` filtrado por ctx — teste de integração com o registry

**Files:**
- Test: `src/core/agent-bridge/__tests__/catalog-filter.test.ts`

- [ ] **Step 1: Escrever o teste de filtragem por permissão**

```ts
import { buildToolCatalog } from '../tool-catalog';
import { bootstrapActions } from '@/core/actions/bootstrap';
import type { ActionContext } from '@/core/actions/types';

function ctxWith(perms: Set<string>, modules: Set<string>): ActionContext {
  return {
    source: 'system',
    clinicId: 'c1',
    can: (k: string) => perms.has(k),
    hasModule: (m: string) => modules.has(m),
    audit: { actor: 'agente (sistema)' },
  } as ActionContext;
}

describe('buildToolCatalog', () => {
  beforeAll(() => { bootstrapActions(); });

  it('includes only tools whose module AND permission are granted', () => {
    const ctx = ctxWith(new Set(['operacional:read']), new Set(['operacional']));
    const cat = buildToolCatalog(ctx);
    const names = cat.tools.map((t) => t.name);
    // todas as tools devem ser do módulo operacional e exigir operacional:read
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n.startsWith('operacional.'))).toBe(true);
  });

  it('returns empty catalog when no module is enabled', () => {
    const cat = buildToolCatalog(ctxWith(new Set(), new Set()));
    expect(cat.tools).toHaveLength(0);
  });

  it('version changes when the tool set changes', () => {
    const full = buildToolCatalog(ctxWith(new Set(['operacional:read', 'operacional:create']), new Set(['operacional'])));
    const partial = buildToolCatalog(ctxWith(new Set(['operacional:read']), new Set(['operacional'])));
    expect(full.version).not.toBe(partial.version);
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npx jest src/core/agent-bridge/__tests__/catalog-filter.test.ts -v`
Expected: PASS. (Se a 1ª asserção falhar por nomes de permissão, ajuste os `perms` para uma permissão real de leitura de `operacional` — confira em `src/modules/operacional/actions/*` qual `requires` as actions de leitura usam.)

- [ ] **Step 3: Commit**

```bash
git add src/core/agent-bridge/__tests__/catalog-filter.test.ts
git commit -m "test(ia): tool catalog filtered by ctx (module + permission)"
```

---

## Task 4: Matriz de segurança por eixos

**Files:**
- Create: `src/core/agent-bridge/security-matrix.ts`
- Test: `src/core/agent-bridge/__tests__/security-matrix.test.ts`

Eixos (spec §Matriz): mutação destrutiva e third-party sempre elevam; dado sensível exige verificação forte. Para esta fatia, a classificação usa metadados estáticos por padrão de nome de action (mantido explícito e auditável).

- [ ] **Step 1: Escrever o teste**

```ts
import { classifyActionLevel, assertSystemAllowed } from '../security-matrix';

describe('classifyActionLevel', () => {
  it('read-only operational is livre', () => {
    expect(classifyActionLevel('operacional.consultarDisponibilidade')).toBe('livre');
    expect(classifyActionLevel('operacional.listarProcedimentos')).toBe('livre');
  });
  it('self mutation is confirmacao', () => {
    expect(classifyActionLevel('operacional.agendarConsulta')).toBe('confirmacao');
    expect(classifyActionLevel('operacional.confirmarConsulta')).toBe('confirmacao');
  });
  it('destructive is proibido (escala)', () => {
    expect(classifyActionLevel('operacional.cancelarConsulta')).toBe('proibido');
    expect(classifyActionLevel('operacional.remarcarConsulta')).toBe('proibido');
  });
  it('sensitive data read needs strong verification', () => {
    expect(classifyActionLevel('operacional.obterPaciente')).toBe('verificacao_forte');
  });
  it('unknown action defaults to proibido (deny-by-default)', () => {
    expect(classifyActionLevel('algum.acaoDesconhecida')).toBe('proibido');
  });
});

describe('assertSystemAllowed', () => {
  it('allows livre without confirmation flag', () => {
    expect(assertSystemAllowed('operacional.consultarDisponibilidade', { confirmed: false }).allowed).toBe(true);
  });
  it('blocks confirmacao without confirmed flag', () => {
    const r = assertSystemAllowed('operacional.agendarConsulta', { confirmed: false });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('needs_confirmation');
  });
  it('allows confirmacao with confirmed flag', () => {
    expect(assertSystemAllowed('operacional.agendarConsulta', { confirmed: true }).allowed).toBe(true);
  });
  it('always blocks proibido (escala humano)', () => {
    const r = assertSystemAllowed('operacional.cancelarConsulta', { confirmed: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('escalate_human');
  });
  it('blocks verificacao_forte unless verified', () => {
    expect(assertSystemAllowed('operacional.obterPaciente', { confirmed: true }).allowed).toBe(false);
    expect(assertSystemAllowed('operacional.obterPaciente', { confirmed: true, identityVerified: true }).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx jest src/core/agent-bridge/__tests__/security-matrix.test.ts -v`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** (`src/core/agent-bridge/security-matrix.ts`)

```ts
import type { SecurityLevel } from './types';

// Classificação explícita por action.name. Deny-by-default: o que não está
// mapeado em níveis menos restritivos cai em 'proibido' (escala humano).
// (spec §Matriz — validada pelo usuário 2026-06-25). No chat interno (delegated)
// esta matriz NÃO se aplica: lá vale só o RBAC do usuário.
const LIVRE = new Set<string>([
  'operacional.consultarDisponibilidade',
  'operacional.listarProcedimentos',
  'operacional.obterProcedimento',
]);
const CONFIRMACAO = new Set<string>([
  'operacional.agendarConsulta',
  'operacional.confirmarConsulta',
  'operacional.entrarWaitlist',
]);
const VERIFICACAO_FORTE = new Set<string>([
  'operacional.obterPaciente',
  'operacional.atualizarPaciente',
]);
// destrutivas / third-party / sensível em massa: proibido (escala). Default cai aqui.

export function classifyActionLevel(actionName: string): SecurityLevel {
  if (LIVRE.has(actionName)) return 'livre';
  if (CONFIRMACAO.has(actionName)) return 'confirmacao';
  if (VERIFICACAO_FORTE.has(actionName)) return 'verificacao_forte';
  return 'proibido';
}

export interface SystemActionFlags {
  confirmed: boolean;
  identityVerified?: boolean;
}

export interface AllowResult {
  allowed: boolean;
  level: SecurityLevel;
  reason?: 'needs_confirmation' | 'needs_identity' | 'escalate_human';
}

// Enforcement server-side para source='system' (WhatsApp autônomo).
export function assertSystemAllowed(actionName: string, flags: SystemActionFlags): AllowResult {
  const level = classifyActionLevel(actionName);
  switch (level) {
    case 'livre':
      return { allowed: true, level };
    case 'confirmacao':
      return flags.confirmed ? { allowed: true, level } : { allowed: false, level, reason: 'needs_confirmation' };
    case 'verificacao_forte':
      return flags.identityVerified ? { allowed: true, level } : { allowed: false, level, reason: 'needs_identity' };
    case 'proibido':
    default:
      return { allowed: false, level, reason: 'escalate_human' };
  }
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx jest src/core/agent-bridge/__tests__/security-matrix.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/agent-bridge/security-matrix.ts src/core/agent-bridge/__tests__/security-matrix.test.ts
git commit -m "feat(ia): security matrix por eixos (deny-by-default; system enforcement)"
```

---

## Task 5: Handle opaco (HMAC + exp + conversationId + anti-replay)

**Files:**
- Create: `src/core/agent-bridge/handle.ts`
- Test: `src/core/agent-bridge/__tests__/handle.test.ts`

Estrutura fiel ao spike (`base64url(payload)+"."+HMAC-SHA256` via `crypto.subtle`), acrescentando `jti` (nonce) e checagens da spec. O anti-replay (registro de `jti`) é injetado como dependência (`SeenStore`) para testar em Node e usar KV em produção.

- [ ] **Step 1: Escrever o teste**

```ts
import { issueHandle, verifyHandle } from '../handle';

const SECRET = 'test-secret-do-not-use-in-prod';

function memStore() {
  const seen = new Set<string>();
  return {
    async wasSeen(jti: string) { return seen.has(jti); },
    async markSeen(jti: string) { seen.add(jti); },
  };
}

describe('handle', () => {
  const base = { clinicId: 'c1', conversationId: 'conv-1', principalRef: 'u1', source: 'agent_delegated' as const };

  it('issues and verifies a valid handle', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const r = await verifyHandle(SECRET, handle, { conversationId: 'conv-1', store: memStore() });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.clinicId).toBe('c1');
  });

  it('rejects forged signature', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const r = await verifyHandle(SECRET, `${handle}x`, { conversationId: 'conv-1', store: memStore() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_signature');
  });

  it('rejects expired handle', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: -1 });
    const r = await verifyHandle(SECRET, handle, { conversationId: 'conv-1', store: memStore() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('expired');
  });

  it('rejects cross-conversation reuse', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const r = await verifyHandle(SECRET, handle, { conversationId: 'OTHER', store: memStore() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('conversation_mismatch');
  });

  it('rejects replay (same jti twice) when singleUse', async () => {
    const store = memStore();
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const first = await verifyHandle(SECRET, handle, { conversationId: 'conv-1', store, singleUse: true });
    const second = await verifyHandle(SECRET, handle, { conversationId: 'conv-1', store, singleUse: true });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('replayed');
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx jest src/core/agent-bridge/__tests__/handle.test.ts -v`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** (`src/core/agent-bridge/handle.ts`)

```ts
import type { HandlePayload } from './types';

const encoder = new TextEncoder();

export interface SeenStore {
  wasSeen(jti: string): Promise<boolean>;
  markSeen(jti: string): Promise<void>;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function encodeJson(obj: unknown): string { return b64url(encoder.encode(JSON.stringify(obj))); }
function decodeJson<T>(seg: string): T { return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg))) as T; }

async function sign(secret: string, data: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return b64url(sig);
}
async function verifySig(secret: string, data: string, signature: string): Promise<boolean> {
  const key = await importKey(secret);
  return crypto.subtle.verify('HMAC', key, b64urlToBytes(signature), encoder.encode(data));
}

export interface IssueInput extends Omit<HandlePayload, 'exp' | 'jti'> { ttlSeconds?: number; }

export async function issueHandle(secret: string, input: IssueInput): Promise<{ handle: string; payload: HandlePayload }> {
  const payload: HandlePayload = {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    principalRef: input.principalRef,
    source: input.source,
    jti: crypto.randomUUID(),
    exp: Date.now() + (input.ttlSeconds ?? 60) * 1000,
  };
  const payload64 = encodeJson(payload);
  const signature = await sign(secret, payload64);
  return { handle: `${payload64}.${signature}`, payload };
}

export type VerifyError = 'malformed' | 'invalid_signature' | 'expired' | 'conversation_mismatch' | 'replayed';
export type VerifyResult = { ok: true; payload: HandlePayload } | { ok: false; error: VerifyError };

export async function verifyHandle(
  secret: string,
  handle: string,
  opts: { conversationId: string; store: SeenStore; singleUse?: boolean },
): Promise<VerifyResult> {
  const [payload64, signature] = handle.split('.');
  if (!payload64 || !signature) return { ok: false, error: 'malformed' };
  if (!(await verifySig(secret, payload64, signature))) return { ok: false, error: 'invalid_signature' };

  let payload: HandlePayload;
  try { payload = decodeJson<HandlePayload>(payload64); } catch { return { ok: false, error: 'malformed' }; }

  if (payload.exp < Date.now()) return { ok: false, error: 'expired' };
  if (payload.conversationId !== opts.conversationId) return { ok: false, error: 'conversation_mismatch' };
  if (opts.singleUse) {
    if (await opts.store.wasSeen(payload.jti)) return { ok: false, error: 'replayed' };
    await opts.store.markSeen(payload.jti);
  }
  return { ok: true, payload };
}
```

- [ ] **Step 4: Rodar (deve passar)**

Run: `npx jest src/core/agent-bridge/__tests__/handle.test.ts -v`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/core/agent-bridge/handle.ts src/core/agent-bridge/__tests__/handle.test.ts
git commit -m "feat(ia): opaque handle (hmac + exp + conversation binding + anti-replay)"
```

---

## Task 6: Lógica da fronteira (pura, testável em Jest)

**Files:**
- Create: `src/core/agent-bridge/bridge-service.ts`
- Test: `src/core/agent-bridge/__tests__/bridge-service.test.ts`

A lógica (verify handle → alias → matriz → `runAction`) é PURA, com dependências injetadas (`BridgeDeps`) — testável em Jest sem o runtime Workers. A casca `AppService` (Task 7) só injeta as deps reais.

- [ ] **Step 1: Escrever o teste da lógica**

```ts
import { listToolsLogic, executeActionLogic, type BridgeDeps } from '../bridge-service';
import { issueHandle } from '../handle';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';

const SECRET = 'secret-test';

function memStore() {
  const seen = new Set<string>();
  return { async wasSeen(j: string) { return seen.has(j); }, async markSeen(j: string) { seen.add(j); } };
}

const consultar = { name: 'operacional.consultarDisponibilidade', module: 'operacional', requires: 'operacional:read', label: 'Consultar', input: { safeParse: () => ({ success: true, data: {} }) } } as unknown as ActionDefinition<any, any>;
const agendar = { name: 'operacional.agendarConsulta', module: 'operacional', requires: 'operacional:create', label: 'Agendar', input: { safeParse: () => ({ success: true, data: {} }) } } as unknown as ActionDefinition<any, any>;

function deps(): BridgeDeps {
  const ctx = { source: 'system', clinicId: 'c1', can: () => true, hasModule: () => true, audit: { actor: 'agente (sistema)' } } as unknown as ActionContext;
  return {
    secret: SECRET,
    store: memStore(),
    getActions: () => [consultar, agendar],
    runAction: async () => ({ ok: true, data: { done: true } }),
    buildSystemContext: async () => ctx,
    buildDelegatedContext: async () => ctx,
  };
}

describe('executeActionLogic', () => {
  async function handleFor(source: 'system' | 'agent_delegated' = 'system') {
    return (await issueHandle(SECRET, { clinicId: 'c1', conversationId: 'conv-1', principalRef: 'agente', source, ttlSeconds: 60 })).handle;
  }

  it('runs a livre action (system) and returns data', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), { handle, conversationId: 'conv-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(r).toEqual({ ok: true, data: { done: true } });
  });

  it('blocks confirmacao action without confirmed flag (system)', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), { handle, conversationId: 'conv-1', alias: 'operacional__agendarConsulta', input: {}, flags: { confirmed: false } });
    expect(r).toMatchObject({ ok: false, error: 'needs_confirmation' });
  });

  it('rejects forged handle', async () => {
    const r = await executeActionLogic(deps(), { handle: 'forged.sig', conversationId: 'conv-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(r).toMatchObject({ ok: false, error: 'invalid_signature' });
  });

  it('rejects unknown alias', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), { handle, conversationId: 'conv-1', alias: 'nao__existe', input: {}, flags: { confirmed: false } });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `npx jest src/core/agent-bridge/__tests__/bridge-service.test.ts -v`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar** (`src/core/agent-bridge/bridge-service.ts`)

```ts
import type { ActionContext, ActionDefinition, ActionResult } from '@/core/actions/types';
import { verifyHandle, type SeenStore } from './handle';
import { buildToolCatalog, normalizeToolName } from './tool-catalog';
import { assertSystemAllowed } from './security-matrix';
import type { ToolCatalog } from './types';

export interface BridgeDeps {
  secret: string;
  store: SeenStore;
  getActions: () => ActionDefinition<any, any>[];
  runAction: (action: ActionDefinition<any, any>, input: unknown, ctx: ActionContext) => Promise<ActionResult<unknown>>;
  buildSystemContext: (clinicId: string) => Promise<ActionContext>;
  buildDelegatedContext: (userId: string, clinicId: string) => Promise<ActionContext>;
}

export type ListToolsInput = { handle: string; conversationId: string };
export type ListToolsResult = { ok: true; catalog: ToolCatalog } | { ok: false; error: string };

export async function listToolsLogic(deps: BridgeDeps, input: ListToolsInput): Promise<ListToolsResult> {
  const v = await verifyHandle(deps.secret, input.handle, { conversationId: input.conversationId, store: deps.store });
  if (!v.ok) return { ok: false, error: v.error };
  const ctx = await rebuildCtx(deps, v.payload);
  // catálogo usa o registry real via getActions injetado em buildToolCatalog? -> usamos o ctx + injeção:
  return { ok: true, catalog: buildCatalogWith(deps, ctx) };
}

export type ExecuteInput = {
  handle: string; conversationId: string; alias: string;
  input: unknown; flags: { confirmed: boolean; identityVerified?: boolean };
};
export type ExecuteResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; level?: string; message?: string };

export async function executeActionLogic(deps: BridgeDeps, input: ExecuteInput): Promise<ExecuteResult> {
  // 1. handle single-use (anti-replay)
  const v = await verifyHandle(deps.secret, input.handle, { conversationId: input.conversationId, store: deps.store, singleUse: true });
  if (!v.ok) return { ok: false, error: v.error };

  // 2. alias → action.name
  const action = deps.getActions().find((a) => normalizeToolName(a.name) === input.alias);
  if (!action) return { ok: false, error: 'unknown_tool' };

  // 3. matriz (só source='system'); delegated cai no RBAC do runAction
  if (v.payload.source === 'system') {
    const gate = assertSystemAllowed(action.name, input.flags);
    if (!gate.allowed) return { ok: false, error: gate.reason!, level: gate.level };
  }

  // 4. ctx real + runAction (RBAC + manifesto + input zod dentro do runAction)
  const ctx = await rebuildCtx(deps, v.payload);
  const result = await deps.runAction(action, input.input, ctx);
  if (!result.ok) return { ok: false, error: result.error.code, message: result.error.message };
  return { ok: true, data: result.data };
}

async function rebuildCtx(deps: BridgeDeps, payload: { clinicId: string; principalRef: string; source: 'system' | 'agent_delegated' }): Promise<ActionContext> {
  return payload.source === 'system'
    ? await deps.buildSystemContext(payload.clinicId)
    : await deps.buildDelegatedContext(payload.principalRef, payload.clinicId);
}

// buildToolCatalog usa getActions() do registry global; para manter a lógica pura
// e testável, filtramos a lista injetada pelo ctx aqui:
function buildCatalogWith(deps: BridgeDeps, ctx: ActionContext): ToolCatalog {
  // reusa o conversor; a filtragem por ctx é a mesma de buildToolCatalog,
  // mas sobre a lista injetada (testável).
  const allowed = deps.getActions().filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires));
  // delega ao conversor padrão para o shape do catálogo:
  return buildToolCatalogFromList(allowed);
}

// extraído de tool-catalog para reuso (ver nota abaixo)
import { toRemoteTool } from './tool-catalog';
function buildToolCatalogFromList(actions: ActionDefinition<any, any>[]): ToolCatalog {
  const tools = actions.map(toRemoteTool);
  const aliases = tools.map((t) => t.alias).sort().join('|');
  let h = 0; for (let i = 0; i < aliases.length; i++) h = (h * 31 + aliases.charCodeAt(i)) | 0;
  return { version: `v${(h >>> 0).toString(16)}`, tools };
}
```

> Nota: `buildToolCatalog(ctx)` (Task 2) usa `getActions()` do registry global; aqui criamos `buildToolCatalogFromList` para receber a lista injetada (testabilidade). Para evitar duplicação, **refatore** `tool-catalog.ts` extraindo `buildToolCatalogFromList(actions)` e fazendo `buildToolCatalog(ctx)` chamá-la com `getActions().filter(...)`. Importe-a aqui em vez de redefinir.

- [ ] **Step 4: Refatorar `tool-catalog.ts` para expor `buildToolCatalogFromList`**

Em `src/core/agent-bridge/tool-catalog.ts`, extrair o corpo de `buildToolCatalog` para `buildToolCatalogFromList(actions: ActionDefinition[])` e exportá-la; `buildToolCatalog(ctx)` passa a ser `buildToolCatalogFromList(getActions().filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires)))`. Em `bridge-service.ts`, importar `buildToolCatalogFromList` e remover a cópia local.

- [ ] **Step 5: Rodar (deve passar)**

Run: `npx jest src/core/agent-bridge/__tests__/bridge-service.test.ts src/core/agent-bridge/__tests__/tool-catalog.test.ts -v`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add src/core/agent-bridge/bridge-service.ts src/core/agent-bridge/tool-catalog.ts src/core/agent-bridge/__tests__/bridge-service.test.ts
git commit -m "feat(ia): bridge-service logic (handle->alias->matrix->runAction), pure & tested"
```

---

## Task 7: Casca `AppService` (WorkerEntrypoint) + wrangler

**Files:**
- Create: `src/workers/ia-bridge/index.ts`
- Create: `wrangler.ia-bridge.jsonc`
- Modify: `package.json` (scripts)

A casca importa `cloudflare:workers` (não roda em Jest) — é fina e só monta as deps reais para `bridge-service`. Validada via `wrangler dev`.

- [ ] **Step 1: Implementar a casca** (`src/workers/ia-bridge/index.ts`)

```ts
import { WorkerEntrypoint } from 'cloudflare:workers';
import { buildSystemContext, buildDelegatedContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { getActions } from '@/core/actions/registry';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { issueHandle, type SeenStore } from '@/core/agent-bridge/handle';
import { listToolsLogic, executeActionLogic, type BridgeDeps, type ListToolsInput, type ExecuteInput } from '@/core/agent-bridge/bridge-service';

export interface Env {
  HANDLE_SECRET: string;
  IA_SEEN: KVNamespace;
}

bootstrapActions(); // garante o registry populado neste isolate

function kvSeenStore(kv: KVNamespace): SeenStore {
  return {
    async wasSeen(jti) { return (await kv.get(`jti:${jti}`)) !== null; },
    async markSeen(jti) { await kv.put(`jti:${jti}`, '1', { expirationTtl: 120 }); },
  };
}

export class AppService extends WorkerEntrypoint<Env> {
  private deps(): BridgeDeps {
    return {
      secret: this.env.HANDLE_SECRET,
      store: kvSeenStore(this.env.IA_SEEN),
      getActions,
      runAction: runAction as BridgeDeps['runAction'],
      buildSystemContext: (clinicId) => buildSystemContext(clinicId),
      buildDelegatedContext: (userId, clinicId) => buildDelegatedContext(userId, clinicId),
    };
  }

  async ping() { return { ok: true as const, from: 'ia-bridge', now: Date.now() }; }

  async issueHandle(input: { clinicId: string; conversationId: string; principalRef: string; source: 'system' | 'agent_delegated'; ttlSeconds?: number }) {
    return issueHandle(this.env.HANDLE_SECRET, input);
  }

  async listTools(input: ListToolsInput) { return listToolsLogic(this.deps(), input); }
  async executeAction(input: ExecuteInput) { return executeActionLogic(this.deps(), input); }
}

export default { fetch() { return new Response('binding-only', { status: 404 }); } };
```

- [ ] **Step 2: Escrever o wrangler** (`wrangler.ia-bridge.jsonc`)

```jsonc
{
  "name": "synkroo-ia-bridge",
  "main": "src/workers/ia-bridge/index.ts",
  "compatibility_date": "2026-06-25",
  "compatibility_flags": ["nodejs_compat"],
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "be5a789a003e4f08a94a82dffbb091be", "localConnectionString": "postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo" }
  ],
  "kv_namespaces": [
    { "binding": "IA_SEEN", "id": "8f2a4d355686427585f665688d1cc082" }
  ],
  "observability": { "enabled": true }
}
```

> `HANDLE_SECRET` é **secret**: `npx wrangler secret put HANDLE_SECRET --config wrangler.ia-bridge.jsonc`. Dev local: `.dev.vars` (gitignored) com `HANDLE_SECRET=...`.

- [ ] **Step 3: Adicionar scripts** (`package.json`)

```json
"dev:ia-bridge": "wrangler dev --config wrangler.ia-bridge.jsonc",
"deploy:ia-bridge": "wrangler deploy --config wrangler.ia-bridge.jsonc"
```

- [ ] **Step 4: Typecheck + provar binding-only**

Run: `npm run typecheck` → Expected: 0 erros.
Run: `npm run dev:ia-bridge` (outro terminal) e `curl -s http://localhost:8787/` → Expected: `binding-only` (HTTP 404).

> A lógica já está testada em Jest (Task 6/8). A casca é validada por typecheck + `wrangler dev` (binding-only). RPC ponta-a-ponta entra no Plano 2 (Worker do agente como cliente do binding).

- [ ] **Step 5: Commit**

```bash
git add src/workers/ia-bridge/index.ts wrangler.ia-bridge.jsonc package.json
git commit -m "feat(ia): ia-bridge worker shell (WorkerEntrypoint) + config (hyperdrive/kv/secret)"
```

---

## Task 8: Matriz de falhas (sobre a lógica pura)

**Files:**
- Test: `src/core/agent-bridge/__tests__/bridge-failures.test.ts`

Exercita os caminhos de falha que a spec exige (§Testing), sobre `executeActionLogic` (lógica pura, deps injetadas) — sem o runtime Workers.

- [ ] **Step 1: Escrever os testes da matriz de falhas**

```ts
import { executeActionLogic, type BridgeDeps } from '../bridge-service';
import { issueHandle } from '../handle';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';

const SECRET = 'secret-test';
const ctx = { source: 'system', clinicId: 'c1', can: () => true, hasModule: () => true, audit: { actor: 'agente (sistema)' } } as unknown as ActionContext;
const mk = (name: string, requires = 'operacional:read') => ({ name, module: 'operacional', requires, label: name, input: { safeParse: () => ({ success: true, data: {} }) } } as unknown as ActionDefinition<any, any>);

function deps(seen = new Set<string>()): BridgeDeps {
  return {
    secret: SECRET,
    store: { async wasSeen(j: string) { return seen.has(j); }, async markSeen(j: string) { seen.add(j); } },
    getActions: () => [mk('operacional.consultarDisponibilidade'), mk('operacional.cancelarConsulta', 'operacional:delete')],
    runAction: async () => ({ ok: true, data: {} }),
    buildSystemContext: async () => ctx,
    buildDelegatedContext: async () => ctx,
  };
}
const issueArgs = { clinicId: 'c1', conversationId: 'conv-1', principalRef: 'agente', source: 'system' as const };

describe('bridge — matriz de falhas', () => {
  it('handle expirado → expired', async () => {
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: -1 });
    const r = await executeActionLogic(deps(), { handle, conversationId: 'conv-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(r).toMatchObject({ ok: false, error: 'expired' });
  });

  it('handle de outra conversa → conversation_mismatch', async () => {
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: 60 });
    const r = await executeActionLogic(deps(), { handle, conversationId: 'OTHER', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(r).toMatchObject({ ok: false, error: 'conversation_mismatch' });
  });

  it('replay do mesmo handle → replayed', async () => {
    const seen = new Set<string>();
    const d = deps(seen);
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: 60 });
    const first = await executeActionLogic(d, { handle, conversationId: 'conv-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    const second = await executeActionLogic(d, { handle, conversationId: 'conv-1', alias: 'operacional__consultarDisponibilidade', input: {}, flags: { confirmed: false } });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: 'replayed' });
  });

  it('alias desconhecido → unknown_tool', async () => {
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: 60 });
    const r = await executeActionLogic(deps(), { handle, conversationId: 'conv-1', alias: 'nao__existe', input: {}, flags: { confirmed: false } });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
  });

  it('ação destrutiva (system) → escalate_human', async () => {
    const { handle } = await issueHandle(SECRET, { ...issueArgs, ttlSeconds: 60 });
    const r = await executeActionLogic(deps(), { handle, conversationId: 'conv-1', alias: 'operacional__cancelarConsulta', input: {}, flags: { confirmed: true } });
    expect(r).toMatchObject({ ok: false, error: 'escalate_human' });
  });
});
```

> A ordem dos gates em `executeActionLogic` (handle → alias → matriz → runAction) garante que cada caso retorne o erro esperado antes de tocar `runAction` (que aqui é mockado de toda forma).

- [ ] **Step 2: Rodar**

Run: `npx jest src/core/agent-bridge/__tests__/bridge-failures.test.ts -v`
Expected: PASS (5/5).

- [ ] **Step 3: Gate completo**

```bash
npm run typecheck
npm run lint
npm test
```
Expected: tudo verde.

- [ ] **Step 4: Commit**

```bash
git add src/core/agent-bridge/__tests__/bridge-failures.test.ts
git commit -m "test(ia): fronteira app-side — matriz de falhas (handle/replay/alias/matriz)"
```

---

## Self-Review Checklist

- **Módulo `ia`** registrado (manifest/permissions/bootstrap/menu) + guard de bootstrap — Task 1.
- **Contrato de tools** (Zod→JSON Schema draft-07 + alias provider-safe + versionamento) — Tasks 2/3.
- **Matriz de segurança** por eixos, deny-by-default, enforcement só no `system` — Task 4.
- **Handle opaco** com HMAC + exp + conversationId + anti-replay (nonce/KV) — Task 5.
- **`AppService`** (handle → alias → matriz → `runAction`), binding-only — Task 6.
- **Infra** do `ia-bridge` (Hyperdrive + KV + secret) — Task 7.
- **Matriz de falhas** testada — Task 8.

> **Notas para o executor:**
> - **Referência fiel:** branch `spike/ia-agente-referencia` (`spikes/app-worker/src/index.ts`, `spikes/convert-tools.ts`) — padrões do handle, WorkerEntrypoint e conversor já provados.
> - **Permissões reais:** ao escrever os testes do catálogo/matriz, confirme os `requires` reais das actions de `operacional` (ex.: `operacional:read`/`:create`) lendo `src/modules/operacional/actions/*` — ajuste os nomes se divergirem dos usados aqui.
> - **Não acessar Postgres fora do `ia-bridge`** (spec §path de dados). O Worker do agente (Plano 2) nunca toca o Postgres — só chama `AppService`.
> - **`HANDLE_SECRET` é secret** (wrangler secret / `.dev.vars`), nunca no repo.
