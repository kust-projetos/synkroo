/**
 * P7S1-R10 HIGH (scheduler): rota /api/cron/journeys.
 * Transport-only: auth CRON_SECRET + rate limit (padrão outbox) e lote
 * limitado repassado ao tick. Tick mockado — sem DB.
 */

import { NextRequest } from 'next/server';

const TEST_CRON_SECRET = 'test-cron-secret-journeys';

jest.mock('@/modules/followup', () => ({
  JOURNEY_TICK_BATCH_SIZE: 100,
  tickPostVisitJourney: jest.fn(async () => ({
    checked: 2,
    advanced: 1,
    completed: 0,
    expired: 0,
    stopped: 0,
    skipped: 1,
  })),
}));

import { JOURNEY_TICK_BATCH_SIZE, tickPostVisitJourney } from '@/modules/followup';
import { GET, POST } from '../route';

const mockTick = tickPostVisitJourney as jest.Mock;

function request(url: string, auth: boolean): NextRequest {
  if (auth) {
    return new NextRequest(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
  }
  return new NextRequest(url, { method: 'POST' });
}

const OLD_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = TEST_CRON_SECRET;
});

afterAll(() => {
  process.env.CRON_SECRET = OLD_SECRET;
});

describe('POST /api/cron/journeys', () => {
  it('sem credencial retorna 401 sem acionar o tick', async () => {
    const res = await POST(request('https://test/api/cron/journeys', false));
    expect(res.status).toBe(401);
    expect(mockTick).not.toHaveBeenCalled();
  });

  it('credencial errada retorna 401 sem acionar o tick', async () => {
    const req = new NextRequest('https://test/api/cron/journeys', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockTick).not.toHaveBeenCalled();
  });

  it('autenticado executa o tick com lote limitado e retorna o resultado', async () => {
    const res = await POST(request('https://test/api/cron/journeys?limit=10', true));
    expect(res.status).toBe(200);
    expect(mockTick).toHaveBeenCalledTimes(1);
    expect(mockTick.mock.calls[0]?.[0]).toEqual({ batchSize: 10 });
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ checked: 2, advanced: 1, skipped: 1 });
  });

  it('limit é clampado a 1..100; inválido usa o default', async () => {
    await POST(request('https://test/api/cron/journeys?limit=9999', true));
    expect(mockTick.mock.calls[0]?.[0]).toEqual({ batchSize: 100 });
    await POST(request('https://test/api/cron/journeys?limit=0', true));
    expect(mockTick.mock.calls[1]?.[0]).toEqual({ batchSize: 1 });
    await POST(request('https://test/api/cron/journeys?limit=abc', true));
    expect(mockTick.mock.calls[2]?.[0]).toEqual({ batchSize: JOURNEY_TICK_BATCH_SIZE });
  });
});

describe('GET /api/cron/journeys', () => {
  it('sem credencial retorna 401', async () => {
    const res = await GET(
      new NextRequest('https://test/api/cron/journeys', { method: 'GET' }),
    );
    expect(res.status).toBe(401);
  });

  it('autenticado retorna status sem executar o tick', async () => {
    const res = await GET(
      new NextRequest('https://test/api/cron/journeys', {
        method: 'GET',
        headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockTick).not.toHaveBeenCalled();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ status: 'ok', job: 'journeys' });
  });
});
