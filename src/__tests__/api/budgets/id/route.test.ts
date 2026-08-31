/** Tests for budgets/[id] route — financeiro legacy adapter (T5 strangler via Actions) */
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
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  })),
  setDbConnectionString: jest.fn(),
}))
jest.mock('@/lib/errors', () => ({
  handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })),
  ValidationError: class extends Error { constructor(msg: string, _ctx?: any) { super(msg) } },
}))
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudgetForClinic: jest.fn(),
  getBudget: jest.fn(),
}))
jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  updateBudget: jest.fn(),
  deleteBudgetDb: jest.fn(),
}))

const { buildUserContext } = require('@/core/actions/context')
const { getBudgetForClinic } = require('@/modules/financeiro/services/budget-service')
const { updateBudget } = require('@/modules/financeiro/repositories/financeiro-repository')

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', id: 'u1', role: 'admin' } })
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

function mkBudget(over: any = {}) {
  return { id: '00000000-0000-0000-0000-000000000001', clinicId: 'c1', patientId: 'p1', status: 'pending', total: 100, ...over }
}

import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../../../../app/api/budgets/[id]/route'

const BUDGET_UUID = '00000000-0000-0000-0000-000000000001'

describe('budgets/[id]', () => {
  describe('GET', () => {
    it('returns 401', async () => {
      authFail()
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: BUDGET_UUID }) })
      expect(r.status).toBe(401)
    })
    it('returns budget', async () => {
      authOk()
      ;(getBudgetForClinic as jest.Mock).mockResolvedValue(mkBudget())
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: BUDGET_UUID }) })
      const b = await r.json()
      expect(b.budget.id).toBe(BUDGET_UUID)
    })
    it('returns 404', async () => {
      authOk()
      ;(getBudgetForClinic as jest.Mock).mockResolvedValue(undefined)
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: BUDGET_UUID }) })
      expect(r.status).toBe(404)
    })
  })
  describe('PUT', () => {
    it('returns 401', async () => {
      authFail()
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({}) }), { params: Promise.resolve({ id: BUDGET_UUID }) })
      expect(r.status).toBe(401)
    })
    it('updates budget', async () => {
      authOk()
      ;(getBudgetForClinic as jest.Mock).mockResolvedValue(mkBudget())
      ;(updateBudget as jest.Mock).mockResolvedValue(mkBudget({ status: 'accepted' }))
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({ status: 'accepted' }) }), { params: Promise.resolve({ id: BUDGET_UUID }) })
      const b = await r.json()
      expect(b.budget.status).toBe('accepted')
    })
  })
  describe('DELETE', () => {
    it('returns 401', async () => {
      authFail()
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: BUDGET_UUID }) })
      expect(r.status).toBe(401)
    })
    it('archives budget', async () => {
      authOk()
      ;(getBudgetForClinic as jest.Mock).mockResolvedValue(mkBudget())
      ;(updateBudget as jest.Mock).mockResolvedValue(mkBudget({ status: 'archived' }))
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: BUDGET_UUID }) })
      const b = await r.json()
      expect(b.success).toBe(true)
    })
  })
})