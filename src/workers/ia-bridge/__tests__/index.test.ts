/**
 * Unit Test Suite for ia-bridge WorkerEntrypoint (src/workers/ia-bridge/index.ts)
 *
 * Covers:
 * 1. Memoized bootstrapActions() initialization (concurrent and sequential calls)
 * 2. kvSeenStore: wasSeen (true/false) and markSeen (TTL clamping with Math.max(ttl, 60))
 * 3. Runtime environment validation and connection string propagation
 * 4. AppService RPC methods: ping, dbHealth, issueHandle, listTools, executeAction
 * 5. Capability separation and version mismatch fail-closed behavior
 * 6. Dependency wiring: buildSystemContext, buildDelegatedContext, getActions, runAction
 * 7. Default export fetch handler (404 binding-only response)
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
  issueHandle: jest.fn().mockResolvedValue({
    handle: 'issued-handle-token-123',
    payload: {
      clinicId: 'clinic-123',
      conversationId: 'conv-456',
      principalRef: 'user-789',
      source: 'system',
      jti: 'jti-123',
      exp: Date.parse('2026-08-29T12:00:00.000Z'),
    },
  }),
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

import defaultExport, { AppService, HandleIssuerService, type Env } from '../index';
import { parseRuntimeEnv } from '@/lib/runtime-env';
import { setDbConnectionString } from '@/lib/db/client';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { issueHandle } from '@/core/agent-bridge/handle';
import { listToolsLogic, executeActionLogic } from '@/core/agent-bridge/bridge-service';
import {
  BRIDGE_RPC_VERSION,
  type ExecuteInput,
  type ListToolsInput,
} from '@/core/agent-bridge/rpc-contract';
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
      await service.ping({ contractVersion: BRIDGE_RPC_VERSION });

      expect(parseRuntimeEnv).toHaveBeenCalledWith('bridge', mockEnv);
      expect(setDbConnectionString).toHaveBeenCalledWith('postgres://user:pass@hyperdrive.local:5432/db');
    });
  });

  describe('ping RPC method', () => {
    it('validates env and returns pong response with timestamp', async () => {
      const before = Date.now();
      const res = await service.ping({ contractVersion: BRIDGE_RPC_VERSION });
      const after = Date.now();

      expect(res.ok).toBe(true);
      expect(res.contractVersion).toBe(BRIDGE_RPC_VERSION);
      expect(res.from).toBe('ia-bridge');
      expect(res.now).toBeGreaterThanOrEqual(before);
      expect(res.now).toBeLessThanOrEqual(after);
    });
  });

  describe('dbHealth RPC method', () => {
    it('validates env and runs db health check with select 1 query', async () => {
      const res = await service.dbHealth({ contractVersion: BRIDGE_RPC_VERSION });

      expect(runDbHealthCheck).toHaveBeenCalledTimes(1);
      expect(res).toEqual({
        status: 'healthy',
        latencyMs: 2,
        contractVersion: BRIDGE_RPC_VERSION,
      });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe('issueHandle RPC method', () => {
    it('keeps issuer and executor entrypoint surfaces distinct', () => {
      const issuer = new (HandleIssuerService as any)({} as any, mockEnv);

      expect(typeof issuer.issueHandle).toBe('function');
      expect(issuer.listTools).toBeUndefined();
      expect(issuer.executeAction).toBeUndefined();
      expect(typeof service.issueHandle).toBe('function');
      expect(typeof service.listTools).toBe('function');
      expect(typeof service.executeAction).toBe('function');
    });

    it('exposes issueHandle through the dedicated issuer entrypoint', async () => {
      const input = {
        contractVersion: BRIDGE_RPC_VERSION,
        clinicId: 'clinic-123',
        conversationId: 'conv-456',
        principalRef: 'user-789',
        source: 'system' as const,
        ttlSeconds: 120,
      };
      const issuer = new (HandleIssuerService as any)({} as any, mockEnv);

      const result = await issuer.issueHandle(input);

      expect(issueHandle).toHaveBeenCalledWith('test-handle-secret-32-chars-long!', {
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        principalRef: input.principalRef,
        source: input.source,
        ttlSeconds: input.ttlSeconds,
      });
      expect(result).toEqual({
        contractVersion: BRIDGE_RPC_VERSION,
        handle: 'issued-handle-token-123',
        expiresAt: '2026-08-29T12:00:00.000Z',
      });
    });

    it('keeps the legacy AppService.issueHandle surface during the first deploy', async () => {
      const result = await service.issueHandle({
        clinicId: 'clinic-123',
        conversationId: 'conv-456',
        principalRef: 'user-789',
        source: 'system',
        ttlSeconds: 120,
      });

      expect(result).toMatchObject({
        contractVersion: 'v1',
        handle: 'issued-handle-token-123',
      });
      expect(result).not.toHaveProperty('payload');
    });
  });

  describe('listTools and executeAction (bootstrap memoization & deps wiring)', () => {
    it('ensures bootstrapActions is called and delegates to listToolsLogic', async () => {
      const input: ListToolsInput = {
        contractVersion: BRIDGE_RPC_VERSION,
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
        {
          handle: input.handle,
          conversationId: input.conversationId,
        },
      );
      expect(res).toEqual({
        ok: true,
        contractVersion: BRIDGE_RPC_VERSION,
        catalog: {
          tools: [{ name: 'pacientes_listar', description: 'Listar pacientes' }],
        },
      });
    });

    it('memoizes ensureBootstrap across concurrent and sequential calls', async () => {
      const callsBefore = (bootstrapActions as jest.Mock).mock.calls.length;

      // Run multiple concurrent calls
      await Promise.all([
        service.listTools({ contractVersion: BRIDGE_RPC_VERSION, handle: 'token-1', conversationId: 'c1' }),
        service.executeAction({
          contractVersion: BRIDGE_RPC_VERSION,
          handle: 'token-2',
          conversationId: 'c1',
          idempotencyKey: 'idemp-1',
          alias: 'pacientes_listar',
          input: {},
          flags: { confirmed: true },
        }),
        service.listTools({ contractVersion: BRIDGE_RPC_VERSION, handle: 'token-3', conversationId: 'c1' }),
      ]);

      const callsAfter = (bootstrapActions as jest.Mock).mock.calls.length;
      // bootstrapActions should not have been invoked again because the Promise is memoized
      expect(callsAfter - callsBefore).toBe(0);
    });

    it('delegates executeAction to executeActionLogic with full bridge deps', async () => {
      const input: ExecuteInput = {
        contractVersion: BRIDGE_RPC_VERSION,
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
        {
          handle: input.handle,
          conversationId: input.conversationId,
          idempotencyKey: input.idempotencyKey,
          alias: input.alias,
          input: input.input,
          flags: input.flags,
        },
      );
      expect(res).toEqual({
        ok: true,
        contractVersion: BRIDGE_RPC_VERSION,
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

  describe('contract version guard', () => {
    it('rejects an unsupported execute version before bootstrap, idempotency, or Action', async () => {
      const res = await service.executeAction({
        contractVersion: 'v99',
        handle: 'valid-handle-token',
        conversationId: 'conv-123',
        idempotencyKey: 'idemp-mismatch',
        alias: 'pacientes_listar',
        input: {},
        flags: { confirmed: true },
      });

      expect(res).toEqual({
        ok: false,
        error: 'contract_version_mismatch',
        contractVersion: BRIDGE_RPC_VERSION,
      });
      expect(executeActionLogic).not.toHaveBeenCalled();
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('rejects an unsupported list version before reading the catalog', async () => {
      const res = await service.listTools({
        contractVersion: 'v99',
        handle: 'valid-handle-token',
        conversationId: 'conv-123',
      });

      expect(res).toEqual({
        ok: false,
        error: 'contract_version_mismatch',
        contractVersion: BRIDGE_RPC_VERSION,
      });
      expect(listToolsLogic).not.toHaveBeenCalled();
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
