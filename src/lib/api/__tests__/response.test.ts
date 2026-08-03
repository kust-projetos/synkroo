/**
 * Contract tests for API response format (ADR-BASE-10).
 *
 * Validates that apiSuccess() and apiFailure() produce the
 * canonical { data, meta? } and { error: { code, message, requestId } } shapes.
 */

import {
  apiSuccess,
  apiCreated,
  apiFailure,
  apiErrors,
  generateRequestId,
} from '../response';

describe('API Response Contract (ADR-BASE-10)', () => {
  describe('apiSuccess', () => {
    it('returns { data } with no meta', async () => {
      const res = apiSuccess({ id: 'uuid-1', name: 'Test' });
      const body = await res.json();

      expect(body).toHaveProperty('data');
      expect(body).not.toHaveProperty('error');
      expect(body.data).toEqual({ id: 'uuid-1', name: 'Test' });
      expect(body.meta).toBeUndefined();
    });

    it('returns { data, meta } when meta provided', async () => {
      const res = apiSuccess(
        [{ id: '1' }],
        { cursor: 'next_123', total: 42 },
      );
      const body = await res.json();

      expect(body.data).toEqual([{ id: '1' }]);
      expect(body.meta).toEqual({ cursor: 'next_123', total: 42 });
    });

    it('returns status 200 by default', () => {
      const res = apiSuccess({ ok: true });
      expect(res.status).toBe(200);
    });
  });

  describe('apiCreated', () => {
    it('returns status 201', () => {
      const res = apiCreated({ id: 'new-1' });
      expect(res.status).toBe(201);
    });
  });

  describe('apiFailure', () => {
    it('returns { error: { code, message, requestId } }', async () => {
      const res = apiFailure('NOT_FOUND', 'Patient not found', 'req_abc123', 404);
      const body = await res.json();

      expect(body).toHaveProperty('error');
      expect(body).not.toHaveProperty('data');
      expect(body.error).toEqual({
        code: 'NOT_FOUND',
        message: 'Patient not found',
        requestId: 'req_abc123',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('apiErrors shortcuts', () => {
    it.each([
      ['badRequest', 400],
      ['unauthorized', 401],
      ['forbidden', 403],
      ['notFound', 404],
      ['conflict', 409],
      ['tooManyRequests', 429],
      ['internal', 500],
    ] as const)('%s returns status %i', async (method, expectedStatus) => {
      const res = apiErrors[method]('test message', 'req_x');
      expect(res.status).toBe(expectedStatus);

      const body = await res.json();
      expect(body.error.requestId).toBe('req_x');
    });
  });

  describe('generateRequestId', () => {
    it('returns a non-empty string', () => {
      const id = generateRequestId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique values', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('response shape guard', () => {
    it('data field is never present on error responses', async () => {
      const res = apiFailure('TEST', 'msg', 'rid');
      const body = await res.json();
      expect(body).not.toHaveProperty('data');
    });

    it('error field is never present on success responses', async () => {
      const res = apiSuccess({ ok: true });
      const body = await res.json();
      expect(body).not.toHaveProperty('error');
    });
  });
});
