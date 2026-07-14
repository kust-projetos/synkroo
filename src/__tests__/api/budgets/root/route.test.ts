/** Tests for budgets/route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
import { buildUserContext } from '@/core/actions/context'
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })), ValidationError: class extends Error { constructor(msg: string, ctx?: any) { super(msg) } } }))
jest.mock('@/lib/rate-limit', () => ({ checkRateLimit: jest.fn().mockReturnValue({ allowed: true }), getClientIdentifier: jest.fn().mockReturnValue('test'), rateLimitPresets: { api: {} } }))
jest.mock('@/lib/validations', () => ({ createBudgetSchema: { parse: jest.fn((b: any) => b) } }))
jest.mock('@/services/budgets/budget.service', () => ({ listBudgets: jest.fn(), createBudget: jest.fn(), getBudgetStats: jest.fn() }))

const { listBudgets, createBudget, getBudgetStats } = require('@/services/budgets/budget.service')
const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', id: 'u1' } })
  ;(buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user', clinicId: 'c1', user: { id: 'u1', email: 'u@x.com', name: 'U' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' },
  })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
  ;(buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'))
}
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET, POST } from '../../../../app/api/budgets/route'

describe('budgets/route', () => {
  describe('GET', () => {
    it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(401) })
    it('lists budgets', async () => { authOk(); listBudgets.mockResolvedValue([{ id: 'b1' }]); const r = await GET(new NextRequest('http://localhost')); const b = await r.json(); expect(b.budgets).toHaveLength(1) })
    it('returns stats', async () => { authOk(); getBudgetStats.mockResolvedValue({ total: 5 }); const r = await GET(new NextRequest('http://localhost?stats=true')); const b = await r.json(); expect(b.stats.total).toBe(5) })
  })
  describe('POST', () => {
    it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(401) })
    it('creates budget', async () => { authOk(); createBudget.mockResolvedValue({ id: 'b1' }); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ patient_id: 'p1', title: 'Budget' }) })); expect(r.status).toBe(201) })
  })
})
