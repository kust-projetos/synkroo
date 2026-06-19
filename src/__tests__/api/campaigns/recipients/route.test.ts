const mockValidateApiAuth = jest.fn(); const mockHasRequiredRole = jest.fn().mockReturnValue(true)
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth, hasRequiredRole: mockHasRequiredRole }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })), ValidationError: class extends Error { constructor(msg: string) { super(msg) } } }))
jest.mock('@/services/followup/campaign.service', () => ({ addCampaignRecipients: jest.fn() }))
jest.mock('@/services/followup/inactive-patient.service', () => ({ getPatientsForReactivation: jest.fn() }))
jest.mock('@/repositories/campaigns', () => ({ findCampaignById: jest.fn() }))
const { addCampaignRecipients } = require('@/services/followup/campaign.service')
const { findCampaignById } = require('@/repositories/campaigns')
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', role: 'admin' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { jest.clearAllMocks(); mockHasRequiredRole.mockReturnValue(true) })
import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/campaigns/[id]/recipients/route'

describe('campaigns/[id]/recipients', () => {
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(401) })
  it('returns 403 for no role', async () => { authOk(); mockHasRequiredRole.mockReturnValue(false); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(403) })
  it('returns 404', async () => { authOk(); findCampaignById.mockResolvedValue(null); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(404) })
  it('adds recipients', async () => { authOk(); findCampaignById.mockResolvedValue({ clinicId: 'c1', status: 'draft' }); addCampaignRecipients.mockResolvedValue({ added: 3 }); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ patient_ids: ['p1','p2','p3'] }) }), { params: Promise.resolve({ id: 'c1' }) }); const b = await r.json(); expect(b.added).toBe(3) })
})
