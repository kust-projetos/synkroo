/** Tests for knowledge/search route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/lib/errors', () => ({ handleApiError: jest.fn((e: any) => new Response(JSON.stringify({ error: 'Internal' }), { status: 500 })) }))
jest.mock('@/repositories/knowledge', () => ({ searchKnowledgeBase: jest.fn() }))
const { searchKnowledgeBase } = require('@/repositories/knowledge')

const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/knowledge/search/route'

describe('knowledge/search', () => {
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(401) })
  it('returns 400 for missing query', async () => { authOk(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(400) })
  it('searches successfully', async () => { authOk(); searchKnowledgeBase.mockResolvedValue([{ id: 'k1', relevance: 0.9 }]); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); const b = await r.json(); expect(b.results).toHaveLength(1) })
  it('returns empty', async () => { authOk(); searchKnowledgeBase.mockResolvedValue([]); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); const b = await r.json(); expect(b.results).toEqual([]); expect(b.count).toBe(0) })
})
