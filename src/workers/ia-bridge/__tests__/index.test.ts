/**
 * Unit Test Suite for ia-bridge WorkerEntrypoint (src/workers/ia-bridge/index.ts)
 *
 * Covers:
 * 1. Memoized bootstrapActions() initialization (concurrent and sequential calls)
 * 2. kvSeenStore: wasSeen (true/false) and markSeen (TTL clamping with Math.max(ttl, 60))
 * 3. Runtime environment validation and connection string propagation
 * 4. AppService RPC methods: ping, dbHealth, issueHandle, listTools, executeAction
 * 5. Dependency wiring: buildSystemContext, buildDelegatedContext, getActions, runAction
 * 6. Default export fetch handler (404 binding-only response)
 */

// ── Mocks ────────────────────────────────────────────────────────

jest.mock(
  'cloudflare:workers',
  () => {
    return {
      WorkerEntrypoint: class WorkerEntrypoint<E = any> {
        ctx: any;
        env: E;
        constructor(ctx: any, env: E) {
          this.ctx = ctx;
          this.env = env;
        }
      },
    };
  },
  { virtual: true },
);

jest.mock('@/lib/runtime-env', () => ({
  parseRuntimeEnv: jest.fn(),
}));

const mockExecute = jest.fn().mockResolvedValue([{ ok: 1 }]);
jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    execute: mockExecute,
  })),
  setDbConnectionString: jest.fn(),
}));

jest.mock('@/core/actions/bootstrap', () => ({
  bootstrapActions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/core/agent-bridge/handle', () => ({
  issueHandle: jest.fn().mockResolvedValue('issued-handle-token-123'),
}));

jest.mock('@/core/agent-bridge/bridge-service', () => ({
  listToolsLogic: jest.fn().mockResolvedValue({
    ok: true,
    catalog: {
      tools: [{ name: 'pacientes_listar', description: 'Listar pacientes' }],
    },
  }),
  executeActionLogic: jest.fn().mockResolvedValue({
    ok: true,
    data: { id: 'act-result-1' },
  }),
}));

jest.mock('@/core/agent-bridge/db-health', () => ({
  runDbHealthCheck: jest.fn().mockImplementation(async (queryFn: () => Promise<any>) => {
    try {
      await queryFn();
      return { status: 'healthy', latencyMs: 2 };
    } catch (err: any) {
      return { status: 'unhealthy', latencyMs: 2, error: err.message };
    }
  }),
}));

jest.mock('@/core/actions/context', () => ({
  buildSystemContext: jest.fn().mockImplementation(async (clinicId: string) => ({
    clinicId,
    role: 'system',
  })),
  buildDelegatedContext: jest.fn().mockImplementation(async (userId: string, clinicId: string) => ({
    userId,
    clinicId,
    role: 'delegated',
  })),
}));

