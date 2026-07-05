/**
 * Route tests: Financeiro canonical routes + legacy budget adapters.
 *
 * Covers:
 * - Gateway secrets masked
 * - Legacy budget payments shape preserved
 */

// Mock auth context for canonical routes (uses buildUserContext)
jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn().mockResolvedValue({
    clinicId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'owner',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test' },
  }),
  buildSystemContext: jest.fn().mockResolvedValue({
    clinicId: '00000000-0000-0000-0000-000000000001',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'system' },
  }),
}));

// Mock auth session for legacy routes (uses validateApiAuth)
jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn().mockResolvedValue({
    success: true,
    profile: {
      id: '00000000-0000-0000-0000-000000000099',
      clinic_id: '00000000-0000-0000-0000-000000000001',
      role: 'owner',
    },
  }),
}));

// Mock module manifest to return enabled
jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: {
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'financeiro'])),
  },
}));

import { NextRequest } from 'next/server';
import { storeReset } from '../repositories/financeiro-store';
import { saveGateway } from '../services/gateway-config-service';

let gatewaysGET: any;
let legacyPaymentsGET: any;

beforeAll(async () => {
  gatewaysGET = (await import('@/app/api/financeiro/gateways/route')).GET as any;
  legacyPaymentsGET = (await import('@/app/api/budgets/[id]/payments/route')).GET as any;
});

beforeEach(() => {
  storeReset();
});

describe('GET /api/financeiro/gateways', () => {
  test('returns empty list when no gateways', async () => {
    const res = await gatewaysGET(new Request('http://localhost/api/financeiro/gateways'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('masks secrets in response', async () => {
    await saveGateway({
      clinicId: '00000000-0000-0000-0000-000000000001',
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
      apiKey: 'sk_live_secret_key_12345',
    });

    const res = await gatewaysGET(new Request('http://localhost/api/financeiro/gateways'));
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain('sk_live_secret_key_12345');
    expect(JSON.stringify(body)).not.toContain('apiKey');
  });
});

describe('GET /api/budgets/[id]/payments (legacy)', () => {
  test('preserves payments key shape', async () => {
    const res = await legacyPaymentsGET(
      new Request('http://localhost/api/budgets/b1/payments'),
      { params: Promise.resolve({ id: 'b1' }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('payments');
    expect(Array.isArray(body.payments)).toBe(true);
  });
});
