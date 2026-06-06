/**
 * Rate Limiter Utility
 * Simple in-memory rate limiting for API routes
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyPrefix?: string // Optional prefix for the key
}

// In-memory store (for production, use Redis)
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every minute
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetTime < now) {
      store.delete(key)
    }
  }
}, 60000)

cleanupInterval.unref?.()

/**
 * Check rate limit for a given key
 * Returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const now = Date.now()
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key
  const entry = store.get(fullKey)

  if (!entry || entry.resetTime < now) {
    // New window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    store.set(fullKey, newEntry)
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    }
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Increment count
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or falls back to a default
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback for development
  return 'unknown'
}

/**
 * Rate limit presets
 */
export const rateLimitPresets = {
  // For webhook endpoints (higher limit)
  webhook: { windowMs: 60000, maxRequests: 100 },

  // For API endpoints (standard limit)
  api: { windowMs: 60000, maxRequests: 60 },

  // For authentication endpoints (stricter)
  auth: { windowMs: 60000, maxRequests: 10 },

  // For message sending (prevent spam)
  messages: { windowMs: 60000, maxRequests: 30 },

  // For cron job endpoints (moderate, authenticated via CRON_SECRET)
  cron: { windowMs: 60000, maxRequests: 20 },
} as const

/**
 * Create rate limit headers
 */
export function createRateLimitHeaders(
  remaining: number,
  resetTime: number,
  limit: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  }
}