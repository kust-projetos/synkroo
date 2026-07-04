/**
 * Unit tests for budget-followup-service — budget follow-up bridge.
 *
 * Tests service layer only (no DB, no Docker). Legacy imports are mocked.
 */

import { listarOrcamentosPendentes, executarFollowupOrcamentos, listarTratamentosIncompletos } from '../budget-followup-service';

const mockFindUnconverted = jest.fn();
const mockProcessBudgets = jest.fn();
const mockDetectIncomplete = jest.fn();
const mockGetAlerts = jest.fn();

jest.mock('@/services/followup/budget-followup.service', () => ({
  findUnconvertedBudgets: (...a: unknown[]) => mockFindUnconverted(...a),
  processBudgetFollowups: (...a: unknown[]) => mockProcessBudgets(...a),
}));

jest.mock('@/services/appointments/incomplete-treatment.service', () => ({
  detectIncompleteTreatments: (...a: unknown[]) => mockDetectIncomplete(...a),
  getIncompleteTreatmentAlerts: (...a: unknown[]) => mockGetAlerts(...a),
}));

describe('budget-followup-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listarOrcamentosPendentes', () => {
    it('calls findUnconvertedBudgets with clinicId and returns result', async () => {
      mockFindUnconverted.mockResolvedValueOnce([
        { id: 'b1', patientName: 'Paciente A', value: 500 },
      ]);
      const result = await listarOrcamentosPendentes('c1');
      expect(mockFindUnconverted).toHaveBeenCalledWith('c1');
      expect(result.budgets).toHaveLength(1);
      expect(result.budgets[0].id).toBe('b1');
      expect(result.total).toBe(1);
    });

    it('returns empty when no pending budgets', async () => {
      mockFindUnconverted.mockResolvedValueOnce([]);
      const result = await listarOrcamentosPendentes('c1');
      expect(result.budgets).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('executarFollowupOrcamentos', () => {
    it('calls processBudgetFollowups with clinicId and returns result', async () => {
      mockProcessBudgets.mockResolvedValueOnce({ processed: 2, errors: 0 });
      const result = await executarFollowupOrcamentos('c1');
      expect(mockProcessBudgets).toHaveBeenCalledWith('c1');
      expect(result).toEqual({ processed: 2, errors: 0 });
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
