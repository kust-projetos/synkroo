const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (h: unknown) => h }))
jest.mock('@/services/followup/campaign.service', () => ({ startCampaign: jest.fn() }))
jest.mock('@/repositories/campaigns', () => ({ findCampaignById: jest.fn() }))
const { startCampaign } = require('@/services/followup/campaign.service')
const { findCampaignById } = require('@/repositories/campaigns')
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1', role: 'admin' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/campaigns/[id]/start/route'

describe('campaigns/[id]/start', () => {
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(401) })
  it('returns 403 for insufficient permission', async () => { mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Insufficient permissions', status: 403 } }); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(403) })
  it('returns 404 for missing campaign', async () => { authOk(); findCampaignById.mockResolvedValue(null); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(404) })
  it('returns 400 for invalid state', async () => { authOk(); findCampaignById.mockResolvedValue({ clinicId: 'c1', status: 'active' }); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'c1' }) }); expect(r.status).toBe(400) })
  it('starts campaign successfully', async () => { authOk(); findCampaignById.mockResolvedValue({ clinicId: 'c1', status: 'draft' }); startCampaign.mockResolvedValue({ success: true }); const r = await POST(new NextRequest('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: 'c1' }) }); const b = await r.json(); expect(b.data.success).toBe(true) })
})
