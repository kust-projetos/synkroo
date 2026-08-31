/** Tests for budgets root route — financeiro legacy adapter (T5 strangler via Actions) */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/actions/context', () => ({ buildUserContext: jest.fn() }))
jest.mock('@/core/actions/audit-writer', () => ({
  writeActionLog: jest.fn().mockResolvedValue(undefined),
  allowlistInput: (i: any) => i,
}))
jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  })),
  setDbConnectionString: jest.fn(),
}))
jest.mock('@/lib/errors', () => ({
  handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })),
  ValidationError: class extends Error { constructor(msg: string, _ctx?: any) { super(msg) } },
}))
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  listBudgets: jest.fn(),
  createBudget: jest.fn(),
}))

const { buildUserContext } = require('@/core/actions/context')
const { listBudgets, createBudget } = require('@/modules/financeiro/services/budget-service')

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', id: 'u1' } })
  ;(buildUserContext as jest.Mock).mockResolvedValue({
    clinicId: 'c1', user: { id: 'u1', email: 'u@x.com', name: 'U' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' }, source: 'user',
  })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
  ;(buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'))
}
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET, POST } from '../../../../app/api/budgets/route'

describe('budgets', () => {
  describe('GET', () => {
    it('returns 401', async () => {
      authFail()
      const r = await GET(new NextRequest('http://localhost'))
      expect(r.status).toBe(401)
    })
    it('lists budgets', async () => {
      authOk()
      ;(listBudgets as jest.Mock).mockResolvedValue([{ id: 'b1' }])
      const r = await GET(new NextRequest('http://localhost'))
      const b = await r.json()
      expect(b.budgets).toHaveLength(1)
    })
  })
  describe('POST', () => {
    it('returns 401', async () => {
      authFail()
      const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }))
      expect(r.status).toBe(401)
    })
    it('creates budget', async () => {
      authOk()
      ;(createBudget as jest.Mock).mockResolvedValue({ id: 'b1', clinicId: 'c1' })
      const r = await POST(new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: '00000000-0000-4000-8000-000000000001',
          title: 'Budget',
          items: [{ procedure_name: 'Consulta', unit_price: 100 }],
        }),
      }))
      expect(r.status).toBe(201)
    })
  })
})