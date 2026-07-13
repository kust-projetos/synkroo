import { NextRequest } from 'next/server';
import { GET as listDuplicates } from '@/app/api/contacts/duplicates/route';
import { GET as getDuplicate } from '@/app/api/contacts/duplicates/[id]/route';
import { POST as approveDuplicate } from '@/app/api/contacts/duplicates/[id]/approve/route';
import { POST as dismissDuplicate } from '@/app/api/contacts/duplicates/[id]/dismiss/route';
import { POST as mergeDuplicate } from '@/app/api/contacts/duplicates/[id]/merge/route';

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
  getUserProfile: jest.fn(),
}));

jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn(),
  buildSystemContext: jest.fn(),
  buildDelegatedContext: jest.fn(),
}));

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => ({
  ...jest.requireActual('@/modules/crm/repositories/duplicate-suggestions-repository'),
  findSuggestionById: jest.fn(),
}));

import { validateApiAuth } from '@/lib/auth/session';
import { buildUserContext } from '@/core/actions/context';
import { findSuggestionById } from '@/modules/crm/repositories/duplicate-suggestions-repository';

const mockAuth = () => {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'u1', clinic_id: 'c1', email: 'u@t.com', name: 'User' },
  });
  (buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user',
    clinicId: 'c1',
    user: { id: 'u1', email: 'u@t.com', name: 'User' },
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'u1' },
  });
};

async function jsonResponse(handler: any, ...args: any[]) {
  const response = await handler(...args);
  const body = response.status === 200 ? await response.json().catch(() => null) : await response.json().catch(() => null);
  return { status: response.status, body };
}

describe('CRM duplicate routes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/contacts/duplicates', () => {
    it('returns 401 without auth', async () => {
      (validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
      const { status } = await jsonResponse(listDuplicates, new NextRequest('http://localhost'));
      expect(status).toBe(401);
    });
  });

  describe('GET /api/contacts/duplicates/[id]', () => {
    it('returns 401 without auth', async () => {
      (validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
      const { status } = await jsonResponse(getDuplicate, new NextRequest('http://localhost'), { params: Promise.resolve({ id: 's1' }) });
      expect(status).toBe(401);
    });
  });

  describe('POST /api/contacts/duplicates/[id]/approve', () => {
    it('returns 401 without auth', async () => {
      (validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
      const { status } = await jsonResponse(approveDuplicate, new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) });
      expect(status).toBe(401);
    });
  });

  describe('POST /api/contacts/duplicates/[id]/dismiss', () => {
    it('returns 401 without auth', async () => {
      (validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
      const { status } = await jsonResponse(dismissDuplicate, new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) });
      expect(status).toBe(401);
    });
  });

  describe('POST /api/contacts/duplicates/[id]/merge', () => {
    it('returns 404 when suggestion not found', async () => {
      mockAuth();
      (findSuggestionById as jest.Mock).mockResolvedValue(null);
      const { status } = await jsonResponse(mergeDuplicate, new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'nonexistent' }) });
      expect(status).toBe(404);
    });

    it('dispatches to patient merge for patient suggestions', async () => {
      mockAuth();
      (findSuggestionById as jest.Mock).mockResolvedValue({
        id: 's1', clinicId: 'c1', ownerType: 'patient', leftId: 'l1', rightId: 'r1',
      });
      const { status } = await jsonResponse(mergeDuplicate, new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) });
      expect(status).toBe(500);
    });

    it('dispatches to lead merge for lead suggestions', async () => {
      mockAuth();
      (findSuggestionById as jest.Mock).mockResolvedValue({
        id: 's1', clinicId: 'c1', ownerType: 'lead', leftId: 'l1', rightId: 'r1',
      });
      const { status } = await jsonResponse(mergeDuplicate, new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 's1' }) });
      expect(status).toBe(500);
    });
  });

  describe('POST /api/cron/crm-duplicates', () => {
    const cronUrl = 'http://localhost/api/cron/crm-duplicates';

    beforeEach(() => {
      process.env.CRON_SECRET = 'test-secret';
    });

    afterEach(() => {
      delete process.env.CRON_SECRET;
    });

    it('returns 401 with invalid CRON_SECRET', async () => {
      const { POST: cronHandler } = await import('@/app/api/cron/crm-duplicates/route');
      const req = new NextRequest(cronUrl, {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-secret' },
      });
      const { status } = await jsonResponse(cronHandler, req);
      expect(status).toBe(401);
    });

    it('returns 401 with missing CRON_SECRET', async () => {
      delete process.env.CRON_SECRET;
      const { POST: cronHandler } = await import('@/app/api/cron/crm-duplicates/route');
      const req = new NextRequest(cronUrl, { method: 'POST' });
      const { status } = await jsonResponse(cronHandler, req);
      expect(status).toBe(401);
    });
  });
});
