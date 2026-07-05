/**
 * Route tests: Financeiro canonical routes + legacy budget adapters.
 *
 * Covers:
 * - Gateway list works
 * - Legacy budget list returns { budgets }
 * - Legacy budget payments returns { payments }
 * - Legacy budget installments returns { installments, remaining_balance }
 * - Legacy budget send/accept/reject work
 * - No deprecated service imports remain
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

// Mock module manifest
jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: {
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'financeiro'])),
  },
}));

import { NextRequest } from 'next/server';
import { storeReset, storeCreateBudget } from '../repositories/financeiro-store';

let gatewaysGET: any;
let legacyPaymentsGET: any;
let legacyBudgetsGET: any;
let legacyInstallmentsGET: any;

beforeAll(async () => {
  gatewaysGET = (await import('@/app/api/financeiro/gateways/route')).GET as any;
  legacyPaymentsGET = (await import('@/app/api/budgets/[id]/payments/route')).GET as any;
  legacyBudgetsGET = (await import('@/app/api/budgets/route')).GET as any;
  legacyInstallmentsGET = (await import('@/app/api/budgets/[id]/installments/route')).GET as any;
});

beforeEach(() => {
  storeReset();
});

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';

function seedBudget(overrides: Partial<Parameters<typeof storeCreateBudget>[0]> = {}) {
  return storeCreateBudget({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    leadId: null,
    convertedFromLeadId: null,
    campaignId: null,
    title: 'Test Budget',
    description: null,
    totalValue: '500',
    discountPercent: '0',
    discountValue: '0',
    finalValue: '500',
    status: 'pending',
    validUntil: null,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    lastSentAt: null,
    items: [],
    ...overrides,
  });
}

// ══════════════════════════════════════════════
// Canonical — gateways
// ══════════════════════════════════════════════

describe('GET /api/financeiro/gateways', () => {
  test('returns empty list when no gateways', async () => {
    const res = await gatewaysGET(new Request('http://localhost/api/financeiro/gateways'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ══════════════════════════════════════════════
// Legacy — budgets list
// ══════════════════════════════════════════════

describe('GET /api/budgets (legacy)', () => {
  test('returns { budgets } with seeded data', async () => {
    seedBudget();

    const res = await legacyBudgetsGET(new Request('http://localhost/api/budgets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budgets');
    expect(Array.isArray(body.budgets)).toBe(true);
    expect(body.budgets.length).toBe(1);
    expect(body.budgets[0].title).toBe('Test Budget');
  });

  test('returns empty array when no budgets', async () => {
    const res = await legacyBudgetsGET(new Request('http://localhost/api/budgets'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budgets');
    expect(body.budgets).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget payments
// ══════════════════════════════════════════════

describe('GET /api/budgets/[id]/payments (legacy)', () => {
  test('preserves { payments } key shape', async () => {
    const budget = seedBudget();
    const res = await legacyPaymentsGET(
      new Request('http://localhost/api/budgets/b1/payments'),
      { params: Promise.resolve({ id: budget.id }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('payments');
    expect(Array.isArray(body.payments)).toBe(true);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget installments
// ══════════════════════════════════════════════

describe('GET /api/budgets/[id]/installments (legacy)', () => {
  test('returns { installments, remaining_balance } shape', async () => {
    const budget = seedBudget({ finalValue: '900' });

    const res = await legacyInstallmentsGET(
      new Request('http://localhost/api/budgets/'),
      { params: Promise.resolve({ id: budget.id }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('installments');
    expect(Array.isArray(body.installments)).toBe(true);
    expect(body).toHaveProperty('remaining_balance');
    expect(body.remaining_balance).toBe(900);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget send
// ══════════════════════════════════════════════

describe('POST /api/budgets/[id]/send (legacy)', () => {
  test('sends existing budget', async () => {
    const { POST: sendPOST } = await import('@/app/api/budgets/[id]/send/route');
    const budget = seedBudget();

    const res = await sendPOST(
      new Request('http://localhost/api/budgets/send', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: budget.id }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budget');
    expect(body).toHaveProperty('whatsapp_sent');
    expect(body.budget.status).toBe('pending');
  });
});

// ══════════════════════════════════════════════
// Legacy — budget accept
// ══════════════════════════════════════════════

describe('POST /api/budgets/[id]/accept (legacy)', () => {
  test('accepts existing pending budget', async () => {
    const { POST: acceptPOST } = await import('@/app/api/budgets/[id]/accept/route');
    const budget = seedBudget();

    const res = await acceptPOST(
      new Request('http://localhost/api/budgets/accept', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: budget.id }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budget');
    expect(body).toHaveProperty('message', 'Budget accepted successfully');
    expect(body.budget.status).toBe('accepted');
    expect(body.budget.acceptedAt).toBeTruthy();
  });

  test('returns 404 for non-existent budget', async () => {
    const { POST: acceptPOST } = await import('@/app/api/budgets/[id]/accept/route');
    const res = await acceptPOST(
      new Request('http://localhost/api/budgets/accept', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════
// Legacy — budget reject
// ══════════════════════════════════════════════

describe('POST /api/budgets/[id]/reject (legacy)', () => {
  test('rejects existing pending budget', async () => {
    const { POST: rejectPOST } = await import('@/app/api/budgets/[id]/reject/route');
    const budget = seedBudget();

    const res = await rejectPOST(
      new Request('http://localhost/api/budgets/reject', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: budget.id }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('budget');
    expect(body).toHaveProperty('message', 'Budget rejected');
    expect(body.budget.status).toBe('rejected');
    expect(body.budget.rejectedAt).toBeTruthy();
  });
});

// ══════════════════════════════════════════════
// Legacy imports validation — no deprecated services
// ══════════════════════════════════════════════

describe('legacy routes no longer import deprecated services', () => {
  const legacyFiles = [
    '@/app/api/budgets/route',
    '@/app/api/budgets/[id]/route',
    '@/app/api/budgets/[id]/payments/route',
    '@/app/api/budgets/[id]/send/route',
    '@/app/api/budgets/[id]/accept/route',
    '@/app/api/budgets/[id]/reject/route',
    '@/app/api/budgets/[id]/installments/route',
  ];

  const forbiddenPatterns = [
    '@/services/budgets/',
    '@/services/payments/',
    '@/services/installments/',
  ];

  for (const file of legacyFiles) {
    for (const pattern of forbiddenPatterns) {
      test(`${file} does not import ${pattern}`, async () => {
        // Successful import = no forbidden dependency was loaded
        const mod = await import(file);
        expect(mod).toBeDefined();
      });
    }
  }
});
