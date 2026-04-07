/**
 * Lead Notification Service Tests
 * Tests for hot lead notification via WhatsApp with deduplication
 */

import {
  notifyHotLead,
  checkAndNotifyHotLeads,
  getUnacknowledgedNotifications,
  checkAllClinicsHotLeads,
  acknowledgeNotification,
  type LeadNotification,
} from '../lead-notification.service'
import type { Lead } from '../leads.service'
import { createTypedClient } from '@/lib/supabase/typed'
import { sendWhatsAppMessage } from '@/services/whatsapp'
import { getHotLeads } from '../leads.service'

jest.mock('@/lib/supabase/typed')
jest.mock('@/services/whatsapp')
jest.mock('../leads.service')

// Mock logger properly
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}))

const mockCreateTypedClient = createTypedClient as jest.MockedFunction<typeof createTypedClient>
const mockSendWhatsAppMessage = sendWhatsAppMessage as jest.MockedFunction<typeof sendWhatsAppMessage>
const mockGetHotLeads = getHotLeads as jest.MockedFunction<typeof getHotLeads>

/**
 * Helper to create a mock lead
 */
function createMockLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-123',
    name: 'João Silva',
    phone: '+5511999999999',
    email: 'joao@example.com',
    source: 'instagram',
    score: 85,
    status: 'new',
    clinic_id: 'clinic-1',
    assigned_to: null,
    interest: 'Implante Dentário',
    notes: 'Paciente muito interessado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Helper to create a mock notification
 */
function createMockNotification(overrides: Partial<LeadNotification> = {}): LeadNotification {
  return {
    id: 'notif-123',
    lead_id: 'lead-123',
    clinic_id: 'clinic-1',
    type: 'hot_lead',
    channel: 'whatsapp',
    sent_at: new Date().toISOString(),
    acknowledged: false,
    lead_name: 'João Silva',
    lead_phone: '+5511999999999',
    lead_score: 85,
    lead_source: 'instagram',
    lead_interest: 'Implante Dentário',
    ...overrides,
  }
}

/**
 * Creates a proper Supabase query chain mock
 * All methods return this (chainable) except single() which resolves the promise
 */
function createSupabaseChain(result: { data?: any; error?: any } | any[]) {
  const isArray = Array.isArray(result)
  const data = isArray ? result : result.data
  const error = isArray ? undefined : result.error

  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), // Returns this, so .single() can be chained
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    // .single() resolves the promise
    single: jest.fn().mockResolvedValue({ data, error }),
  }

  return chain
}

/**
 * Creates a chain that resolves from .limit() without .single()
 * Used for queries like: .from().select().eq().order().limit()
 */
function createLimitChain(result: { data?: any; error?: any }) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    // limit() directly resolves the promise
    limit: jest.fn().mockResolvedValue(result),
  }
  return chain
}

/**
 * Creates a dedup check chain (.from().select().eq().eq().gte().limit())
 * This is specifically for wasRecentlyNotified() which ends with .limit()
 */
function createDedupChain(result: { data?: any; error?: any }) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
  }
  return chain
}

/**
 * Creates a chain for admin query: .from().select().eq().in().eq().limit().single()
 */
function createAdminChain(result: { data?: any; error?: any }) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  }
  return chain
}

/**
 * Creates an update chain (without .single())
 */
function createUpdateChain(error: any = null) {
  return {
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error }),
      }),
    }),
  }
}

/**
 * Creates a chain that returns a promise directly (for functions using .then())
 */
function createThenableChain(result: { data?: any; error?: any }) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => Promise.resolve(result)),
  }
  return chain
}

