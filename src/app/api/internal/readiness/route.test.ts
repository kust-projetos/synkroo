import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { EXPECTED_MIGRATIONS } from '@/services/api-handlers/health/db';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
const mdb = {
  execute: jest.fn(),
  transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(mdb)),
} as any;
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb) }));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockGetDb = getDb as jest.Mock;
const DRIVER_MARKER = 'DRIVER_SECRET_MARKER_9f8b';

function readinessRequest(withSecret: string | null = null): NextRequest {
  const headers: Record<string, string> = {};
  if (withSecret) headers.authorization = `Bearer ${withSecret}`;
  return new NextRequest('http://localhost/api/internal/readiness', { headers });
}

/** Extrai o texto SQL estático dos chunks do template drizzle (white-box). */
function executedSqlTexts(): string[] {
  const chunkText = (c: { value?: unknown }): string => {
    const values = Array.isArray(c?.value) ? c.value : [c?.value];
    return values.filter((x): x is string => typeof x === 'string').join('');
  };
  return mdb.execute.mock.calls.map(([q]: any[]) =>
    ((q?.queryChunks ?? []) as Array<{ value?: unknown }>).map(chunkText).join(''),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Integração G4×F2: "tudo aplicado" acompanha EXPECTED_MIGRATIONS (31 após
  // migration 0031) em vez de número fixo.
  mdb.execute.mockResolvedValue({ rows: [{ count: EXPECTED_MIGRATIONS }] });
  mdb.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mdb));
  mockGetDb.mockReturnValue(mdb);
  process.env.CRON_SECRET = 'test-cron-secret';
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('GET /api/internal/readiness', () => {
  it('rejects unauthenticated readiness probes', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(readinessRequest());

    expect(response.status).toBe(401);
  });

  it('rejects wrong CRON_SECRET without session', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(readinessRequest('wrong-secret!!'));

    expect(response.status).toBe(401);
  });

  it('returns ready with durationMs quando DB ok (CRON_SECRET)', async () => {
    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ready');
    expect(body.checks).toEqual({ database: 'ok', migrations: 'complete' });
    expect(typeof body.durationMs).toBe('number');
  });

  it('returns ready para sessão autenticada (sem CRON_SECRET no header)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } } as never);

    const response = await GET(readinessRequest());

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('ready');
  });

  it('aplica statement_timeout nas queries via transação', async () => {
    await GET(readinessRequest('test-cron-secret'));

    expect(mdb.transaction).toHaveBeenCalled();
    expect(executedSqlTexts().some((t) => t.includes('statement_timeout'))).toBe(true);
  });

  it('returns 503 com motivo estático quando DB falha, sem vazar driver', async () => {
    mdb.execute.mockRejectedValue(new Error(`${DRIVER_MARKER} connection refused`));

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('not-ready');
    expect(body.reason).toBe('db-unreachable');
    expect(typeof body.durationMs).toBe('number');
    expect(JSON.stringify(body)).not.toContain(DRIVER_MARKER);
  });

  it('estouro de statement_timeout vira 503 db-unreachable', async () => {
    mdb.execute.mockRejectedValue(new Error('canceling statement due to statement timeout'));

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe('db-unreachable');
    expect(typeof body.durationMs).toBe('number');
  });

  it('getDb() lançando vira 503 db-unreachable com durationMs', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error(`${DRIVER_MARKER} No database connection available`);
    });

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe('db-unreachable');
    expect(typeof body.durationMs).toBe('number');
    expect(JSON.stringify(body)).not.toContain(DRIVER_MARKER);
  });

  it('timeout só no ledger (SET LOCAL + SELECT 1 ok) vira 503 db-unreachable', async () => {
    // SET LOCAL ok, SELECT 1 ok, apenas a query do ledger rejeita (timeout)
    mdb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockRejectedValueOnce(new Error('canceling statement due to statement timeout'));

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('not-ready');
    expect(body.reason).toBe('db-unreachable');
    expect(typeof body.durationMs).toBe('number');
  });

  it('returns 503 quando ledger de migrations incompleto, com durationMs', async () => {
    // SET LOCAL ok, SELECT 1 ok, ledger com 5 aplicadas
    mdb.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValue({ rows: [{ count: 5 }] });

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe('migrations-incomplete');
    expect(typeof body.durationMs).toBe('number');
    expect(JSON.stringify(body)).not.toContain(DRIVER_MARKER);
  });
});
