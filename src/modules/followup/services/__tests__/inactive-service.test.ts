/**
 * Unit tests for inactive-service — inactive patient detection bridge.
 *
 * Tests service layer only (no DB, no Docker). Legacy imports are mocked.
 * reactivatePatient tests skip the actual DB call (covered by integration).
 */

import { runInactivityDetection, findInactivePatients, INACTIVITY_SEGMENTS } from '../inactive-service';

const mockRunDetection = jest.fn();
const mockIdentifyInactive = jest.fn();

jest.mock('@/services/followup/inactive-patient.service', () => ({
  runInactivityDetection: (...a: unknown[]) => mockRunDetection(...a),
  identifyInactivePatients: (...a: unknown[]) => mockIdentifyInactive(...a),
  INACTIVITY_SEGMENTS: [
    { min: 30, max: 60, label: '30-60 dias', critical: false },
    { min: 60, max: 180, label: '60-180 dias', critical: false },
    { min: 180, max: 365, label: '6-12 meses', critical: true },
  ],
}));

describe('inactive-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('INACTIVITY_SEGMENTS', () => {
    it('is defined and non-empty', () => {
      expect(INACTIVITY_SEGMENTS).toBeDefined();
      expect(INACTIVITY_SEGMENTS.length).toBeGreaterThan(0);
    });
  });

  describe('runInactivityDetection', () => {
    it('calls legacy runInactivityDetection and returns processed=1', async () => {
      mockRunDetection.mockResolvedValueOnce(undefined);
      const result = await runInactivityDetection();
      expect(mockRunDetection).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ processed: 1 });
    });
  });

  describe('findInactivePatients', () => {
    it('calls legacy identifyInactivePatients with clinicId and minDays', async () => {
      mockIdentifyInactive.mockResolvedValueOnce([
        { patientId: 'p1', patientName: 'Paciente A', daysSinceLastVisit: 45 } as any,
      ]);
      const result = await findInactivePatients('c1', 30);
      expect(mockIdentifyInactive).toHaveBeenCalledWith('c1', 30);
      expect(result).toHaveLength(1);
      expect(result[0].patientId).toBe('p1');
    });

    it('defaults minDays to 30', async () => {
      mockIdentifyInactive.mockResolvedValueOnce([]);
      await findInactivePatients('c1');
      expect(mockIdentifyInactive).toHaveBeenCalledWith('c1', 30);
    });
  });
});
