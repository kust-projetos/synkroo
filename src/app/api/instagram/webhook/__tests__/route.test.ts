/**
 * Tests for Instagram Webhook API
 */

import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { POST, GET } from '@/app/api/instagram/webhook/route'

const APP_SECRET = 'test-app-secret-at-least-32-chars!!'
const signBody = (body: string | Buffer) =>
  `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`

jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: { isEnabled: jest.fn().mockResolvedValue(true), enabledModules: jest.fn() },
}))

// Mock rate-limit to always allow
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({
    allowed: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
  })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: {
    webhook: { windowMs: 60000, maxRequests: 100 },
    api: { windowMs: 60000, maxRequests: 60 },
    auth: { windowMs: 60000, maxRequests: 10 },
    messages: { windowMs: 60000, maxRequests: 30 },
  },
  createRateLimitHeaders: jest.fn(() => ({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
  })),
}))

describe('Instagram Webhook API', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      // Note: The route uses default 'synkroo_instagram_token' if INSTAGRAM_VERIFY_TOKEN is not set
      // Since modules are loaded before beforeEach runs, we need to use the default token
      INSTAGRAM_ACCESS_TOKEN: 'test_instagram_access',
      INSTAGRAM_ACCOUNT_ID: 'test_account_id',
      NODE_ENV: 'development',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('GET - Webhook Verification', () => {
    it('should verify webhook with correct token', async () => {
      const url = new URL(
        'http://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=synkroo_instagram_token&hub.challenge=challenge_code'
      )
      const request = new NextRequest(url)

      const response = await GET(request)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('challenge_code')
    })

    it('should reject verification with wrong token', async () => {
      const url = new URL(
        'http://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=challenge_code'
      )
      const request = new NextRequest(url)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data).toHaveProperty('error')
    })
  })

  describe('POST - Message Reception', () => {
    beforeEach(() => {
      process.env.INSTAGRAM_APP_SECRET = APP_SECRET
    })

    it('should ignore non-Instagram payloads', async () => {
      const payload = {
        object: 'other_platform',
        entry: [],
      }
      const body = JSON.stringify(payload)

      const url = new URL('http://localhost/api/instagram/webhook')
      const request = new NextRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signBody(body),
        },
        body,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status', 'ignored')
    })
  })
})