jest.mock('@/core/actions/run', () => ({
  runAction: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('@/core/actions/registry', () => ({
  getActions: jest.fn().mockReturnValue([
    { key: 'pacientes_listar', permission: 'patients:view' },
  ]),
}));

// ── Imports after mocks ──────────────────────────────────────────

import defaultExport, { AppService, type Env } from '../index';
import { parseRuntimeEnv } from '@/lib/runtime-env';
import { setDbConnectionString } from '@/lib/db/client';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { issueHandle } from '@/core/agent-bridge/handle';
import { listToolsLogic, executeActionLogic, type ListToolsInput, type ExecuteInput } from '@/core/agent-bridge/bridge-service';
import { runDbHealthCheck } from '@/core/agent-bridge/db-health';
import { buildSystemContext, buildDelegatedContext } from '@/core/actions/context';

// ── Helpers ──────────────────────────────────────────────────────

function createMockKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    put: jest.fn(async (key: string, val: string, _opts?: any) => {
      store.set(key, val);
    }),
  } as unknown as KVNamespace & { store: Map<string, string>; get: jest.Mock; put: jest.Mock };
}

function createMockEnv(): { env: Env; mockKV: ReturnType<typeof createMockKV> } {
  const mockKV = createMockKV();
  const env: Env = {
    HANDLE_SECRET: 'test-handle-secret-32-chars-long!',
    IA_SEEN: mockKV,
    HYPERDRIVE: { connectionString: 'postgres://user:pass@hyperdrive.local:5432/db' },
  };
  return { env, mockKV };
}

// ── Test Suite ───────────────────────────────────────────────────

describe('ia-bridge WorkerEntrypoint', () => {
  let mockEnv: Env;
  let mockKV: ReturnType<typeof createMockKV>;
  let service: AppService;

  beforeEach(() => {
    jest.clearAllMocks();
    const created = createMockEnv();
    mockEnv = created.env;
    mockKV = created.mockKV;
    service = new (AppService as any)({} as any, mockEnv);
  });

  describe('validateBridgeEnv and runtime configuration', () => {
    it('validates bridge env and propagates Hyperdrive connection string', async () => {
      await service.ping();

      expect(parseRuntimeEnv).toHaveBeenCalledWith('bridge', mockEnv);
      expect(setDbConnectionString).toHaveBeenCalledWith('postgres://user:pass@hyperdrive.local:5432/db');
    });
  });

  describe('ping RPC method', () => {
    it('validates env and returns pong response with timestamp', async () => {
      const before = Date.now();
      const res = await service.ping();
      const after = Date.now();

      expect(res.ok).toBe(true);
      expect(res.from).toBe('ia-bridge');
      expect(res.now).toBeGreaterThanOrEqual(before);
      expect(res.now).toBeLessThanOrEqual(after);
    });
  });

  describe('dbHealth RPC method', () => {
    it('validates env and runs db health check with select 1 query', async () => {
      const res = await service.dbHealth();

      expect(runDbHealthCheck).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ status: 'healthy', latencyMs: 2 });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('issueHandle RPC method', () => {
    it('validates env and delegates to issueHandle helper with HANDLE_SECRET', async () => {
      const input = {
        clinicId: 'clinic-123',
        conversationId: 'conv-456',
        principalRef: 'user-789',
        source: 'system' as const,
        ttlSeconds: 120,
      };

      const handle = await service.issueHandle(input);

      expect(issueHandle).toHaveBeenCalledWith('test-handle-secret-32-chars-long!', input);
      expect(handle).toBe('issued-handle-token-123');
    });
  });

  describe('listTools and executeAction (bootstrap memoization & deps wiring)', () => {
    it('ensures bootstrapActions is called and delegates to listToolsLogic', async () => {
      const input: ListToolsInput = {
        handle: 'valid-handle-token',
        conversationId: 'conv-123',
      };
      const res = await service.listTools(input);

      expect(bootstrapActions).toHaveBeenCalledTimes(1);
      expect(listToolsLogic).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: mockEnv.HANDLE_SECRET,
          store: expect.any(Object),
          getActions: expect.any(Function),
          runAction: expect.any(Function),
        }),
        input,
      );
      expect(res).toEqual({
        ok: true,
        catalog: {
          tools: [{ name: 'pacientes_listar', description: 'Listar pacientes' }],
        },
      });
    });

    it('memoizes ensureBootstrap across concurrent and sequential calls', async () => {
      const callsBefore = (bootstrapActions as jest.Mock).mock.calls.length;

      // Run multiple concurrent calls
      await Promise.all([
        service.listTools({ handle: 'token-1', conversationId: 'c1' }),
        service.executeAction({
          handle: 'token-2',
          conversationId: 'c1',
          idempotencyKey: 'idemp-1',
          alias: 'pacientes_listar',
          input: {},
          flags: { confirmed: true },
        }),
        service.listTools({ handle: 'token-3', conversationId: 'c1' }),
      ]);

      const callsAfter = (bootstrapActions as jest.Mock).mock.calls.length;
      // bootstrapActions should not have been invoked again because the Promise is memoized
      expect(callsAfter - callsBefore).toBe(0);
    });

    it('delegates executeAction to executeActionLogic with full bridge deps', async () => {
      const input: ExecuteInput = {
        handle: 'valid-handle-token',
        conversationId: 'conv-123',
        idempotencyKey: 'idemp-2',
        alias: 'pacientes_listar',
        input: { search: 'Maria' },
        flags: { confirmed: true, identityVerified: true },
      };

      const res = await service.executeAction(input);

      expect(executeActionLogic).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: mockEnv.HANDLE_SECRET,
          store: expect.any(Object),
          getActions: expect.any(Function),
          runAction: expect.any(Function),
        }),
        input,
      );
      expect(res).toEqual({
        ok: true,
        data: { id: 'act-result-1' },
      });
    });

    it('invokes context builder callbacks wired in deps', async () => {
      // Access deps via private method invocation
      const deps = (service as any).deps();

      const sysCtx = await deps.buildSystemContext('clinic-test');
      expect(buildSystemContext).toHaveBeenCalledWith('clinic-test');
      expect(sysCtx).toEqual({ clinicId: 'clinic-test', role: 'system' });

      const delCtx = await deps.buildDelegatedContext('user-1', 'clinic-test');
      expect(buildDelegatedContext).toHaveBeenCalledWith('user-1', 'clinic-test');
      expect(delCtx).toEqual({ userId: 'user-1', clinicId: 'clinic-test', role: 'delegated' });
    });
  });

  describe('kvSeenStore behavior via deps', () => {
    it('correctly tracks seen JTIs with min 60s expiration TTL', async () => {
      const deps = (service as any).deps();
      const store = deps.store;

      // Initially not seen
      const seenInitial = await store.wasSeen('jti-abc');
      expect(seenInitial).toBe(false);
      expect(mockKV.get).toHaveBeenCalledWith('jti:jti-abc');

      // Mark seen with small TTL (should clamp to 60)
      await store.markSeen('jti-abc', 20);
      expect(mockKV.put).toHaveBeenCalledWith('jti:jti-abc', '1', {
        expirationTtl: 60,
      });

      // Now seen returns true
      const seenAfter = await store.wasSeen('jti-abc');
      expect(seenAfter).toBe(true);

      // Mark seen with large TTL (> 60)
      await store.markSeen('jti-xyz', 300);
      expect(mockKV.put).toHaveBeenCalledWith('jti:jti-xyz', '1', {
        expirationTtl: 300,
      });
    });
  });

  describe('default export fetch handler', () => {
    it('returns a 404 response with "binding-only" body', async () => {
      const res = defaultExport.fetch();

      expect(res.status).toBe(404);
      const text = await res.text();
      expect(text).toBe('binding-only');
    });
  });
});
