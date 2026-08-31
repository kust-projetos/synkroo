/**
 * Unit tests for the Drizzle-backed campaign service.
 */

import { executarCampanhas, listarSegmentos } from '../campaign-service';

const mockFindScheduledCampaigns = jest.fn();
const mockDb = { select: jest.fn() };

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }));

jest.mock('@/modules/followup/repositories/campaigns-repository', () => ({
  findScheduledCampaigns: (...a: unknown[]) => mockFindScheduledCampaigns(...a),
}));

function query(result: unknown[]): any {
  const chain: any = {
    from: jest.fn(() => chain),
    where: jest.fn(() => chain),
    orderBy: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
}

describe('campaign-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockFindScheduledCampaigns.mockResolvedValue([]);
  });

  describe('executarCampanhas', () => {
    it('processes scheduled campaigns for the requested clinic', async () => {
      const result = await executarCampanhas('clinic-a');
      expect(mockFindScheduledCampaigns).toHaveBeenCalledWith('clinic-a', expect.any(Date));
      expect(result).toEqual({ processed: 1 });
    });
  });

  describe('listarSegmentos', () => {
    it('lists segments scoped to clinicId and returns the API shape', async () => {
      mockDb.select.mockReturnValue(query([{
        id: 's1',
        clinicId: 'c1',
        name: 'Segmento A',
        description: null,
        criteria: {},
        patientCount: 10,
        createdBy: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }]));
      const result = await listarSegmentos('c1');
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].id).toBe('s1');
      expect(result.total).toBe(1);
    });

    it('returns empty when no segments', async () => {
      mockDb.select.mockReturnValue(query([]));
      const result = await listarSegmentos('c1');
      expect(result.segments).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
