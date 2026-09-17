/**
 * Etapa 5.3 — audit trail (ADR-BASE-12): writeActionLog receives exactly the
 * allowlisted fields for money-mutating financeiro actions.
 */

import { randomUUID } from 'node:crypto';

const mockRegisterManualPayment = jest.fn();
const mockGetBudgetForClinic = jest.fn();
const mockUpdateBudget = jest.fn();

jest.mock('../../services/payment-service', () => ({
  registerManualPayment: (...args: unknown[]) => mockRegisterManualPayment(...args),
}));

jest.mock('../../services/budget-service', () => ({
  getBudgetForClinic: (...args: unknown[]) => mockGetBudgetForClinic(...args),
}));

jest.mock('../../repositories/financeiro-repository', () => ({
  updateBudget: (...args: unknown[]) => mockUpdateBudget(...args),
}));

const logs: any[] = [];
jest.mock('@/core/actions/audit-writer', () => ({
  writeActionLog: (r: unknown) => { logs.push(r); },
  allowlistInput: jest.requireActual('@/core/actions/audit-writer').allowlistInput,
}));

import { runAction } from '@/core/actions/run';
import type { ActionContext } from '@/core/actions/types';
import { registrarPagamento } from '../registrar-pagamento';
import { atualizarOrcamento } from '../atualizar-orcamento';

const CLINIC_ID = randomUUID();

function ctx(): ActionContext {
  return {
    source: 'user',
    clinicId: CLINIC_ID,
    user: { id: 'u1', email: 'a@b.c', name: 'A' },
    role: 'owner',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'u1' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.length = 0;
});

describe('Etapa 5.3 — financeiro auditFields', () => {
  it('registrarPagamento logs money fields + idempotencyKey, never notes', async () => {
    const budgetId = randomUUID();
    mockRegisterManualPayment.mockResolvedValue({ id: 'pay-1' });
    const r = await runAction(registrarPagamento, {
      budgetId,
      amount: 100,
      paymentMethod: 'pix',
      idempotencyKey: 'key-1',
      notes: 'free-text-must-not-log',
    }, ctx());
    expect(r.ok).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actionName: 'financeiro.registrarPagamento', result: 'ok' });
    expect(logs[0].inputRedacted).toEqual({
      budgetId,
      amount: 100,
      paymentMethod: 'pix',
      idempotencyKey: 'key-1',
    });
  });

  it('atualizarOrcamento logs id/status/discountPercent/validUntil only', async () => {
    const id = randomUUID();
    mockGetBudgetForClinic.mockResolvedValue({ id, totalValue: '1000.00' });
    mockUpdateBudget.mockResolvedValue({ id, status: 'pending' });
    const r = await runAction(atualizarOrcamento, {
      id,
      discountPercent: 10,
      notes: 'free-text-must-not-log',
    }, ctx());
    expect(r.ok).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actionName: 'financeiro.atualizarOrcamento', result: 'ok' });
    expect(logs[0].inputRedacted).toEqual({ id, discountPercent: 10 });
  });
});
