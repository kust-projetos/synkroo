import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));
const mdb = {
  execute: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
} as any;
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb) }));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const DRIVER_MARKER = 'DRIVER_SECRET_MARKER_9f8b';

function readinessRequest(withSecret: string | null = null): NextRequest {
  const headers: Record<string, string> = {};
  if (withSecret) headers.authorization = `Bearer ${withSecret}`;
  return new NextRequest('http://localhost/api/internal/readiness', { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  mdb.execute.mockResolvedValue({ rows: [{ '?column?': 1 }] });
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

  it('returns 503 com motivo estático quando DB falha, sem vazar driver', async () => {
    mdb.execute.mockRejectedValue(new Error(`${DRIVER_MARKER} connection refused`));

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('not-ready');
    expect(body.reason).toBe('db-unreachable');
    expect(JSON.stringify(body)).not.toContain(DRIVER_MARKER);
  });

  it('returns 503 quando migrations incompletas', async () => {
    // SELECT 1 ok, mas primeira tabela ausente
    mdb.execute
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockRejectedValueOnce(new Error(`${DRIVER_MARKER} relation does not exist`))
      .mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const response = await GET(readinessRequest('test-cron-secret'));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe('migrations-incomplete');
    expect(JSON.stringify(body)).not.toContain(DRIVER_MARKER);
  });
});
