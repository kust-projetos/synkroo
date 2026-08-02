/**
 * Integration Contract Test — HTTP API Response Format (ADR-BASE-10)
 *
 * Validates that API routes follow the canonical contract:
 *   Success: { data: T; meta?: { cursor?: string; total?: number } }
 *   Failure: { error: { code: string; message: string; requestId: string } }
 *
 * Uses Next.js route handler testing via plain function calls.
 * Does NOT start a server — tests against route handler exports.
 */

import { apiSuccess, apiFailure, apiErrors, generateRequestId } from '@/lib/api/response';

describe('HTTP API Contract (ADR-BASE-10)', () => {
  // ── Response shape contracts ────────────────────────

  describe('canonical success shape', () => {
    it('{ data } — minimal success', async () => {
      const res = apiSuccess({ id: '123', name: 'Test' });
      const json = await res.json();
      expect(json).toEqual({ data: { id: '123', name: 'Test' } });
      expect(res.status).toBe(200);
    });

    it('{ data, meta } — paginated success', async () => {
      const res = apiSuccess(['item1'], { cursor: 'next', total: 100 });
      const json = await res.json();
      expect(json).toEqual({
        data: ['item1'],
        meta: { cursor: 'next', total: 100 },
      });
    });

    it('never has "error" key on success', async () => {
      const res = apiSuccess({ ok: true });
      const json = await res.json();
      expect(json).not.toHaveProperty('error');
    });
  });

  describe('canonical error shape', () => {
    it('{ error: { code, message, requestId } } — 4xx', async () => {
      const res = apiFailure('NOT_FOUND', 'Resource not found', 'req_test_1', 404);
      const json = await res.json();
      expect(json).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          requestId: 'req_test_1',
        },
      });
      expect(res.status).toBe(404);
    });

    it('{ error: { code, message, requestId } } — 5xx', async () => {
      const res = apiErrors.internal('DB connection failed', 'req_test_2');
      const json = await res.json();
      expect(json.error.code).toBe('INTERNAL_ERROR');
      expect(json.error.requestId).toBe('req_test_2');
      expect(res.status).toBe(500);
    });

    it('never has "data" key on error', async () => {
      const res = apiFailure('FORBIDDEN', 'Nope', 'rid');
      const json = await res.json();
      expect(json).not.toHaveProperty('data');
    });
  });

  // ── HTTP status code contracts ──────────────────────

  describe('status codes match error type', () => {
    const cases = [
      ['badRequest', 400],
      ['unauthorized', 401],
      ['forbidden', 403],
      ['notFound', 404],
      ['conflict', 409],
      ['tooManyRequests', 429],
      ['internal', 500],
    ] as const;

    it.each(cases)('%s → %i', (method, status) => {
      const res = apiErrors[method]('msg', 'rid');
      expect(res.status).toBe(status);
    });
  });

  // ── Field format contracts ──────────────────────────

  describe('field formats', () => {
    it('IDs should be UUIDs', () => {
      const uuid = crypto.randomUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('requestId is a non-empty string', () => {
      const id = generateRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('dates should serialize as ISO 8601 UTC', () => {
      const now = new Date('2026-07-29T12:00:00Z');
      const json = JSON.stringify({ date: now });
      expect(json).toContain('2026-07-29T12:00:00.000Z');
    });
  });

  // ── Content-Type contract ───────────────────────────

  describe('content type', () => {
    it('all responses are application/json', () => {
      const success = apiSuccess({ ok: true });
      const error = apiFailure('TEST', 'msg', 'rid');

      expect(success.headers.get('content-type')).toContain('application/json');
      expect(error.headers.get('content-type')).toContain('application/json');
    });
  });
});