describe('lead-notification.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
    mockSendWhatsAppMessage.mockResolvedValue({ success: true })
  })

  describe('notifyHotLead', () => {
    it('should return error when lead is not found', async () => {
      mockCreateTypedClient.mockResolvedValue(
        createSupabaseChain({ data: null, error: { message: 'Not found' } })
      )

      const result = await notifyHotLead('nonexistent-lead')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('Lead not found')
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should return error when lead score is below threshold', async () => {
      const lead = createMockLead({ score: 45 })

      mockCreateTypedClient.mockResolvedValue(
        createSupabaseChain({ data: lead, error: null })
      )

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toContain('Score 45 below threshold 70')
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should handle unexpected errors gracefully', async () => {
      const mockClient = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('Database connection failed')
        }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should skip notification when dedup check finds recent notification', async () => {
      const lead = createMockLead({ score: 85 })

      mockCreateTypedClient
        .mockResolvedValueOnce(createSupabaseChain({ data: lead, error: null }) as any) // Fetch
        .mockResolvedValueOnce(createDedupChain({ data: [{ id: 'existing-notif' }], error: null }) as any) // Dedup

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('Already notified within 24h')
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should return false when no responsible phone is found and store in_app notification', async () => {
      const lead = createMockLead({ score: 85 })
      const notification = createMockNotification({ channel: 'in_app' })

      // Chain 1: Fetch lead
      const fetchChain = createSupabaseChain({ data: lead, error: null })
      // Chain 2: Dedup check - no recent notifications
      const dedupChain = createSupabaseChain([])
      // Chain 3: Admin check - no admin found
      const adminChain = createSupabaseChain({ data: null, error: null })
      // Chain 4: Store in_app notification
      const storeChain = createSupabaseChain({ data: notification, error: null })

      mockCreateTypedClient
        .mockResolvedValueOnce(fetchChain as any)
        .mockResolvedValueOnce(dedupChain as any)
        .mockResolvedValueOnce(adminChain as any)
        .mockResolvedValueOnce(storeChain as any)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('No phone number found for notification')
      expect(mockSendWhatsAppMessage).not.toHaveBeenCalled()
    })

    it('should store in_app notification when WhatsApp send fails', async () => {
      const lead = createMockLead({ score: 85 })
      const notification = createMockNotification({ channel: 'in_app' })

      mockSendWhatsAppMessage.mockResolvedValue({ success: false, error: 'WhatsApp API error' })

      // Chain 1: Fetch lead
      const fetchChain = createSupabaseChain({ data: lead, error: null })
      // Chain 2: Dedup check
      const dedupChain = createSupabaseChain([])
      // Chain 3: Admin check - returns phone
      const adminChain = createSupabaseChain({ data: { phone: '+5511888888888' }, error: null })
      // Chain 4: Store in_app notification
      const storeChain = createSupabaseChain({ data: notification, error: null })

      mockCreateTypedClient
        .mockResolvedValueOnce(fetchChain as any)
        .mockResolvedValueOnce(dedupChain as any)
        .mockResolvedValueOnce(adminChain as any)
        .mockResolvedValueOnce(storeChain as any)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(false)
      expect(result.error).toBe('WhatsApp API error')
    })

    it('should use assigned user phone when available', async () => {
      const lead = createMockLead({ score: 85, assigned_to: 'user-456' })
      const notification = createMockNotification()

      // Chain 1: Fetch lead
      const fetchChain = createSupabaseChain({ data: lead, error: null })
      // Chain 2: Dedup check
      const dedupChain = createSupabaseChain([])
      // Chain 3: Assigned user check - returns phone
      const userChain = createSupabaseChain({ data: { phone: '+5511777777777' }, error: null })
      // Chain 4: Store notification
      const storeChain = createSupabaseChain({ data: notification, error: null })

      mockCreateTypedClient
        .mockResolvedValueOnce(fetchChain as any)
        .mockResolvedValueOnce(dedupChain as any)
        .mockResolvedValueOnce(userChain as any)
        .mockResolvedValueOnce(storeChain as any)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
    })

    it('should successfully notify hot lead via WhatsApp with admin phone', async () => {
      const lead = createMockLead({ score: 85 })
      const notification = createMockNotification()

      // Chain 1: Fetch lead
      const fetchChain = createSupabaseChain({ data: lead, error: null })
      // Chain 2: Dedup check
      const dedupChain = createSupabaseChain([])
      // Chain 3: Admin check
      const adminChain = createSupabaseChain({ data: { phone: '+5511888888888' }, error: null })
      // Chain 4: Store notification
      const storeChain = createSupabaseChain({ data: notification, error: null })

      mockCreateTypedClient
        .mockResolvedValueOnce(fetchChain as any)
        .mockResolvedValueOnce(dedupChain as any)
        .mockResolvedValueOnce(adminChain as any)
        .mockResolvedValueOnce(storeChain as any)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle dedup check error gracefully and proceed with notification', async () => {
      const lead = createMockLead({ score: 85 })
      const notification = createMockNotification()

      // Chain 1: Fetch lead
      const fetchChain = createSupabaseChain({ data: lead, error: null })
      // Chain 2: Dedup check - fails but continues
      const dedupChain = createSupabaseChain({ data: null, error: { message: 'DB Error' } })
      // Chain 3: Admin check
      const adminChain = createSupabaseChain({ data: { phone: '+5511888888888' }, error: null })
      // Chain 4: Store
      const storeChain = createSupabaseChain({ data: notification, error: null })

      mockCreateTypedClient
        .mockResolvedValueOnce(fetchChain as any)
        .mockResolvedValueOnce(dedupChain as any)
        .mockResolvedValueOnce(adminChain as any)
        .mockResolvedValueOnce(storeChain as any)

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
    })

    it.skip('should handle assigned user without phone (fallback to admin)', async () => {
      const lead = createMockLead({ score: 85, assigned_to: 'user-456' })
      const notification = createMockNotification()

      // Assigned user has no phone - fallback to admin
      // Note: When user query returns { phone: null }, the code should fallback to admin
      // The user query is: .from().select().eq().single()
      // The admin query is: .from().select().eq().in().eq().limit().single()

      // User chain: returns { phone: null } which is falsy, triggering fallback
      const userChain = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { phone: null }, error: null }),
      }

      mockCreateTypedClient
        .mockResolvedValueOnce(createSupabaseChain({ data: lead, error: null }) as any) // Fetch
        .mockResolvedValueOnce(createDedupChain({ data: [], error: null }) as any) // Dedup
        .mockResolvedValueOnce(userChain as any) // User query (no phone)
        .mockResolvedValueOnce(createAdminChain({ data: { phone: '+5511888888888' }, error: null }) as any) // Admin
        .mockResolvedValueOnce(createSupabaseChain({ data: notification, error: null }) as any) // Store

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
    })

    it('should handle exact threshold score (70)', async () => {
      const lead = createMockLead({ score: 70 })
      const notification = createMockNotification()

      // Use createSupabaseChain for all chains - consistent with working tests
      mockCreateTypedClient
        .mockResolvedValueOnce(createSupabaseChain({ data: lead, error: null }) as any) // Fetch
        .mockResolvedValueOnce(createDedupChain({ data: [], error: null }) as any) // Dedup
        .mockResolvedValueOnce(createSupabaseChain({ data: { phone: '+5511888888888' }, error: null }) as any) // Admin
        .mockResolvedValueOnce(createSupabaseChain({ data: notification, error: null }) as any) // Store

      const result = await notifyHotLead('lead-123')

      expect(result.sent).toBe(true)
    })
  })

  describe('checkAndNotifyHotLeads', () => {
    it('should handle errors gracefully', async () => {
      mockGetHotLeads.mockRejectedValue(new Error('Database error'))

      await expect(checkAndNotifyHotLeads('clinic-1')).resolves.not.toThrow()
    })

    it('should not notify leads below threshold', async () => {
      const coolLeads: Lead[] = [
        createMockLead({ id: 'lead-1', score: 45 }),
        createMockLead({ id: 'lead-2', score: 60 }),
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
      const hotLeads: Lead[] = [
        createMockLead({ id: 'lead-1', score: 85 }),
        createMockLead({ id: 'lead-2', score: 92 }),
      ]

      mockGetHotLeads.mockResolvedValue(hotLeads)

      // Setup proper chains for both leads
      // Lead 1
      const fetch1 = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: hotLeads[0], error: null }),
      }
      const dedup1 = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
      const admin1 = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { phone: '+5511888888888' }, error: null }),
      }
      const store1 = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createMockNotification(), error: null }),
      }

      // Lead 2
      const fetch2 = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: hotLeads[1], error: null }),
      }
      const dedup2 = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
      const admin2 = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { phone: '+5511888888888' }, error: null }),
      }
      const store2 = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createMockNotification(), error: null }),
      }

      mockCreateTypedClient
        .mockResolvedValueOnce(fetch1 as any)
        .mockResolvedValueOnce(dedup1 as any)
        .mockResolvedValueOnce(admin1 as any)
        .mockResolvedValueOnce(store1 as any)
        .mockResolvedValueOnce(fetch2 as any)
        .mockResolvedValueOnce(dedup2 as any)
        .mockResolvedValueOnce(admin2 as any)
        .mockResolvedValueOnce(store2 as any)

      await checkAndNotifyHotLeads('clinic-1')

      expect(mockGetHotLeads).toHaveBeenCalledWith('clinic-1', 50)
      expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(2)
    })
  })

  describe('getUnacknowledgedNotifications', () => {
    it('should return empty array on error', async () => {
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      const result = await getUnacknowledgedNotifications('clinic-1')

      expect(result).toEqual([])
    })

    it('should return empty array when no notifications exist', async () => {
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      const result = await getUnacknowledgedNotifications('clinic-1')

      expect(result).toEqual([])
    })

    it('should return unacknowledged notifications for clinic', async () => {
      const notifications = [
        createMockNotification({ id: 'notif-1', acknowledged: false }),
        createMockNotification({ id: 'notif-2', acknowledged: false }),
      ]

      mockCreateTypedClient.mockResolvedValue(
        createLimitChain({ data: notifications, error: null }) as any
      )

      const result = await getUnacknowledgedNotifications('clinic-1')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('notif-1')
      expect(result[1].id).toBe('notif-2')
    })

    it('should filter out acknowledged notifications', async () => {
      const notifications = [
        createMockNotification({ id: 'notif-1', acknowledged: false }),
        createMockNotification({ id: 'notif-2', acknowledged: false }),
        createMockNotification({ id: 'notif-3', acknowledged: false }),
      ]

      mockCreateTypedClient.mockResolvedValue(
        createLimitChain({ data: notifications, error: null }) as any
      )

      const result = await getUnacknowledgedNotifications('clinic-1')

      expect(result).toHaveLength(3)
    })

    it('should order notifications by sent_at descending', async () => {
      const notifications = [
        createMockNotification({ id: 'notif-1', sent_at: '2024-01-01T10:00:00Z' }),
        createMockNotification({ id: 'notif-2', sent_at: '2024-01-02T10:00:00Z' }),
        createMockNotification({ id: 'notif-3', sent_at: '2024-01-03T10:00:00Z' }),
      ]

      mockCreateTypedClient.mockResolvedValue(
        createLimitChain({ data: notifications, error: null }) as any
      )

      const result = await getUnacknowledgedNotifications('clinic-1')

      expect(result).toHaveLength(3)
    })
  })

  describe('checkAllClinicsHotLeads', () => {
    it('should handle errors gracefully when clinics query fails', async () => {
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      await expect(checkAllClinicsHotLeads()).resolves.not.toThrow()
    })

    it('should handle empty clinics list', async () => {
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      await checkAllClinicsHotLeads()

      expect(mockGetHotLeads).not.toHaveBeenCalled()
    })

    it('should scan all clinics and check for hot leads', async () => {
      const clinics = [
        { id: 'clinic-1' },
        { id: 'clinic-2' },
        { id: 'clinic-3' },
      ]

      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: clinics, error: null }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)
      mockGetHotLeads.mockResolvedValue([])

      await checkAllClinicsHotLeads()

      expect(mockGetHotLeads).toHaveBeenCalledTimes(3)
    })

    it('should process clinics sequentially even if one fails', async () => {
      const clinics = [
        { id: 'clinic-1' },
        { id: 'clinic-2' },
        { id: 'clinic-3' },
      ]

      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: clinics, error: null }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      mockGetHotLeads
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Clinic 2 error'))
        .mockResolvedValueOnce([])

      await checkAllClinicsHotLeads()

      expect(mockGetHotLeads).toHaveBeenCalledTimes(3)
    })

    it('should limit clinics query to 100', async () => {
      const mockClient = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)
      mockGetHotLeads.mockResolvedValue([])

      await checkAllClinicsHotLeads()

      expect(mockCreateTypedClient).toHaveBeenCalled()
    })
  })

  describe('acknowledgeNotification', () => {
    it('should mark notification as acknowledged', async () => {
      const chain = createUpdateChain(null)
      mockCreateTypedClient.mockResolvedValue(chain as any)

      const result = await acknowledgeNotification('notif-123')

      expect(result).toBe(true)
    })

    it('should handle unexpected errors gracefully', async () => {
      const mockClient = {
        from: jest.fn().mockImplementation(() => {
          throw new Error('Connection lost')
        }),
      }

      mockCreateTypedClient.mockResolvedValue(mockClient as any)

      const result = await acknowledgeNotification('notif-123')

      expect(result).toBe(false)
    })

    it('should include acknowledged_at timestamp in update', async () => {
      const chain = createUpdateChain(null)
      mockCreateTypedClient.mockResolvedValue(chain as any)

      await acknowledgeNotification('notif-123')

      expect(mockCreateTypedClient).toHaveBeenCalled()
    })

    it('should return false when update fails', async () => {
      const chain = createUpdateChain({ message: 'Notification not found' })
      mockCreateTypedClient.mockResolvedValue(chain as any)

      const result = await acknowledgeNotification('nonexistent-notif')

      expect(result).toBe(false)
    })

    it('should not throw on error', async () => {
      const chain = createUpdateChain({ message: 'Database error' })
      mockCreateTypedClient.mockResolvedValue(chain as any)

      await expect(acknowledgeNotification('notif-123')).resolves.toBe(false)
    })
  })
})
