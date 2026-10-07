/**
 * Unit tests for the Drizzle-backed campaign service.
 */

import { executarCampanhas, listarSegmentos } from '../campaign-service';
import * as campaignRepo from '../../repositories/campaigns-repository';

const mockFindScheduledCampaigns = jest.fn();
const mockDb = { select: jest.fn() };

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }));

jest.mock('@/modules/followup/repositories/campaigns-repository', () => ({
  findScheduledCampaigns: (...a: unknown[]) => mockFindScheduledCampaigns(...a),
  updateCampaignStatus: jest.fn(),
  findPendingRecipients: jest.fn(),
  enqueueRecipientDelivery: jest.fn(),
  markRecipientSuppressed: jest.fn(),
  markRecipientError: jest.fn(),
  updateCampaignCounts: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const repo = campaignRepo as unknown as Record<string, jest.Mock>;

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
    it('returns an empty completed batch when nothing is scheduled', async () => {
      const result = await executarCampanhas('clinic-a');
      expect(mockFindScheduledCampaigns).toHaveBeenCalledWith('clinic-a', expect.any(Date));
      expect(result).toEqual({
        requested: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0,
        errors: [], success: true, status: 'completed',
      });
    });

    it('aggregates enqueue outcomes without swallowing failures (P1-FIX-CANON 2)', async () => {
      mockFindScheduledCampaigns.mockResolvedValue([
        { id: 'camp-1', clinicId: 'clinic-a', messageTemplate: 'Olá' },
      ]);
      repo.findPendingRecipients.mockResolvedValue([
        { id: 'r1', patientId: 'p1', patientPhone: '5511999999999', optOutMarketing: false, optOutReminders: false },
        { id: 'r2', patientId: 'p2', patientPhone: '5511999999998', optOutMarketing: true, optOutReminders: false },
        { id: 'r3', patientId: 'p3', patientPhone: '5511999999997', optOutMarketing: false, optOutReminders: false },
      ]);
      repo.enqueueRecipientDelivery
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('WHATSAPP_DOWN'));

      const result = await executarCampanhas('clinic-a');

      expect(result).toMatchObject({
        requested: 3, processed: 1, succeeded: 1, failed: 1, skipped: 1,
        success: false, status: 'partial',
      });
      expect(result.errors).toHaveLength(1);
      expect(repo.markRecipientError).toHaveBeenCalledWith('r3', 'WHATSAPP_DOWN');
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
