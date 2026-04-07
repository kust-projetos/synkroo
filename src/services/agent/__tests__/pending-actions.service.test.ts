/**
 * Tests for Pending Actions Service
 * Tests undo/rollback flow for agent actions
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { PendingActionsService } from '../pending-actions.service'

describe('Pending Actions Service', () => {
  let service: PendingActionsService
  const mockClient = { from: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
    service = new PendingActionsService()
  })

  describe('createAction', () => {
    it('should create a pending action with undo deadline', async () => {
      const mockAction = {
        id: 'action-1',
        action_type: 'cancel_appointment',
        status: 'pending',
        undo_deadline: new Date(Date.now() + 5 * 60_000).toISOString(),
      }

      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockAction, error: null }),
          }),
        }),
      })

      const result = await service.createAction({
        clinicId: 'clinic-1',
        actionType: 'cancel_appointment',
        riskScore: 0.7,
        riskLevel: 'MEDIUM',
      })

      expect(result).toEqual(mockAction)
    })

    it('should throw on insert error', async () => {
      mockClient.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      })

      await expect(
        service.createAction({
          clinicId: 'clinic-1',
          actionType: 'cancel',
          riskScore: 0.5,
          riskLevel: 'LOW',
        })
      ).rejects.toBeDefined()
    })
  })

  describe('confirmAction', () => {
    it('should confirm action when count reaches max', async () => {
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { confirmation_count: 0, max_confirmations: 1 },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await service.confirmAction('action-1')

      expect(result.confirmed).toBe(true)
      expect(result.requiresMore).toBe(false)
    })

    it('should require more confirmations when count < max', async () => {
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { confirmation_count: 0, max_confirmations: 2 },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await service.confirmAction('action-1')

      expect(result.confirmed).toBe(false)
      expect(result.requiresMore).toBe(true)
    })
  })

  describe('executeAction', () => {
    it('should execute a pending action', async () => {
      const futureDeadline = new Date(Date.now() + 5 * 60_000).toISOString()
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { undo_deadline: futureDeadline },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const result = await service.executeAction('action-1')

      expect(result.executed).toBe(true)
      expect(result.undoDeadline.getTime()).toBeGreaterThan(0)
    })

    it('should return not executed on error', async () => {
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        }),
      })

      const result = await service.executeAction('action-1')

      expect(result.executed).toBe(false)
    })
  })

  describe('undoAction', () => {
    it('should undo action within undo window', async () => {
      const futureDeadline = new Date(Date.now() + 5 * 60_000).toISOString()
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { status: 'executed', undo_deadline: futureDeadline, undo_payload: { status: 'scheduled' } },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await service.undoAction('action-1')

      expect(result.undone).toBe(true)
      expect(result.restored).toEqual({ status: 'scheduled' })
    })

    it('should not undo if deadline has passed', async () => {
      const pastDeadline = new Date(Date.now() - 10 * 60_000).toISOString()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { status: 'executed', undo_deadline: pastDeadline, undo_payload: {} },
              error: null,
            }),
          }),
        }),
      })

      const result = await service.undoAction('action-1')

      expect(result.undone).toBe(false)
    })

    it('should not undo if not in executed state', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { status: 'pending', undo_deadline: new Date().toISOString(), undo_payload: {} },
              error: null,
            }),
          }),
        }),
      })

      const result = await service.undoAction('action-1')

      expect(result.undone).toBe(false)
    })
  })

  describe('expireOldActions', () => {
    it('should expire actions past undo deadline', async () => {
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: [{ id: 'a1' }, { id: 'a2' }],
                error: null,
              }),
            }),
          }),
        }),
      })

      const count = await service.expireOldActions()
      expect(count).toBe(2)
    })

    it('should return 0 on error', async () => {
      mockClient.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Query failed' },
              }),
            }),
          }),
        }),
      })

      const count = await service.expireOldActions()
      expect(count).toBe(0)
    })
  })
})
