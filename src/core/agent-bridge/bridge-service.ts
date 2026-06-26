import type { ActionContext, ActionDefinition, ActionResult } from '@/core/actions/types';
import { verifyHandle, type SeenStore } from './handle';
import { buildToolCatalogFromList, normalizeToolName } from './tool-catalog';
import { assertSystemAllowed } from './security-matrix';
import type { ToolCatalog } from './types';

export interface BridgeDeps {
  secret: string;
  store: SeenStore;
  getActions: () => ActionDefinition<any, any>[];
  runAction: (
    action: ActionDefinition<any, any>,
    input: unknown,
    ctx: ActionContext,
  ) => Promise<ActionResult<unknown>>;
  buildSystemContext: (clinicId: string) => Promise<ActionContext>;
  buildDelegatedContext: (
    userId: string,
    clinicId: string,
  ) => Promise<ActionContext>;
}

// ─── listTools ────────────────────────────────────────────────────────────────

export type ListToolsInput = { handle: string; conversationId: string };

export type ListToolsResult =
  | { ok: true; catalog: ToolCatalog }
  | { ok: false; error: string };

export async function listToolsLogic(
  deps: BridgeDeps,
  input: ListToolsInput,
): Promise<ListToolsResult> {
  const v = await verifyHandle(deps.secret, input.handle, {
    conversationId: input.conversationId,
    store: deps.store,
  });
  if (!v.ok) return { ok: false, error: v.error };

  const ctx = await rebuildCtx(deps, v.payload);
  const allowed = deps
    .getActions()
    .filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires));
  return { ok: true, catalog: buildToolCatalogFromList(allowed) };
}

// ─── executeAction ────────────────────────────────────────────────────────────

export type ExecuteInput = {
  handle: string;
  conversationId: string;
  idempotencyKey: string;
  alias: string;
  input: unknown;
  flags: { confirmed: boolean; identityVerified?: boolean };
};

export type ExecuteResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; level?: string; message?: string };

export async function executeActionLogic(
  deps: BridgeDeps,
  input: ExecuteInput,
): Promise<ExecuteResult> {
  // 1. handle reusable (no single-use — dedup é por idempotencyKey)
  const v = await verifyHandle(deps.secret, input.handle, {
    conversationId: input.conversationId,
    store: deps.store,
  });
  if (!v.ok) return { ok: false, error: v.error };

  // 2. anti-replay por idempotencyKey
  const dedupKey = `${input.conversationId}:${input.idempotencyKey}`;
  if (await deps.store.wasSeen(dedupKey)) {
    return { ok: false, error: 'duplicate' };
  }
  const ttl = Math.max(
    Math.ceil((v.payload.exp - Date.now()) / 1000) + 30,
    60,
  );
  await deps.store.markSeen(dedupKey, ttl);

  // 3. alias → action.name
  const action = deps
    .getActions()
    .find((a) => normalizeToolName(a.name) === input.alias);
  if (!action) return { ok: false, error: 'unknown_tool' };

  // 4. matriz (só source='system'); delegated cai no RBAC do runAction
  if (v.payload.source === 'system') {
    const gate = assertSystemAllowed(action.name, input.flags);
    if (!gate.allowed) {
      return { ok: false, error: gate.reason!, level: gate.level };
    }
  }

  // 5. ctx real + runAction (RBAC + manifesto + input zod dentro do runAction)
  const ctx = await rebuildCtx(deps, v.payload);
  const result = await deps.runAction(action, input.input, ctx);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error.code,
      message: result.error.message,
    };
  }
  return { ok: true, data: result.data };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function rebuildCtx(
  deps: BridgeDeps,
  payload: {
    clinicId: string;
    principalRef: string;
    source: 'system' | 'agent_delegated';
  },
): Promise<ActionContext> {
  return payload.source === 'system'
    ? await deps.buildSystemContext(payload.clinicId)
    : await deps.buildDelegatedContext(payload.principalRef, payload.clinicId);
}
