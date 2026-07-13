import { NextRequest } from 'next/server';
import { GET as listDuplicates } from '@/app/api/contacts/duplicates/route';
import { GET as getDuplicate } from '@/app/api/contacts/duplicates/[id]/route';
import { POST as approveDuplicate } from '@/app/api/contacts/duplicates/[id]/approve/route';
import { POST as dismissDuplicate } from '@/app/api/contacts/duplicates/[id]/dismiss/route';
import { POST as mergeDuplicate } from '@/app/api/contacts/duplicates/[id]/merge/route';

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}));

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => ({
  ...jest.requireActual('@/modules/crm/repositories/duplicate-suggestions-repository'),
  findSuggestionById: jest.fn(),
}));

import { validateApiAuth } from '@/lib/auth/session';
import { findSuggestionById } from '@/modules/crm/repositories/duplicate-suggestions-repository';

const mockAuth = (clinicId = 'c1') => {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'u1', clinic_id: clinicId, email: 'u@t.com', name: 'User' },
  });
};

async function jsonResponse(handler: any, ...args: any[]) {
  const response = await handler(...args);
  const body = response.status === 200 ? await response.json() : null;
  return { status: response.status, body, headers: Object.fromEntries(response.headers) };
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
      const { status } = await jsonResponse(
        getDuplicate,
        new NextRequest('http://localhost'),
        { params: Promise.resolve({ id: 's1' }) },
      );
      expect(status).toBe(401);
    });
  });

  describe('POST /api/contacts/duplicates/[id]/merge', () => {
    it.skip('returns 404 when suggestion not found (needs full integration mock)', async () => {
      mockAuth();
      (findSuggestionById as jest.Mock).mockResolvedValue(null);
      const { status } = await jsonResponse(
        mergeDuplicate,
        new NextRequest('http://localhost', { method: 'POST' }),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      );
      expect(status).toBe(404);
    });
  });
});
