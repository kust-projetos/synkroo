/** Tests for knowledge/search route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
const mockCheckRateLimit = jest.fn()
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
  rateLimitPresets: { api: { windowMs: 60_000, maxRequests: 60 } },
}))
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  dbLogger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))
jest.mock('@/repositories/knowledge', () => ({ searchKnowledgeBase: jest.fn() }))
const { searchKnowledgeBase } = require('@/repositories/knowledge')

const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
beforeEach(() => {
  jest.clearAllMocks()
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetTime: Date.now() + 60_000 })
})

import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { POST } from '../../../../app/api/knowledge/search/route'

describe('knowledge/search', () => {
  it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(401); const b = await r.json(); expect(b.error.code).toBe('UNAUTHORIZED'); expect(b.error.requestId).toEqual(expect.any(String)) })
  it('returns 400 for missing query', async () => { authOk(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(400); const b = await r.json(); expect(b.error.code).toBe('INVALID_INPUT'); expect(b.error.requestId).toEqual(expect.any(String)) })
  it('searches successfully', async () => { authOk(); searchKnowledgeBase.mockResolvedValue([{ id: 'k1', relevance: 0.9 }]); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); const b = await r.json(); expect(b.data.results).toHaveLength(1) })
  it('returns empty', async () => { authOk(); searchKnowledgeBase.mockResolvedValue([]); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); const b = await r.json(); expect(b.data.results).toEqual([]); expect(b.data.count).toBe(0) })
  it('returns 500 envelope and logs on service failure', async () => { authOk(); const boom = new Error('boom'); searchKnowledgeBase.mockRejectedValueOnce(boom); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); expect(r.status).toBe(500); expect(await r.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: expect.any(String) } }); expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('knowledge/search'), boom, expect.objectContaining({ requestId: expect.any(String) })) })
  it('returns 429 with Retry-After when the tenant bucket is exhausted (auth before limiter)', async () => { authOk(); mockCheckRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() + 60_000, retryAfter: 20 }); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); expect(r.status).toBe(429); expect(r.headers.get('Retry-After')).toBe('20'); const b = await r.json(); expect(b.error.code).toBe('TOO_MANY_REQUESTS'); expect(b.error.requestId).toEqual(expect.any(String)); expect(searchKnowledgeBase).not.toHaveBeenCalled() })
  it('does not consume quota on 401 (limiter after auth)', async () => { authFail(); mockCheckRateLimit.mockClear(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ query: 'test' }) })); expect(r.status).toBe(401); expect(mockCheckRateLimit).not.toHaveBeenCalled() })
})
