const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }))

import { buildUserContext } from '@/core/actions/context'
import { runAction } from '@/core/actions/run'

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
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
import { GET, PUT, DELETE } from '../../../../app/api/leads/[id]/route'

describe('leads/[id]', () => {
  describe('GET', () => {
    it('returns 401', async () => {
      authFail()
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) })
      expect(r.status).toBe(401)
    })
    it('returns lead', async () => {
      authOk()
      ;(runAction as jest.Mock).mockResolvedValue({
        ok: true,
        data: { lead: { id: 'l1', name: 'Test', clinicId: 'c1', patientId: null, status: 'novo' } },
      })
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) })
      const b = await r.json()
      expect(b.data.lead.id).toBe('l1')
    })
    it('returns 404', async () => {
      authOk()
      ;(runAction as jest.Mock).mockResolvedValue({
        ok: false,
        error: { code: 'not_found', message: 'Lead not found' },
      })
      const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) })
      expect(r.status).toBe(404)
    })
  })
  describe('PUT', () => {
    it('returns 401', async () => {
      authFail()
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'l1' }) })
      expect(r.status).toBe(401)
    })
    it('updates status', async () => {
      authOk()
      ;(runAction as jest.Mock).mockResolvedValue({
        ok: true,
        data: { lead: { id: 'l1', status: 'qualified' } },
      })
      const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({ status: 'qualified' }) }), { params: Promise.resolve({ id: 'l1' }) })
      const b = await r.json()
      expect(b.data.lead.status).toBe('qualified')
    })
  })
  describe('DELETE', () => {
    it('returns 401', async () => {
      authFail()
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) })
      expect(r.status).toBe(401)
    })
    it('archives lead', async () => {
      authOk()
      ;(runAction as jest.Mock).mockResolvedValue({
        ok: true,
        data: { success: true },
      })
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) })
      const b = await r.json()
      expect(b.data.success).toBe(true)
    })
  })
})
