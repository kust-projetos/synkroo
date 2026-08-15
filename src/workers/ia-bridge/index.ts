import { WorkerEntrypoint } from 'cloudflare:workers';
import { buildSystemContext, buildDelegatedContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { getActions } from '@/core/actions/registry';
import { parseRuntimeEnv } from '@/lib/runtime-env';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { issueHandle, type SeenStore } from '@/core/agent-bridge/handle';
import {
  listToolsLogic,
  executeActionLogic,
  type BridgeDeps,
  type ListToolsInput,
  type ExecuteInput,
} from '@/core/agent-bridge/bridge-service';

export interface Env {
  HANDLE_SECRET: string;
  IA_SEEN: KVNamespace;
}

// bootstrapActions() é ASYNC (dynamic imports). Memoizar a Promise garante que o
// registry esteja populado antes de qualquer RPC, mesmo sob chamadas concorrentes.
let bootstrapPromise: Promise<void> | null = null;
function ensureBootstrap(): Promise<void> {
  if (!bootstrapPromise) bootstrapPromise = bootstrapActions();
  return bootstrapPromise;
}

function kvSeenStore(kv: KVNamespace): SeenStore {
  return {
    async wasSeen(jti) {
      return (await kv.get(`jti:${jti}`)) !== null;
    },
    async markSeen(jti, ttlSeconds) {
      await kv.put(`jti:${jti}`, '1', {
        expirationTtl: Math.max(ttlSeconds, 60),
      });
    },
  };
}

function validateBridgeEnv(env: Env): void {
  parseRuntimeEnv('bridge', env as unknown as Record<string, unknown>);
}

export class AppService extends WorkerEntrypoint<Env> {
  private deps(): BridgeDeps {
    validateBridgeEnv(this.env);
    return {
      secret: this.env.HANDLE_SECRET,
      store: kvSeenStore(this.env.IA_SEEN),
      getActions,
      runAction: runAction as BridgeDeps['runAction'],
      buildSystemContext: (clinicId) => buildSystemContext(clinicId),
      buildDelegatedContext: (userId, clinicId) =>
        buildDelegatedContext(userId, clinicId),
    };
  }

  async ping() {
    validateBridgeEnv(this.env);
    return { ok: true as const, from: 'ia-bridge', now: Date.now() };
  }

  async issueHandle(input: {
    clinicId: string;
    conversationId: string;
    principalRef: string;
    source: 'system' | 'agent_delegated';
    ttlSeconds?: number;
  }) {
    validateBridgeEnv(this.env);
    return issueHandle(this.env.HANDLE_SECRET, input);
  }

  async listTools(input: ListToolsInput) {
    await ensureBootstrap();
    return listToolsLogic(this.deps(), input);
  }

  async executeAction(input: ExecuteInput) {
    await ensureBootstrap();
    return executeActionLogic(this.deps(), input);
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  fetch() {
    return new Response('binding-only', { status: 404 });
  },
};
