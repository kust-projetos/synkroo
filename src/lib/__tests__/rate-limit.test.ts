/**
 * Tests for Rate Limiting Utility
 */

import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
  testLimiter,
} from '@/lib/rate-limit'

describe('Rate Limiting Utility', () => {
  // Use real timers since implementation uses Date.now() directly
  // and the store persists between tests
  let testKeyCounter = 0

  beforeEach(() => {
    testKeyCounter++
  })

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result = checkRateLimit(`test-key-${testKeyCounter}`, {
        windowMs: 60000,
        maxRequests: 5,
      })

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should track multiple requests', () => {
      const key = `test-key-track-${testKeyCounter}`
      const config = { windowMs: 60000, maxRequests: 3 }

      const r1 = checkRateLimit(key, config)
      expect(r1.allowed).toBe(true)
      expect(r1.remaining).toBe(2)

      const r2 = checkRateLimit(key, config)
      expect(r2.allowed).toBe(true)
      expect(r2.remaining).toBe(1)

      const r3 = checkRateLimit(key, config)
      expect(r3.allowed).toBe(true)
      expect(r3.remaining).toBe(0)

      const r4 = checkRateLimit(key, config)
      expect(r4.allowed).toBe(false)
      expect(r4.remaining).toBe(0)
      expect(r4.allowed === false ? r4.retryAfter : undefined).toBeDefined()
    })

    it('should reset after window expires', async () => {
      const key = `test-key-reset-${testKeyCounter}`
      const config = { windowMs: 100, maxRequests: 2 }

      // Use up the limit
      checkRateLimit(key, config)
      checkRateLimit(key, config)

      // Should be blocked
      const blocked = checkRateLimit(key, config)
      expect(blocked.allowed).toBe(false)

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be allowed again
      const allowed = checkRateLimit(key, config)
      expect(allowed.allowed).toBe(true)
      expect(allowed.remaining).toBe(1)
    })

    it('should use key prefix', () => {
      const key = `test-key-prefix-${testKeyCounter}`
      const config = { windowMs: 60000, maxRequests: 5, keyPrefix: 'prefix' }

      checkRateLimit(key, config)
      checkRateLimit(key, config)

      // Different prefix should be tracked separately
      const config2 = { windowMs: 60000, maxRequests: 5, keyPrefix: 'other' }
      const result = checkRateLimit(key, config2)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })
  })

  describe('test isolation', () => {
    it('resets limiter only through the test dependency', () => {
      const key = `test-reset-${testKeyCounter}`
      checkRateLimit(key, rateLimitPresets.auth)
      testLimiter.reset()
      expect(testLimiter.remaining(key, rateLimitPresets.auth)).toBe(rateLimitPresets.auth.maxRequests)
    })
  })

  describe('getClientIdentifier', () => {
    it('should use x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      })

      const id = getClientIdentifier(request)
      expect(id).toBe('192.168.1.1')
    })

    it('should use x-real-ip header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-real-ip': '192.168.1.2' },
      })

      const id = getClientIdentifier(request)
      expect(id).toBe('192.168.1.2')
    })

    it('should fallback to unknown', () => {
      const request = new Request('http://localhost')
      const id = getClientIdentifier(request)
      expect(id).toBe('unknown')
    })
  })

  describe('rateLimitPresets', () => {
    it('should have correct webhook preset', () => {
      expect(rateLimitPresets.webhook).toEqual({
        windowMs: 60000,
        maxRequests: 100,
      })
    })

    it('should have correct auth preset', () => {
      expect(rateLimitPresets.auth).toEqual({
        windowMs: 60000,
        maxRequests: 10,
      })
    })

    it('should have correct messages preset', () => {
      expect(rateLimitPresets.messages).toEqual({
        windowMs: 60000,
        maxRequests: 30,
      })
    })
  })

  describe('createRateLimitHeaders', () => {
    it('should create correct headers', () => {
      const resetTime = Math.floor(Date.now() / 1000) + 60
      const headers = createRateLimitHeaders(5, resetTime * 1000, 10)

      expect(headers['X-RateLimit-Limit']).toBe('10')
      expect(headers['X-RateLimit-Remaining']).toBe('5')
      expect(parseInt(headers['X-RateLimit-Reset'])).toBe(resetTime)
    })
  })
})