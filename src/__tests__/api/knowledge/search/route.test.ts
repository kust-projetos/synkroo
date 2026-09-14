/** Tests for knowledge/search route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  dbLogger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))
jest.mock('@/repositories/knowledge', () => ({ searchKnowledgeBase: jest.fn() }))
const { searchKnowledgeBase } = require('@/repositories/knowledge')

const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { POST } from '../../../../app/api/knowledge/search/route'

describe('knowledge/search', () => {
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(401); const b = await r.json(); expect(b.error.code).toBe('UNAUTHORIZED'); expect(b.error.requestId).toEqual(expect.any(String)) })
  it('returns 400 for missing query', async () => { authOk(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(400); const b = await r.json(); expect(b.error.code).toBe('INVALID_INPUT'); expect(b.error.requestId).toEqual(expect.any(String)) })
  it('searches successfully', async () => { authOk(); searchKnowledgeBase.mockResolvedValue([{ id: 'k1', relevance: 0.9 }]); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); const b = await r.json(); expect(b.data.results).toHaveLength(1) })
  it('returns empty', async () => { authOk(); searchKnowledgeBase.mockResolvedValue([]); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); const b = await r.json(); expect(b.data.results).toEqual([]); expect(b.data.count).toBe(0) })
  it('returns 500 envelope and logs on service failure', async () => { authOk(); const boom = new Error('boom'); searchKnowledgeBase.mockRejectedValueOnce(boom); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); expect(r.status).toBe(500); expect(await r.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: expect.any(String) } }); expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('knowledge/search'), boom, expect.objectContaining({ requestId: expect.any(String) })) })
})
