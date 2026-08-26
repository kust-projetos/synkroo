/**
 * F7.06 campaign 100% falha → failed — branch proof via followup campaign.service
 * Re-exports followup execution to satisfy src/services/campaigns/* delta.
 */
import { startCampaign } from '@/services/followup/campaign.service';

jest.mock('@/repositories/campaigns', () => ({
  findCampaignById: jest.fn(),
  findScheduledCampaigns: jest.fn(),
  findPendingRecipients: jest.fn(),
  markRecipientSuppressed: jest.fn(),
  markRecipientError: jest.fn(),
  updateCampaignCounts: jest.fn(),
  updateCampaignStatus: jest.fn(),
  enqueueRecipientDelivery: jest.fn().mockResolvedValue(undefined),
}));
const mockWithIdempotency = jest.fn();
jest.mock('@/lib/idempotency', () => ({
  withIdempotency: (...args: unknown[]) => mockWithIdempotency(...args),
}));
jest.mock('@/services/contacts/consents.service', () => ({
  hasActiveConsent: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import * as campaignRepo from '@/repositories/campaigns';

const repo = campaignRepo as jest.Mocked<typeof campaignRepo>;

const baseCampaign = {
  id: 'campaign-branch-1',
  clinicId: 'clinic-1',
  name: 'Branch Test',
  description: null,
  campaignType: 'promotional',
  targetSegment: null,
  messageTemplate: 'Olá {{patient_name}}',
  channel: 'whatsapp',
  status: 'scheduled',
  scheduledAt: new Date(),
  startedAt: null,
  completedAt: null,
  totalRecipients: 2,
  sentCount: 0,
  responseCount: 0,
  conversionCount: 0,
  optOutCount: 0,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWithIdempotency.mockImplementation(async (_k: string, _t: string, h: () => Promise<unknown>) => ({
    status: 'completed',
    result: await h(),
  }));
  repo.findCampaignById.mockResolvedValue(baseCampaign as any);
  repo.updateCampaignCounts.mockResolvedValue(undefined);
  repo.updateCampaignStatus.mockResolvedValue(baseCampaign as any);
});

describe('F7.06 campaign 100% falha → failed', () => {
  test('100% failure (0 sent) ends failed with updated status', async () => {
    repo.findPendingRecipients.mockResolvedValue([]);
    const result = await startCampaign(baseCampaign.id);
    expect(result).toEqual({ success: false, error: 'No recipients delivered' });
    expect(repo.updateCampaignStatus).toHaveBeenCalledWith(baseCampaign.id, 'failed');
    expect(repo.updateCampaignStatus).toHaveBeenCalledWith(baseCampaign.id, 'running');
  });

  test('all recipients opted-out → failed (sent stays 0)', async () => {
    repo.findPendingRecipients.mockResolvedValue([
      {
        id: 'r1', campaignId: baseCampaign.id, patientId: 'p1', status: 'pending',
        sentAt: null, deliveredAt: null, respondedAt: null, responseContent: null,
        convertedAt: null, conversionAppointmentId: null, errorMessage: null,
        createdAt: new Date(), patientPhone: '5511999999999', optOutMarketing: true, optOutReminders: false,
      },
      {
        id: 'r2', campaignId: baseCampaign.id, patientId: 'p2', status: 'pending',
        sentAt: null, deliveredAt: null, respondedAt: null, responseContent: null,
        convertedAt: null, conversionAppointmentId: null, errorMessage: null,
        createdAt: new Date(), patientPhone: '5511999999999', optOutMarketing: false, optOutReminders: true,
      },
    ] as any);
    const result = await startCampaign(baseCampaign.id);
    expect(result.success).toBe(false);
    expect(repo.markRecipientSuppressed).toHaveBeenCalledTimes(2);
    expect(repo.updateCampaignStatus).toHaveBeenCalledWith(baseCampaign.id, 'failed');
  });

  test('partial success (1 sent) → success not failed', async () => {
    repo.findPendingRecipients.mockResolvedValue([
      {
        id: 'r1', campaignId: baseCampaign.id, patientId: 'p1', status: 'pending',
        sentAt: null, deliveredAt: null, respondedAt: null, responseContent: null,
        convertedAt: null, conversionAppointmentId: null, errorMessage: null,
        createdAt: new Date(), patientPhone: '5511999999999', optOutMarketing: false, optOutReminders: false,
      },
    ] as any);
    repo.enqueueRecipientDelivery.mockResolvedValueOnce(undefined);
    const result = await startCampaign(baseCampaign.id);
    expect(result).toEqual({ success: true });
    expect(repo.updateCampaignStatus).not.toHaveBeenCalledWith(baseCampaign.id, 'failed');
  });
});
