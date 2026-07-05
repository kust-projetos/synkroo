/**
 * Tests: Collection service — overdue detection, stage rules, reminders.
 */

import { storeReset, storeCreateCharge } from '../../repositories/financeiro-store';
import {
  getCollectionStage,
  calculateDaysOverdue,
  enrichOverdueCharges,
  sendReminder,
} from '../collection-service';

beforeEach(() => {
  storeReset();
});

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';

function seedCharge(overrides: Record<string, unknown> = {}) {
  return storeCreateCharge({
    clinicId: CLINIC_ID,
    budgetId: '00000000-0000-0000-0000-000000000010',
    gatewayId: '00000000-0000-0000-0000-000000000020',
    externalChargeId: null,
    paymentUrl: null,
    pixQrCode: null,
    dueDate: '2026-08-15',
    amount: '500',
    status: 'pending',
    paidAt: null,
    ...overrides,
  } as any);
}

describe('getCollectionStage', () => {
  test('returns none for current/early charges', () => {
    expect(getCollectionStage(0)).toBe('none');
    expect(getCollectionStage(-1)).toBe('none');
  });

  test('returns light for D+1', () => {
    expect(getCollectionStage(1)).toBe('light');
    expect(getCollectionStage(2)).toBe('light');
  });

  test('returns firm for D+3', () => {
    expect(getCollectionStage(3)).toBe('firm');
    expect(getCollectionStage(4)).toBe('firm');
    expect(getCollectionStage(6)).toBe('firm');
  });

  test('returns internal for D+7+', () => {
    expect(getCollectionStage(7)).toBe('internal');
    expect(getCollectionStage(30)).toBe('internal');
    expect(getCollectionStage(365)).toBe('internal');
  });
});

describe('calculateDaysOverdue', () => {
  test('returns 0 for future date', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(calculateDaysOverdue(future.toISOString().slice(0, 10))).toBe(0);
  });

  test('returns positive for past date', () => {
    const due = '2025-01-01';
    const days = calculateDaysOverdue(due);
    expect(days).toBeGreaterThan(400);
  });
});

describe('enrichOverdueCharges', () => {
  test('adds daysOverdue and collectionStage', () => {
    const charges = [{
      id: 'ch1',
      clinicId: CLINIC_ID,
      budgetId: 'b1',
      gatewayId: 'g1',
      externalChargeId: null,
      paymentUrl: null,
      pixQrCode: null,
      dueDate: '2025-01-01',
      amount: '500',
      status: 'pending',
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const enriched = enrichOverdueCharges(charges as any);
    expect(enriched[0].daysOverdue).toBeGreaterThan(0);
    expect(enriched[0].collectionStage).toBe('internal');
  });
});

describe('sendReminder', () => {
  test('returns sent=true (stub)', async () => {
    const result = await sendReminder({ clinicId: CLINIC_ID, chargeId: 'ch1' });
    expect(result.sent).toBe(true);
  });
});
