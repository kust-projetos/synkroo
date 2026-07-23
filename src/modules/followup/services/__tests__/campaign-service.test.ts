/**
 * Unit tests for campaign-service — campaign execution bridge.
 *
 * Tests service layer only (no DB, no Docker). Legacy imports are mocked.
 */

import { executarCampanhas, listarSegmentos } from '../campaign-service';

const mockProcessCampaigns = jest.fn();
const mockListSegments = jest.fn();

jest.mock('@/services/followup/campaign.service', () => ({
  processScheduledCampaigns: (...a: unknown[]) => mockProcessCampaigns(...a),
}));

jest.mock('@/services/followup/segmentation.service', () => ({
  listSegments: (...a: unknown[]) => mockListSegments(...a),
}));

describe('campaign-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executarCampanhas', () => {
    it('calls processScheduledCampaigns and returns processed=1', async () => {
      mockProcessCampaigns.mockResolvedValueOnce(undefined);
      const result = await executarCampanhas();
      expect(mockProcessCampaigns).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ processed: 1 });
    });
  });

  describe('listarSegmentos', () => {
    it('calls listSegments with clinicId and returns result', async () => {
      mockListSegments.mockResolvedValueOnce([
        { id: 's1', name: 'Segmento A', count: 10 },
      ]);
      const result = await listarSegmentos('c1');
      expect(mockListSegments).toHaveBeenCalledWith('c1');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].id).toBe('s1');
      expect(result.total).toBe(1);
    });

    it('returns empty when no segments', async () => {
      mockListSegments.mockResolvedValueOnce([]);
      const result = await listarSegmentos('c1');
      expect(result.segments).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
