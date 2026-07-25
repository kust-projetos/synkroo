/**
 * Unit tests for followup-service — followup execution bridge.
 *
 * Tests service layer only (no DB, no Docker). Legacy imports are mocked.
 */

import { executarAll, executarPostConsulta, executarLembretesRetorno, listarPendentes, listarRetornoPendentes } from '../followup-service';

const mockProcessAll = jest.fn();
const mockProcessPost = jest.fn();
const mockProcessReturn = jest.fn();
const mockGetAppts = jest.fn();
const mockGetPatients = jest.fn();

jest.mock('@/services/followup/followup.service', () => ({
  processAllFollowUps: (...a: unknown[]) => mockProcessAll(...a),
  processPostConsultationFollowUps: (...a: unknown[]) => mockProcessPost(...a),
  processReturnReminders: (...a: unknown[]) => mockProcessReturn(...a),
  getAppointmentsNeedingFollowUp: (...a: unknown[]) => mockGetAppts(...a),
  getPatientsNeedingReturnReminder: (...a: unknown[]) => mockGetPatients(...a),
}));

describe('followup-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executarAll', () => {
    it('calls processAllFollowUps and returns processed=1', async () => {
      mockProcessAll.mockResolvedValueOnce(undefined);
      const result = await executarAll('clinic-a');
      expect(mockProcessAll).toHaveBeenCalledWith('clinic-a');
      expect(result).toEqual({ processed: 1 });
    });
  });

  describe('executarPostConsulta', () => {
    it('calls processPostConsultationFollowUps and returns its result', async () => {
      mockProcessPost.mockResolvedValueOnce({ processed: 3, sent: 2, failed: 0 });
      const result = await executarPostConsulta('clinic-a');
      expect(mockProcessPost).toHaveBeenCalledWith('clinic-a');
      expect(result).toEqual({ processed: 3, sent: 2, failed: 0 });
    });
  });

  describe('executarLembretesRetorno', () => {
    it('calls processReturnReminders and returns its result', async () => {
      mockProcessReturn.mockResolvedValueOnce({ processed: 1, sent: 1, failed: 0 });
      const result = await executarLembretesRetorno('clinic-a');
      expect(mockProcessReturn).toHaveBeenCalledWith('clinic-a');
      expect(result).toEqual({ processed: 1, sent: 1, failed: 0 });
    });
  });

  describe('listarPendentes', () => {
    it('filters appointments by clinicId', async () => {
      mockGetAppts.mockResolvedValueOnce([
        { clinicId: 'c1' } as any,
        { clinicId: 'c2' } as any,
      ]);
      const result = await listarPendentes('c1');
      expect(mockGetAppts).toHaveBeenCalledWith(2);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty when no appointments match clinic', async () => {
      mockGetAppts.mockResolvedValueOnce([
        { clinicId: 'c2' } as any,
      ]);
      const result = await listarPendentes('c1');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('listarRetornoPendentes', () => {
    it('filters return-reminder patients by clinicId', async () => {
      mockGetPatients.mockResolvedValueOnce([
        { clinicId: 'c1' } as any,
        { clinicId: 'c2' } as any,
      ]);
      const result = await listarRetornoPendentes('c1');
      expect(mockGetPatients).toHaveBeenCalledWith(6);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
