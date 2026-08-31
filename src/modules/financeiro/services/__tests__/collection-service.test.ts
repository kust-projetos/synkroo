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

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({})),
  })),
}));
jest.mock('@/lib/outbox/outbox-repository', () => ({ enqueueOutbox: jest.fn() }));

jest.mock('../../repositories/financeiro-scope-repository', () => ({
  getPaymentChargeForClinic: jest.fn(),
  getBudgetForClinic: jest.fn(),
}));
import * as scopeRepo from '../../repositories/financeiro-scope-repository';
const mockGetPaymentChargeForClinic = scopeRepo.getPaymentChargeForClinic as jest.Mock;
const mockGetBudgetForClinic = scopeRepo.getBudgetForClinic as jest.Mock;

jest.mock('@/modules/operacional/public', () => ({
  obterPaciente: jest.fn(),
}));
import * as patientsSvc from '@/modules/operacional/public';
const mockObterPaciente = patientsSvc.obterPaciente as jest.Mock;
import * as outboxRepo from '@/lib/outbox/outbox-repository';
const mockEnqueueOutbox = outboxRepo.enqueueOutbox as jest.Mock;

beforeEach(() => {
  storeReset();
    mockEnqueueOutbox.mockResolvedValue(undefined);
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

  test('returns 0 for today or recent date', () => {
    const today = new Date().toISOString().slice(0, 10);
    const days = calculateDaysOverdue(today);
    expect(days).toBeLessThanOrEqual(1);
  });

  test('returns 0 for today date', () => {
    const today = new Date().toISOString().slice(0, 10);
    const days = calculateDaysOverdue(today);
    expect(days).toBeLessThanOrEqual(1);
  });

  test('getCollectionStage handles boundary values', () => {
    expect(getCollectionStage(0)).toBe('none');
    expect(getCollectionStage(6)).toBe('firm');
    expect(getCollectionStage(7)).toBe('internal');
    expect(getCollectionStage(100)).toBe('internal');
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

  test('returns empty array for empty input', () => {
    const enriched = enrichOverdueCharges([]);
    expect(enriched).toEqual([]);
  });
});

describe('sendReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storeReset();

    // Default: charge belongs to caller's clinic
    mockGetPaymentChargeForClinic.mockResolvedValue({
      id: 'ch1',
      clinicId: CLINIC_ID,
      budgetId: '00000000-0000-0000-0000-000000000010',
      amount: '500',
      status: 'pending',
      dueDate: '2026-08-15',
    });
    // Default: patient found via obterPaciente with phone
    mockObterPaciente.mockResolvedValue({
      id: 'patient-1',
      clinicId: CLINIC_ID,
      name: 'Test Patient',
      phone: '11999990000',
    });
    // Default: budget has patientId
    mockGetBudgetForClinic.mockResolvedValue({
      id: 'budget-1',
      clinicId: CLINIC_ID,
      patientId: 'patient-1',
    });
  });

  test('returns sent=true when the Atendimento delivery is queued', async () => {
    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch1',
      patientPhone: '11999990000',
    });

    expect(result.sent).toBe(true);
    expect(mockGetPaymentChargeForClinic).toHaveBeenCalledWith('ch1', CLINIC_ID);
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        clinicId: CLINIC_ID,
        operation: 'atendimento.outbound.message',
        payload: expect.objectContaining({ channel: 'whatsapp', externalId: '11999990000' }),
      }),
    );
  });

  test('returns sent=false when no patient phone', async () => {
    mockGetBudgetForClinic.mockResolvedValue({
      id: 'budget-1', clinicId: CLINIC_ID, patientId: null,
    });

    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch1',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');
    expect(mockGetPaymentChargeForClinic).toHaveBeenCalledWith('ch1', CLINIC_ID);
  });

  test('returns sent=false when outbox enqueue fails', async () => {
    mockEnqueueOutbox.mockRejectedValueOnce(new Error('outbox unavailable'));

    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch1',
      patientPhone: '11999990000',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('outbox unavailable');
  });

  // ── Foreign charge tests (REQ04) ───────────────────

  test('returns missing_patient_phone for foreign charge even with phone provided', async () => {
    mockGetPaymentChargeForClinic.mockResolvedValue(undefined); // charge belongs to other clinic

    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch-foreign',
      patientPhone: '11999990000',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');
    // Must NOT attempt to send
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });

  test('returns missing_patient_phone for foreign charge with no phone', async () => {
    mockGetPaymentChargeForClinic.mockResolvedValue(undefined); // charge belongs to other clinic

    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch-foreign',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });

  test('returns missing_patient_phone when obterPaciente returns patient with no phone', async () => {
    mockObterPaciente.mockResolvedValue({
      id: 'patient-2', clinicId: CLINIC_ID, name: 'No Phone', phone: null,
    });

    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch1',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('missing_patient_phone');
  });

  test('handles outbox enqueue throwing an error (catch path)', async () => {
    mockObterPaciente.mockResolvedValue({
      id: 'patient-3', clinicId: CLINIC_ID, name: 'Test', phone: '11999990001',
    });
    mockEnqueueOutbox.mockRejectedValueOnce(new Error('connection refused'));

    const result = await sendReminder({
      clinicId: CLINIC_ID,
      chargeId: 'ch1',
      patientPhone: '11999990001',
    });

    expect(result.sent).toBe(false);
    expect(result.error).toBe('connection refused');
  });
});
