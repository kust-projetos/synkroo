/**
 * Application Configuration Constants
 * Single source of truth for all configurable values.
 */

export const APP = {
  name: 'Synkroo',
  version: process.env.npm_package_version || '1.0.0',
} as const

export const SCHEDULING = {
  /** Default appointment duration in minutes */
  defaultDuration: 30,
  /** Slot interval in minutes */
  slotInterval: 30,
} as const

export const META_API = {
  /** Graph API base URL */
  baseUrl: 'https://graph.facebook.com',
  /** API version - update when Meta releases new versions */
  version: 'v18.0',
  /** 24h messaging window for Instagram */
  messagingWindowHours: 24,
} as const

export const RATE_LIMITS = {
  /** Default rate limit window in ms */
  windowMs: 60_000,
  /** Default max requests per window */
  maxRequests: 100,
  /** Webhook-specific limits */
  webhook: { windowMs: 60_000, maxRequests: 200 },
  /** Message sending limits */
  messages: { windowMs: 60_000, maxRequests: 30 },
  /** Auth endpoint limits */
  auth: { windowMs: 15 * 60_000, maxRequests: 10 },
} as const

export const PAGINATION = {
  /** Default page size */
  defaultLimit: 50,
  /** Maximum page size allowed */
  maxLimit: 100,
} as const

export const WHATSAPP = {
  /** Session storage path */
  sessionPath: './.whatsapp-session',
  /** Connection polling interval in ms */
  pollInterval: 5_000,
} as const

export const LEADS = {
  /** Score threshold for "hot" leads */
  hotThreshold: 70,
} as const

export const EMBEDDINGS = {
  /** Embedding dimensions for text models */
  dimensions: 1536,
} as const
