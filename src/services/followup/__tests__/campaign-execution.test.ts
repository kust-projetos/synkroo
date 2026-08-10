import {
  processScheduledCampaigns,
  startCampaign,
} from '@/services/followup/campaign.service'

jest.mock('@/repositories/campaigns', () => ({
  findCampaignById: jest.fn(),
  findScheduledCampaigns: jest.fn(),
  findPendingRecipients: jest.fn(),
  markRecipientSuppressed: jest.fn(),
  markRecipientSent: jest.fn(),
  markRecipientError: jest.fn(),
  updateCampaignCounts: jest.fn(),
  updateCampaignStatus: jest.fn(),
  enqueueRecipientDelivery: jest.fn().mockResolvedValue(undefined),
}))
const mockWithIdempotency = jest.fn()
jest.mock('@/lib/idempotency', () => ({
  withIdempotency: (...args: unknown[]) => mockWithIdempotency(...args),
}))
jest.mock('@/services/contacts/consents.service', () => ({
  hasActiveConsent: jest.fn(),
}))
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
  whatsappLogger: { warn: jest.fn(), error: jest.fn() },
}))

import { hasActiveConsent } from '@/services/contacts/consents.service'
import * as campaignRepo from '@/repositories/campaigns'

const repo = campaignRepo as jest.Mocked<typeof campaignRepo>

const campaign = {
  id: 'campaign-1',
  clinicId: 'clinic-1',
  name: 'Retention',
  description: null,
  campaignType: 'retention',
  targetSegment: null,
  messageTemplate: 'Olá',
  channel: 'whatsapp',
  status: 'scheduled',
  scheduledAt: new Date('2026-07-29T10:00:00Z'),
  startedAt: null,
  completedAt: null,
  totalRecipients: 1,
  sentCount: 0,
  responseCount: 0,
  conversionCount: 0,
  optOutCount: 0,
  createdBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockWithIdempotency.mockImplementation(async (_key: string, _type: string, handler: () => Promise<unknown>) => ({
    status: 'completed', result: await handler(),
  }))
  repo.findCampaignById.mockResolvedValue(campaign)
  repo.findPendingRecipients.mockResolvedValue([])
  repo.updateCampaignCounts.mockResolvedValue(undefined)
  repo.updateCampaignStatus.mockResolvedValue(campaign)
})

describe('campaign execution', () => {
  it('does not execute a campaign while another worker owns its claim', async () => {
    mockWithIdempotency.mockResolvedValueOnce({ status: 'conflict' })

    await expect(startCampaign(campaign.id)).resolves.toEqual({
      success: false,
      error: 'Campaign execution already in progress',
    })
    expect(repo.findCampaignById).not.toHaveBeenCalled()
  })

  it('marks campaign failed when no recipient is delivered', async () => {
    const result = await startCampaign(campaign.id)

    expect(result).toEqual({ success: false, error: 'No recipients delivered' })
    expect(repo.updateCampaignStatus).not.toHaveBeenCalledWith(campaign.id, 'failed')
  })

  it('processes only campaigns due now for one clinic', async () => {
    repo.findScheduledCampaigns.mockResolvedValue([campaign])
    const now = new Date('2026-07-30T10:00:00Z')

    await processScheduledCampaigns(campaign.clinicId, now)

    expect(repo.findScheduledCampaigns).toHaveBeenCalledWith(campaign.clinicId, now)
    expect(repo.findCampaignById).toHaveBeenCalledWith(campaign.id)
  })

  it('completes campaign after consented recipient is sent', async () => {
    repo.findPendingRecipients.mockResolvedValue([{
      id: 'recipient-1',
      campaignId: campaign.id,
      patientId: 'patient-1',
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
    }])
    ;(hasActiveConsent as jest.Mock).mockResolvedValue(true)
    process.env.WHATSAPP_API_URL = 'https://whatsapp.test/send'
    process.env.WHATSAPP_TOKEN = 'token'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    }) as jest.Mock

    const result = await startCampaign(campaign.id)

    expect(result).toEqual({ success: true })
    expect(repo.updateCampaignStatus).not.toHaveBeenCalledWith(campaign.id, 'completed')
  })
})
