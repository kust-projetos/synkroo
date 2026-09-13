import { NextRequest } from 'next/server';

const mockValidateApiAuth = jest.fn();
const mockSearchKnowledge = jest.fn();
const mockIngestDocument = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: mockValidateApiAuth,
}));

jest.mock('@/services/rag', () => ({
  ragService: {
    searchKnowledge: (...a: unknown[]) => mockSearchKnowledge(...a),
    ingestDocument: (...a: unknown[]) => mockIngestDocument(...a),
  },
}));

import { POST as searchPOST } from '@/app/api/knowledge/search/route';
import { POST as ingestPOST } from '@/app/api/knowledge/ingest/route';

const CLINIC = 'c1';

function authed() {
  mockValidateApiAuth.mockResolvedValue({
    success: true,
    profile: { id: 'u1', clinic_id: CLINIC, role: 'owner' },
  });
}

function req(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  authed();
  mockSearchKnowledge.mockResolvedValue([]);
  mockIngestDocument.mockResolvedValue({ success: true, data: {} });
});

/**
 * B1 (knowledge) — clamps Zod de limit/threshold/chunkSize.
 */
describe('knowledge clamps (B1)', () => {
  it('search: limit gigante → clamp em 50; threshold > 1 → clamp em 1', async () => {
    const res = await searchPOST(
      req('http://localhost/api/knowledge/search', { query: 'horário', limit: 9999, threshold: 5 }),
    );
    expect(res.status).toBe(200);
    expect(mockSearchKnowledge).toHaveBeenCalledWith(CLINIC, 'horário', { limit: 50, threshold: 1 });
  });

  it('search: sem query → 400 legado', async () => {
    const res = await searchPOST(
      req('http://localhost/api/knowledge/search', { limit: 5 }),
    );
    expect(res.status).toBe(400);
    expect(mockSearchKnowledge).not.toHaveBeenCalled();
  });

  it('ingest: chunkSize absurdo → clamp em 2000 (201, sem rejeitar)', async () => {
    const res = await ingestPOST(
      req('http://localhost/api/knowledge/ingest', {
        category: 'horarios',
        content: 'texto longo',
        chunkSize: 99999,
      }),
    );
    expect(res.status).toBe(201);
    expect(mockIngestDocument).toHaveBeenCalledWith(CLINIC, {
      category: 'horarios',
      content: 'texto longo',
      title: undefined,
      chunkSize: 2000,
      chunkOverlap: undefined,
    });
  });

  it('ingest: chunkSize não-numérico → 400', async () => {
    const res = await ingestPOST(
      req('http://localhost/api/knowledge/ingest', {
        category: 'horarios',
        content: 'texto longo',
        chunkSize: 'enorme',
      }),
    );
    expect(res.status).toBe(400);
    expect(mockIngestDocument).not.toHaveBeenCalled();
  });

  it('ingest: sem category → 400 legado', async () => {
    const res = await ingestPOST(
      req('http://localhost/api/knowledge/ingest', { content: 'x' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Field "category" is required' });
  });

  it('ingest: params válidos passam com clamp aplicado', async () => {
    const res = await ingestPOST(
      req('http://localhost/api/knowledge/ingest', {
        category: 'horarios',
        content: 'texto',
        chunkSize: 300,
        chunkOverlap: 30,
      }),
    );
    expect(res.status).toBe(201);
    expect(mockIngestDocument).toHaveBeenCalledWith(CLINIC, {
      category: 'horarios',
      content: 'texto',
      title: undefined,
      chunkSize: 300,
      chunkOverlap: 30,
    });
  });
});
