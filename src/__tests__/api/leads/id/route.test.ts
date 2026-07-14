const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
import { buildUserContext } from '@/core/actions/context'
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })), ValidationError: class extends Error { constructor(msg: string, ctx?: any) { super(msg) } } }))
jest.mock('@/lib/validations', () => ({ updateLeadSchema: { parse: jest.fn((b: any) => b) } }))
jest.mock('@/services/leads/leads.service', () => ({ updateLeadStatus: jest.fn(), qualifyLead: jest.fn() }))
jest.mock('@/repositories/leads', () => ({ updateLead: jest.fn() }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }), limit: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
const { updateLeadStatus, qualifyLead } = require('@/services/leads/leads.service')
const { updateLead } = require('@/repositories/leads')
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
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../../../../app/api/leads/[id]/route'

describe('leads/[id]', () => {
  describe('GET', () => {
    it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(401) })
    it('returns lead', async () => { authOk(); seed([{ id: 'l1', name: 'Test', clinicId: 'c1', patientId: null }]); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) }); const b = await r.json(); expect(b.lead.id).toBe('l1') })
    it('returns 404', async () => { authOk(); seed([]); const r = await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(404) })
  })
  describe('PUT', () => {
    it('returns 401', async () => { authFail(); const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(401) })
    it('updates status', async () => { authOk(); updateLeadStatus.mockResolvedValue({ id: 'l1', status: 'qualified' }); const r = await PUT(new NextRequest('http://localhost', { method: 'PUT', body: JSON.stringify({ status: 'qualified' }) }), { params: Promise.resolve({ id: 'l1' }) }); const b = await r.json(); expect(b.lead.status).toBe('qualified') })
  })
  describe('DELETE', () => {
    it('returns 401', async () => { authFail(); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(401) })
    it('archives lead', async () => { authOk(); updateLead.mockResolvedValue({ id: 'l1', status: 'lost' }); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'l1' }) }); const b = await r.json(); expect(b.success).toBe(true) })
  })
})
