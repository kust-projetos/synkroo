/** Tests for budgets/[id] route — financeiro legacy adapter */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/lib/errors', () => ({
  handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })),
  ValidationError: class extends Error { constructor(msg: string, _ctx?: any) { super(msg) } },
}))
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudget: jest.fn(),
}))
jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  updateBudget: jest.fn(),
  deleteBudgetDb: jest.fn(),
}))

const { getBudget } = require('@/modules/financeiro/services/budget-service')
const { updateBudget, deleteBudgetDb } = require('@/modules/financeiro/repositories/financeiro-repository')

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', id: 'u1', role: 'admin' } })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
}
beforeEach(() => { jest.clearAllMocks() })

function mkBudget(over: any = {}) {
  return { id: 'b1', clinicId: 'c1', patientId: 'p1', status: 'pending', total: 100, ...over }
}

import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../../../../app/api/budgets/[id]/route'

describe('budgets/[id]', () => {
  describe('GET', () => {
    it('returns 401', async () => {
      authFail()
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) })
      expect(r.status).toBe(401)
    })
    it('returns budget', async () => {
      authOk()
      ;(getBudget as jest.Mock).mockResolvedValue(mkBudget())
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) })
      const b = await r.json()
      expect(b.budget.id).toBe('b1')
    })
    it('returns 404', async () => {
      authOk()
      ;(getBudget as jest.Mock).mockResolvedValue(undefined)
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) })
      expect(r.status).toBe(404)
    })
  })
  describe('PUT', () => {
    it('returns 401', async () => {
      authFail()
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'b1' }) })
      expect(r.status).toBe(401)
    })
    it('updates budget', async () => {
      authOk()
      ;(getBudget as jest.Mock).mockResolvedValue(mkBudget())
      ;(updateBudget as jest.Mock).mockResolvedValue(mkBudget({ status: 'accepted' }))
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({ status: 'accepted' }) }), { params: Promise.resolve({ id: 'b1' }) })
      const b = await r.json()
      expect(b.budget.status).toBe('accepted')
    })
  })
  describe('DELETE', () => {
    it('returns 401', async () => {
      authFail()
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) })
      expect(r.status).toBe(401)
    })
    it('deletes budget', async () => {
      authOk()
      ;(getBudget as jest.Mock).mockResolvedValue(mkBudget())
      ;(deleteBudgetDb as jest.Mock).mockResolvedValue(true)
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'b1' }) })
      const b = await r.json()
      expect(b.success).toBe(true)
    })
  })
})
