/**
 * Unit tests for the Drizzle-backed budget follow-up service.
 */

import { listarOrcamentosPendentes, executarFollowupOrcamentos, listarTratamentosIncompletos } from '../budget-followup-service';

const mockDetectIncomplete = jest.fn();
const mockGetAlerts = jest.fn();
const mockDb = {
  select: jest.fn(),
  update: jest.fn(() => ({
    set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })),
  })),
};

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }));

jest.mock('@/modules/operacional/public', () => ({
  detectIncompleteTreatments: (...a: unknown[]) => mockDetectIncomplete(...a),
  getIncompleteTreatmentAlerts: (...a: unknown[]) => mockGetAlerts(...a),
}));

function query(result: unknown[], terminal: 'orderBy' | 'limit'): any {
  const chain: any = {
    from: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => terminal === 'orderBy' ? Promise.resolve(result) : chain),
    limit: jest.fn(() => terminal === 'limit' ? Promise.resolve(result) : chain),
  };
  return chain;
}

const pendingBudgetRow = {
  budgets: {
    id: 'b1',
    patientId: 'p1',
    clinicId: 'c1',
    totalValue: '500.00',
    createdAt: new Date(Date.now() - 8 * 86_400_000),
    notes: null,
    status: 'sent',
  },
  patients: { name: 'Paciente A', phone: '11999990000' },
};

describe('budget-followup-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
  });

  describe('listarOrcamentosPendentes', () => {
    it('lists pending budgets scoped to clinicId', async () => {
      mockDb.select.mockReturnValue(query([pendingBudgetRow], 'orderBy'));
      const result = await listarOrcamentosPendentes('c1');
      expect(result.budgets).toHaveLength(1);
      expect(result.budgets[0].id).toBe('b1');
      expect(result.total).toBe(1);
    });

    it('returns empty when no pending budgets', async () => {
      mockDb.select.mockReturnValue(query([], 'orderBy'));
      const result = await listarOrcamentosPendentes('c1');
      expect(result.budgets).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('executarFollowupOrcamentos', () => {
    it('processes an eligible budget with clinic-scoped writes', async () => {
      mockDb.select
        .mockReturnValueOnce(query([pendingBudgetRow], 'orderBy'))
        .mockReturnValueOnce(query([{ notes: null }], 'limit'));
      const result = await executarFollowupOrcamentos('c1');
      expect(result).toEqual({ processed: 1, errors: 0 });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('listarTratamentosIncompletos', () => {
    it('returns treatments when alertsOnly is false', async () => {
      mockDetectIncomplete.mockResolvedValueOnce([
        { patient_id: 'p1', patient_name: 'Paciente A', procedure_name: 'Canal' } as any,
      ]);
      const result = await listarTratamentosIncompletos('c1', false);
      expect(mockDetectIncomplete).toHaveBeenCalledWith('c1');
      expect(result.treatments).toHaveLength(1);
      expect(result.treatments![0].patient_id).toBe('p1');
    });

    it('returns alerts when alertsOnly is true', async () => {
      mockGetAlerts.mockResolvedValueOnce({
        total: 5, highRisk: 1, mediumRisk: 2,
        treatments: [{ patient_id: 'p1', patient_name: 'Paciente A', risk_level: 'high' }] as any,
      });
      const result = await listarTratamentosIncompletos('c1', true);
      expect(mockGetAlerts).toHaveBeenCalledWith('c1');
      expect(result.alerts!.total).toBe(5);
      expect(result.alerts!.highRisk).toBe(1);
    });

    it('defaults alertsOnly to undefined (returns treatments)', async () => {
      mockDetectIncomplete.mockResolvedValueOnce([]);
      await listarTratamentosIncompletos('c1');
      expect(mockDetectIncomplete).toHaveBeenCalledWith('c1');
    });
  });
});
