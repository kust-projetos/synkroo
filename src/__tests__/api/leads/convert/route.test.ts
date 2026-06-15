const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/services/leads/leads.service', () => ({ convertLeadToPatient: jest.fn() }))
const { convertLeadToPatient } = require('@/services/leads/leads.service')

const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/leads/[id]/convert/route'

describe('leads/[id]/convert', () => {
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(401) })
  it('returns 400 for missing patient_id', async () => { authOk(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(400) })
  it('converts successfully', async () => { authOk(); convertLeadToPatient.mockResolvedValue(true); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ patient_id: 'p1' }) }), { params: Promise.resolve({ id: 'l1' }) }); const b = await r.json(); expect(b.success).toBe(true) })
  it('returns 500 on failure', async () => { authOk(); convertLeadToPatient.mockResolvedValue(false); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ patient_id: 'p1' }) }), { params: Promise.resolve({ id: 'l1' }) }); expect(r.status).toBe(500) })
})
