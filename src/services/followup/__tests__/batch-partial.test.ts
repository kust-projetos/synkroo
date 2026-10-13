/**
 * P1A-FAKE: batch parcial explícito — nenhuma operação em lote retorna
 * success:true puro quando há falhas registradas (failed>0 / errors[]).
 */
import { startCampaign } from '@/services/followup/campaign.service';

jest.mock('@/repositories/campaigns', () => ({
  findCampaignById: jest.fn(),
  findScheduledCampaigns: jest.fn(),
  findPendingRecipients: jest.fn(),
  markRecipientSuppressed: jest.fn(),
  markRecipientSent: jest.fn(),
  markRecipientError: jest.fn(),
  updateCampaignCounts: jest.fn(),
  updateCampaignStatus: jest.fn(),
  enqueueRecipientDelivery: jest.fn(),
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
  whatsappLogger: { warn: jest.fn(), error: jest.fn() },
}));

import * as campaignRepo from '@/repositories/campaigns';

const repo = campaignRepo as jest.Mocked<typeof campaignRepo>;

const campaign = {
  id: 'campaign-batch',
  clinicId: 'clinic-1',
  name: 'Batch',
  description: null,
  campaignType: 'retention',
  targetSegment: null,
  messageTemplate: 'Olá',
  channel: 'whatsapp',
  status: 'scheduled',
  scheduledAt: new Date('2026-07-29T10:00:00Z'),
  startedAt: null,
  completedAt: null,
  totalRecipients: 3,
  sentCount: 0,
  responseCount: 0,
  conversionCount: 0,
  optOutCount: 0,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function recipient(id: string) {
  return {
    id,
    campaignId: campaign.id,
    patientId: `patient-${id}`,
    status: 'pending',
    sentAt: null,
    deliveredAt: null,
    respondedAt: null,
    responseContent: null,
    convertedAt: null,
    conversionAppointmentId: null,
    errorMessage: null,
    createdAt: new Date(),
    patientPhone: '5511999999999',
    optOutMarketing: false,
    optOutReminders: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockWithIdempotency.mockImplementation(async (_key: string, _type: string, handler: () => Promise<unknown>) => ({
    status: 'completed',
    result: await handler(),
  }));
  repo.findCampaignById.mockResolvedValue(campaign);
  repo.updateCampaignCounts.mockResolvedValue(undefined);
  repo.updateCampaignStatus.mockResolvedValue(campaign);
});

describe('P1A-FAKE batch parcial (campaign)', () => {
  it('2 ok + 1 falha → parcial explícita (success:false, failed=1, errors=1)', async () => {
    repo.findPendingRecipients.mockResolvedValue([recipient('r1'), recipient('r2'), recipient('r3')]);
    repo.enqueueRecipientDelivery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('WHATSAPP_DOWN'));

    const result = await startCampaign(campaign.id);

    expect(result.success).toBe(false);
    expect(result.status).toBe('partial');
    expect(result.requested).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(repo.updateCampaignStatus).toHaveBeenCalledWith(campaign.id, 'partial');
  });

  it('tudo-falha → success:false', async () => {
    repo.findPendingRecipients.mockResolvedValue([recipient('r1'), recipient('r2')]);
    repo.enqueueRecipientDelivery.mockRejectedValue(new Error('WHATSAPP_DOWN'));

    const result = await startCampaign(campaign.id);

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.failed).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it('already_processed → success:true + alreadyProcessed:true (reexecução segura)', async () => {
    mockWithIdempotency.mockResolvedValueOnce({ status: 'already_processed' });

    const result = await startCampaign(campaign.id);

    expect(result).toMatchObject({ success: true, alreadyProcessed: true });
    expect(repo.findCampaignById).not.toHaveBeenCalled();
  });
});
