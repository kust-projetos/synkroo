import { WorkerEntrypoint } from 'cloudflare:workers';
import { buildSystemContext, buildDelegatedContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { getDb, setDbConnectionString } from '@/lib/db/client';
import { sql } from 'drizzle-orm';
import { runDbHealthCheck } from '@/core/agent-bridge/db-health';
import { getActions } from '@/core/actions/registry';
import { parseRuntimeEnv } from '@/lib/runtime-env';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { issueHandle, type SeenStore } from '@/core/agent-bridge/handle';
import {
  listToolsLogic,
  executeActionLogic,
  type BridgeDeps,
} from '@/core/agent-bridge/bridge-service';
import {
  contractVersionMismatch,
  resolveContractVersion,
  type CompatibleDbHealthInput,
  type CompatibleExecuteInput,
  type CompatibleIssueHandleInput,
  type CompatibleListToolsInput,
  type CompatiblePingInput,
  type DbHealthResult,
  type ExecuteResult,
  type IssueHandleResult,
  type ListToolsResult,
  type PingResult,
} from '@/core/agent-bridge/rpc-contract';
import {
  createTelemetryLogger,
  extractCorrelationId,
} from '@/core/ia-agent/telemetry';

// B2: sink estruturado edge-safe (JSON via console). correlationId é
// extraído de forma defensiva do input (campo aditivo opcional).
const emitBridge = createTelemetryLogger('ia-bridge');

export interface Env {
  HANDLE_SECRET: string;
  IA_SEEN: KVNamespace;
  HYPERDRIVE: { connectionString: string };
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
  setDbConnectionString(env.HYPERDRIVE.connectionString);
}

function withoutContractVersion<T extends { contractVersion?: unknown }>(
  input: T,
): Omit<T, 'contractVersion'> {
  const { contractVersion: _contractVersion, ...withoutVersion } = input;
  return withoutVersion;
}

async function issueHandleRpc(
  env: Env,
  input: CompatibleIssueHandleInput,
): Promise<IssueHandleResult> {
  const contractVersion = resolveContractVersion(input);
  if (!contractVersion) return contractVersionMismatch();

  validateBridgeEnv(env);
  const { handle, payload } = await issueHandle(
    env.HANDLE_SECRET,
    withoutContractVersion(input),
  );
  return {
    contractVersion,
    handle,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export class HandleIssuerService extends WorkerEntrypoint<Env> {
  async issueHandle(input: CompatibleIssueHandleInput): Promise<IssueHandleResult> {
    return issueHandleRpc(this.env, input);
  }
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

  async ping(input: CompatiblePingInput = {}): Promise<PingResult> {
    const contractVersion = resolveContractVersion(input);
    if (!contractVersion) return contractVersionMismatch();

    validateBridgeEnv(this.env);
    return {
      ok: true,
      contractVersion,
      from: 'ia-bridge',
      now: Date.now(),
    };
  }

  async dbHealth(input: CompatibleDbHealthInput = {}): Promise<DbHealthResult> {
    const contractVersion = resolveContractVersion(input);
    if (!contractVersion) return contractVersionMismatch();

    validateBridgeEnv(this.env);
    const result = await runDbHealthCheck(() => getDb().execute(sql`SELECT 1`));
    return { ...result, contractVersion };
  }

  // Compat: manter issueHandle em AppService temporariamente para rollout compatível (primeiro deploy)
  async issueHandle(input: CompatibleIssueHandleInput): Promise<IssueHandleResult> {
    return issueHandleRpc(this.env, input);
  }

  async listTools(input: CompatibleListToolsInput): Promise<ListToolsResult> {
    const contractVersion = resolveContractVersion(input);
    if (!contractVersion) return contractVersionMismatch();

    const correlationId = extractCorrelationId(input);
    const startedAt = Date.now();
    await ensureBootstrap();
    try {
      const result = await listToolsLogic(this.deps(), withoutContractVersion(input));
      if (result.ok) {
        return { ok: true, contractVersion, catalog: result.catalog };
      }
      emitBridge({
        correlationId,
        operation: 'list_tools',
        durationMs: Date.now() - startedAt,
        status: 'error',
        code: result.error,
      });
      return { ok: false, contractVersion, error: result.error, level: (result as any).level, message: (result as any).message };
    } catch (err) {
      emitBridge({
        correlationId,
        operation: 'list_tools',
        durationMs: Date.now() - startedAt,
        status: 'error',
        code: 'internal',
        detail: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
      throw err;
    }
  }

  async executeAction(input: CompatibleExecuteInput): Promise<ExecuteResult> {
    const contractVersion = resolveContractVersion(input);
    if (!contractVersion) return contractVersionMismatch();

    const correlationId = extractCorrelationId(input);
    const startedAt = Date.now();
    await ensureBootstrap();
    try {
      const result = await executeActionLogic(
        this.deps(),
        withoutContractVersion(input),
      );
      if (result.ok) {
        return { ok: true, contractVersion, data: result.data };
      }
      emitBridge({
        correlationId,
        operation: 'execute_action',
        durationMs: Date.now() - startedAt,
        status: 'error',
        code: result.error,
        detail: (result as { message?: string }).message?.slice(0, 300),
      });
      return { ok: false, contractVersion, error: result.error, level: (result as any).level, message: (result as any).message };
    } catch (err) {
      emitBridge({
        correlationId,
        operation: 'execute_action',
        durationMs: Date.now() - startedAt,
        status: 'error',
        code: 'internal',
        detail: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300),
      });
      throw err;
    }
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  fetch() {
    return new Response('binding-only', { status: 404 });
  },
};
