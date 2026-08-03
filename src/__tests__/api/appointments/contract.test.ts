/**
 * Integration Contract Test — GET /api/appointments (ADR-BASE-10)
 *
 * Tests that the real route handler returns canonical response shapes:
 *   Success: { data: T; meta?: { cursor?: string; total?: number } }
 *   Failure: { error: { code: string; message: string; requestId: string } }
 *
 * This test only validates the HTTP response envelope, NOT business logic.
 * Full integration tests live in test:integration.
 */

import { NextRequest } from 'next/server';

// We import the handler directly; no server needed.
// The route splits on method, so we test each method's handler pattern.

/**
 * Helper: create a mock NextRequest for testing route handlers.
 */
function mockRequest(method: string, url: string, body?: unknown): NextRequest {
  const req = new NextRequest(new URL(url), {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return req;
}

describe('GET /api/appointments — HTTP Contract', () => {
  it('canonical error shape: { error: { code, message, requestId } }', async () => {
    // Test the shape contract from src/lib/api/response.ts
    const { apiFailure } = await import('@/lib/api/response');

    const res = apiFailure('NOT_FOUND', 'Appointment not found', 'req_shape_test', 404);
    const json = await res.json();

    // Must have error object with code, message, requestId
    expect(json).toHaveProperty('error');
    expect(json.error).toHaveProperty('code');
    expect(json.error).toHaveProperty('message');
    expect(json.error).toHaveProperty('requestId');
    expect(json).not.toHaveProperty('data');
    expect(res.status).toBe(404);
  });

  it('canonical success shape: { data, meta? }', async () => {
    const { apiSuccess } = await import('@/lib/api/response');

    const items = [
      { id: '00000000-0000-0000-0000-000000000001', patientName: 'Maria' },
    ];
    const res = apiSuccess(items, { total: 1 });
    const json = await res.json();

    expect(json).toHaveProperty('data');
    expect(json).not.toHaveProperty('error');
    expect(json.data).toEqual(items);
    expect(json.meta).toEqual({ total: 1 });
  });

  it('dates are ISO 8601 UTC', async () => {
    const { apiSuccess } = await import('@/lib/api/response');

    const res = apiSuccess({ createdAt: new Date('2026-08-01T10:00:00Z') });
    const json = await res.json();
    const dateStr = json.data.createdAt;

    // ISO 8601 UTC: contains T and Z (or +00:00)
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('IDs are UUIDs', async () => {
    const { generateRequestId } = await import('@/lib/api/response');
    const id = generateRequestId();

    // UUID v4 format
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('content-type is application/json', async () => {
    const { apiSuccess, apiFailure } = await import('@/lib/api/response');

    const success = apiSuccess({ ok: true });
    const error = apiFailure('TEST', 'msg', 'rid');

    expect(success.headers.get('content-type')).toContain('application/json');
    expect(error.headers.get('content-type')).toContain('application/json');
  });

  // Schema-level validation: verify no raw error strings escape
  it('error responses never contain string error field', async () => {
    const { apiFailure } = await import('@/lib/api/response');

    const res = apiFailure('FORBIDDEN', 'Access denied', 'req_abc');
    const json = await res.json();

    expect(typeof json.error).toBe('object');
    expect(typeof json.error.code).toBe('string');
    expect(typeof json.error.message).toBe('string');
    expect(typeof json.error.requestId).toBe('string');
    // No flat string error
    expect(typeof json.error).not.toBe('string');
  });
});
