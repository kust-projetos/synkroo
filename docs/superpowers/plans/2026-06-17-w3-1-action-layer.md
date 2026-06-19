# W3.1 — Action Layer (core) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o núcleo da Action Layer — `defineAction`, registry determinístico, `runAction` (pipeline com gates, validação e auditoria) e o adaptador de tools do agente — testável isoladamente com `ActionContext` mockado.

**Architecture:** `runAction` é o único caminho de execução de operações. Ele consome um `ActionContext` já construído (os construtores reais de contexto — `buildUserContext`/`buildDelegatedContext`/`buildSystemContext` — vêm em W3.2/W3.3, pois dependem de RBAC e manifesto). Aqui o `ctx` é injetado, então tudo é testável sem DB de RBAC/manifesto. Toda execução grava em `action_logs`.

**Tech Stack:** TypeScript 5.6, Zod 3, Drizzle ORM (`getDb()` de `@/lib/db/client`), Jest + ts-jest. Logger: `dbLogger` de `@/lib/logger`.

**Spec de referência:** `docs/superpowers/specs/2026-06-17-w3-modularidade-rbac-action-layer-design.md` (§2 Action Layer, §3.8 auditoria).

**Pré-requisitos:** W0/W1 concluídos (Drizzle única fonte, sem Supabase). `jest.setup.ts` já mocka `@/lib/db/client` com `mockDb`.

**Escopo desta fase (W3.1):** tipos, `defineAction`, registry, `runAction`, `action_logs`, `toAgentTool`/`agentToolsFor`. **Fora de escopo:** resolução real de `can()`/`hasModule()` e construtores de contexto (W3.2/W3.3); painel (W3.5).

---

## File Structure

- Create: `src/core/actions/types.ts` — contratos (ActionContext, ActionDefinition, ActionResult, erros).
- Create: `src/core/actions/registry.ts` — `defineAction`, `registerActions`, `getActions`, `getAction`.
- Create: `src/core/actions/run.ts` — `runAction` (pipeline + auditoria).
- Create: `src/core/actions/agent.ts` — `toAgentTool`, `agentToolsFor`.
- Create: `src/core/actions/index.ts` — reexports públicos.
- Create: `src/lib/db/schema/audit.ts` — tabela `action_logs`.
- Modify: `src/lib/db/schema/index.ts` — `export * from './audit'`.
- Test: `src/core/actions/__tests__/{registry,run,agent}.test.ts`.

Responsabilidade isolada: `types` (contratos), `registry` (catálogo), `run` (execução+auditoria), `agent` (adaptação). Arquivos pequenos e focados.

---

### Task 1: Tipos e contratos

**Files:**
- Create: `src/core/actions/types.ts`

- [ ] **Step 1: Escrever os tipos**

```ts
// src/core/actions/types.ts
import type { z } from 'zod';

export type ContextSource = 'user' | 'agent_delegated' | 'system';

export interface ActionContext {
  source: ContextSource;
  clinicId: string;                 // clínica ativa
  user?: { id: string; email: string; name: string };
  role?: string;
  can: (permissionKey: string) => boolean;
  hasModule: (moduleId: string) => boolean;
  audit: { actor: string; onBehalfOf?: string };
}

export type ActionErrorCode =
  | 'unauthenticated' | 'module_disabled' | 'forbidden'
  | 'invalid_input' | 'not_found' | 'conflict' | 'internal';

export type ActionResult<O> =
  | { ok: true; data: O }
  | { ok: false; error: { code: ActionErrorCode; message: string } };

// Erro de domínio que o handler pode lançar para mapear código + mensagem segura.
export class ActionError extends Error {
  constructor(public code: ActionErrorCode, message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface ActionDefinition<I extends z.ZodTypeAny = z.ZodTypeAny, O = unknown> {
  name: string;
  module: string;
  requires: string;
  label: string;
  description?: string;
  input: I;
  // campos do input a mascarar no log (LGPD). Default: [].
  sensitiveFields?: string[];
  handler: (input: z.infer<I>, ctx: ActionContext) => Promise<O>;
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add src/core/actions/types.ts
git commit -m "feat(actions): tipos e contratos da Action Layer"
```

---

### Task 2: Registry determinístico + `defineAction`

