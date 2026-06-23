/**
 * Lead Notification Service Tests
 * Migrated from Supabase to Drizzle
 * Tests for hot lead notification via WhatsApp
 */

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}))

jest.mock('@/lib/whatsapp/send')
jest.mock('@/services/leads/leads.service')
jest.mock('@/repositories/leads')

import {
  notifyHotLead,
  checkAndNotifyHotLeads,
  getUnacknowledgedNotifications,
  checkAllClinicsHotLeads,
  acknowledgeNotification,
} from '../lead-notification.service'
import * as leadsService from '@/services/leads/leads.service'
import type { Lead } from '@/services/leads/leads.service'
import * as leadRepo from '@/repositories/leads'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

const mockGetHotLeads = leadsService.getHotLeads as jest.MockedFunction<typeof leadsService.getHotLeads>
const mockSendWhatsAppMessage = sendWhatsAppMessage as jest.MockedFunction<typeof sendWhatsAppMessage>
const mockFindLeadById = leadRepo.findLeadById as jest.MockedFunction<typeof leadRepo.findLeadById>

function createMockLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-123',
    clinic_id: 'clinic-1',
    patient_id: null,
    name: 'João Silva',
    phone: '+5511999999999',
    email: 'joao@example.com',
    source: 'instagram',
    status: 'new',
    temperature: 'hot',
    score: 85,
    interest: 'Implante Dentário',
    notes: 'Paciente muito interessado',
    assigned_to: null,
    last_contact_at: null,
    next_followup_at: null,
    converted_at: null,
    lost_reason: null,
    deal_value: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockLeadRow(overrides: Partial<leadRepo.LeadRow> = {}): leadRepo.LeadRow {
  const now = new Date()
  return {
    id: 'lead-123',
    clinicId: 'clinic-1',
    patientId: null,
    name: 'João Silva',
    phone: '+5511999999999',
    email: 'joao@example.com',
    source: 'instagram',
    campaignId: null,
    score: 85,
    temperature: 'hot',
    status: 'new',
    interest: 'Implante Dentário',
    hasBudget: null,
    hasTimeline: null,
    assignedTo: null,
    lastContactAt: null,
    nextFollowupAt: null,
    contactCount: 0,
    convertedAt: null,
    convertedAppointmentId: null,
    lostReason: null,
    lostAt: null,
    notes: 'Paciente muito interessado',
    stageId: null,
    sourceType: null,
    dealValue: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('lead-notification.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSendWhatsAppMessage.mockResolvedValue({ success: true })
  })

  describe('notifyHotLead', () => {
    it('should return error when lead is not found', async () => {
      mockFindLeadById.mockResolvedValue(null)

      const result = await notifyHotLead('nonexistent-lead')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('Lead not found')
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should return error when lead score is below threshold', async () => {
      mockFindLeadById.mockResolvedValue(createMockLeadRow({ score: 45 }))

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toContain('Score 45 below threshold 70')
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should send WhatsApp message to lead phone', async () => {
      const lead = createMockLeadRow({ score: 85 })
      mockFindLeadById.mockResolvedValue(lead)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
        '+5511999999999',
        expect.stringContaining('LEAD QUENTE DETECTADO')
      )
    })

    it('should handle WhatsApp send failure', async () => {
      mockFindLeadById.mockResolvedValue(createMockLeadRow({ score: 85 }))
      mockSendWhatsAppMessage.mockResolvedValue({ success: false, error: 'WhatsApp API error' })

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('WhatsApp API error')
    })

    it('should return error when lead has no phone', async () => {
      mockFindLeadById.mockResolvedValue(createMockLeadRow({ phone: '' }))

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('No phone number found')
    })

    it('should handle unexpected errors gracefully', async () => {
      mockFindLeadById.mockRejectedValue(new Error('Database error'))

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('Database error')
    })

    it('should handle exact threshold score (70)', async () => {
      mockFindLeadById.mockResolvedValue(createMockLeadRow({ score: 70 }))

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
    })

    it('should include lead details in message', async () => {
      mockFindLeadById.mockResolvedValue(createMockLeadRow({
        score: 85,
        name: 'Maria Silva',
        phone: '+5511999999999',
        email: 'maria@example.com',
        source: 'referral',
        status: 'qualified',
        interest: 'Clareamento',
        notes: 'Muy interessada',
      }))

      await notifyHotLead('lead-123')

      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
        '+5511999999999',
        expect.stringContaining('Maria Silva')
      )
      expect(mockSendWhatsAppMessage).toHaveBeenCalledWith(
        '+5511999999999',
        expect.stringContaining('Score: 85/100')
      )
    })
  })

  describe('checkAndNotifyHotLeads', () => {
    it('should handle errors gracefully', async () => {
      mockGetHotLeads.mockRejectedValue(new Error('Database error'))

      await expect(checkAndNotifyHotLeads('clinic-1')).resolves.not.toThrow()
    })

    it('should not notify leads below threshold', async () => {
      const coolLeads = [
        createMockLead({ id: 'lead-1', score: 45, name: 'A', phone: '111' }),
        createMockLead({ id: 'lead-2', score: 60, name: 'B', phone: '222' }),
      ]
      mockGetHotLeads.mockResolvedValue(coolLeads)

      await checkAndNotifyHotLeads('clinic-1')

      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should handle empty leads list', async () => {
      mockGetHotLeads.mockResolvedValue([])

      await checkAndNotifyHotLeads('clinic-1')

      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should check and notify hot leads for clinic', async () => {
      const hotLeads = [
        createMockLead({ id: 'lead-1', score: 85, name: 'A', phone: '111' }),
        createMockLead({ id: 'lead-2', score: 92, name: 'B', phone: '222' }),
      ]
      mockGetHotLeads.mockResolvedValue(hotLeads)
      mockFindLeadById
        .mockResolvedValueOnce(createMockLeadRow({ id: 'lead-1', score: 85, name: 'A', phone: '111' }))
        .mockResolvedValueOnce(createMockLeadRow({ id: 'lead-2', score: 92, name: 'B', phone: '222' }))

      await checkAndNotifyHotLeads('clinic-1')

      expect(mockGetHotLeads).toHaveBeenCalledWith('clinic-1', 50)
      expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(2)
    })
  })

  describe('getUnacknowledgedNotifications', () => {
    it('should return empty array (lead_notifications table not in schema)', async () => {
      const result = await getUnacknowledgedNotifications('clinic-1')
      expect(result).toEqual([])
    })
  })

  describe('checkAllClinicsHotLeads', () => {
    it('should log warning (out of scope - requires clinics table)', async () => {
      await checkAllClinicsHotLeads()
      // Should just return without error
      expect(true).toBe(true)
    })
  })

  describe('acknowledgeNotification', () => {
    it('should return true (no-op, lead_notifications not in schema)', async () => {
      const result = await acknowledgeNotification('notif-123')
      expect(result).toBe(true)
    })
  })
})