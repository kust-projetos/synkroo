/**
 * Jest setup file
 */

// Extend Jest matchers
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.MINIMAX_API_KEY = 'test-minimax-key'
process.env.MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
process.env.MINIMAX_MODEL = 'abab6.5s-chat'
process.env.WHATSAPP_VERIFY_TOKEN = 'synkroo_webhook_token'
process.env.WHATSAPP_APP_SECRET = 'test-app-secret'
process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
process.env.INSTAGRAM_VERIFY_TOKEN = 'synkroo_instagram_token'
process.env.INSTAGRAM_ACCESS_TOKEN = 'test-instagram-token'
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test'

// Mock fetch globally
global.fetch = jest.fn()

// Import shared mock and wire into the module system
import { mockDb } from './src/test-utils/db-mock'

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDb),
  closeDb: jest.fn(),
}))

// Suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}