**Files:**
- Create: `src/core/actions/registry.ts`
- Test: `src/core/actions/__tests__/registry.test.ts`

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/core/actions/__tests__/registry.test.ts
import { z } from 'zod';
import { defineAction, registerActions, getActions, getAction, clearRegistry } from '../registry';

const sample = defineAction({
  name: 'core.ping', module: 'core', requires: 'core:ping', label: 'Ping',
  input: z.object({}), handler: async () => 'pong',
});

describe('action registry', () => {
  beforeEach(() => clearRegistry());

  it('defineAction does not register by side effect', () => {
    expect(getActions()).toHaveLength(0);   // só registra via registerActions
  });

  it('registers actions explicitly and retrieves by name', () => {
    registerActions([sample]);
    expect(getActions()).toHaveLength(1);
    expect(getAction('core.ping')).toBe(sample);
  });

  it('throws on duplicate action name', () => {
    registerActions([sample]);
    expect(() => registerActions([sample])).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- src/core/actions/__tests__/registry.test.ts`
Expected: FAIL (módulo `../registry` não existe).

- [ ] **Step 3: Implementar**

```ts
// src/core/actions/registry.ts
import type { z } from 'zod';
import type { ActionDefinition } from './types';

const registry = new Map<string, ActionDefinition>();

// Apenas constrói/tipa a Action. NÃO registra (sem side-effect — §2.3).
export function defineAction<I extends z.ZodTypeAny, O>(
  def: ActionDefinition<I, O>,
): ActionDefinition<I, O> {
  return def;
}

// Registro determinístico, chamado no bootstrap central.
export function registerActions(actions: ActionDefinition[]): void {
  for (const a of actions) {
    if (registry.has(a.name)) throw new Error(`duplicate action name: ${a.name}`);
    registry.set(a.name, a);
  }
}

export function getActions(): ActionDefinition[] {
  return [...registry.values()];
}

export function getAction(name: string): ActionDefinition | undefined {
  return registry.get(name);
}

// Apenas para testes.
export function clearRegistry(): void {
  registry.clear();
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npm test -- src/core/actions/__tests__/registry.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/actions/registry.ts src/core/actions/__tests__/registry.test.ts
git commit -m "feat(actions): registry deterministico + defineAction"
```

---

### Task 3: Tabela `action_logs`

**Files:**
- Create: `src/lib/db/schema/audit.ts`
- Modify: `src/lib/db/schema/index.ts`

- [ ] **Step 1: Definir a tabela** (seguindo o padrão das demais em `src/lib/db/schema/`)

```ts
// src/lib/db/schema/audit.ts
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { clinics } from './core';

export const actionLogs = pgTable('action_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clinicId: uuid('clinic_id').references(() => clinics.id, { onDelete: 'set null' }), // null em pré-auth
  principalType: text('principal_type'),     // 'user' | 'agent_delegated' | 'system' | null
  actor: text('actor').notNull(),            // userId | 'agente' | 'agente (sistema)' | 'unknown'
  onBehalfOf: uuid('on_behalf_of'),          // userId delegante (agent_delegated)
  actionName: text('action_name').notNull(),
  module: text('module').notNull(),
  inputRedacted: jsonb('input_redacted').default('{}'),
  result: text('result').notNull(),          // 'ok' | 'error'
  errorCode: text('error_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Exportar no index do schema**

Em `src/lib/db/schema/index.ts`, adicionar:
```ts
export * from './audit';
```

- [ ] **Step 3: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Gerar a migração Drizzle**

Run: `npm run db:generate`
Expected: novo arquivo em `src/lib/db/migrations/` criando `action_logs`. Conferir o SQL gerado.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema/audit.ts src/lib/db/schema/index.ts src/lib/db/migrations/
git commit -m "feat(db): tabela action_logs para auditoria da Action Layer"
```

---

### Task 4: `runAction` (pipeline + auditoria)

**Files:**
- Create: `src/core/actions/run.ts`
- Test: `src/core/actions/__tests__/run.test.ts`

- [ ] **Step 1: Escrever os testes (falham)** — cobrem cada ramo do pipeline (§2.2) + auditoria.

```ts
// src/core/actions/__tests__/run.test.ts
import { z } from 'zod';
import { runAction } from '../run';
import { defineAction } from '../registry';
import { ActionError, type ActionContext } from '../types';

const action = defineAction({
  name: 'core.echo', module: 'core', requires: 'core:echo', label: 'Echo',
  input: z.object({ value: z.string() }),
  handler: async (i) => ({ echoed: i.value }),
});

function ctx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    source: 'user', clinicId: 'clinic-1',
    user: { id: 'u1', email: 'a@b.c', name: 'A' }, role: 'owner',
    can: () => true, hasModule: () => true,
    audit: { actor: 'u1' }, ...over,
  };
}

// captura as gravações de auditoria
const logs: any[] = [];
jest.mock('../audit-writer', () => ({ writeActionLog: (r: any) => { logs.push(r); } }));

describe('runAction pipeline', () => {
  beforeEach(() => { logs.length = 0; });

  it('rejects when ctx is missing', async () => {
    const r = await runAction(action, { value: 'x' }, undefined as any);
    expect(r).toEqual({ ok: false, error: { code: 'unauthenticated', message: expect.any(String) } });
  });

  it('rejects non-system principal without user', async () => {
    const r = await runAction(action, { value: 'x' }, ctx({ user: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unauthenticated');
  });

  it('allows system principal without user', async () => {
    const r = await runAction(action, { value: 'x' },
      ctx({ source: 'system', user: undefined, audit: { actor: 'agente (sistema)' } }));
    expect(r.ok).toBe(true);
  });

  it('rejects when module disabled', async () => {
    const r = await runAction(action, { value: 'x' }, ctx({ hasModule: () => false }));
    if (!r.ok) expect(r.error.code).toBe('module_disabled');
  });

  it('rejects when permission denied', async () => {
    const r = await runAction(action, { value: 'x' }, ctx({ can: () => false }));
    if (!r.ok) expect(r.error.code).toBe('forbidden');
  });

  it('rejects invalid input', async () => {
    const r = await runAction(action, { value: 123 }, ctx());
    if (!r.ok) expect(r.error.code).toBe('invalid_input');
  });

  it('runs handler and returns data', async () => {
    const r = await runAction(action, { value: 'hi' }, ctx());
    expect(r).toEqual({ ok: true, data: { echoed: 'hi' } });
  });

  it('maps ActionError thrown by handler', async () => {
    const boom = defineAction({
      name: 'core.boom', module: 'core', requires: 'core:boom', label: 'Boom',
      input: z.object({}), handler: async () => { throw new ActionError('not_found', 'nope'); },
    });
    const r = await runAction(boom, {}, ctx());
    if (!r.ok) expect(r.error.code).toBe('not_found');
  });

  it('writes an audit log on success and on error', async () => {
    await runAction(action, { value: 'hi' }, ctx());
    await runAction(action, { value: 1 as any }, ctx());
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ result: 'ok', actionName: 'core.echo', clinicId: 'clinic-1' });
    expect(logs[1]).toMatchObject({ result: 'error', errorCode: 'invalid_input' });
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- src/core/actions/__tests__/run.test.ts`
Expected: FAIL (`../run` e `../audit-writer` não existem).

- [ ] **Step 3: Implementar o writer de auditoria**

```ts
// src/core/actions/audit-writer.ts
import { getDb } from '@/lib/db/client';
import { actionLogs } from '@/lib/db/schema/audit';
import { dbLogger } from '@/lib/logger';

export interface ActionLogRecord {
  clinicId: string | null;
  principalType: string | null;
  actor: string;
  onBehalfOf?: string | null;
  actionName: string;
  module: string;
  inputRedacted: unknown;
  result: 'ok' | 'error';
  errorCode?: string | null;
}

export async function writeActionLog(rec: ActionLogRecord): Promise<void> {
  try {
    await getDb().insert(actionLogs).values({
      clinicId: rec.clinicId, principalType: rec.principalType, actor: rec.actor,
      onBehalfOf: rec.onBehalfOf ?? null, actionName: rec.actionName, module: rec.module,
      inputRedacted: rec.inputRedacted as any, result: rec.result, errorCode: rec.errorCode ?? null,
    });
  } catch (err) {
    dbLogger.error('failed to write action_log', { actionName: rec.actionName, err });
  }
}

// Mascara campos sensíveis do input antes de logar (LGPD).
export function redactInput(input: unknown, sensitive: string[]): unknown {
  if (!input || typeof input !== 'object') return input;
  const clone: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  for (const key of sensitive) if (key in clone) clone[key] = '[REDACTED]';
  return clone;
}
```

- [ ] **Step 4: Implementar `runAction`**

```ts
// src/core/actions/run.ts
import type { ActionContext, ActionDefinition, ActionResult, ActionErrorCode } from './types';
import { ActionError } from './types';
import { writeActionLog, redactInput } from './audit-writer';
import { dbLogger } from '@/lib/logger';

function fail(code: ActionErrorCode, message: string) {
  return { ok: false as const, error: { code, message } };
}

export async function runAction<O>(
  action: ActionDefinition<any, O>,
  rawInput: unknown,
  ctx: ActionContext,
): Promise<ActionResult<O>> {
  // 1. Auth por principal
  if (!ctx || !ctx.clinicId || (ctx.source !== 'system' && !ctx.user)) {
    await writeActionLog({
      clinicId: ctx?.clinicId ?? null, principalType: ctx?.source ?? null,
      actor: ctx?.audit?.actor ?? 'unknown', onBehalfOf: ctx?.audit?.onBehalfOf,
      actionName: action.name, module: action.module,
      inputRedacted: redactInput(rawInput, action.sensitiveFields ?? []),
      result: 'error', errorCode: 'unauthenticated',
    });
    return fail('unauthenticated', 'Não autenticado.');
  }

  const base = {
    clinicId: ctx.clinicId, principalType: ctx.source, actor: ctx.audit.actor,
    onBehalfOf: ctx.audit.onBehalfOf, actionName: action.name, module: action.module,
    inputRedacted: redactInput(rawInput, action.sensitiveFields ?? []),
  };
  const logErr = (code: ActionErrorCode) =>
    writeActionLog({ ...base, result: 'error', errorCode: code });

  // 2. Gate manifesto
  if (!ctx.hasModule(action.module)) { await logErr('module_disabled'); return fail('module_disabled', 'Módulo não disponível.'); }
  // 3. Gate RBAC
  if (!ctx.can(action.requires)) { await logErr('forbidden'); return fail('forbidden', 'Sem permissão.'); }
  // 4. Input
  const parsed = action.input.safeParse(rawInput);
  if (!parsed.success) { await logErr('invalid_input'); return fail('invalid_input', 'Dados inválidos.'); }

  // 5. Handler
  try {
    const data = await action.handler(parsed.data, ctx);
    await writeActionLog({ ...base, result: 'ok', errorCode: null });
    return { ok: true, data };
  } catch (err) {
    const code: ActionErrorCode = err instanceof ActionError ? err.code : 'internal';
    if (code === 'internal') dbLogger.error('action handler threw', { action: action.name, err });
    await logErr(code);
    return fail(code, err instanceof ActionError ? err.message : 'Erro interno.');
  }
}
```

- [ ] **Step 5: Rodar — deve passar**

Run: `npm test -- src/core/actions/__tests__/run.test.ts`
Expected: PASS (todos os ramos).

- [ ] **Step 6: Commit**

```bash
git add src/core/actions/run.ts src/core/actions/audit-writer.ts src/core/actions/__tests__/run.test.ts
git commit -m "feat(actions): runAction com gates, validacao e auditoria"
```

---

### Task 5: Adaptador de tools do agente

**Files:**
- Create: `src/core/actions/agent.ts`
- Test: `src/core/actions/__tests__/agent.test.ts`

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/core/actions/__tests__/agent.test.ts
import { z } from 'zod';
import { defineAction, registerActions, clearRegistry } from '../registry';
import { agentToolsFor } from '../agent';
import type { ActionContext } from '../types';

const a1 = defineAction({ name: 'op.a', module: 'op', requires: 'op:a', label: 'A', input: z.object({}), handler: async () => 1 });
const a2 = defineAction({ name: 'fin.b', module: 'fin', requires: 'fin:b', label: 'B', input: z.object({}), handler: async () => 2 });

function ctx(over: Partial<ActionContext> = {}): ActionContext {
  return { source: 'system', clinicId: 'c1', can: () => true, hasModule: () => true, audit: { actor: 'agente (sistema)' }, ...over };
}

describe('agentToolsFor', () => {
  beforeEach(() => { clearRegistry(); registerActions([a1, a2]); });

  it('exposes only tools whose module is enabled and permitted', () => {
    const tools = agentToolsFor(ctx({ hasModule: (m) => m === 'op', can: () => true }));
    expect(tools.map((t) => t.name)).toEqual(['op.a']);
  });

  it('excludes tools the principal cannot run', () => {
    const tools = agentToolsFor(ctx({ hasModule: () => true, can: (k) => k === 'op:a' }));
    expect(tools.map((t) => t.name)).toEqual(['op.a']);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- src/core/actions/__tests__/agent.test.ts`
Expected: FAIL (`../agent` não existe).

- [ ] **Step 3: Implementar**

```ts
// src/core/actions/agent.ts
import type { ActionContext, ActionDefinition } from './types';
import { getActions } from './registry';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: ActionDefinition['input'];
  run: (rawInput: unknown) => Promise<unknown>;
}

export function toAgentTool(action: ActionDefinition, ctx: ActionContext): AgentTool {
  // import dinâmico evita ciclo run.ts <-> agent.ts
  return {
    name: action.name,
    description: action.description ?? action.label,
    inputSchema: action.input,
    run: async (rawInput: unknown) => {
      const { runAction } = await import('./run');
      return runAction(action, rawInput, ctx);
    },
  };
}

// Filtra o registry pelo manifesto (hasModule) E pela permissão (can) do principal.
export function agentToolsFor(ctx: ActionContext): AgentTool[] {
  return getActions()
    .filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires))
    .map((a) => toAgentTool(a, ctx));
}
```

- [ ] **Step 4: Rodar — deve passar**

Run: `npm test -- src/core/actions/__tests__/agent.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar o barrel `index.ts`**

```ts
// src/core/actions/index.ts
export * from './types';
export { defineAction, registerActions, getActions, getAction, clearRegistry } from './registry';
export { runAction } from './run';
export { toAgentTool, agentToolsFor } from './agent';
```

- [ ] **Step 6: Commit**

```bash
git add src/core/actions/agent.ts src/core/actions/index.ts src/core/actions/__tests__/agent.test.ts
git commit -m "feat(actions): adaptador de tools do agente (filtrado por manifesto+RBAC)"
```

---

### Task 6: Verificação final da fase

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 2: Toda a suíte da Action Layer**

Run: `npm test -- src/core/actions`
Expected: PASS (registry, run, agent).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 4: Commit final (se houve ajuste)**

```bash
git add -A && git commit -m "chore(actions): baseline verde da Action Layer core (W3.1)"
```

---

## Self-Review

**Spec coverage (vs. §2 e §3.8):**
- `defineAction` sem side-effect + registry determinístico → Task 2 ✓ (§2.3)
- `runAction` pipeline com auth-por-principal (system sem user), gates manifesto+RBAC, zod, mapeamento de erro → Task 4 ✓ (§2.2)
- `action_logs` com clinicId/principalType nullable, redação, ok/error → Tasks 3+4 ✓ (§3.8)
- `toAgentTool`/`agentToolsFor` filtrados por hasModule+can → Task 5 ✓ (§2.5)

**Placeholder scan:** nenhum TBD. `can`/`hasModule` reais e construtores de contexto são **explicitamente** W3.2/W3.3 — aqui injetados/mockados, não placeholder.

**Type consistency:** `ActionContext`, `ActionDefinition`, `ActionResult`, `ActionError`, `ActionErrorCode` definidos na Task 1 e usados igual nas Tasks 2/4/5. `writeActionLog`/`redactInput` definidos na Task 4 e referenciados no teste (mock de `../audit-writer`).

**Dependência seguinte:** W3.2 (RBAC) implementa `buildUserContext`/`buildDelegatedContext` e a resolução real de `can()`; W3.3 (manifesto) implementa `hasModule` e `buildSystemContext`. O `runAction` não muda — só passa a receber contextos reais.
